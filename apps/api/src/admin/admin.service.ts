import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { FancyMenuSettingsSchema, LockBundleItem, ProfileLock, ProfileLockSchema } from '@mvl/shared';
import type { Request, Response } from 'express';
import { PrismaService } from '../db/prisma.service';
import { GenerateLockfileDto, InstallModDto, PublishProfileDto, UpdateSettingsDto } from './admin.dto';

const scrypt = promisify(scryptCb);

const FANCY_MENU_PROJECT_ID = 'Wq5SjeWM';
const ADMIN_CREDENTIAL_ID = 'global';
const APP_SETTING_ID = 'global';
const ACCESS_COOKIE = 'mvl_admin_access';
const REFRESH_COOKIE = 'mvl_admin_refresh';
const SUPPORTED_MVP_PLATFORMS = new Set(['fabric']);

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

interface AdminSessionResult {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

interface ResolvedModWithDeps {
  mod: {
    kind: 'mod';
    name: string;
    provider: 'modrinth';
    side: 'client';
    projectId: string;
    versionId: string;
    url: string;
    sha256: string;
  };
  requiredDependencies: string[];
}

interface FabricLoaderRow {
  version: string;
  stable: boolean;
}

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly modrinthApiBase = 'https://api.modrinth.com/v2';
  private readonly fabricMetaBase = 'https://meta.fabricmc.net';
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: number;
  private readonly cookieSecure: boolean;
  private readonly cipherKey: Buffer;
  private readonly fabricCache = new Map<string, { expiresAt: number; value: FabricLoaderRow[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const accessMinutes = Number(this.config.get('ADMIN_ACCESS_TOKEN_TTL_MINUTES') ?? 15);
    const refreshDays = Number(this.config.get('ADMIN_REFRESH_TOKEN_TTL_DAYS') ?? 14);
    this.accessTtlMs = Math.max(1, accessMinutes) * 60 * 1000;
    this.refreshTtlMs = Math.max(1, refreshDays) * 24 * 60 * 60 * 1000;
    const secureRaw = this.config.get<string>('ADMIN_COOKIE_SECURE');
    this.cookieSecure = secureRaw === 'true' || this.config.get('NODE_ENV') === 'production';
    this.cipherKey = this.deriveCipherKey();
  }

  async onModuleInit() {
    await this.ensureAppSettings();
    const password = await this.ensureAdminCredential();
    console.log(`[admin] password: ${password}`);
  }

  async login(password: string, request: Request, response: Response) {
    const credential = await this.prisma.adminCredential.findUnique({
      where: { id: ADMIN_CREDENTIAL_ID },
    });

    if (!credential) {
      throw new UnauthorizedException('Admin password is not initialized');
    }

    const valid = await this.verifyPassword(password, credential.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid admin password');
    }

    const session = await this.createSession(request);
    this.setSessionCookies(response, session);

    return { success: true };
  }

  async refresh(request: Request, response: Response) {
    const refreshToken = this.readCookie(request, REFRESH_COOKIE);
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const refreshed = await this.rotateSession(refreshToken);
    this.setSessionCookies(response, refreshed);
    return { success: true };
  }

  async logout(request: Request, response: Response) {
    const accessToken = this.readCookie(request, ACCESS_COOKIE);
    const refreshToken = this.readCookie(request, REFRESH_COOKIE);

    await this.revokeSession(accessToken, refreshToken);
    this.clearSessionCookies(response);
    return { success: true };
  }

  async authenticateRequest(request: Request): Promise<boolean> {
    const accessToken = this.readCookie(request, ACCESS_COOKIE);
    if (!accessToken) {
      return false;
    }

    const tokenHash = this.hashToken(accessToken);
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
      throw new NotFoundException(`No profile version found for server '${serverId}'`);
    }

    const lock = ProfileLockSchema.parse(latest.lockJson);
    const mods = lock.items.filter((item) => item.kind === 'mod');

    const serverFancyMenu = this.extractFancyMenu(server.fancyMenuSettings);
    const profileFancyMenu = this.extractFancyMenu(latest.fancyMenuSettings);
    const lockFancyMenu = this.extractFancyMenu(lock.fancyMenu);

    return {
      server: {
        id: server.id,
        name: server.name,
        address: server.address,
        profileId: server.profileId,
      },
      latestProfile: {
        version: latest.version,
        minecraftVersion: latest.minecraftVersion,
        loader: latest.loader,
        loaderVersion: latest.loaderVersion,
        mods,
        fancyMenu: profileFancyMenu ?? serverFancyMenu ?? lockFancyMenu,
      },
      appSettings: settings,
    };
  }

