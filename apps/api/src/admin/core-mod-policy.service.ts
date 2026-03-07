import { Injectable, Logger } from '@nestjs/common';

export const FABRIC_API_PROJECT_ID = 'P7dR8mSH';
export const FANCY_MENU_PROJECT_ID = 'Wq5SjeWM';
export const MOD_MENU_PROJECT_ID = 'mOgUt4GM';

export type ManagedMod = {
  kind: 'mod';
  name: string;
  provider: 'modrinth' | 'direct';
  side: 'client' | 'server' | 'both';
  clientSide?: 'required' | 'optional' | 'unsupported';
  serverSide?: 'required' | 'optional' | 'unsupported';
  projectId?: string;
  versionId?: string;
  url: string;
  sha256: string;
  iconUrl?: string;
  slug?: string;
};

export type CoreModPolicyMetadata = {
  fabricApiProjectId: string;
  fancyMenuProjectId: string;
  modMenuProjectId: string;
  fancyMenuDependencyProjectIds: string[];
  modMenuDependencyProjectIds: string[];
  lockedProjectIds: string[];
  nonRemovableProjectIds: string[];
  rules: {
    fabricApiRequired: true;
    fabricApiVersionEditable: true;
    fancyMenuRequiredWhenEnabled: true;
    modMenuRequired: true;
    fancyMenuEnabled: boolean;
  };
};

@Injectable()
export class CoreModPolicyService {
  private readonly logger = new Logger(CoreModPolicyService.name);

  private readonly coreProjectIds = new Set([
    FABRIC_API_PROJECT_ID,
    FANCY_MENU_PROJECT_ID,
    MOD_MENU_PROJECT_ID,
  ]);

  private isFancyMenuMod(mod: ManagedMod): boolean {
    const name = mod.name.toLowerCase();
    return (
      mod.projectId === FANCY_MENU_PROJECT_ID ||
      name.includes('fancymenu') ||
      name.includes('fancy menu') ||
      name.includes('fancy-menu')
    );
  }

  private isFabricApiMod(mod: ManagedMod): boolean {
    return mod.projectId === FABRIC_API_PROJECT_ID;
  }

  private isModMenuMod(mod: ManagedMod): boolean {
    const name = mod.name.toLowerCase();
    return (
      mod.projectId === MOD_MENU_PROJECT_ID ||
      mod.projectId === 'modmenu' ||
      name.includes('mod menu') ||
      name.includes('modmenu')
    );
  }

  private dedupeMods(mods: ManagedMod[]): ManagedMod[] {
    const byProject = new Map<string, ManagedMod>();
    const unnamed: ManagedMod[] = [];

    for (const mod of mods) {
      const key = mod.projectId?.trim();
      if (key) {
        byProject.set(key, mod);
      } else {
        unnamed.push(mod);
      }
    }

    return [...byProject.values(), ...unnamed];
  }

  private enforceManagedSide(mod: ManagedMod): ManagedMod {
    if (this.isModMenuMod(mod)) {
      return { ...mod, side: 'client' };
    }

    if (this.isFancyMenuMod(mod)) {
      return { ...mod, side: 'client' };
    }

    return mod;
  }

  private coreProjectIdsWithoutFancyDeps(): string[] {
    return [FABRIC_API_PROJECT_ID, MOD_MENU_PROJECT_ID];
  }

  private async resolveCoreModWithFallback(input: {
    projectId: string;
    minecraftVersion: string;
    existing?: ManagedMod;
    resolveMod: (
      projectId: string,
      minecraftVersion: string,
      versionId?: string,
    ) => Promise<ManagedMod>;
    warningLabel: string;
  }): Promise<ManagedMod> {
    const cleanVersion = input.minecraftVersion.trim();
    if (input.existing?.versionId) {
      try {
        return await input.resolveMod(
          input.projectId,
          cleanVersion,
          input.existing.versionId,
        );
      } catch {
        // Fall back to latest compatible below.
      }
    }

    try {
      return await input.resolveMod(input.projectId, cleanVersion);
    } catch (error) {
      if (input.existing) {
        this.logger.warn(
          `Using existing ${input.warningLabel} because resolver failed: ${(error as Error).message || 'unknown error'}`,
        );
        return input.existing;
      }
      throw error;
    }
  }

