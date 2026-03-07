import { BadGatewayException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ManagedMod } from '../core-mod-policy.service';
import { AdminHttpClientService } from '../common/admin-http-client.service';
import { ModrinthClientService } from './modrinth-client.service';
import {
  AssetType,
  ManagedResourcePack,
  ManagedShaderPack,
  ModrinthProject,
  ModrinthVersion,
  ResolvedModWithDeps,
} from './mods.types';
import {
  defaultInstallSideFromSupport,
  normalizeAssetType,
  normalizeModrinthSideSupport,
  versionTypeRank,
} from './mods.utils';

@Injectable()
export class AssetResolverService {
  constructor(
    private readonly http: AdminHttpClientService,
    private readonly modrinth: ModrinthClientService,
  ) {}

  async resolveCompatibleMod(
    projectId: string,
    minecraftVersion: string,
    versionId?: string,
  ): Promise<ManagedMod> {
    const resolved = await this.resolveCompatibleModWithDependencies(
      projectId,
      minecraftVersion,
      {},
      versionId,
    );
    return resolved.mod;
  }

  async resolveCompatibleAsset(
    projectId: string,
    minecraftVersion: string,
    type: AssetType = 'mod',
    versionId?: string,
  ) {
    const assetType = normalizeAssetType(type);
    if (assetType === 'mod') {
      return this.resolveCompatibleMod(projectId, minecraftVersion, versionId);
    }

    return this.resolveCompatiblePack(
      projectId,
      minecraftVersion,
      assetType,
      versionId,
    );
  }

  async resolveCompatibleModWithDependencies(
    projectId: string,
    minecraftVersion: string,
    projectCache: Record<string, ModrinthProject>,
    versionId?: string,
  ): Promise<ResolvedModWithDeps> {
    const cleanProjectId = projectId.trim();
    const cleanMinecraftVersion = minecraftVersion.trim();
    const cleanVersionId = versionId?.trim();

    const [project, versions] = await Promise.all([
      this.modrinth.fetchProject(cleanProjectId, projectCache),
      this.modrinth.fetchProjectVersions(cleanProjectId),
    ]);

    const selected = this.selectBestCompatibleVersion(
      project.title,
      cleanMinecraftVersion,
      versions,
      cleanVersionId,
      true,
    );
    const file =
      selected.files.find((entry) => entry.primary === true) ??
      selected.files[0];

    if (!file) {
      throw new BadGatewayException(
        `No downloadable file found for '${project.title}'`,
      );
    }

    const sha256 = await this.computeSha256FromUrl(file.url);
    const clientSide = normalizeModrinthSideSupport(project.client_side);
    const serverSide = normalizeModrinthSideSupport(project.server_side);
    const requiredDependencies = Array.from(
      new Set(
        (selected.dependencies ?? [])
          .filter((dependency) => dependency.dependency_type === 'required')
          .map((dependency) => dependency.project_id?.trim())
          .filter((dependency): dependency is string => Boolean(dependency)),
      ),
    );

    return {
      mod: {
        kind: 'mod',
        name: project.title,
        provider: 'modrinth',
        side: defaultInstallSideFromSupport({ clientSide, serverSide }),
        clientSide,
        serverSide,
        projectId: project.id,
        versionId: selected.id,
        url: file.url,
        sha256,
        iconUrl: project.icon_url,
        slug: project.slug,
      },
      requiredDependencies,
    };
  }

  async resolveCompatiblePack(
    projectId: string,
    minecraftVersion: string,
    type: 'resourcepack' | 'shaderpack',
    versionId?: string,
  ): Promise<ManagedResourcePack | ManagedShaderPack> {
    const cleanProjectId = projectId.trim();
    const cleanMinecraftVersion = minecraftVersion.trim();
    const cleanVersionId = versionId?.trim();

    const [project, versions] = await Promise.all([
      this.modrinth.fetchProject(cleanProjectId, {}),
      this.modrinth.fetchProjectVersions(cleanProjectId),
    ]);

    const selected = this.selectBestCompatibleVersion(
      project.title,
      cleanMinecraftVersion,
      versions,
      cleanVersionId,
      false,
    );
    const file =
      selected.files.find((entry) => entry.primary === true) ??
      selected.files[0];
    if (!file) {
      throw new BadGatewayException(
        `No downloadable file found for '${project.title}'`,
      );
    }

    const sha256 = await this.computeSha256FromUrl(file.url);
    return {
      kind: type,
      name: project.title,
      provider: 'modrinth',
      projectId: project.id,
      versionId: selected.id,
      url: file.url,
      sha256,
      iconUrl: project.icon_url,
      slug: project.slug,
    };
  }

  async getAssetVersions(
    projectId: string,
    minecraftVersion: string,
    type: AssetType = 'mod',
  ) {
    const cleanProjectId = projectId.trim();
    const cleanMinecraftVersion = minecraftVersion.trim();
    if (!cleanProjectId || !cleanMinecraftVersion) {
      return {
        projectId: cleanProjectId,
        minecraftVersion: cleanMinecraftVersion,
        versions: [],
      };
    }

    const project = await this.modrinth.fetchProject(cleanProjectId, {});
    const versions = await this.modrinth.fetchProjectVersions(cleanProjectId);
    const requireFabricLoader = normalizeAssetType(type) === 'mod';
    const compatible = versions
      .filter(
        (entry) =>
          (!requireFabricLoader || entry.loaders.includes('fabric')) &&
          entry.game_versions.includes(cleanMinecraftVersion),
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

  private selectBestCompatibleVersion(
    projectName: string,
    minecraftVersion: string,
    versions: ModrinthVersion[],
    preferredVersionId?: string,
    requireFabricLoader = true,
  ): ModrinthVersion {
    const compatible = versions.filter(
      (entry) =>
        (!requireFabricLoader || entry.loaders.includes('fabric')) &&
        entry.game_versions.includes(minecraftVersion),
    );

    if (compatible.length === 0) {
      throw new BadGatewayException(
        `No compatible version found for '${projectName}' on Minecraft ${minecraftVersion}`,
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
      const leftRank = versionTypeRank(left.version_type);
      const rightRank = versionTypeRank(right.version_type);
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return Date.parse(right.date_published) - Date.parse(left.date_published);
    });

    const selected = compatible[0];
    if (!selected) {
      throw new BadGatewayException(
        `No compatible version found for '${projectName}' on Minecraft ${minecraftVersion}`,
      );
    }
    return selected;
  }

  private async computeSha256FromUrl(url: string): Promise<string> {
    const payload = await this.http.requestBytes(url, {
      upstreamName: 'artifact-download',
      maxResponseBytes: 100 * 1024 * 1024,
    });
    const hash = createHash('sha256');
    hash.update(payload);
    return hash.digest('hex');
  }
}
