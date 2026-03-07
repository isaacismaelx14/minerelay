import { Injectable } from '@nestjs/common';
import { InstallAssetDto, InstallModDto } from '../admin.dto';
import { ManagedMod } from '../core-mod-policy.service';
import { AssetMetadataHydratorService } from './asset-metadata-hydrator.service';
import { AssetResolverService } from './asset-resolver.service';
import { FabricLoaderService } from './fabric-loader.service';
import { ModrinthClientService } from './modrinth-client.service';
import { ModsInstallPlannerService } from './mods-install-planner.service';
import {
  AssetType,
  BootstrapAsset,
  ManagedResourcePack,
  ManagedShaderPack,
  ModrinthProject,
} from './mods.types';

export type {
  AssetType,
  BootstrapAsset,
  ManagedResourcePack,
  ManagedShaderPack,
};

@Injectable()
export class AdminModsContextService {
  constructor(
    private readonly fabric: FabricLoaderService,
    private readonly modrinth: ModrinthClientService,
    private readonly resolver: AssetResolverService,
    private readonly hydrator: AssetMetadataHydratorService,
    private readonly planner: ModsInstallPlannerService,
  ) {}

  getFabricVersions(minecraftVersion: string) {
    return this.fabric.getFabricVersions(minecraftVersion);
  }

  searchMods(query: string, minecraftVersion: string) {
    return this.modrinth.searchAssets(query, minecraftVersion, 'mod');
  }

  searchAssets(
    query: string,
    minecraftVersion: string,
    type: AssetType = 'mod',
    limit = 12,
  ) {
    return this.modrinth.searchAssets(query, minecraftVersion, type, limit);
  }

  popularAssets(minecraftVersion: string, type: AssetType = 'mod', limit = 10) {
    return this.modrinth.searchAssets('', minecraftVersion, type, limit);
  }

  analyzeModDependencies(projectId: string, minecraftVersion: string) {
    return this.planner.analyzeModDependencies(projectId, minecraftVersion);
  }

  analyzeModDependenciesBatch(projectIds: string[], minecraftVersion: string) {
    return this.planner.analyzeModDependenciesBatch(
      projectIds,
      minecraftVersion,
    );
  }

  installMod(input: InstallModDto) {
    return this.planner.installMod(input);
  }

  installAsset(input: InstallAssetDto) {
    return this.planner.installAsset(input);
  }

  resolveCompatibleMod(
    projectId: string,
    minecraftVersion: string,
    versionId?: string,
  ) {
    return this.resolver.resolveCompatibleMod(
      projectId,
      minecraftVersion,
      versionId,
    );
  }

  resolveCompatibleAsset(
    projectId: string,
    minecraftVersion: string,
    type: AssetType = 'mod',
    versionId?: string,
  ) {
    return this.resolver.resolveCompatibleAsset(
      projectId,
      minecraftVersion,
      type,
      versionId,
    );
  }

  resolveCompatibleModWithDependencies(
    projectId: string,
    minecraftVersion: string,
    projectCache: Record<string, ModrinthProject>,
    versionId?: string,
  ) {
    return this.resolver.resolveCompatibleModWithDependencies(
      projectId,
      minecraftVersion,
      projectCache,
      versionId,
    );
  }

  getModVersions(projectId: string, minecraftVersion: string) {
    return this.resolver.getAssetVersions(projectId, minecraftVersion, 'mod');
  }

  getAssetVersions(
    projectId: string,
    minecraftVersion: string,
    type: AssetType = 'mod',
  ) {
    return this.resolver.getAssetVersions(projectId, minecraftVersion, type);
  }

  resolveCoreDependencyProjectIds(
    rootProjectId: string,
    minecraftVersion: string,
    versionId?: string,
  ) {
    return this.planner.resolveCoreDependencyProjectIds(
      rootProjectId,
      minecraftVersion,
      versionId,
    );
  }

  hydrateModrinthModMetadata(mods: ManagedMod[]) {
    return this.hydrator.hydrateModrinthModMetadata(mods);
  }

  hydrateModrinthAssetMetadata(items: BootstrapAsset[]) {
    return this.hydrator.hydrateModrinthAssetMetadata(items);
  }
}
