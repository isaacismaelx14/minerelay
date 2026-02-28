import { BadGatewayException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ProfileLock, ProfileLockSchema } from '@mvl/shared';
import { GenerateLockfileDto } from './admin.dto';

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

interface ModrinthVersion {
  id: string;
  version_type: 'release' | 'beta' | 'alpha';
  date_published: string;
  game_versions: string[];
  loaders: string[];
  files: Array<{
    url: string;
    primary?: boolean;
  }>;
}

const FANCY_MENU_PROJECT_ID = 'Wq5SjeWM';

@Injectable()
export class AdminService {
  private readonly modrinthApiBase = 'https://api.modrinth.com/v2';

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
        'User-Agent': 'mvl-admin-mvp/0.1.0',
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

  async resolveCompatibleMod(projectId: string, minecraftVersion: string) {
    const cleanProjectId = projectId.trim();
    const cleanMinecraftVersion = minecraftVersion.trim();

    const [project, versions] = await Promise.all([
      this.fetchProject(cleanProjectId),
      this.fetchProjectVersions(cleanProjectId),
    ]);

    const compatible = versions.filter(
      (entry) =>
        entry.loaders.includes('fabric') &&
        entry.game_versions.includes(cleanMinecraftVersion),
    );

    if (compatible.length === 0) {
      throw new BadGatewayException(
        `No compatible Fabric version found for '${project.title}' on Minecraft ${cleanMinecraftVersion}`,
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
        `No compatible Fabric version found for '${project.title}' on Minecraft ${cleanMinecraftVersion}`,
      );
    }
    const file =
      selected.files.find((entry) => entry.primary) ?? selected.files[0];

    if (!file) {
      throw new BadGatewayException(
        `No downloadable file found for '${project.title}'`,
      );
    }

    const sha256 = await this.computeSha256FromUrl(file.url);

    return {
      kind: 'mod',
      name: project.title,
      provider: 'modrinth',
      side: 'client',
      projectId: project.id,
      versionId: selected.id,
      url: file.url,
      sha256,
    } as const;
  }

  async generateLockfile(
    input: GenerateLockfileDto,
    _requestOrigin: string,
  ): Promise<ProfileLock> {
    const cleanServerName = input.serverName.trim();
    const cleanServerAddress = input.serverAddress.trim();
    const cleanMinecraftVersion = input.minecraftVersion.trim();
    const cleanLoaderVersion = input.loaderVersion.trim();

    const profileId =
      input.profileId?.trim() ||
      this.slugify(cleanServerName || 'server-profile');
    const version = input.version ?? 1;
    const includeFancyMenu = input.includeFancyMenu ?? true;
    const fancyMenuSettings = {
      enabled: includeFancyMenu,
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
    };
    const mods = input.mods.filter(
      (entry) =>
        !entry.name.toLowerCase().includes('server lock') &&
        !entry.url.includes('server-lock-'),
    );

    if (includeFancyMenu) {
      const hasFancyMenu = mods.some(
        (entry) =>
          entry.projectId === FANCY_MENU_PROJECT_ID ||
          entry.name.toLowerCase().includes('fancymenu'),
      );

      if (!hasFancyMenu) {
        const fancyMenu = await this.resolveCompatibleMod(
          FANCY_MENU_PROJECT_ID,
          cleanMinecraftVersion,
        );
        mods.push(fancyMenu);
      }
    }

    const configs = [];

    const fancyMenuConfigUrl = fancyMenuSettings.configUrl;
    const fancyMenuConfigSha256 = fancyMenuSettings.configSha256;
    if (fancyMenuConfigUrl && fancyMenuConfigSha256) {
      configs.push({
        name: 'FancyMenu UI Config',
        url: fancyMenuConfigUrl,
        sha256: fancyMenuConfigSha256,
      });
    }

    const fancyMenuAssetsUrl = fancyMenuSettings.assetsUrl;
    const fancyMenuAssetsSha256 = fancyMenuSettings.assetsSha256;
    if (fancyMenuAssetsUrl && fancyMenuAssetsSha256) {
      configs.push({
        name: 'FancyMenu Assets',
        url: fancyMenuAssetsUrl,
        sha256: fancyMenuAssetsSha256,
      });
    }

    return ProfileLockSchema.parse({
      profileId,
      version,
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
      runtimeHints: {
        javaMajor: 17,
        minMemoryMb: 4096,
        maxMemoryMb: 8192,
      },
      branding: {
        serverName: cleanServerName,
        logoUrl:
          'https://images.unsplash.com/photo-1579546929662-711aa81148cf?auto=format&fit=crop&w=320&q=80',
        backgroundUrl:
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80',
        newsUrl: 'https://example.com/news',
      },
      fancyMenu: fancyMenuSettings,
    });
  }

  private async fetchProject(projectId: string): Promise<ModrinthProject> {
    const response = await fetch(
      `${this.modrinthApiBase}/project/${encodeURIComponent(projectId)}`,
      {
        headers: {
          'User-Agent': 'mvl-admin-mvp/0.1.0',
        },
      },
    );

    if (!response.ok) {
      throw new BadGatewayException(
        `Failed to fetch Modrinth project '${projectId}' (${response.status})`,
      );
    }

    return (await response.json()) as ModrinthProject;
  }

  private async fetchProjectVersions(
    projectId: string,
  ): Promise<ModrinthVersion[]> {
    const response = await fetch(
      `${this.modrinthApiBase}/project/${encodeURIComponent(projectId)}/version`,
      {
        headers: {
          'User-Agent': 'mvl-admin-mvp/0.1.0',
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

  private async computeSha256FromUrl(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'mvl-admin-mvp/0.1.0',
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

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
