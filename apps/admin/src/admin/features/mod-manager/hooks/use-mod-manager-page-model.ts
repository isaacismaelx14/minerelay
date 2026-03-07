"use client";

import { useEffect, useRef } from "react";

import { requestJson } from "@/admin/client/http";
import type {
  AdminMod,
  CoreModPolicy,
  DependencyAnalysisBatchPayload,
  DependencyAnalysis,
  ExarotonSyncModsPayload,
  InstallModsPayload,
  ModVersionsPayload,
  SearchResult,
} from "@/admin/client/types";
import { mergeMods } from "@/admin/shared/domain/mods";
import { useAdminStore } from "@/admin/shared/store/admin-store";

type SideSupport = "required" | "optional" | "unsupported";
type InstallTarget = "client" | "server" | "both";

type TargetNormalization = {
  target: InstallTarget;
  reason: string | null;
  tone?: "ok" | "error";
};

type SideCompatibility = {
  clientSide?: SideSupport;
  serverSide?: SideSupport;
};

function normalizeSideSupport(value: unknown): SideSupport | undefined {
  if (value === "required" || value === "optional" || value === "unsupported") {
    return value;
  }
  return undefined;
}

function getCompatibilityForProject(
  projectId: string,
  mods: AdminMod[],
  searchResults: SearchResult[],
): SideCompatibility {
  const fromInstalled = mods.find((mod) => mod.projectId === projectId);
  if (fromInstalled) {
    return {
      clientSide: normalizeSideSupport(fromInstalled.clientSide),
      serverSide: normalizeSideSupport(fromInstalled.serverSide),
    };
  }
  const fromSearch = searchResults.find(
    (result) => result.projectId === projectId,
  );
  return {
    clientSide: normalizeSideSupport(fromSearch?.clientSide),
    serverSide: normalizeSideSupport(fromSearch?.serverSide),
  };
}

function defaultTargetFromCompatibility(
  compatibility: SideCompatibility,
  hasServerIntegration: boolean,
): InstallTarget {
  if (!hasServerIntegration) {
    return "client";
  }

  const clientSide = compatibility.clientSide ?? "optional";
  const serverSide = compatibility.serverSide ?? "optional";

  if (clientSide === "unsupported") {
    return "server";
  }
  if (serverSide === "unsupported") {
    return "client";
  }
  if (clientSide === "required" || serverSide === "required") {
    return "both";
  }
  return "client";
}

function targetCompatibilityWarning(
  target: InstallTarget,
  compatibility: SideCompatibility,
): string | null {
  const clientSide = compatibility.clientSide;
  const serverSide = compatibility.serverSide;
  const usesClient = target === "client" || target === "both";
  const usesServer = target === "server" || target === "both";

  if (usesClient && clientSide === "unsupported") {
    return "Warning: this mod is not supported on client.";
  }
  if (usesServer && serverSide === "unsupported") {
    return "Warning: this mod is not supported on server.";
  }
  if (!usesServer && serverSide === "required") {
    return "Warning: this mod requires server installation.";
  }
  if (!usesClient && clientSide === "required") {
    return "Warning: this mod requires client installation.";
  }

  return null;
}

function clientOnlyInstallWarning(mods: AdminMod[]): string | null {
  const requiresServer = mods.find(
    (mod) => mod.serverSide === "required" || mod.clientSide === "unsupported",
  );
  if (!requiresServer) {
    return null;
  }
  return `Warning: ${requiresServer.name} requires server-side support. Connect a server integration to apply server installs.`;
}

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
  if (projectId === coreModPolicy.modMenuProjectId) {
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
  requestedTarget: InstallTarget,
  mods: AdminMod[],
  coreModPolicy: CoreModPolicy,
  dependencyMap: Record<string, DependencyAnalysis>,
  compatibility: SideCompatibility,
  hasServerIntegration: boolean,
): TargetNormalization {
  if (!hasServerIntegration && requestedTarget !== "client") {
    return {
      target: "client",
      reason:
        "Server integration is not connected. Target was set to User (client-only).",
      tone: "error",
    };
  }

  if (projectId === coreModPolicy.fabricApiProjectId) {
    return { target: requestedTarget, reason: null, tone: "ok" };
  }

  if (projectId === coreModPolicy.fancyMenuProjectId) {
    return {
      target: "client",
      reason: "FancyMenu is user-side only.",
      tone: "ok",
    };
  }

  if (projectId === coreModPolicy.modMenuProjectId) {
    return {
      target: "client",
      reason: "Mod Menu is user-side only.",
      tone: "ok",
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
      tone: "ok",
    };
  }

  const warning = targetCompatibilityWarning(requestedTarget, compatibility);
  if (warning) {
    return { target: requestedTarget, reason: warning, tone: "error" };
  }

  return { target: requestedTarget, reason: null, tone: "ok" };
}

