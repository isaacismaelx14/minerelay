import type { AdminMod } from "@/admin/client/types";

export function modFingerprint(mod: AdminMod): string {
  return [
    mod.projectId ?? "",
    mod.versionId ?? "",
    mod.sha256 ?? "",
    mod.url ?? "",
    mod.side ?? "client",
  ].join("|");
}

export function isServerRelevantMod(mod: AdminMod): boolean {
  return mod.side === "server" || mod.side === "both";
}

export function computeServerModDiffSummary(
  current: AdminMod[],
  baseline: AdminMod[],
) {
  const baselineMap = new Map<string, AdminMod>();
  for (const mod of baseline.filter(isServerRelevantMod)) {
    baselineMap.set(mod.projectId || mod.name, mod);
  }

  const currentMap = new Map<string, AdminMod>();
  for (const mod of current.filter(isServerRelevantMod)) {
    currentMap.set(mod.projectId || mod.name, mod);
  }

  let add = 0;
  let remove = 0;
  let update = 0;
  let keep = 0;

  for (const [id, mod] of currentMap) {
    const base = baselineMap.get(id);
    if (!base) {
      add += 1;
    } else if (
      base.versionId !== mod.versionId ||
      base.sha256 !== mod.sha256 ||
      base.url !== mod.url
    ) {
      update += 1;
    } else {
      keep += 1;
    }
  }

  for (const id of baselineMap.keys()) {
    if (!currentMap.has(id)) {
      remove += 1;
    }
  }

  return {
    add,
    remove,
    update,
    keep,
    hasChanges: add + remove + update > 0,
  };
}

export function sameMods(left: AdminMod[], right: AdminMod[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const normalizedLeft = left.map(modFingerprint).slice().sort();
  const normalizedRight = right.map(modFingerprint).slice().sort();

  return normalizedLeft.every(
    (value: string, index: number) => value === normalizedRight[index],
  );
}

export function mergeMods(
  current: AdminMod[],
  incoming: AdminMod[],
): AdminMod[] {
  const map = new Map<string, AdminMod>();
  for (const mod of current) {
    const key = mod.projectId?.trim() || mod.name;
    map.set(key, mod);
  }
  for (const mod of incoming) {
    const key = mod.projectId?.trim() || mod.name;
    map.set(key, mod);
  }
  return Array.from(map.values());
}