  async updateSettings(input: UpdateSettingsDto) {
    const cleanVersions = Array.from(
      new Set(input.supportedMinecraftVersions.map((value) => value.trim()).filter(Boolean)),
    );

    const cleanPlatforms = Array.from(
      new Set(input.supportedPlatforms.map((value) => value.trim().toLowerCase()).filter(Boolean)),
    );

    if (!cleanPlatforms.every((platform) => SUPPORTED_MVP_PLATFORMS.has(platform))) {
      throw new BadGatewayException('Only fabric platform is supported for MVP');
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
        latestStable: cached.value.find((loader) => loader.stable)?.version ?? null,
      };
    }

    const url = `${this.fabricMetaBase}/v2/versions/loader/${encodeURIComponent(version)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'mvl-admin-mvp/0.2.0',
      },
    });

    if (!response.ok) {
      throw new BadGatewayException(`Failed to fetch Fabric versions (${response.status})`);
    }

    const payload = (await response.json()) as Array<{ loader?: { version?: string; stable?: boolean } }>;
    const loaders = payload
      .map((entry) => ({
        version: entry.loader?.version?.trim() ?? '',
        stable: entry.loader?.stable === true,
      }))
      .filter((entry) => entry.version.length > 0)
      .filter((entry, idx, arr) => arr.findIndex((item) => item.version === entry.version) === idx);

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
      throw new BadGatewayException(`Modrinth search failed (${response.status})`);
    }

    const payload = (await response.json()) as ModrinthSearchResponse;

    return payload.hits.map((hit) => ({
      projectId: hit.project_id,
      title: hit.title,
      description: hit.description,
    }));
  }

  async analyzeModDependencies(projectId: string, minecraftVersion: string) {
    const resolved = await this.resolveCompatibleModWithDependencies(projectId, minecraftVersion, {});

    return {
      projectId: resolved.mod.projectId,
      versionId: resolved.mod.versionId,
      requiresDependencies: resolved.requiredDependencies.length > 0,
      requiredDependencies: resolved.requiredDependencies,
    };
  }

  async installMod(input: InstallModDto) {
    const includeDependencies = input.includeDependencies ?? true;
    const installed = new Map<string, ResolvedModWithDeps['mod']>();

    await this.collectMod(input.projectId, input.minecraftVersion, includeDependencies, installed, new Set());

    return {
      mods: Array.from(installed.values()),
    };
  }

  async resolveCompatibleMod(projectId: string, minecraftVersion: string) {
    const resolved = await this.resolveCompatibleModWithDependencies(projectId, minecraftVersion, {});
    return resolved.mod;
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
      fancyMenu: {
        enabled: input.includeFancyMenu ?? true,
        playButtonLabel: input.playButtonLabel?.trim() || 'Play',
        hideSingleplayer: input.hideSingleplayer ?? true,
        hideMultiplayer: input.hideMultiplayer ?? true,
        hideRealms: input.hideRealms ?? true,
        titleText: input.titleText?.trim() || undefined,
        subtitleText: input.subtitleText?.trim() || undefined,
        logoUrl: input.logoUrl?.trim() || undefined,
        configUrl: input.fancyMenuConfigUrl?.trim() || undefined,
        configSha256: input.fancyMenuConfigSha256?.trim() || undefined,
        assetsUrl: input.fancyMenuAssetsUrl?.trim() || undefined,
        assetsSha256: input.fancyMenuAssetsSha256?.trim() || undefined,
      },
    });
  }

  async publishProfile(input: PublishProfileDto, requestOrigin: string) {
    const serverId = this.getServerId();

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const [server, latest] = await Promise.all([
        tx.server.findUnique({ where: { id: serverId } }),
        tx.profileVersion.findFirst({
          where: { serverId },
          orderBy: { version: 'desc' },
        }),
      ]);

      if (!server || !latest) {
        throw new NotFoundException(`No profile version found for server '${serverId}'`);
      }

      const nextVersion = latest.version + 1;
      const profileId = input.profileId?.trim() || server.profileId || latest.profileId;
      const fancyMenu = FancyMenuSettingsSchema.parse({
        enabled: input.fancyMenu?.enabled ?? true,
        playButtonLabel: input.fancyMenu?.playButtonLabel ?? 'Play',
        hideSingleplayer: input.fancyMenu?.hideSingleplayer ?? true,
        hideMultiplayer: input.fancyMenu?.hideMultiplayer ?? true,
        hideRealms: input.fancyMenu?.hideRealms ?? true,
        titleText: input.fancyMenu?.titleText?.trim() || undefined,
        subtitleText: input.fancyMenu?.subtitleText?.trim() || undefined,
        logoUrl: input.fancyMenu?.logoUrl?.trim() || undefined,
        configUrl: input.fancyMenu?.configUrl?.trim() || undefined,
        configSha256: input.fancyMenu?.configSha256?.trim() || undefined,
        assetsUrl: input.fancyMenu?.assetsUrl?.trim() || undefined,
        assetsSha256: input.fancyMenu?.assetsSha256?.trim() || undefined,
      });

      const generated = await this.buildLockPayload({
        profileId,
        version: nextVersion,
        serverName: input.serverName,
        serverAddress: input.serverAddress,
        minecraftVersion: input.minecraftVersion,
        loaderVersion: input.loaderVersion,
        mods: input.mods,
        fancyMenu,
        previousLockJson: latest.lockJson,
      });

      const lockUrl = `${requestOrigin}/v1/locks/${encodeURIComponent(profileId)}/${nextVersion}`;
      const summary = this.computeDiffSummary(latest.lockJson, generated);
      const allowedVersions = Array.from(
        new Set([...server.allowedMinecraftVersions, input.minecraftVersion]),
      );

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
          lockJson: generated as unknown as object,
        },
      });

      return {
        version: nextVersion,
        lockUrl,
        summary,
      };
    });
  }

  private async ensureAdminCredential(): Promise<string> {
    const existing = await this.prisma.adminCredential.findUnique({
      where: { id: ADMIN_CREDENTIAL_ID },
    });

    if (!existing) {
      const password = this.generateRandomToken(24);
      const passwordHash = await this.hashPassword(password);
      const encrypted = this.encryptPassword(password);

      await this.prisma.adminCredential.create({
        data: {
          id: ADMIN_CREDENTIAL_ID,
          passwordHash,
          passwordCiphertext: encrypted.ciphertext,
          passwordIv: encrypted.iv,
        },
      });

      return password;
    }

    return this.decryptPassword(existing.passwordCiphertext, existing.passwordIv);
  }

  private async ensureAppSettings() {
    const existing = await this.prisma.appSetting.findUnique({
      where: { id: APP_SETTING_ID },
    });

    if (existing) {
      return;
    }

    const serverId = this.getServerId();
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });

    await this.prisma.appSetting.create({
      data: {
        id: APP_SETTING_ID,
        supportedMinecraftVersions: server?.allowedMinecraftVersions ?? [],
        supportedPlatforms: ['fabric'],
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
      },
      update: {},
    });

    return {
      supportedMinecraftVersions: setting.supportedMinecraftVersions,
      supportedPlatforms: setting.supportedPlatforms,
    };
  }

  private async createSession(request: Request): Promise<AdminSessionResult> {
    const now = Date.now();
    const accessToken = this.generateRandomToken();
    const refreshToken = this.generateRandomToken();
    const sessionId = randomBytes(16).toString('hex');
    const expiresAt = new Date(now + this.accessTtlMs);
    const refreshExpiresAt = new Date(now + this.refreshTtlMs);

    await this.prisma.adminSession.create({
      data: {
        id: sessionId,
        accessTokenHash: this.hashToken(accessToken),
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt,
        refreshExpiresAt,
        ip: request.ip,
        userAgent: request.headers['user-agent']?.slice(0, 256),
      },
    });

    return {
      sessionId,
      accessToken,
      refreshToken,
      expiresAt,
      refreshExpiresAt,
    };
  }

  private async rotateSession(refreshToken: string): Promise<AdminSessionResult> {
    const refreshTokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.adminSession.findFirst({
      where: {
        refreshTokenHash,
        revokedAt: null,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.refreshExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const accessToken = this.generateRandomToken();
    const nextRefreshToken = this.generateRandomToken();
    const expiresAt = new Date(Date.now() + this.accessTtlMs);
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlMs);

    await this.prisma.adminSession.update({
      where: { id: session.id },
      data: {
        accessTokenHash: this.hashToken(accessToken),
        refreshTokenHash: this.hashToken(nextRefreshToken),
        expiresAt,
        refreshExpiresAt,
      },
    });

    return {
      sessionId: session.id,
      accessToken,
      refreshToken: nextRefreshToken,
      expiresAt,
      refreshExpiresAt,
    };
  }

  private async revokeSession(
    accessToken?: string | null,
    refreshToken?: string | null,
  ) {
    const tokenHashes = [accessToken, refreshToken]
      .filter((value): value is string => Boolean(value))
      .map((value) => this.hashToken(value));

    if (!tokenHashes.length) {
      return;
    }

    await this.prisma.adminSession.updateMany({
      where: {
        revokedAt: null,
        OR: [
          { accessTokenHash: { in: tokenHashes } },
          { refreshTokenHash: { in: tokenHashes } },
        ],
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private setSessionCookies(response: Response, session: AdminSessionResult) {
    response.cookie(ACCESS_COOKIE, session.accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.cookieSecure,
      path: '/',
      expires: session.expiresAt,
    });

    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.cookieSecure,
      path: '/',
      expires: session.refreshExpiresAt,
    });
  }

  clearSessionCookies(response: Response) {
    response.clearCookie(ACCESS_COOKIE, {
      path: '/',
      sameSite: 'strict',
      secure: this.cookieSecure,
    });

    response.clearCookie(REFRESH_COOKIE, {
      path: '/',
      sameSite: 'strict',
      secure: this.cookieSecure,
    });
  }

  private readCookie(request: Request, name: string): string | null {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return null;
    }

    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
      const [rawKey, ...rest] = pair.trim().split('=');
      if (rawKey === name) {
        return decodeURIComponent(rest.join('='));
      }
    }

    return null;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
  }

  private async verifyPassword(password: string, encoded: string): Promise<boolean> {
    const [algo, saltHex, hashHex] = encoded.split('$');
    if (algo !== 'scrypt' || !saltHex || !hashHex) {
      return false;
    }

    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const derived = (await scrypt(password, salt, expected.length)) as Buffer;

    if (derived.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(derived, expected);
  }

  private deriveCipherKey() {
    const configured = this.config.get<string>('ADMIN_PASSWORD_CIPHER_KEY')?.trim();
    if (configured) {
      return createHash('sha256').update(configured).digest();
    }

    const fallback = this.config.get<string>('DATABASE_URL') ?? 'local-dev-fallback';
    return createHash('sha256').update(fallback).digest();
  }

  private encryptPassword(password: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.cipherKey, iv);
    const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      ciphertext: `${encrypted.toString('base64')}.${tag.toString('base64')}`,
    };
  }

  private decryptPassword(ciphertext: string, ivBase64: string) {
    const [encryptedBase64, tagBase64] = ciphertext.split('.');
    if (!encryptedBase64 || !tagBase64) {
      throw new Error('Invalid encrypted admin password payload');
    }

    const iv = Buffer.from(ivBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');
    const tag = Buffer.from(tagBase64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.cipherKey, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  private generateRandomToken(lengthBytes = 32) {
    return randomBytes(lengthBytes).toString('base64url');
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

    const resolved = await this.resolveCompatibleModWithDependencies(normalized, minecraftVersion, {});
    output.set(resolved.mod.projectId, resolved.mod);

    if (!includeDependencies) {
      return;
    }

    for (const dependencyId of resolved.requiredDependencies) {
      await this.collectMod(dependencyId, minecraftVersion, includeDependencies, output, visited);
    }
  }

  private async resolveCompatibleModWithDependencies(
    projectId: string,
    minecraftVersion: string,
    projectCache: Record<string, ModrinthProject>,
  ): Promise<ResolvedModWithDeps> {
    const cleanProjectId = projectId.trim();
    const cleanMinecraftVersion = minecraftVersion.trim();

    const [project, versions] = await Promise.all([
      this.fetchProject(cleanProjectId, projectCache),
      this.fetchProjectVersions(cleanProjectId),
    ]);

    const selected = this.selectBestCompatibleVersion(project.title, cleanMinecraftVersion, versions);
    const file = selected.files.find((entry) => entry.primary) ?? selected.files[0];

    if (!file) {
      throw new BadGatewayException(`No downloadable file found for '${project.title}'`);
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

  private async fetchProject(projectId: string, cache?: Record<string, ModrinthProject>): Promise<ModrinthProject> {
    if (cache?.[projectId]) {
      return cache[projectId];
    }

    const response = await fetch(`${this.modrinthApiBase}/project/${encodeURIComponent(projectId)}`, {
      headers: {
        'User-Agent': 'mvl-admin-mvp/0.2.0',
      },
    });

    if (!response.ok) {
      throw new BadGatewayException(`Failed to fetch Modrinth project '${projectId}' (${response.status})`);
    }

    const project = (await response.json()) as ModrinthProject;
    if (cache) {
      cache[projectId] = project;
    }

    return project;
  }

  private async fetchProjectVersions(projectId: string): Promise<ModrinthVersion[]> {
    const response = await fetch(`${this.modrinthApiBase}/project/${encodeURIComponent(projectId)}/version`, {
      headers: {
        'User-Agent': 'mvl-admin-mvp/0.2.0',
      },
    });

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
  ): ModrinthVersion {
    const compatible = versions.filter(
      (entry) => entry.loaders.includes('fabric') && entry.game_versions.includes(minecraftVersion),
    );

    if (compatible.length === 0) {
      throw new BadGatewayException(
        `No compatible Fabric version found for '${projectName}' on Minecraft ${minecraftVersion}`,
      );
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
      throw new BadGatewayException(`Failed to download artifact for hash (${response.status})`);
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
        add: nextLock.items.length + nextLock.resources.length + nextLock.shaders.length + nextLock.configs.length,
        remove: 0,
        update: 0,
        keep: 0,
      };
    }

    const prevItems = this.flattenLockItems(previous.data);
    const nextItems = this.flattenLockItems(nextLock);

    const prevMap = new Map(prevItems.map((item) => [this.itemKey(item), item.sha256]));
    const nextMap = new Map(nextItems.map((item) => [this.itemKey(item), item.sha256]));

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
      playButtonLabel?: string;
      hideSingleplayer?: boolean;
      hideMultiplayer?: boolean;
      hideRealms?: boolean;
      titleText?: string;
      subtitleText?: string;
      logoUrl?: string;
      configUrl?: string;
      configSha256?: string;
      assetsUrl?: string;
      assetsSha256?: string;
    };
    previousLockJson?: unknown;
  }): Promise<ProfileLock> {
    const cleanServerName = input.serverName.trim();
    const cleanServerAddress = input.serverAddress.trim();
    const cleanMinecraftVersion = input.minecraftVersion.trim();
    const cleanLoaderVersion = input.loaderVersion.trim();

    const profileId = input.profileId?.trim() || this.slugify(cleanServerName || 'server-profile');
    const includeFancyMenu = input.fancyMenu.enabled ?? true;

    const fancyMenuSettings = FancyMenuSettingsSchema.parse({
      enabled: includeFancyMenu,
      playButtonLabel: input.fancyMenu.playButtonLabel?.trim() || 'Play',
      hideSingleplayer: input.fancyMenu.hideSingleplayer ?? true,
      hideMultiplayer: input.fancyMenu.hideMultiplayer ?? true,
      hideRealms: input.fancyMenu.hideRealms ?? true,
      titleText: input.fancyMenu.titleText?.trim() || undefined,
      subtitleText: input.fancyMenu.subtitleText?.trim() || undefined,
      logoUrl: input.fancyMenu.logoUrl?.trim() || undefined,
      configUrl: input.fancyMenu.configUrl?.trim() || undefined,
      configSha256: input.fancyMenu.configSha256?.trim() || undefined,
      assetsUrl: input.fancyMenu.assetsUrl?.trim() || undefined,
      assetsSha256: input.fancyMenu.assetsSha256?.trim() || undefined,
    });

    const mods = input.mods.filter(
      (entry) => !entry.name.toLowerCase().includes('server lock') && !entry.url.includes('server-lock-'),
    );

    if (includeFancyMenu) {
      const hasFancyMenu = mods.some(
        (entry) => entry.projectId === FANCY_MENU_PROJECT_ID || entry.name.toLowerCase().includes('fancymenu'),
      );

      if (!hasFancyMenu) {
        const fancyMenuMod = await this.resolveCompatibleMod(FANCY_MENU_PROJECT_ID, cleanMinecraftVersion);
        mods.push(fancyMenuMod);
      }
    }

    const configs = [];
    if (fancyMenuSettings.configUrl && fancyMenuSettings.configSha256) {
      configs.push({
        kind: 'config' as const,
        name: 'FancyMenu UI Config',
        url: fancyMenuSettings.configUrl,
        sha256: fancyMenuSettings.configSha256,
      });
    }

    if (fancyMenuSettings.assetsUrl && fancyMenuSettings.assetsSha256) {
      configs.push({
        kind: 'config' as const,
        name: 'FancyMenu Assets',
        url: fancyMenuSettings.assetsUrl,
        sha256: fancyMenuSettings.assetsSha256,
      });
    }

    const previousParsed = ProfileLockSchema.safeParse(input.previousLockJson);
    const previousBranding = previousParsed.success ? previousParsed.data.branding : null;
    const previousRuntime = previousParsed.success ? previousParsed.data.runtimeHints : null;

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
      branding: previousBranding ?? {
        serverName: cleanServerName,
        logoUrl: 'https://images.unsplash.com/photo-1579546929662-711aa81148cf?auto=format&fit=crop&w=320&q=80',
        backgroundUrl:
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80',
        newsUrl: 'https://example.com/news',
      },
      fancyMenu: fancyMenuSettings,
    });
  }

  private extractFancyMenu(value: unknown) {
    const parsed = FancyMenuSettingsSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
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