export function useModManagerPageModel() {
  const store = useAdminStore();
  const activeCorePolicy = store.effectiveCorePolicy;
  const selectedModsRef = useRef(store.selectedMods);
  const searchResultsRef = useRef(store.searchResults);
  const fancyEnabledRef = useRef(store.form.fancyMenuEnabled === "true");

  useEffect(() => {
    selectedModsRef.current = store.selectedMods;
  }, [store.selectedMods]);

  useEffect(() => {
    searchResultsRef.current = store.searchResults;
  }, [store.searchResults]);

  useEffect(() => {
    fancyEnabledRef.current = store.form.fancyMenuEnabled === "true";
  }, [store.form.fancyMenuEnabled]);

  const syncInstalledMods = async (
    incomingMods: AdminMod[],
    minecraftVersion: string,
  ) => {
    const currentMods = selectedModsRef.current;
    const incomingProjectIds = new Set(
      incomingMods
        .map((mod) => mod.projectId?.trim())
        .filter(Boolean) as string[],
    );
    const currentSides = new Map(
      currentMods
        .map((mod) => [mod.projectId?.trim(), mod.side] as const)
        .filter((entry): entry is readonly [string, InstallTarget] =>
          Boolean(entry[0] && entry[1]),
        ),
    );

    const mergedMods: AdminMod[] = mergeMods(
      currentMods,
      incomingMods ?? [],
    ).map((mod): AdminMod => {
      const projectId = mod.projectId?.trim();
      if (!projectId) {
        return mod;
      }

      const persistedSide = currentSides.get(projectId);
      if (persistedSide) {
        return { ...mod, side: persistedSide };
      }

      if (!incomingProjectIds.has(projectId)) {
        return mod;
      }

      if (projectId === activeCorePolicy.fabricApiProjectId) {
        return {
          ...mod,
          side: store.exaroton.connected ? "both" : "client",
        };
      }

      const compatibility = getCompatibilityForProject(
        projectId,
        incomingMods,
        searchResultsRef.current,
      );
      return {
        ...mod,
        side: defaultTargetFromCompatibility(
          compatibility,
          store.exaroton.connected,
        ),
      };
    });
    const synced = await store.ensureCoreMods(
      mergedMods,
      fancyEnabledRef.current,
      minecraftVersion,
    );
    const nextMods = synced.length ? synced : currentMods;
    selectedModsRef.current = nextMods;
    store.setSelectedMods(nextMods);
    return nextMods;
  };

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

      const dependencyRecord: Record<string, DependencyAnalysis> = {};
      if (normalizedResults.length > 0) {
        const batch = await requestJson<DependencyAnalysisBatchPayload>(
          "/v1/admin/mods/analyze/batch",
          "POST",
          {
            projectIds: normalizedResults.map((entry) => entry.projectId),
            minecraftVersion,
          },
        );
        for (const [projectId, analysis] of Object.entries(
          batch.analysis ?? {},
        )) {
          if (analysis) {
            dependencyRecord[projectId] = analysis;
          }
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
      await syncInstalledMods(payload.mods ?? [], minecraftVersion);
      const warning = store.exaroton.connected
        ? null
        : clientOnlyInstallWarning(payload.mods ?? []);
      store.setStatus(
        "mods",
        warning
          ? `Installed ${payload.primary?.name || projectId} with ${String(payload.dependencies?.length ?? 0)} dependencies. ${warning}`
          : `Installed ${payload.primary?.name || projectId} with ${String(payload.dependencies?.length ?? 0)} dependencies.`,
        warning ? "error" : "ok",
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
      await syncInstalledMods(payload.mods ?? [], minecraftVersion);
      store.setPendingInstall(null);
      const warning = store.exaroton.connected
        ? null
        : clientOnlyInstallWarning(payload.mods ?? []);
      store.setStatus(
        "mods",
        warning
          ? `Installed ${payload.primary?.name || store.pendingInstall.projectId} with ${String(payload.dependencies?.length ?? 0)} dependencies. ${warning}`
          : `Installed ${payload.primary?.name || store.pendingInstall.projectId} with ${String(payload.dependencies?.length ?? 0)} dependencies.`,
        warning ? "error" : "ok",
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
    if (
      projectId &&
      activeCorePolicy.nonRemovableProjectIds.includes(projectId)
    ) {
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
    target: InstallTarget,
    sha256?: string,
  ) => {
    const targetMod = store.selectedMods.find((entry) => {
      if (projectId && entry.projectId === projectId) return true;
      if (sha256 && entry.sha256 === sha256) return true;
      return false;
    });
    const targetKey =
      projectId ||
      store.selectedMods.find((entry) => sha256 && entry.sha256 === sha256)
        ?.projectId ||
      "";
    const compatibility = {
      clientSide: normalizeSideSupport(targetMod?.clientSide),
      serverSide: normalizeSideSupport(targetMod?.serverSide),
    };
    const normalized = normalizeInstallTarget(
      targetKey,
      target,
      store.selectedMods,
      activeCorePolicy,
      store.dependencyMap,
      compatibility,
      store.exaroton.connected,
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
      normalized.reason ? (normalized.tone ?? "ok") : "ok",
    );
  };

  const setModsInstallTargetBulk = (
    entries: Array<{ projectId?: string; sha256?: string }>,
    target: InstallTarget,
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
    let warningCount = 0;
    for (const mod of touched) {
      const projectId = mod.projectId || "";
      const compatibility = {
        clientSide: normalizeSideSupport(mod.clientSide),
        serverSide: normalizeSideSupport(mod.serverSide),
      };
      const normalized = normalizeInstallTarget(
        projectId,
        target,
        store.selectedMods,
        activeCorePolicy,
        store.dependencyMap,
        compatibility,
        store.exaroton.connected,
      );
      if (normalized.target !== target) {
        autoAdjustedCount += 1;
      }
      if (normalized.tone === "error") {
        warningCount += 1;
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

    if (autoAdjustedCount > 0 || warningCount > 0) {
      store.setStatus(
        "mods",
        warningCount > 0
          ? `Bulk target updated with ${String(warningCount)} compatibility warning(s). ${String(autoAdjustedCount)} mod(s) were auto-adjusted to safe targets.`
          : `Bulk target updated. ${String(autoAdjustedCount)} mod(s) were auto-adjusted to safe targets.`,
        warningCount > 0 ? "error" : "ok",
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
    const next = store.selectedMods.filter((entry) => {
      const key = entry.projectId || entry.sha256;
      if (!keys.has(key)) {
        return true;
      }
      if (
        entry.projectId &&
        activeCorePolicy.nonRemovableProjectIds.includes(entry.projectId)
      ) {
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
    const cleanProjectId = projectId?.trim();
    if (!cleanProjectId) {
      store.setStatus(
        "mods",
        "Cannot load versions for unknown project.",
        "error",
      );
      return;
    }
    const minecraftVersion = store.form.minecraftVersion.trim();
    if (!minecraftVersion) {
      store.setStatus("mods", "Set Minecraft version first.", "error");
      return;
    }

    try {
      const payload = await requestJson<ModVersionsPayload>(
        `/v1/admin/mods/versions?projectId=${encodeURIComponent(cleanProjectId)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}`,
        "GET",
      );
      store.setModVersionOptions((current) => ({
        ...current,
        [cleanProjectId]: payload.versions ?? [],
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
    const cleanProjectId = projectId?.trim();
    if (!cleanProjectId) {
      store.setStatus(
        "mods",
        "Cannot update version for unknown project.",
        "error",
      );
      return;
    }
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
        `/v1/admin/mods/resolve?projectId=${encodeURIComponent(cleanProjectId)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}&versionId=${encodeURIComponent(versionId)}`,
        "GET",
      );
      store.setSelectedMods((current) =>
        current.map((entry) =>
          entry.projectId === cleanProjectId ? resolved : entry,
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
