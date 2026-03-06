"use client";

import { requestJson } from "@/admin/client/http";
import type {
  AdminMod,
  CoreModPolicy,
  DependencyAnalysis,
  ExarotonSyncModsPayload,
  InstallModsPayload,
  ModVersionsPayload,
  SearchResult,
} from "@/admin/client/types";
import { mergeMods } from "@/admin/shared/domain/mods";
import { useAdminStore } from "@/admin/shared/store/admin-store";

function isClientRequiredMod(
  projectId: string,
  mods: AdminMod[],
  coreModPolicy: CoreModPolicy,
  dependencyMap: Record<string, DependencyAnalysis>,
): boolean {
  if (projectId === coreModPolicy.fabricApiProjectId) {
    return true;
  }
  if (projectId === coreModPolicy.fancyMenuProjectId) {
    return true;
  }

  for (const mod of mods) {
    if (!mod.projectId || mod.side === "server") {
      continue;
    }
    const analysis = dependencyMap[mod.projectId];
    if (analysis?.requiredDependencies?.includes(projectId)) {
      return true;
    }
  }

  return false;
}

function normalizeInstallTarget(
  projectId: string,
  requestedTarget: "client" | "server" | "both",
  mods: AdminMod[],
  coreModPolicy: CoreModPolicy,
  dependencyMap: Record<string, DependencyAnalysis>,
): { target: "client" | "server" | "both"; reason: string | null } {
  if (projectId === coreModPolicy.fabricApiProjectId) {
    return { target: requestedTarget, reason: null };
  }

  if (projectId === coreModPolicy.fancyMenuProjectId) {
    return {
      target: "client",
      reason: "FancyMenu is user-side only.",
    };
  }

  if (
    requestedTarget === "server" &&
    isClientRequiredMod(projectId, mods, coreModPolicy, dependencyMap)
  ) {
    return {
      target: "both",
      reason:
        "This mod is required by a user-side mod, so target was set to User + Server.",
    };
  }

  return { target: requestedTarget, reason: null };
}

