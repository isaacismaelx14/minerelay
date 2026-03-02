import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, extname, resolve } from 'node:path';
import {
  BrandingSchema,
  FancyMenuSettingsSchema,
  LockBundleItem,
  ProfileLock,
  ProfileLockSchema,
} from '@mvl/shared';
import type { Request, Response } from 'express';
import { PrismaService } from '../db/prisma.service';
import { SigningService } from '../security/signing.service';
import {
  BuildFancyMenuPreviewDto,
  GenerateLockfileDto,
  InstallModDto,
  PublishProfileDto,
  SaveDraftDto,
  UpdateSettingsDto,
} from './admin.dto';
import {
  BundleSandboxClient,
  SandboxPreviewResponse,
} from './bundle-sandbox.client';
import { CoreModPolicyService, ManagedMod } from './core-mod-policy.service';
import {
  FancyPreviewAssemblerService,
  FancyPreviewModel,
} from './fancy-preview-assembler.service';

import { AdminAuthService } from './auth/admin-auth.service';
import {
  AdminSessionService,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from './auth/admin-session.service';

const ADMIN_CREDENTIAL_ID = 'global';
const APP_SETTING_ID = 'global';
const SUPPORTED_MVP_PLATFORMS = new Set(['fabric']);
const FANCY_MENU_BUNDLE_CONFIG_NAME = 'FancyMenu Custom Bundle';
const MAX_FANCY_BUNDLE_UPLOAD_BYTES = 50 * 1024 * 1024;

interface ModrinthSearchResponse {
  hits: Array<{
    project_id: string;
    title: string;
    description: string;
  }>;
}

interface ModrinthProject {
  id: string;
  title: string;
}

interface ModrinthDependency {
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
  project_id?: string;
  version_id?: string;
}

interface ModrinthVersion {
  id: string;
  name?: string;
  version_type: 'release' | 'beta' | 'alpha';
  date_published: string;
  game_versions: string[];
  loaders: string[];
  dependencies?: ModrinthDependency[];
  files: Array<{
    url: string;
    primary?: boolean;
  }>;
}

interface ResolvedModWithDeps {
  mod: ManagedMod;
  requiredDependencies: string[];
}

interface FabricLoaderRow {
  version: string;
  stable: boolean;
}

type BumpType = 'major' | 'minor' | 'patch';

interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

interface FancyMenuBundleValidation {
  entryCount: number;
  totalUncompressedBytes: number;
}

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly modrinthApiBase = 'https://api.modrinth.com/v2';
  private readonly fabricMetaBase = 'https://meta.fabricmc.net';
  private readonly fabricCache = new Map<
    string,
    { expiresAt: number; value: FabricLoaderRow[] }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly authService: AdminAuthService,
    private readonly sessionService: AdminSessionService,
    private readonly signing: SigningService,
    private readonly sandboxClient: BundleSandboxClient,
    private readonly coreModPolicy: CoreModPolicyService,
    private readonly previewAssembler: FancyPreviewAssemblerService,
  ) {}

  async onModuleInit() {
    await this.ensureAppSettings();
    await this.ensureAdminCredential();
  }

  async login(password: string, request: Request, response: Response) {
    const credential = await this.prisma.adminCredential.findUnique({
      where: { id: ADMIN_CREDENTIAL_ID },
    });

    if (!credential) {
      throw new UnauthorizedException('Admin password is not initialized');
    }

    const valid = await this.authService.verifyPassword(
      password,
      credential.passwordHash,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid admin password');
    }

    const session = await this.sessionService.createSession(request);
    this.sessionService.setSessionCookies(response, session);

    return { success: true };
  }

  async refresh(request: Request, response: Response) {
    const refreshToken = this.sessionService.readCookie(
      request,
      REFRESH_COOKIE,
    );
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const refreshed = await this.sessionService.rotateSession(refreshToken);
    this.sessionService.setSessionCookies(response, refreshed);
    return { success: true };
  }

  async logout(request: Request, response: Response) {
    const accessToken = this.sessionService.readCookie(request, ACCESS_COOKIE);
    const refreshToken = this.sessionService.readCookie(
      request,
      REFRESH_COOKIE,
    );

    await this.sessionService.revokeSession(accessToken, refreshToken);
    this.sessionService.clearSessionCookies(response);
    return { success: true };
  }

  async authenticateRequest(request: Request): Promise<boolean> {
    const accessToken = this.sessionService.readCookie(request, ACCESS_COOKIE);
    if (!accessToken) {
      return false;
    }

    const tokenHash = this.sessionService.hashToken(accessToken);
    const session = await this.prisma.adminSession.findFirst({
      where: {
        accessTokenHash: tokenHash,
        revokedAt: null,
      },
    });

    if (!session) {
      return false;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      return false;
    }

    return true;
  }

  async getBootstrap() {
    const serverId = this.getServerId();
    const [server, latest, settings] = await Promise.all([
      this.prisma.server.findUnique({ where: { id: serverId } }),
      this.prisma.profileVersion.findFirst({
        where: { serverId },
        orderBy: { version: 'desc' },
      }),
      this.getAppSettings(),
    ]);

    if (!server || !latest) {
      throw new NotFoundException(
        `No profile version found for server '${serverId}'`,
      );
    }

    const lock = ProfileLockSchema.parse(latest.lockJson);
    const lockMods = lock.items.filter((item) => item.kind === 'mod');

    const serverFancyMenu = this.extractFancyMenu(server.fancyMenuSettings);
    const profileFancyMenu = this.extractFancyMenu(latest.fancyMenuSettings);
    const lockFancyMenu = this.extractFancyMenu(lock.fancyMenu);
    const activeFancyMenu =
      profileFancyMenu ?? serverFancyMenu ?? lockFancyMenu;
    let normalizedMods = lockMods as ManagedMod[];
    try {
      normalizedMods = await this.coreModPolicy.normalizeMods({
        mods: lockMods as ManagedMod[],
        minecraftVersion: latest.minecraftVersion,
        fancyMenuEnabled: activeFancyMenu?.enabled === true,
        resolveMod: (projectId, minecraftVersion, versionId) =>
          this.resolveCompatibleMod(projectId, minecraftVersion, versionId),
      });
    } catch {
      normalizedMods = lockMods as ManagedMod[];
    }
    const lockBrandingResult = BrandingSchema.safeParse(lock.branding);
    const lockBranding = lockBrandingResult.success
      ? lockBrandingResult.data
      : null;
    const draft = this.extractDraft(settings.publishDraft);

    return {
      server: {
        id: server.id,
        name: server.name,
        address: server.address,
        profileId: server.profileId,
      },
      latestProfile: {
        version: latest.version,
        releaseVersion:
          latest.releaseVersion ??
          this.formatSemver({
            major: settings.releaseMajor,
            minor: settings.releaseMinor,
            patch: settings.releasePatch,
          }),
        minecraftVersion: latest.minecraftVersion,
        loader: latest.loader,
        loaderVersion: latest.loaderVersion,
        mods: normalizedMods,
        fancyMenu: activeFancyMenu,
        coreModPolicy: this.coreModPolicy.buildMetadata(
          activeFancyMenu?.enabled === true,
        ),
        branding: lockBranding,
      },
      appSettings: settings,
      draft,
    };
  }

  async updateSettings(input: UpdateSettingsDto) {
    const cleanVersions = Array.from(
      new Set(
        input.supportedMinecraftVersions
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );

    const cleanPlatforms = Array.from(
      new Set(
        input.supportedPlatforms
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    if (
      !cleanPlatforms.every((platform) => SUPPORTED_MVP_PLATFORMS.has(platform))
    ) {
      throw new BadGatewayException(
        'Only fabric platform is supported for MVP',
      );
    }

    const serverId = this.getServerId();

    const [setting] = await this.prisma.$transaction([
      this.prisma.appSetting.upsert({
        where: { id: APP_SETTING_ID },
        create: {
          id: APP_SETTING_ID,
          supportedMinecraftVersions: cleanVersions,
          supportedPlatforms: cleanPlatforms,
        },
        update: {
          supportedMinecraftVersions: cleanVersions,
          supportedPlatforms: cleanPlatforms,
        },
      }),
      this.prisma.server.update({
        where: { id: serverId },
        data: {
          allowedMinecraftVersions: cleanVersions,
        },
      }),
    ]);

    return {
      supportedMinecraftVersions: setting.supportedMinecraftVersions,
      supportedPlatforms: setting.supportedPlatforms,
      releaseVersion: this.formatSemver({
        major: setting.releaseMajor,
        minor: setting.releaseMinor,
        patch: setting.releasePatch,
      }),
    };
  }

  async saveDraft(input: SaveDraftDto) {
    const serverId = this.getServerId();
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
    });
    if (!server) {
      throw new NotFoundException(`Server '${serverId}' not found`);
    }

    const serverName = input.serverName.trim();
    const serverAddress = input.serverAddress.trim();
    const profileId = input.profileId?.trim();

    const fancyMenu = this.normalizeFancyMenuSettings(input.fancyMenu);

    const branding = BrandingSchema.parse({
      serverName,
      logoUrl: input.branding?.logoUrl?.trim() || undefined,
      backgroundUrl: input.branding?.backgroundUrl?.trim() || undefined,
      newsUrl: input.branding?.newsUrl?.trim() || undefined,
    });

    const setting = await this.prisma.appSetting.upsert({
      where: { id: APP_SETTING_ID },
      create: {
        id: APP_SETTING_ID,
        supportedMinecraftVersions: [],
        supportedPlatforms: ['fabric'],
        releaseMajor: 1,
        releaseMinor: 0,
        releasePatch: 0,
        publishDraft: {
          serverName,
          serverAddress,
          profileId: profileId || null,
          fancyMenu,
          branding,
        } as unknown as object,
      },
      update: {
        publishDraft: {
          serverName,
          serverAddress,
          profileId: profileId || null,
          fancyMenu,
          branding,
        } as unknown as object,
      },
    });

    const draft = this.extractDraft(setting.publishDraft);

    return {
      server: {
        id: server.id,
        name: draft?.serverName || server.name,
        address: draft?.serverAddress || server.address,
        profileId: draft?.profileId || server.profileId,
      },
      releaseVersion: this.formatSemver({
        major: setting.releaseMajor,
        minor: setting.releaseMinor,
        patch: setting.releasePatch,
      }),
      draft,
    };
  }

  async getFabricVersions(minecraftVersion: string) {
    const version = minecraftVersion.trim();
    if (!version) {
      return { minecraftVersion: version, loaders: [], latestStable: null };
    }

    const cached = this.fabricCache.get(version);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        minecraftVersion: version,
        loaders: cached.value,
        latestStable:
          cached.value.find((loader) => loader.stable)?.version ?? null,
      };
    }

    const url = `${this.fabricMetaBase}/v2/versions/loader/${encodeURIComponent(version)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'mvl-admin-mvp/0.2.0',
      },
    });

    if (!response.ok) {
      throw new BadGatewayException(
        `Failed to fetch Fabric versions (${response.status})`,
      );
    }

    const payload = (await response.json()) as Array<{
      loader?: { version?: string; stable?: boolean };
    }>;
    const loaders = payload
      .map((entry) => ({
        version: entry.loader?.version?.trim() ?? '',
        stable: entry.loader?.stable === true,
      }))
      .filter((entry) => entry.version.length > 0)
      .filter(
        (entry, idx, arr) =>
          arr.findIndex((item) => item.version === entry.version) === idx,
      );

    this.fabricCache.set(version, {
      value: loaders,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return {
      minecraftVersion: version,
      loaders,
      latestStable: loaders.find((loader) => loader.stable)?.version ?? null,
    };
  }

  async searchMods(query: string, minecraftVersion: string) {
    const cleanQuery = query.trim();
    const cleanVersion = minecraftVersion.trim();

    if (!cleanQuery) {
      return [];
    }

    const facets = JSON.stringify([
      ['project_type:mod'],
      ['categories:fabric'],
      [`versions:${cleanVersion}`],
    ]);

    const url = `${this.modrinthApiBase}/search?query=${encodeURIComponent(cleanQuery)}&index=relevance&limit=12&facets=${encodeURIComponent(facets)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'mvl-admin-mvp/0.2.0',
      },
    });

    if (!response.ok) {
      throw new BadGatewayException(
        `Modrinth search failed (${response.status})`,
      );
    }

    const payload = (await response.json()) as ModrinthSearchResponse;

    return payload.hits.map((hit) => ({
      projectId: hit.project_id,
      title: hit.title,
      description: hit.description,
    }));
  }

  async analyzeModDependencies(projectId: string, minecraftVersion: string) {
    const projectCache: Record<string, ModrinthProject> = {};
    const resolved = await this.resolveCompatibleModWithDependencies(
      projectId,
      minecraftVersion,
      projectCache,
    );
    const dependencyDetails = await Promise.all(
      resolved.requiredDependencies.map(async (dependencyId) => {
        try {
          const project = await this.fetchProject(dependencyId, projectCache);
          return {
            projectId: dependencyId,
            title: project.title,
          };
        } catch {
          return {
            projectId: dependencyId,
            title: dependencyId,
          };
        }
      }),
    );

    return {
      projectId: resolved.mod.projectId,
      versionId: resolved.mod.versionId,
      requiresDependencies: resolved.requiredDependencies.length > 0,
      requiredDependencies: resolved.requiredDependencies,
      dependencyDetails,
    };
  }

  async installMod(input: InstallModDto) {
    const includeDependencies = input.includeDependencies ?? true;
    const installed = new Map<string, ResolvedModWithDeps['mod']>();
    const primaryResolved = await this.resolveCompatibleModWithDependencies(
      input.projectId,
      input.minecraftVersion,
      {},
      input.versionId?.trim() || undefined,
    );
    installed.set(
      primaryResolved.mod.projectId || input.projectId,
      primaryResolved.mod,
    );

    if (includeDependencies) {
      const visited = new Set([input.projectId.trim()]);
      for (const dependencyId of primaryResolved.requiredDependencies) {
        await this.collectMod(
          dependencyId,
          input.minecraftVersion,
          true,
          installed,
          visited,
        );
      }
    }

    const mods = Array.from(installed.values());
    const dependencies = mods.filter(
      (entry) => entry.projectId !== primaryResolved.mod.projectId,
    );

    return {
      primary: primaryResolved.mod,
      dependencies,
      mods,
    };
  }

  async resolveCompatibleMod(
    projectId: string,
    minecraftVersion: string,
    versionId?: string,
  ) {
    const resolved = await this.resolveCompatibleModWithDependencies(
      projectId,
      minecraftVersion,
      {},
      versionId,
    );
    return resolved.mod;
  }

  async getModVersions(projectId: string, minecraftVersion: string) {
    const cleanProjectId = projectId.trim();
    const cleanMinecraftVersion = minecraftVersion.trim();
    if (!cleanProjectId || !cleanMinecraftVersion) {
      return {
        projectId: cleanProjectId,
        minecraftVersion: cleanMinecraftVersion,
        versions: [],
      };
    }

    const project = await this.fetchProject(cleanProjectId, {});
    const versions = await this.fetchProjectVersions(cleanProjectId);
    const compatible = versions
      .filter(
        (entry) =>
          entry.loaders.includes('fabric') &&
          entry.game_versions.includes(cleanMinecraftVersion),
      )
      .sort((left, right) => {
        const leftRank = this.versionTypeRank(left.version_type);
        const rightRank = this.versionTypeRank(right.version_type);
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return (
          Date.parse(right.date_published) - Date.parse(left.date_published)
        );
      })
      .slice(0, 25)
      .map((entry) => ({
        id: entry.id,
        name: entry.name?.trim() || entry.id,
        versionType: entry.version_type,
        publishedAt: entry.date_published,
      }));

    return {
      projectId: cleanProjectId,
      projectTitle: project.title,
      minecraftVersion: cleanMinecraftVersion,
      versions: compatible,
    };
  }

  async generateLockfile(input: GenerateLockfileDto): Promise<ProfileLock> {
    return this.buildLockPayload({
      profileId: input.profileId,
      version: input.version ?? 1,
      serverName: input.serverName,
      serverAddress: input.serverAddress,
      minecraftVersion: input.minecraftVersion,
      loaderVersion: input.loaderVersion,
      mods: input.mods,
      fancyMenu: input.fancyMenu ?? {},
    });
  }

  async publishProfile(input: PublishProfileDto, requestOrigin: string) {
    const serverId = this.getServerId();
    const publicBase = this.resolvePublicBaseUrl(requestOrigin);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const [server, latest] = await Promise.all([
        tx.server.findUnique({ where: { id: serverId } }),
        tx.profileVersion.findFirst({
          where: { serverId },
          orderBy: { version: 'desc' },
        }),
      ]);

      if (!server || !latest) {
        throw new NotFoundException(
          `No profile version found for server '${serverId}'`,
        );
      }

      const nextVersion = latest.version + 1;
      const profileId =
        input.profileId?.trim() || server.profileId || latest.profileId;
      const fancyMenu = this.normalizeFancyMenuSettings(input.fancyMenu);

      const generated = await this.buildLockPayload({
        profileId,
        version: nextVersion,
        serverName: input.serverName,
        serverAddress: input.serverAddress,
        minecraftVersion: input.minecraftVersion,
        loaderVersion: input.loaderVersion,
        mods: input.mods,
        fancyMenu,
        branding: {
          logoUrl: input.branding?.logoUrl?.trim() || undefined,
          backgroundUrl: input.branding?.backgroundUrl?.trim() || undefined,
          newsUrl: input.branding?.newsUrl?.trim() || undefined,
        },
        previousLockJson: latest.lockJson,
      });

      const lockUrl = `${publicBase}/v1/locks/${encodeURIComponent(profileId)}/${nextVersion}`;
      const summary = this.computeDiffSummary(latest.lockJson, generated);
      const lockSignature = this.signing.signLockPayload(generated);
      const allowedVersions = Array.from(
        new Set([...server.allowedMinecraftVersions, input.minecraftVersion]),
      );
      const [appSettings] = await Promise.all([
        tx.appSetting.upsert({
          where: { id: APP_SETTING_ID },
          create: {
            id: APP_SETTING_ID,
            supportedMinecraftVersions: allowedVersions,
            supportedPlatforms: ['fabric'],
            releaseMajor: 1,
            releaseMinor: 0,
            releasePatch: 0,
          },
          update: {},
        }),
      ]);
      const currentSemver = {
        major: appSettings.releaseMajor,
        minor: appSettings.releaseMinor,
        patch: appSettings.releasePatch,
      };
      const bumpType = this.classifyReleaseBump({
        latest,
        input,
        summary,
      });
      const nextSemver = this.bumpSemver(currentSemver, bumpType);
      const releaseVersion = this.formatSemver(nextSemver);

      await tx.server.update({
        where: { id: serverId },
        data: {
          name: input.serverName.trim(),
          address: input.serverAddress.trim(),
          profileId,
          fancyMenuEnabled: fancyMenu.enabled,
          fancyMenuSettings: fancyMenu as unknown as object,
          allowedMinecraftVersions: allowedVersions,
        },
      });

      await tx.profileVersion.create({
        data: {
          serverId,
          profileId,
          version: nextVersion,
          releaseVersion,
          minecraftVersion: generated.minecraftVersion,
          loader: generated.loader,
          loaderVersion: generated.loaderVersion,
          defaultServerName: generated.defaultServer.name,
          defaultServerAddress: generated.defaultServer.address,
          fancyMenuEnabled: generated.fancyMenu.enabled,
          fancyMenuSettings: generated.fancyMenu as unknown as object,
          lockUrl,
          summaryAdd: summary.add,
          summaryRemove: summary.remove,
          summaryUpdate: summary.update,
          summaryKeep: summary.keep,
          signature: lockSignature?.signature,
          lockJson: generated as unknown as object,
        },
      });

      await tx.appSetting.update({
        where: { id: APP_SETTING_ID },
        data: {
          releaseMajor: nextSemver.major,
          releaseMinor: nextSemver.minor,
          releasePatch: nextSemver.patch,
          supportedMinecraftVersions: allowedVersions,
        },
      });

      return {
        version: nextVersion,
        releaseVersion,
        bumpType,
        lockUrl,
        summary,
      };
    });
  }

  async uploadMedia(
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    requestOrigin: string,
  ) {
    if (!file || !file.buffer || file.size <= 0) {
      throw new BadGatewayException('No file uploaded');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadGatewayException('Only image uploads are supported');
    }

    const allowedExt = new Set(['.png', '.jpg', '.jpeg', '.webp']);
    const fromName = extname(file.originalname || '').toLowerCase();
    const ext = allowedExt.has(fromName)
      ? fromName
      : file.mimetype === 'image/png'
        ? '.png'
        : file.mimetype === 'image/webp'
          ? '.webp'
          : '.jpg';

    if (file.size > 5 * 1024 * 1024) {
      throw new BadGatewayException('Image must be 5MB or smaller');
    }

    const root = this.getArtifactsRoot();
    await mkdir(root, { recursive: true });

    const stamp = Date.now().toString(36);
    const token = randomBytes(6).toString('hex');
    const fileName = `admin-image-${stamp}-${token}${ext}`;
    const target = resolve(root, basename(fileName));
    await writeFile(target, file.buffer);
    const publicBase = this.resolvePublicBaseUrl(requestOrigin);

    return {
      fileName,
      url: `${publicBase}/v1/artifacts/${encodeURIComponent(fileName)}`,
      size: file.size,
      contentType: file.mimetype,
    };
  }

  async uploadFancyMenuBundle(
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    requestOrigin: string,
  ) {
    if (!file || !file.buffer || file.size <= 0) {
      throw new BadGatewayException('No file uploaded');
    }

    if (file.size > MAX_FANCY_BUNDLE_UPLOAD_BYTES) {
      throw new BadGatewayException('FancyMenu bundle must be 50MB or smaller');
    }

    const fileExt = extname(file.originalname || '').toLowerCase();
    if (fileExt !== '.zip') {
      throw new BadGatewayException('FancyMenu bundle must be a .zip file');
    }

    const validation = await this.sandboxClient.validateBundle(file.buffer);
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    const root = this.getArtifactsRoot();
    await mkdir(root, { recursive: true });

    const stamp = Date.now().toString(36);
    const token = randomBytes(6).toString('hex');
    const fileName = `fancymenu-bundle-${stamp}-${token}.zip`;
    const target = resolve(root, basename(fileName));
    await writeFile(target, file.buffer);
    const publicBase = this.resolvePublicBaseUrl(requestOrigin);

    return {
      fileName,
      url: `${publicBase}/v1/artifacts/${encodeURIComponent(fileName)}`,
      sha256,
      size: file.size,
      entryCount: validation.entryCount,
    };
  }

  async buildFancyMenuPreview(input: BuildFancyMenuPreviewDto): Promise<{
    model: FancyPreviewModel;
    expiresAt?: string;
  }> {
    const fancyMenu = this.normalizeFancyMenuSettings(input.fancyMenu);
    const baseline = this.previewAssembler.buildSimplePreview({
      serverName: input.serverName?.trim() || undefined,
      fancyMenu,
      branding: {
        logoUrl: input.branding?.logoUrl?.trim() || undefined,
        backgroundUrl: input.branding?.backgroundUrl?.trim() || undefined,
      },
    });

    if (
      !fancyMenu.enabled ||
      fancyMenu.mode !== 'custom' ||
      !fancyMenu.customLayoutUrl ||
      !fancyMenu.customLayoutSha256
    ) {
      return { model: baseline };
    }

    const bundlePath = this.resolveArtifactPathFromUrl(
      fancyMenu.customLayoutUrl,
    );
    const payload = await readFile(bundlePath).catch(() => null);
    if (!payload || payload.length === 0) {
      throw new BadGatewayException(
        'FancyMenu preview bundle is missing or unreadable',
      );
    }

    const actualSha = createHash('sha256').update(payload).digest('hex');
    if (
      actualSha.toLowerCase() !== fancyMenu.customLayoutSha256.toLowerCase()
    ) {
      throw new BadGatewayException(
        'FancyMenu preview bundle SHA-256 does not match',
      );
    }

    const sandboxPreview: SandboxPreviewResponse =
      await this.sandboxClient.buildPreview(payload);
    return {
      model: this.previewAssembler.mergeCustomPreview(
        baseline,
        sandboxPreview,
        '/v1/admin/fancymenu/preview/assets',
      ),
      expiresAt: sandboxPreview.expiresAt,
    };
  }

  async getFancyMenuPreviewAsset(token: string, assetId: string) {
    return this.sandboxClient.fetchPreviewAsset(token, assetId);
  }

  private async ensureAdminCredential(): Promise<void> {
    const existing = await this.prisma.adminCredential.findUnique({
      where: { id: ADMIN_CREDENTIAL_ID },
    });

    if (!existing) {
      const initialPassword = this.config.get<string>('ADMIN_INITIAL_PASSWORD');
      if (!initialPassword && this.config.get('NODE_ENV') === 'production') {
        throw new Error(
          'ADMIN_INITIAL_PASSWORD env var is required in production',
        );
      }

      const password =
        initialPassword || this.authService.generateRandomToken(24);
      const passwordHash = await this.authService.hashPassword(password);
      await this.prisma.adminCredential.create({
        data: {
          id: ADMIN_CREDENTIAL_ID,
          passwordHash,
          passwordCiphertext: '',
          passwordIv: '',
        },
      });

      if (!initialPassword) {
        console.warn(
          `[admin] Auto-generated admin password for dev: ${password}`,
        );
      }
    }
  }

  private async ensureAppSettings() {
    const existing = await this.prisma.appSetting.findUnique({
      where: { id: APP_SETTING_ID },
    });

    if (existing) {
      return;
    }

    const serverId = this.getServerId();
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
    });

    await this.prisma.appSetting.create({
      data: {
        id: APP_SETTING_ID,
        supportedMinecraftVersions: server?.allowedMinecraftVersions ?? [],
        supportedPlatforms: ['fabric'],
        releaseMajor: 1,
        releaseMinor: 0,
        releasePatch: 0,
      },
    });
  }

  private async getAppSettings() {
    const setting = await this.prisma.appSetting.upsert({
      where: { id: APP_SETTING_ID },
      create: {
        id: APP_SETTING_ID,
        supportedMinecraftVersions: [],
        supportedPlatforms: ['fabric'],
        releaseMajor: 1,
        releaseMinor: 0,
        releasePatch: 0,
      },
      update: {},
    });

    return {
      supportedMinecraftVersions: setting.supportedMinecraftVersions,
      supportedPlatforms: setting.supportedPlatforms,
      releaseMajor: setting.releaseMajor,
      releaseMinor: setting.releaseMinor,
      releasePatch: setting.releasePatch,
      releaseVersion: this.formatSemver({
        major: setting.releaseMajor,
        minor: setting.releaseMinor,
        patch: setting.releasePatch,
      }),
      publishDraft: setting.publishDraft,
    };
  }

  private async collectMod(
    projectId: string,
    minecraftVersion: string,
    includeDependencies: boolean,
    output: Map<string, ResolvedModWithDeps['mod']>,
    visited: Set<string>,
  ) {
    const normalized = projectId.trim();
    if (!normalized || visited.has(normalized)) {
      return;
    }

    visited.add(normalized);

    const resolved = await this.resolveCompatibleModWithDependencies(
      normalized,
      minecraftVersion,
      {},
    );
    output.set(resolved.mod.projectId || normalized, resolved.mod);

    if (!includeDependencies) {
      return;
    }

    for (const dependencyId of resolved.requiredDependencies) {
      await this.collectMod(
        dependencyId,
        minecraftVersion,
        includeDependencies,
        output,
        visited,
      );
    }
  }

  private async resolveCompatibleModWithDependencies(
    projectId: string,
    minecraftVersion: string,
    projectCache: Record<string, ModrinthProject>,
    versionId?: string,
  ): Promise<ResolvedModWithDeps> {
    const cleanProjectId = projectId.trim();
    const cleanMinecraftVersion = minecraftVersion.trim();
    const cleanVersionId = versionId?.trim();

    const [project, versions] = await Promise.all([
      this.fetchProject(cleanProjectId, projectCache),
      this.fetchProjectVersions(cleanProjectId),
    ]);

    const selected = this.selectBestCompatibleVersion(
      project.title,
      cleanMinecraftVersion,
      versions,
      cleanVersionId,
    );
    const file =
      selected.files.find((entry) => entry.primary) ?? selected.files[0];

    if (!file) {
      throw new BadGatewayException(
        `No downloadable file found for '${project.title}'`,
      );
    }

    const sha256 = await this.computeSha256FromUrl(file.url);
    const requiredDependencies = Array.from(
      new Set(
        (selected.dependencies ?? [])
          .filter((dep) => dep.dependency_type === 'required')
          .map((dep) => dep.project_id?.trim())
          .filter((dep): dep is string => Boolean(dep)),
      ),
    );

    return {
      mod: {
        kind: 'mod',
        name: project.title,
        provider: 'modrinth',
        side: 'client',
        projectId: project.id,
        versionId: selected.id,
        url: file.url,
        sha256,
      },
      requiredDependencies,
    };
  }

  private async fetchProject(
    projectId: string,
    cache?: Record<string, ModrinthProject>,
  ): Promise<ModrinthProject> {
    if (cache?.[projectId]) {
      return cache[projectId];
    }

    const response = await fetch(
      `${this.modrinthApiBase}/project/${encodeURIComponent(projectId)}`,
      {
        headers: {
          'User-Agent': 'mvl-admin-mvp/0.2.0',
        },
      },
    );

    if (!response.ok) {
      throw new BadGatewayException(
        `Failed to fetch Modrinth project '${projectId}' (${response.status})`,
      );
    }

    const project = (await response.json()) as ModrinthProject;
    if (cache) {
      cache[projectId] = project;
    }

    return project;
  }

  private async fetchProjectVersions(
    projectId: string,
  ): Promise<ModrinthVersion[]> {
    const response = await fetch(
      `${this.modrinthApiBase}/project/${encodeURIComponent(projectId)}/version`,
      {
        headers: {
          'User-Agent': 'mvl-admin-mvp/0.2.0',
        },
      },
    );

    if (!response.ok) {
      throw new BadGatewayException(
        `Failed to fetch Modrinth versions for '${projectId}' (${response.status})`,
      );
    }

    return (await response.json()) as ModrinthVersion[];
  }

  private selectBestCompatibleVersion(
    projectName: string,
    minecraftVersion: string,
    versions: ModrinthVersion[],
    preferredVersionId?: string,
  ): ModrinthVersion {
    const compatible = versions.filter(
      (entry) =>
        entry.loaders.includes('fabric') &&
        entry.game_versions.includes(minecraftVersion),
    );

    if (compatible.length === 0) {
      throw new BadGatewayException(
        `No compatible Fabric version found for '${projectName}' on Minecraft ${minecraftVersion}`,
      );
    }

    if (preferredVersionId) {
      const preferred = compatible.find(
        (entry) => entry.id === preferredVersionId,
      );
      if (!preferred) {
        throw new BadGatewayException(
          `Version '${preferredVersionId}' is not compatible for '${projectName}' on Minecraft ${minecraftVersion}`,
        );
      }
      return preferred;
    }

    compatible.sort((left, right) => {
      const leftRank = this.versionTypeRank(left.version_type);
      const rightRank = this.versionTypeRank(right.version_type);

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return Date.parse(right.date_published) - Date.parse(left.date_published);
    });

    const selected = compatible[0];
    if (!selected) {
      throw new BadGatewayException(
        `No compatible Fabric version found for '${projectName}' on Minecraft ${minecraftVersion}`,
      );
    }

    return selected;
  }

  private async computeSha256FromUrl(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'mvl-admin-mvp/0.2.0',
      },
    });

    if (!response.ok) {
      throw new BadGatewayException(
        `Failed to download artifact for hash (${response.status})`,
      );
    }

    const payload = await response.arrayBuffer();
    const hash = createHash('sha256');
    hash.update(Buffer.from(payload));
    return hash.digest('hex');
  }

  private versionTypeRank(value: ModrinthVersion['version_type']): number {
    switch (value) {
      case 'release':
        return 0;
      case 'beta':
        return 1;
      case 'alpha':
      default:
        return 2;
    }
  }

  private computeDiffSummary(previousLockJson: unknown, nextLock: ProfileLock) {
    const previous = ProfileLockSchema.safeParse(previousLockJson);

    if (!previous.success) {
      return {
        add:
          nextLock.items.length +
          nextLock.resources.length +
          nextLock.shaders.length +
          nextLock.configs.length,
        remove: 0,
        update: 0,
        keep: 0,
      };
    }

    const prevItems = this.flattenLockItems(previous.data);
    const nextItems = this.flattenLockItems(nextLock);

    const prevMap = new Map(
      prevItems.map((item) => [this.itemKey(item), item.sha256]),
    );
    const nextMap = new Map(
      nextItems.map((item) => [this.itemKey(item), item.sha256]),
    );

    let add = 0;
    let remove = 0;
    let update = 0;
    let keep = 0;

    for (const [key, sha] of nextMap.entries()) {
      const prevSha = prevMap.get(key);
      if (!prevSha) {
        add += 1;
      } else if (prevSha === sha) {
        keep += 1;
      } else {
        update += 1;
      }
    }

    for (const key of prevMap.keys()) {
      if (!nextMap.has(key)) {
        remove += 1;
      }
    }

    return { add, remove, update, keep };
  }

  private flattenLockItems(lock: ProfileLock) {
    return [
      ...lock.items,
      ...lock.resources,
      ...lock.shaders,
      ...lock.configs,
    ] as LockBundleItem[];
  }

  private itemKey(item: LockBundleItem) {
    if (item.kind === 'mod') {
      return `mod:${item.projectId ?? item.name}`;
    }

    return `${item.kind}:${item.name}`;
  }

  private async buildLockPayload(input: {
    profileId?: string;
    version: number;
    serverName: string;
    serverAddress: string;
    minecraftVersion: string;
    loaderVersion: string;
    mods: Array<{
      kind: 'mod';
      name: string;
      provider: 'modrinth' | 'direct';
      side: 'client';
      projectId?: string;
      versionId?: string;
      url: string;
      sha256: string;
    }>;
    fancyMenu: {
      enabled?: boolean;
      mode?: 'simple' | 'custom';
      playButtonLabel?: string;
      hideSingleplayer?: boolean;
      hideMultiplayer?: boolean;
      hideRealms?: boolean;
      customLayoutUrl?: string;
      customLayoutSha256?: string;
    };
    branding?: {
      logoUrl?: string;
      backgroundUrl?: string;
      newsUrl?: string;
    };
    previousLockJson?: unknown;
  }): Promise<ProfileLock> {
    const cleanServerName = input.serverName.trim();
    const cleanServerAddress = input.serverAddress.trim();
    const cleanMinecraftVersion = input.minecraftVersion.trim();
    const cleanLoaderVersion = input.loaderVersion.trim();

    const profileId =
      input.profileId?.trim() ||
      this.slugify(cleanServerName || 'server-profile');
    const fancyMenuSettings = this.normalizeFancyMenuSettings(input.fancyMenu);
    const includeFancyMenu = fancyMenuSettings.enabled;

    const draftMods = input.mods.filter(
      (entry) =>
        !entry.name.toLowerCase().includes('server lock') &&
        !entry.url.includes('server-lock-'),
    );

    const mods = await this.coreModPolicy.normalizeMods({
      mods: draftMods as ManagedMod[],
      minecraftVersion: cleanMinecraftVersion,
      fancyMenuEnabled: includeFancyMenu,
      resolveMod: (projectId, minecraftVersion, versionId) =>
        this.resolveCompatibleMod(projectId, minecraftVersion, versionId),
    });

    const configs = [];
    if (includeFancyMenu && fancyMenuSettings.mode === 'custom') {
      if (
        !fancyMenuSettings.customLayoutUrl ||
        !fancyMenuSettings.customLayoutSha256
      ) {
        throw new BadGatewayException(
          'FancyMenu custom mode requires customLayoutUrl and customLayoutSha256',
        );
      }
      await this.revalidateFancyMenuBundleArtifact(
        fancyMenuSettings.customLayoutUrl,
        fancyMenuSettings.customLayoutSha256,
      );
      configs.push({
        kind: 'config' as const,
        name: FANCY_MENU_BUNDLE_CONFIG_NAME,
        url: fancyMenuSettings.customLayoutUrl,
        sha256: fancyMenuSettings.customLayoutSha256,
      });
    }

    const previousParsed = ProfileLockSchema.safeParse(input.previousLockJson);
    const previousBranding = previousParsed.success
      ? previousParsed.data.branding
      : null;
    const previousRuntime = previousParsed.success
      ? previousParsed.data.runtimeHints
      : null;

    return ProfileLockSchema.parse({
      profileId,
      version: input.version,
      minecraftVersion: cleanMinecraftVersion,
      loader: 'fabric',
      loaderVersion: cleanLoaderVersion,
      defaultServer: {
        name: cleanServerName,
        address: cleanServerAddress,
      },
      items: mods,
      resources: [],
      shaders: [],
      configs,
      runtimeHints: previousRuntime ?? {
        javaMajor: 17,
        minMemoryMb: 4096,
        maxMemoryMb: 8192,
      },
      branding: {
        serverName: cleanServerName,
        logoUrl:
          input.branding?.logoUrl?.trim() ||
          previousBranding?.logoUrl ||
          'https://images.unsplash.com/photo-1579546929662-711aa81148cf?auto=format&fit=crop&w=320&q=80',
        backgroundUrl:
          input.branding?.backgroundUrl?.trim() ||
          previousBranding?.backgroundUrl ||
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80',
        newsUrl:
          input.branding?.newsUrl?.trim() ||
          previousBranding?.newsUrl ||
          'https://example.com/news',
      },
      fancyMenu: fancyMenuSettings,
    });
  }

  private normalizeFancyMenuSettings(input?: {
    enabled?: boolean;
    mode?: 'simple' | 'custom';
    playButtonLabel?: string;
    hideSingleplayer?: boolean;
    hideMultiplayer?: boolean;
    hideRealms?: boolean;
    customLayoutUrl?: string;
    customLayoutSha256?: string;
  }) {
    const settings = FancyMenuSettingsSchema.parse({
      enabled: input?.enabled ?? true,
      mode: input?.mode ?? 'simple',
      playButtonLabel: input?.playButtonLabel?.trim() || 'Play',
      hideSingleplayer: input?.hideSingleplayer ?? true,
      hideMultiplayer: input?.hideMultiplayer ?? true,
      hideRealms: input?.hideRealms ?? true,
      customLayoutUrl: input?.customLayoutUrl?.trim() || undefined,
      customLayoutSha256: input?.customLayoutSha256?.trim() || undefined,
    });

    if (!settings.enabled) {
      return {
        ...settings,
        mode: 'simple' as const,
        customLayoutUrl: undefined,
        customLayoutSha256: undefined,
      };
    }

    if (settings.mode !== 'custom') {
      return {
        ...settings,
        mode: 'simple' as const,
        customLayoutUrl: undefined,
        customLayoutSha256: undefined,
      };
    }

    return settings;
  }

  private async revalidateFancyMenuBundleArtifact(
    bundleUrl: string,
    expectedSha256: string,
  ): Promise<FancyMenuBundleValidation> {
    const filePath = this.resolveArtifactPathFromUrl(bundleUrl);
    const payload = await readFile(filePath).catch(() => null);
    if (!payload || payload.length === 0) {
      throw new BadGatewayException(
        'FancyMenu bundle artifact is missing or unreadable',
      );
    }

    if (payload.length > MAX_FANCY_BUNDLE_UPLOAD_BYTES) {
      throw new BadGatewayException('FancyMenu bundle must be 50MB or smaller');
    }

    if (extname(filePath).toLowerCase() !== '.zip') {
      throw new BadGatewayException(
        'FancyMenu bundle artifact must be a .zip file',
      );
    }

    const actualSha = createHash('sha256').update(payload).digest('hex');
    if (actualSha.toLowerCase() !== expectedSha256.toLowerCase()) {
      throw new BadGatewayException(
        'FancyMenu bundle SHA-256 does not match artifact content',
      );
    }

    return this.sandboxClient.validateBundle(payload);
  }

  private resolveArtifactPathFromUrl(url: string): string {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadGatewayException('Invalid FancyMenu customLayoutUrl');
    }

    const marker = '/v1/artifacts/';
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) {
      throw new BadGatewayException(
        'FancyMenu customLayoutUrl must reference /v1/artifacts/',
      );
    }

    const rawFileName = parsed.pathname.slice(idx + marker.length);
    const decodedFileName = decodeURIComponent(rawFileName);
    const safeFileName = basename(decodedFileName);
    if (!safeFileName || safeFileName !== decodedFileName) {
      throw new BadGatewayException('Invalid FancyMenu bundle artifact path');
    }

    return resolve(this.getArtifactsRoot(), safeFileName);
  }

  private extractFancyMenu(value: unknown) {
    const parsed = FancyMenuSettingsSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  private extractDraft(value: unknown) {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const draft = value as {
      profileId?: unknown;
      serverName?: unknown;
      serverAddress?: unknown;
      fancyMenu?: unknown;
      branding?: unknown;
    };

    const fancyMenu = this.extractFancyMenu(draft.fancyMenu);
    const brandingParsed = BrandingSchema.safeParse(draft.branding);
    const branding = brandingParsed.success ? brandingParsed.data : null;

    return {
      serverName:
        typeof draft.serverName === 'string' &&
        draft.serverName.trim().length > 0
          ? draft.serverName.trim()
          : null,
      serverAddress:
        typeof draft.serverAddress === 'string' &&
        draft.serverAddress.trim().length > 0
          ? draft.serverAddress.trim()
          : null,
      profileId:
        typeof draft.profileId === 'string' && draft.profileId.trim().length > 0
          ? draft.profileId.trim()
          : null,
      fancyMenu,
      branding,
    };
  }

  private classifyReleaseBump(input: {
    latest: {
      minecraftVersion: string;
      loaderVersion: string;
      loader: string;
    };
    input: {
      minecraftVersion: string;
      loaderVersion: string;
    };
    summary: {
      add: number;
      remove: number;
      update: number;
    };
  }): BumpType {
    const minecraftChanged =
      input.latest.minecraftVersion.trim() !==
      input.input.minecraftVersion.trim();
    const loaderVersionChanged =
      input.latest.loaderVersion.trim() !== input.input.loaderVersion.trim();
    const loaderChanged = input.latest.loader.trim().toLowerCase() !== 'fabric';

    if (minecraftChanged || loaderVersionChanged || loaderChanged) {
      return 'major';
    }

    if (
      input.summary.add > 0 ||
      input.summary.remove > 0 ||
      input.summary.update > 0
    ) {
      return 'minor';
    }

    return 'patch';
  }

  private bumpSemver(current: SemverParts, bumpType: BumpType): SemverParts {
    if (bumpType === 'major') {
      return { major: current.major + 1, minor: 0, patch: 0 };
    }

    if (bumpType === 'minor') {
      return { major: current.major, minor: current.minor + 1, patch: 0 };
    }

    return {
      major: current.major,
      minor: current.minor,
      patch: current.patch + 1,
    };
  }

  private formatSemver(parts: SemverParts): string {
    return `${parts.major}.${parts.minor}.${parts.patch}`;
  }

  private getArtifactsRoot() {
    const configured = this.config.get<string>('ARTIFACTS_DIR')?.trim();
    if (configured) {
      return resolve(configured);
    }

    return resolve(homedir(), '.mss-client', 'artifacts');
  }

  private resolvePublicBaseUrl(fallbackOrigin: string): string {
    const configured = this.config.get<string>('PUBLIC_BASE_URL')?.trim();
    if (configured) {
      return configured.replace(/\/+$/, '');
    }
    return fallbackOrigin;
  }

  private getServerId() {
    return this.config.get<string>('SERVER_ID') ?? 'mvl';
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
