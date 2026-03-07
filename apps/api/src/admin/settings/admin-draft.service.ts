import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BrandingSchema, FancyMenuSettingsSchema } from '@minerelay/shared';
import { PrismaService } from '../../db/prisma.service';
import { SaveDraftDto } from '../admin.dto';
import { AdminAppSettingsStoreService } from './admin-app-settings-store.service';
import { DraftPayload } from './settings.types';

@Injectable()
export class AdminDraftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettingsStore: AdminAppSettingsStoreService,
  ) {}

  async saveDraft(input: SaveDraftDto, serverId: string) {
    if (input.discard === true) {
      return this.discardDraft();
    }

    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
    });
    if (!server) {
      throw new NotFoundException(`Server '${serverId}' not found`);
    }

    const serverName = input.serverName?.trim() || '';
    const serverAddress = input.serverAddress?.trim() || '';
    const profileId = input.profileId?.trim();
    const fancyMenu = this.normalizeFancyMenuSettings(input.fancyMenu);
    const minecraftVersion = input.minecraftVersion?.trim() || undefined;
    const loaderVersion = input.loaderVersion?.trim() || undefined;
    const mods = input.mods || undefined;
    const resources = input.resources || undefined;
    const shaders = input.shaders || undefined;

    const rawBranding = {
      serverName,
      logoUrl: input.branding?.logoUrl?.trim() || undefined,
      backgroundUrl: input.branding?.backgroundUrl?.trim() || undefined,
      newsUrl: input.branding?.newsUrl?.trim() || undefined,
    };

    const brandingParse = BrandingSchema.safeParse(rawBranding);
    if (!brandingParse.success) {
      throw new BadRequestException(
        `Validation failed: ${brandingParse.error.message}`,
      );
    }
    const branding = brandingParse.data;

    const setting = await this.appSettingsStore.savePublishDraft({
      serverName,
      serverAddress,
      profileId: profileId || null,
      minecraftVersion,
      loaderVersion,
      mods,
      resources,
      shaders,
      fancyMenu,
      branding,
    } as Prisma.InputJsonValue);

    const draft = this.extractDraft(setting.publishDraft);
    return {
      server: {
        id: server.id,
        name: draft?.serverName || server.name,
        address: draft?.serverAddress || server.address,
        profileId: draft?.profileId || server.profileId,
      },
      releaseVersion: `${setting.releaseMajor}.${setting.releaseMinor}.${setting.releasePatch}`,
      draft,
    };
  }

  discardDraft() {
    return this.appSettingsStore.discardPublishDraft();
  }

  extractDraft(value: unknown): DraftPayload | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const draft = value as {
      profileId?: unknown;
      serverName?: unknown;
      serverAddress?: unknown;
      minecraftVersion?: unknown;
      loaderVersion?: unknown;
      mods?: unknown;
      resources?: unknown;
      shaders?: unknown;
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
      minecraftVersion:
        typeof draft.minecraftVersion === 'string' &&
        draft.minecraftVersion.trim().length > 0
          ? draft.minecraftVersion.trim()
          : null,
      loaderVersion:
        typeof draft.loaderVersion === 'string' &&
        draft.loaderVersion.trim().length > 0
          ? draft.loaderVersion.trim()
          : null,
      mods: Array.isArray(draft.mods)
        ? (draft.mods as DraftPayload['mods'])
        : null,
      resources: Array.isArray(draft.resources)
        ? (draft.resources as DraftPayload['resources'])
        : null,
      shaders: Array.isArray(draft.shaders)
        ? (draft.shaders as DraftPayload['shaders'])
        : null,
      fancyMenu,
      branding,
    };
  }

  extractFancyMenu(value: unknown): DraftPayload['fancyMenu'] {
    const parsed = FancyMenuSettingsSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  normalizeFancyMenuSettings(input?: {
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

    if (!settings.enabled || settings.mode !== 'custom') {
      return {
        ...settings,
        mode: 'simple' as const,
        customLayoutUrl: undefined,
        customLayoutSha256: undefined,
      };
    }

    return settings;
  }
}