  private async collectRequiredDependencies(input: {
    rootProjectId: string;
    rootVersionId?: string;
    ownerLabel: string;
    minecraftVersion: string;
    resolveModWithDependencies?: (
      projectId: string,
      minecraftVersion: string,
      versionId?: string,
    ) => Promise<{ mod: ManagedMod; requiredDependencies: string[] }>;
    resolveMod: (
      projectId: string,
      minecraftVersion: string,
      versionId?: string,
    ) => Promise<ManagedMod>;
    existingByProject: Map<string, ManagedMod>;
  }): Promise<ManagedMod[]> {
    if (!input.resolveModWithDependencies) {
      return [];
    }

    const cleanVersion = input.minecraftVersion.trim();
    const deps: ManagedMod[] = [];
    const visited = new Set<string>();

    const walk = async (projectId: string, versionId?: string) => {
      const normalized = projectId.trim();
      if (!normalized || visited.has(normalized)) {
        return;
      }
      visited.add(normalized);

      const resolved = await input.resolveModWithDependencies!(
        normalized,
        cleanVersion,
        versionId,
      );

      for (const depProjectId of resolved.requiredDependencies) {
        const depId = depProjectId.trim();
        if (!depId || visited.has(depId)) {
          continue;
        }

        const existing = input.existingByProject.get(depId);
        const depResolved = await this.resolveCoreModWithFallback({
          projectId: depId,
          minecraftVersion: cleanVersion,
          existing,
          resolveMod: input.resolveMod,
          warningLabel: `${input.ownerLabel} dependency '${depId}'`,
        });

        const managedDep = this.enforceManagedSide({
          ...depResolved,
          side: 'client',
        });
        deps.push(managedDep);
        await walk(depId);
      }
    };

    await walk(input.rootProjectId, input.rootVersionId);
    return this.dedupeMods(deps);
  }

  buildMetadata(
    fancyMenuEnabled: boolean,
    fancyMenuDependencyProjectIds: string[] = [],
    modMenuDependencyProjectIds: string[] = [],
  ): CoreModPolicyMetadata {
    const normalizeDeps = (ids: string[]) =>
      Array.from(
        new Set(
          ids
            .map((value) => value.trim())
            .filter(
              (value) => value.length > 0 && !this.coreProjectIds.has(value),
            ),
        ),
      );

    const normalizedFancyDeps = normalizeDeps(fancyMenuDependencyProjectIds);
    const normalizedModMenuDeps = normalizeDeps(modMenuDependencyProjectIds);

    const lockedProjectIds = this.coreProjectIdsWithoutFancyDeps();
    const nonRemovableProjectIds = this.coreProjectIdsWithoutFancyDeps();
    lockedProjectIds.push(...normalizedModMenuDeps);
    nonRemovableProjectIds.push(...normalizedModMenuDeps);
    if (fancyMenuEnabled) {
      lockedProjectIds.push(FANCY_MENU_PROJECT_ID);
      nonRemovableProjectIds.push(FANCY_MENU_PROJECT_ID);
      lockedProjectIds.push(...normalizedFancyDeps);
      nonRemovableProjectIds.push(...normalizedFancyDeps);
    }

    return {
      fabricApiProjectId: FABRIC_API_PROJECT_ID,
      fancyMenuProjectId: FANCY_MENU_PROJECT_ID,
      modMenuProjectId: MOD_MENU_PROJECT_ID,
      fancyMenuDependencyProjectIds: normalizedFancyDeps,
      modMenuDependencyProjectIds: normalizedModMenuDeps,
      lockedProjectIds: Array.from(new Set(lockedProjectIds)),
      nonRemovableProjectIds: Array.from(new Set(nonRemovableProjectIds)),
      rules: {
        fabricApiRequired: true,
        fabricApiVersionEditable: true,
        fancyMenuRequiredWhenEnabled: true,
        modMenuRequired: true,
        fancyMenuEnabled,
      },
    };
  }

