import { Injectable } from '@nestjs/common';
import { InstallAssetDto, InstallModDto } from '../admin.dto';
import {
  FABRIC_API_PROJECT_ID,
  FANCY_MENU_PROJECT_ID,
  MOD_MENU_PROJECT_ID,
} from '../core-mod-policy.service';
import { AssetResolverService } from './asset-resolver.service';
import { ModrinthClientService } from './modrinth-client.service';
import {
  ManagedResourcePack,
  ManagedShaderPack,
  ModrinthProject,
  ResolvedModWithDeps,
} from './mods.types';
import { normalizeAssetType } from './mods.utils';

@Injectable()
export class ModsInstallPlannerService {
  constructor(
    private readonly resolver: AssetResolverService,
    private readonly modrinth: ModrinthClientService,
  ) {}

  async analyzeModDependencies(projectId: string, minecraftVersion: string) {
    const projectCache: Record<string, ModrinthProject> = {};
    const resolved = await this.resolver.resolveCompatibleModWithDependencies(
      projectId,
      minecraftVersion,
      projectCache,
    );

    const dependencyDetails = await Promise.all(
      resolved.requiredDependencies.map(async (dependencyId) => {
        try {
          const project = await this.modrinth.fetchProject(
            dependencyId,
            projectCache,
          );
          return { projectId: dependencyId, title: project.title };
        } catch {
          return { projectId: dependencyId, title: dependencyId };
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

  async analyzeModDependenciesBatch(
    projectIds: string[],
    minecraftVersion: string,
  ) {
    const entries = await Promise.all(
      projectIds
        .map((value) => value.trim())
        .filter(Boolean)
        .map(async (projectId) => {
          try {
            const result = await this.analyzeModDependencies(
              projectId,
              minecraftVersion,
            );
            return [projectId, result] as const;
          } catch {
            return null;
          }
        }),
    );

    const analysis: Record<
      string,
      Awaited<ReturnType<ModsInstallPlannerService['analyzeModDependencies']>>
    > = {};
    for (const entry of entries) {
      if (!entry) {
        continue;
      }
      analysis[entry[0]] = entry[1];
    }

    return { analysis };
  }

  async installMod(input: InstallModDto) {
    const includeDependencies = input.includeDependencies ?? true;
    const installed = new Map<string, ResolvedModWithDeps['mod']>();
    const primaryResolved =
      await this.resolver.resolveCompatibleModWithDependencies(
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

  async installAsset(input: InstallAssetDto) {
    const assetType = normalizeAssetType(input.type);
    if (assetType === 'mod') {
      return this.installMod(input);
    }

    const resolved = await this.resolver.resolveCompatiblePack(
      input.projectId,
      input.minecraftVersion,
      assetType,
      input.versionId?.trim() || undefined,
    );

    if (assetType === 'resourcepack') {
      return {
        primary: resolved as ManagedResourcePack,
        dependencies: [],
        resources: [resolved],
      };
    }

    return {
      primary: resolved as ManagedShaderPack,
      dependencies: [],
      shaders: [resolved],
    };
  }

  async resolveCoreDependencyProjectIds(
    rootProjectId: string,
    minecraftVersion: string,
    versionId?: string,
  ): Promise<string[]> {
    const cleanVersion = minecraftVersion.trim();
    if (!cleanVersion) {
      return [];
    }

    const dependencyProjectIds = new Set<string>();
    const visited = new Set<string>();

    const walk = async (projectId: string, projectVersionId?: string) => {
      const normalized = projectId.trim();
      if (!normalized || visited.has(normalized)) {
        return;
      }
      visited.add(normalized);

      const resolved = await this.resolver.resolveCompatibleModWithDependencies(
        normalized,
        cleanVersion,
        {},
        projectVersionId,
      );

      for (const dependencyIdRaw of resolved.requiredDependencies) {
        const dependencyId = dependencyIdRaw.trim();
        if (!dependencyId) {
          continue;
        }
        if (
          dependencyId === FABRIC_API_PROJECT_ID ||
          dependencyId === FANCY_MENU_PROJECT_ID ||
          dependencyId === MOD_MENU_PROJECT_ID
        ) {
          continue;
        }

        dependencyProjectIds.add(dependencyId);
        await walk(dependencyId);
      }
    };

    await walk(rootProjectId, versionId);
    return Array.from(dependencyProjectIds);
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
    const resolved = await this.resolver.resolveCompatibleModWithDependencies(
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
}
