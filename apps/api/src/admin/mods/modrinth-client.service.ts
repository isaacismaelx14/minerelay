import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { AdminHttpClientService } from '../common/admin-http-client.service';
import {
  AssetType,
  ModrinthProject,
  ModrinthSearchHit,
  ModrinthSearchResponse,
  ModrinthVersion,
} from './mods.types';
import {
  formatErrorDetails,
  modrinthProjectTypeForAsset,
  normalizeAssetType,
  versionTypeRank,
} from './mods.utils';

@Injectable()
export class ModrinthClientService {
  private readonly logger = new Logger(ModrinthClientService.name);
  private readonly modrinthApiBase = 'https://api.modrinth.com/v2';

  constructor(private readonly http: AdminHttpClientService) {}

  async searchAssets(
    query: string,
    minecraftVersion: string,
    type: AssetType = 'mod',
    limit = 12,
  ): Promise<ModrinthSearchHit[]> {
    const cleanQuery = query.trim();
    const cleanVersion = minecraftVersion.trim();
    const normalizedType = normalizeAssetType(type);
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.trunc(limit), 1), 50)
      : 12;
    const searchQuery = cleanQuery || '';
    const searchIndex = cleanQuery ? 'relevance' : 'follows';
    const facetsArray = [
      [`project_type:${modrinthProjectTypeForAsset(normalizedType)}`],
    ];

    if (cleanVersion) {
      facetsArray.push([`versions:${cleanVersion}`]);
    }

    if (normalizedType === 'mod') {
      facetsArray.push(['categories:fabric']);
    }

    const facets = JSON.stringify(facetsArray);
    const url = `${this.modrinthApiBase}/search?query=${encodeURIComponent(searchQuery)}&index=${searchIndex}&limit=${safeLimit}&facets=${encodeURIComponent(facets)}`;

    const payload = await this.http
      .requestJson<ModrinthSearchResponse>(url, {
        upstreamName: 'modrinth',
      })
      .catch((error) => {
        const detail = formatErrorDetails(error);
        this.logger.error(
          `[modrinth] search failed query=${cleanQuery || '<empty>'} minecraft=${cleanVersion || '<any>'} type=${normalizedType} detail=${detail}`,
        );
        throw new BadGatewayException('Modrinth search failed');
      });

    const mapped: ModrinthSearchHit[] = payload.hits.map((hit) => ({
      projectId: hit.project_id,
      title: hit.title,
      description: hit.description,
      iconUrl: hit.icon_url,
      slug: hit.slug,
      author: hit.author,
      categories: hit.categories,
      latestVersion: hit.latest_version,
      clientSide: hit.client_side,
      serverSide: hit.server_side,
    }));

    if (cleanQuery && cleanVersion) {
      const exact = await this.tryResolveExactAssetSearchHit(
        cleanQuery,
        cleanVersion,
        normalizedType,
      );
      if (
        exact &&
        !mapped.some((entry) => entry.projectId === exact.projectId)
      ) {
        mapped.unshift(exact);
      }
    }

    return mapped;
  }

  async fetchProject(
    projectId: string,
    cache?: Record<string, ModrinthProject>,
  ): Promise<ModrinthProject> {
    const cleanProjectId = projectId.trim();
    if (cache?.[cleanProjectId]) {
      return cache[cleanProjectId];
    }

    const url = `${this.modrinthApiBase}/project/${encodeURIComponent(cleanProjectId)}`;
    const project = await this.http
      .requestJson<ModrinthProject>(url, {
        upstreamName: 'modrinth',
      })
      .catch((error) => {
        const detail = formatErrorDetails(error);
        this.logger.error(
          `[modrinth] project fetch failed projectId=${cleanProjectId} detail=${detail}`,
        );
        throw new BadGatewayException(
          `Failed to fetch Modrinth project '${cleanProjectId}'`,
        );
      });

    if (cache) {
      cache[cleanProjectId] = project;
    }

    return project;
  }

  async fetchProjectVersions(projectId: string): Promise<ModrinthVersion[]> {
    const cleanProjectId = projectId.trim();
    const url = `${this.modrinthApiBase}/project/${encodeURIComponent(cleanProjectId)}/version`;

    return this.http
      .requestJson<ModrinthVersion[]>(url, {
        upstreamName: 'modrinth',
      })
      .catch((error) => {
        const detail = formatErrorDetails(error);
        this.logger.error(
          `[modrinth] versions fetch failed projectId=${cleanProjectId} detail=${detail}`,
        );
        throw new BadGatewayException(
          `Failed to fetch Modrinth versions for '${cleanProjectId}'`,
        );
      });
  }

  private async tryResolveExactAssetSearchHit(
    query: string,
    minecraftVersion: string,
    type: AssetType,
  ): Promise<ModrinthSearchHit | null> {
    try {
      const project = await this.fetchProject(query, {});
      const expectedProjectType = modrinthProjectTypeForAsset(type);
      if (
        project.project_type &&
        project.project_type !== expectedProjectType
      ) {
        return null;
      }

      const versions = await this.fetchProjectVersions(project.id);
      const requireFabricLoader = type === 'mod';
      const compatible = versions
        .filter(
          (entry) =>
            (!requireFabricLoader || entry.loaders.includes('fabric')) &&
            entry.game_versions.includes(minecraftVersion),
        )
        .sort((left, right) => {
          const leftRank = versionTypeRank(left.version_type);
          const rightRank = versionTypeRank(right.version_type);
          if (leftRank !== rightRank) {
            return leftRank - rightRank;
          }
          return (
            Date.parse(right.date_published) - Date.parse(left.date_published)
          );
        });

      const latest = compatible[0];
      if (!latest) {
        return null;
      }

      return {
        projectId: project.id,
        title: project.title,
        description: `Matched by project ID/slug: ${query}`,
        iconUrl: project.icon_url,
        slug: project.slug,
        author: 'Modrinth',
        categories: [],
        latestVersion: latest.name?.trim() || latest.id || undefined,
        clientSide: project.client_side,
        serverSide: project.server_side,
      };
    } catch {
      return null;
    }
  }
}