  async normalizeMods(input: {
    mods: ManagedMod[];
    minecraftVersion: string;
    fancyMenuEnabled: boolean;
    resolveMod: (
      projectId: string,
      minecraftVersion: string,
      versionId?: string,
    ) => Promise<ManagedMod>;
    resolveModWithDependencies?: (
      projectId: string,
      minecraftVersion: string,
      versionId?: string,
    ) => Promise<{ mod: ManagedMod; requiredDependencies: string[] }>;
  }): Promise<ManagedMod[]> {
    const minecraftVersion = input.minecraftVersion.trim();
    const deduped = this.dedupeMods(input.mods);
    const existingByProject = new Map<string, ManagedMod>();
    for (const mod of deduped) {
      const projectId = mod.projectId?.trim();
      if (projectId) {
        existingByProject.set(projectId, mod);
      }
    }

    const filtered = deduped.filter((mod) => {
      if (this.isFabricApiMod(mod)) {
        return false;
      }

      if (this.isModMenuMod(mod)) {
        return false;
      }

      if (!input.fancyMenuEnabled && this.isFancyMenuMod(mod)) {
        return false;
      }

      return true;
    });

    const fabricApiExisting = deduped.find((mod) => this.isFabricApiMod(mod));
    const targetFabricSide = fabricApiExisting?.side ?? 'both';
    const resolvedFabric = await this.resolveCoreModWithFallback({
      projectId: FABRIC_API_PROJECT_ID,
      minecraftVersion,
      existing: fabricApiExisting,
      resolveMod: input.resolveMod,
      warningLabel: 'Fabric API',
    });
    filtered.push(
      this.enforceManagedSide({
        ...resolvedFabric,
        side: targetFabricSide,
      }),
    );

    if (input.fancyMenuEnabled) {
      const fancyExisting = deduped.find((mod) => this.isFancyMenuMod(mod));
      const resolvedFancy = await this.resolveCoreModWithFallback({
        projectId: FANCY_MENU_PROJECT_ID,
        minecraftVersion,
        existing: fancyExisting,
        resolveMod: input.resolveMod,
        warningLabel: 'FancyMenu',
      });
      filtered.push(
        this.enforceManagedSide({
          ...resolvedFancy,
          side: 'client',
        }),
      );

      const fancyDependencies = await this.collectRequiredDependencies({
        rootProjectId: FANCY_MENU_PROJECT_ID,
        rootVersionId: resolvedFancy.versionId,
        ownerLabel: 'FancyMenu',
        minecraftVersion,
        resolveMod: input.resolveMod,
        resolveModWithDependencies: input.resolveModWithDependencies,
        existingByProject,
      });
      for (const dependency of fancyDependencies) {
        if (
          dependency.projectId &&
          this.coreProjectIds.has(dependency.projectId.trim())
        ) {
          continue;
        }
        filtered.push(
          this.enforceManagedSide({
            ...dependency,
            side: 'client',
          }),
        );
      }
    }

    const modMenuExisting = deduped.find((mod) => this.isModMenuMod(mod));
    const resolvedModMenu = await this.resolveCoreModWithFallback({
      projectId: MOD_MENU_PROJECT_ID,
      minecraftVersion,
      existing: modMenuExisting,
      resolveMod: input.resolveMod,
      warningLabel: 'Mod Menu',
    });
    filtered.push(
      this.enforceManagedSide({
        ...resolvedModMenu,
        side: 'client',
      }),
    );

    const modMenuDependencies = await this.collectRequiredDependencies({
      rootProjectId: MOD_MENU_PROJECT_ID,
      rootVersionId: resolvedModMenu.versionId,
      ownerLabel: 'Mod Menu',
      minecraftVersion,
      resolveMod: input.resolveMod,
      resolveModWithDependencies: input.resolveModWithDependencies,
      existingByProject,
    });
    for (const dependency of modMenuDependencies) {
      if (
        dependency.projectId &&
        this.coreProjectIds.has(dependency.projectId.trim())
      ) {
        continue;
      }
      filtered.push(
        this.enforceManagedSide({
          ...dependency,
          side: 'client',
        }),
      );
    }

    return this.dedupeMods(filtered).map((mod) => this.enforceManagedSide(mod));
  }
}
