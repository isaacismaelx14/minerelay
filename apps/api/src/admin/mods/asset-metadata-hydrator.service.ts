import { Injectable } from '@nestjs/common';
import { ManagedMod } from '../core-mod-policy.service';
import { ModrinthClientService } from './modrinth-client.service';
import { BootstrapAsset, ModrinthProject } from './mods.types';
import {
  normalizeModrinthProvider,
  normalizeModrinthSideSupport,
  parseModrinthIdsFromUrl,
} from './mods.utils';

@Injectable()
export class AssetMetadataHydratorService {
  constructor(private readonly modrinth: ModrinthClientService) {}

  async hydrateModrinthModMetadata(mods: ManagedMod[]): Promise<ManagedMod[]> {
    if (mods.length === 0) {
      return mods;
    }

    const projectCache: Record<string, ModrinthProject> = {};
    return Promise.all(
      mods.map(async (mod) => {
        const idsFromUrl = parseModrinthIdsFromUrl(mod.url);
        const projectId = mod.projectId?.trim() || idsFromUrl.projectId;
        const versionId = mod.versionId?.trim() || idsFromUrl.versionId;
        const provider = normalizeModrinthProvider(mod.provider, projectId);
        let iconUrl = mod.iconUrl?.trim() || undefined;
        let slug = mod.slug?.trim() || undefined;
        let clientSide =
          normalizeModrinthSideSupport(mod.clientSide) ?? undefined;
        let serverSide =
          normalizeModrinthSideSupport(mod.serverSide) ?? undefined;

        if (
          provider === 'modrinth' &&
          projectId &&
          (!iconUrl || !slug || !clientSide || !serverSide)
        ) {
          try {
            const project = await this.modrinth.fetchProject(
              projectId,
              projectCache,
            );
            iconUrl = iconUrl || project.icon_url;
            slug = slug || project.slug;
            clientSide =
              clientSide ?? normalizeModrinthSideSupport(project.client_side);
            serverSide =
              serverSide ?? normalizeModrinthSideSupport(project.server_side);
          } catch {
            // Best-effort metadata hydration.
          }
        }

        return {
          ...mod,
          provider,
          projectId,
          versionId,
          iconUrl,
          slug,
          clientSide,
          serverSide,
        };
      }),
    );
  }

  async hydrateModrinthAssetMetadata(
    items: BootstrapAsset[],
  ): Promise<BootstrapAsset[]> {
    if (items.length === 0) {
      return items;
    }

    const projectCache: Record<string, ModrinthProject> = {};
    return Promise.all(
      items.map(async (item) => {
        const idsFromUrl = parseModrinthIdsFromUrl(item.url);
        const projectId = item.projectId?.trim() || idsFromUrl.projectId;
        const versionId = item.versionId?.trim() || idsFromUrl.versionId;
        const provider = normalizeModrinthProvider(item.provider, projectId);
        let iconUrl = item.iconUrl?.trim() || undefined;
        let slug = item.slug?.trim() || undefined;

        if (provider === 'modrinth' && projectId && (!iconUrl || !slug)) {
          try {
            const project = await this.modrinth.fetchProject(
              projectId,
              projectCache,
            );
            iconUrl = iconUrl || project.icon_url;
            slug = slug || project.slug;
          } catch {
            // Best-effort metadata hydration.
          }
        }

        return {
          ...item,
          provider,
          projectId,
          versionId,
          iconUrl,
          slug,
        };
      }),
    );
  }
}
