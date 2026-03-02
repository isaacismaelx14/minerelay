import { Injectable } from '@nestjs/common';

export const FABRIC_API_PROJECT_ID = 'P7dR8mSH';
export const FANCY_MENU_PROJECT_ID = 'Wq5SjeWM';

export type ManagedMod = {
  kind: 'mod';
  name: string;
  provider: 'modrinth' | 'direct';
  side: 'client';
  projectId?: string;
  versionId?: string;
  url: string;
  sha256: string;
};

export type CoreModPolicyMetadata = {
  fabricApiProjectId: string;
  fancyMenuProjectId: string;
  lockedProjectIds: string[];
  nonRemovableProjectIds: string[];
  rules: {
    fabricApiRequired: true;
    fabricApiVersionEditable: true;
    fancyMenuRequiredWhenEnabled: true;
    fancyMenuEnabled: boolean;
  };
};

@Injectable()
export class CoreModPolicyService {
  private isFancyMenuMod(mod: ManagedMod): boolean {
    const name = mod.name.toLowerCase();
    return (
      mod.projectId === FANCY_MENU_PROJECT_ID ||
      name.includes('fancymenu') ||
      name.includes('fancy menu')
    );
  }

  private isFabricApiMod(mod: ManagedMod): boolean {
    return mod.projectId === FABRIC_API_PROJECT_ID;
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

  buildMetadata(fancyMenuEnabled: boolean): CoreModPolicyMetadata {
    const lockedProjectIds = [FABRIC_API_PROJECT_ID];
    if (fancyMenuEnabled) {
      lockedProjectIds.push(FANCY_MENU_PROJECT_ID);
    }

    return {
      fabricApiProjectId: FABRIC_API_PROJECT_ID,
      fancyMenuProjectId: FANCY_MENU_PROJECT_ID,
      lockedProjectIds,
      nonRemovableProjectIds: [...lockedProjectIds],
      rules: {
        fabricApiRequired: true,
        fabricApiVersionEditable: true,
        fancyMenuRequiredWhenEnabled: true,
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
  }): Promise<ManagedMod[]> {
    const minecraftVersion = input.minecraftVersion.trim();
    const deduped = this.dedupeMods(input.mods);

    const filtered = deduped.filter((mod) => {
      if (this.isFabricApiMod(mod)) {
        return false;
      }

      if (!input.fancyMenuEnabled && this.isFancyMenuMod(mod)) {
        return false;
      }

      return true;
    });

    const fabricApiExisting = deduped.find((mod) => this.isFabricApiMod(mod));
    if (fabricApiExisting?.versionId) {
      try {
        filtered.push(
          await input.resolveMod(
            FABRIC_API_PROJECT_ID,
            minecraftVersion,
            fabricApiExisting.versionId,
          ),
        );
      } catch {
        filtered.push(
          await input.resolveMod(FABRIC_API_PROJECT_ID, minecraftVersion),
        );
      }
    } else {
      filtered.push(
        await input.resolveMod(FABRIC_API_PROJECT_ID, minecraftVersion),
      );
    }

    if (input.fancyMenuEnabled) {
      const fancyExisting = deduped.find((mod) => this.isFancyMenuMod(mod));
      if (fancyExisting?.versionId) {
        try {
          filtered.push(
            await input.resolveMod(
              FANCY_MENU_PROJECT_ID,
              minecraftVersion,
              fancyExisting.versionId,
            ),
          );
        } catch {
          filtered.push(
            await input.resolveMod(FANCY_MENU_PROJECT_ID, minecraftVersion),
          );
        }
      } else {
        filtered.push(
          await input.resolveMod(FANCY_MENU_PROJECT_ID, minecraftVersion),
        );
      }
    }

    return this.dedupeMods(filtered);
  }
}
