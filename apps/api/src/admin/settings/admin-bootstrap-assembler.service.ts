import { Injectable, NotFoundException } from '@nestjs/common';
import { BrandingSchema, ProfileLockSchema } from '@minerelay/shared';
import { PrismaService } from '../../db/prisma.service';
import {
  CoreModPolicyService,
  FANCY_MENU_PROJECT_ID,
  ManagedMod,
  MOD_MENU_PROJECT_ID,
} from '../core-mod-policy.service';
import { AdminExarotonContextService } from '../exaroton/admin-exaroton-context.service';
import { AdminModsContextService } from '../mods/admin-mods-context.service';
import { AdminAppSettingsStoreService } from './admin-app-settings-store.service';
import { AdminDraftService } from './admin-draft.service';

@Injectable()
export class AdminBootstrapAssemblerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettingsStore: AdminAppSettingsStoreService,
    private readonly draft: AdminDraftService,
    private readonly coreModPolicy: CoreModPolicyService,
    private readonly mods: AdminModsContextService,
    private readonly exaroton: AdminExarotonContextService,
  ) {}

  async getBootstrap(serverId: string, includeLoaders = false) {
    const [server, latest, settings, exaroton] = await Promise.all([
      this.prisma.server.findUnique({ where: { id: serverId } }),
      this.prisma.profileVersion.findFirst({
        where: { serverId },
        orderBy: { version: 'desc' },
      }),
      this.appSettingsStore.getAppSettings(),
      this.exaroton.getExarotonBootstrapState(),
    ]);

    if (!server || !latest) {
      throw new NotFoundException(
        `No profile version found for server '${serverId}'`,
      );
    }

    const lock = ProfileLockSchema.parse(latest.lockJson);
    const lockMods = lock.items.filter(
      (item): item is ManagedMod => item.kind === 'mod',
    );

    const serverFancyMenu = this.draft.extractFancyMenu(
      server.fancyMenuSettings,
    );
    const profileFancyMenu = this.draft.extractFancyMenu(
      latest.fancyMenuSettings,
    );
    const lockFancyMenu = this.draft.extractFancyMenu(lock.fancyMenu);
    const activeFancyMenu =
      profileFancyMenu ?? serverFancyMenu ?? lockFancyMenu;

    const normalizedMods: ManagedMod[] = await this.coreModPolicy
      .normalizeMods({
        mods: lockMods,
        minecraftVersion: latest.minecraftVersion,
        fancyMenuEnabled: activeFancyMenu?.enabled === true,
        resolveMod: (projectId, minecraftVersion, versionId) =>
          this.mods.resolveCompatibleMod(
            projectId,
            minecraftVersion,
            versionId,
          ),
        resolveModWithDependencies: (projectId, minecraftVersion, versionId) =>
          this.mods.resolveCompatibleModWithDependencies(
            projectId,
            minecraftVersion,
            {},
            versionId,
          ),
      })
      .catch(() => lockMods);

    const lockBrandingResult = BrandingSchema.safeParse(lock.branding);
    const lockBranding = lockBrandingResult.success
      ? lockBrandingResult.data
      : null;
    const rawDraft = this.draft.extractDraft(settings.publishDraft);

    const [publishedMods, publishedResources, publishedShaders] =
      await Promise.all([
        this.mods.hydrateModrinthModMetadata(normalizedMods),
        this.mods.hydrateModrinthAssetMetadata(lock.resources || []),
        this.mods.hydrateModrinthAssetMetadata(lock.shaders || []),
      ]);

    const [draftMods, draftResources, draftShaders] = await Promise.all([
      rawDraft?.mods
        ? this.mods.hydrateModrinthModMetadata(rawDraft.mods)
        : Promise.resolve(null),
      rawDraft?.resources
        ? this.mods.hydrateModrinthAssetMetadata(rawDraft.resources)
        : Promise.resolve(null),
      rawDraft?.shaders
        ? this.mods.hydrateModrinthAssetMetadata(rawDraft.shaders)
        : Promise.resolve(null),
    ]);

    const draft = rawDraft
      ? {
          ...rawDraft,
          mods: draftMods,
          resources: draftResources,
          shaders: draftShaders,
        }
      : null;

    const selectedMinecraftVersion =
      draft?.minecraftVersion || latest.minecraftVersion;
    const publishedFancyDependencyProjectIds =
      activeFancyMenu?.enabled === true
        ? await this.mods
            .resolveCoreDependencyProjectIds(
              FANCY_MENU_PROJECT_ID,
              latest.minecraftVersion,
              normalizedMods.find(
                (mod) => mod.projectId === FANCY_MENU_PROJECT_ID,
              )?.versionId,
            )
            .catch(() => [])
        : [];
    const publishedModMenuDependencyProjectIds = await this.mods
      .resolveCoreDependencyProjectIds(
        MOD_MENU_PROJECT_ID,
        latest.minecraftVersion,
        normalizedMods.find((mod) => mod.projectId === MOD_MENU_PROJECT_ID)
          ?.versionId,
      )
      .catch(() => []);

    const payload = {
      server: {
        id: server.id,
        name: server.name,
        address: server.address,
        profileId: server.profileId,
      },
      latestProfile: {
        version: latest.version,
        releaseVersion: latest.releaseVersion ?? settings.releaseVersion,
        minecraftVersion: latest.minecraftVersion,
        loader: latest.loader,
        loaderVersion: latest.loaderVersion,
        mods: publishedMods,
        resources: publishedResources,
        shaders: publishedShaders,
        fancyMenu: activeFancyMenu,
        coreModPolicy: this.coreModPolicy.buildMetadata(
          activeFancyMenu?.enabled === true,
          publishedFancyDependencyProjectIds,
          publishedModMenuDependencyProjectIds,
        ),
        branding: lockBranding,
      },
      appSettings: settings,
      draft,
      hasSavedDraft: settings.publishDraft !== null,
      exaroton,
    };

    if (!includeLoaders || !selectedMinecraftVersion.trim()) {
      return payload;
    }

    const fabricVersions = await this.mods
      .getFabricVersions(selectedMinecraftVersion)
      .catch(() => null);

    return {
      ...payload,
      fabricVersions,
    };
  }
}