export function useModManagerPageModel() {
  const store = useAdminStore();

  const searchMods = async () => {
    const query = store.form.searchQuery?.trim?.() ?? "";
    const minecraftVersion = store.form.minecraftVersion.trim();

    if (!query) {
      store.setStatus("mods", "Type a mod name first.", "error");
      return;
    }

    if (!minecraftVersion) {
      store.setStatus("mods", "Set Minecraft version first.", "error");
      return;
    }

    store.setBusy("search", true);
    store.setStatus("mods", "Searching mods...");

    try {
      const results = await requestJson<SearchResult[]>(
        `/v1/admin/mods/search?query=${encodeURIComponent(query)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}`,
        "GET",
      );
      const normalizedResults = Array.isArray(results) ? results : [];
      store.setSearchResults(normalizedResults);

      const dependencyEntries = await Promise.all(
        normalizedResults.map(async (entry) => {
          try {
            const analysis = await requestJson<DependencyAnalysis>(
              `/v1/admin/mods/analyze?projectId=${encodeURIComponent(entry.projectId)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}`,
              "GET",
            );
            return [entry.projectId, analysis] as const;
          } catch {
            return null;
          }
        }),
      );

      const dependencyRecord: Record<string, DependencyAnalysis> = {};
      for (const result of dependencyEntries) {
        if (result) {
          dependencyRecord[result[0]] = result[1];
        }
      }

      store.setDependencyMap(dependencyRecord);
      store.setStatus("mods", "Search complete.", "ok");
    } catch (error) {
      store.setStatus(
        "mods",
        (error as Error).message || "Search failed.",
        "error",
      );
    } finally {
      store.setBusy("search", false);
    }
  };

  const requestInstall = async (projectId: string) => {
    const fromCache = store.dependencyMap[projectId];
    if (fromCache) {
      store.setPendingInstall({
        projectId,
        title:
          store.searchResults.find((entry) => entry.projectId === projectId)
            ?.title || projectId,
        dependencies: fromCache.dependencyDetails,
      });
      return;
    }

    if (!store.form.minecraftVersion.trim()) {
      store.setStatus("mods", "Set Minecraft version first.", "error");
      return;
    }

    try {
      const analysis = await requestJson<DependencyAnalysis>(
        `/v1/admin/mods/analyze?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(store.form.minecraftVersion.trim())}`,
        "GET",
      );
      store.setDependencyMap((current) => ({
        ...current,
        [projectId]: analysis,
      }));
      store.setPendingInstall({
        projectId,
        title:
          store.searchResults.find((entry) => entry.projectId === projectId)
            ?.title || projectId,
        dependencies: analysis.dependencyDetails,
      });
    } catch (error) {
      store.setStatus(
        "mods",
        (error as Error).message || "Could not load dependency details.",
        "error",
      );
    }
  };

  const analyzeDeps = async (
    projectId: string,
  ): Promise<DependencyAnalysis | null> => {
    const fromCache = store.dependencyMap[projectId];
    if (fromCache) return fromCache;
    if (!store.form.minecraftVersion.trim()) return null;
    try {
      const analysis = await requestJson<DependencyAnalysis>(
        `/v1/admin/mods/analyze?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(store.form.minecraftVersion.trim())}`,
        "GET",
      );
      store.setDependencyMap((current) => ({
        ...current,
        [projectId]: analysis,
      }));
      return analysis;
    } catch {
      return null;
    }
  };

  const requestAndConfirmInstall = async (projectId: string) => {
    const minecraftVersion = store.form.minecraftVersion.trim();
    if (!minecraftVersion) {
      store.setStatus("mods", "Set Minecraft version first.", "error");
      return;
    }
    store.setBusy("install", true);
    try {
      const payload = await requestJson<InstallModsPayload>(
        "/v1/admin/mods/install",
        "POST",
        { projectId, minecraftVersion, includeDependencies: true },
      );
      const mergedMods = mergeMods(store.selectedMods, payload.mods ?? []);
      const synced = await store.ensureCoreMods(
        mergedMods,
        store.form.fancyMenuEnabled === "true",
        minecraftVersion,
      );
      store.setSelectedMods((current) => (synced.length ? synced : current));
      store.setStatus(
        "mods",
        `Installed ${payload.primary?.name || projectId} with ${String(payload.dependencies?.length ?? 0)} dependencies.`,
        "ok",
      );
    } catch (error) {
      store.setStatus(
        "mods",
        (error as Error).message || "Install failed.",
        "error",
      );
    } finally {
      store.setBusy("install", false);
    }
  };

  const confirmInstall = async () => {
    if (!store.pendingInstall) {
      return;
    }
    const minecraftVersion = store.form.minecraftVersion.trim();
    if (!minecraftVersion) {
      store.setStatus("mods", "Set Minecraft version first.", "error");
      return;
    }

    store.setBusy("install", true);
    store.setStatus("mods", "Installing mod and dependencies...");
    try {
      const payload = await requestJson<InstallModsPayload>(
        "/v1/admin/mods/install",
        "POST",
        {
          projectId: store.pendingInstall.projectId,
          minecraftVersion,
          includeDependencies: true,
        },
      );
      const mergedMods = mergeMods(store.selectedMods, payload.mods ?? []);
      const synced = await store.ensureCoreMods(
        mergedMods,
        store.form.fancyMenuEnabled === "true",
        minecraftVersion,
      );
      store.setSelectedMods(synced);
      store.setPendingInstall(null);
      store.setStatus(
        "mods",
        `Installed ${payload.primary?.name || store.pendingInstall.projectId} with ${String(payload.dependencies?.length ?? 0)} dependencies.`,
        "ok",
      );
    } catch (error) {
      store.setStatus(
        "mods",
        (error as Error).message || "Install failed.",
        "error",
      );
    } finally {
      store.setBusy("install", false);
    }
  };

  const removeMod = (projectId: string, sha256?: string) => {
    const nonRemovable = new Set(store.coreModPolicy.nonRemovableProjectIds);
    if (store.form.fancyMenuEnabled === "true") {
      nonRemovable.add(store.coreModPolicy.fancyMenuProjectId);
    }
    if (projectId && nonRemovable.has(projectId)) {
      store.setStatus("mods", "This core mod cannot be removed.", "error");
      return;
    }
    const nextMods = store.selectedMods.filter((entry) => {
      if (projectId && entry.projectId === projectId) return false;
      if (sha256 && entry.sha256 === sha256) return false;
      return true;
    });
    store.setSelectedMods(nextMods);
    store.setStatus("mods", "Mod removed.", "ok");
  };

  const setModInstallTarget = (
    projectId: string,
    target: "client" | "server" | "both",
    sha256?: string,
  ) => {
    const targetKey =
      projectId ||
      store.selectedMods.find((entry) => sha256 && entry.sha256 === sha256)
        ?.projectId ||
      "";
    const normalized = normalizeInstallTarget(
      targetKey,
      target,
      store.selectedMods,
      store.coreModPolicy,
      store.dependencyMap,
    );

    store.setSelectedMods((current) =>
      current.map((entry) => {
        if (projectId && entry.projectId === projectId) {
          return { ...entry, side: normalized.target };
        }
        if (sha256 && entry.sha256 === sha256) {
          return { ...entry, side: normalized.target };
        }
        return entry;
      }),
    );
    store.setStatus(
      "mods",
      normalized.reason || "Mod install target updated.",
      "ok",
    );
  };

  const setModsInstallTargetBulk = (
    entries: Array<{ projectId?: string; sha256?: string }>,
    target: "client" | "server" | "both",
  ) => {
    const keys = new Set(
      entries.map((entry) => entry.projectId || entry.sha256).filter(Boolean),
    );
    if (!keys.size) {
      return;
    }

    const touched = store.selectedMods.filter((mod) =>
      keys.has(mod.projectId || mod.sha256),
    );

    const nextById = new Map<string, "client" | "server" | "both">();
    let autoAdjustedCount = 0;
    for (const mod of touched) {
      const projectId = mod.projectId || "";
      const normalized = normalizeInstallTarget(
        projectId,
        target,
        store.selectedMods,
        store.coreModPolicy,
        store.dependencyMap,
      );
      if (normalized.target !== target) {
        autoAdjustedCount += 1;
      }
      nextById.set(mod.projectId || mod.sha256, normalized.target);
    }

    store.setSelectedMods((mods) =>
      mods.map((mod) => {
        const key = mod.projectId || mod.sha256;
        const mapped = nextById.get(key);
        if (!mapped) {
          return mod;
        }
        return { ...mod, side: mapped };
      }),
    );

    if (autoAdjustedCount > 0) {
      store.setStatus(
        "mods",
        `Bulk target updated. ${String(autoAdjustedCount)} mod(s) were auto-adjusted to safe targets.`,
        "ok",
      );
      return;
    }

    store.setStatus("mods", "Bulk install target updated.", "ok");
  };

  const removeModsBulk = (
    entries: Array<{ projectId?: string; sha256?: string }>,
  ) => {
    if (!entries.length) {
      return;
    }

    const keys = new Set(
      entries.map((entry) => entry.projectId || entry.sha256).filter(Boolean),
    );
    const nonRemovable = new Set(store.coreModPolicy.nonRemovableProjectIds);
    if (store.form.fancyMenuEnabled === "true") {
      nonRemovable.add(store.coreModPolicy.fancyMenuProjectId);
    }

    const next = store.selectedMods.filter((entry) => {
      const key = entry.projectId || entry.sha256;
      if (!keys.has(key)) {
        return true;
      }
      if (entry.projectId && nonRemovable.has(entry.projectId)) {
        return true;
      }
      return false;
    });

    const removedCount = store.selectedMods.length - next.length;
    store.setSelectedMods(next);
    store.setStatus(
      "mods",
      removedCount > 0
        ? `Removed ${String(removedCount)} mod(s).`
        : "No removable mods in selection.",
      removedCount > 0 ? "ok" : "error",
    );
  };

  const loadModVersions = async (projectId: string) => {
    const minecraftVersion = store.form.minecraftVersion.trim();
    if (!minecraftVersion) {
      store.setStatus("mods", "Set Minecraft version first.", "error");
      return;
    }

    try {
      const payload = await requestJson<ModVersionsPayload>(
        `/v1/admin/mods/versions?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}`,
        "GET",
      );
      store.setModVersionOptions((current) => ({
        ...current,
        [projectId]: payload.versions ?? [],
      }));
      store.setStatus(
        "mods",
        `Loaded versions for ${payload.projectTitle}.`,
        "ok",
      );
    } catch (error) {
      store.setStatus(
        "mods",
        (error as Error).message || "Failed to load mod versions.",
        "error",
      );
    }
  };

  const applyModVersion = async (projectId: string, versionId: string) => {
    const minecraftVersion = store.form.minecraftVersion.trim();
    if (!minecraftVersion) {
      store.setStatus("mods", "Set Minecraft version first.", "error");
      return;
    }
    if (!versionId.trim()) {
      return;
    }

    try {
      const resolved = await requestJson<AdminMod>(
        `/v1/admin/mods/resolve?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}&versionId=${encodeURIComponent(versionId)}`,
        "GET",
      );
      store.setSelectedMods((current) =>
        current.map((entry) =>
          entry.projectId === projectId ? resolved : entry,
        ),
      );
      store.setStatus(
        "mods",
        `Updated ${resolved.name} to selected version.`,
        "ok",
      );
    } catch (error) {
      store.setStatus(
        "mods",
        (error as Error).message || "Failed to apply mod version.",
        "error",
      );
    }
  };

  const syncExarotonMods = async () => {
    store.setExaroton((current) => ({ ...current, busy: true }));
    store.setStatus("exaroton", "Running Exaroton mods sync...");
    try {
      const response = await requestJson<ExarotonSyncModsPayload>(
        "/v1/admin/exaroton/mods/sync",
        "POST",
      );
      store.setExaroton((current) => ({ ...current, busy: false }));
      store.setStatus(
        "exaroton",
        response.success
          ? `Exaroton mods synced (+${response.summary.add} / -${response.summary.remove} / =${response.summary.keep}).`
          : response.message,
        response.success ? "ok" : "error",
      );
    } catch (error) {
      store.setExaroton((current) => ({
        ...current,
        busy: false,
        error: (error as Error).message || "Exaroton mods sync failed.",
      }));
      store.setStatus(
        "exaroton",
        (error as Error).message || "Exaroton mods sync failed.",
        "error",
      );
    }
  };

  return {
    ...store,
    searchMods,
    requestInstall,
    analyzeDeps,
    requestAndConfirmInstall,
    confirmInstall,
    cancelInstall: () => store.setPendingInstall(null),
    removeMod,
    removeModsBulk,
    setModInstallTarget,
    setModsInstallTargetBulk,
    loadModVersions,
    applyModVersion,
    syncExarotonMods,
  };
}
