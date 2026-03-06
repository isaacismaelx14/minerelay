"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type Dispatch,
  type PropsWithChildren,
  type ReactElement,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";

import { authFetch, clearAdminSession, requestJson } from "@/admin/client/http";
import type {
  AdminMod,
  CoreModPolicy,
  DependencyAnalysis,
  ExarotonServersPayload,
  FabricVersionsPayload,
  SearchResult,
} from "@/admin/client/types";
import {
  buildPublishSnapshot,
  DEFAULT_EXAROTON,
  DEFAULT_FORM,
  DEFAULT_POLICY,
  DEFAULT_STATUS,
  type ExarotonState,
  type FormState,
  type LoaderOption,
  mapBootstrapToForm,
  mapStatusToExarotonState,
  type PendingInstall,
  type PublishSnapshot,
  type RailState,
  type StatusState,
  type StatusTone,
  samePublishSnapshot,
} from "@/admin/shared/domain/admin-form";
import {
  getAdminPathForView,
  type AdminView,
} from "@/admin/shared/domain/admin-view";
import {
  computeServerModDiffSummary,
  mergeMods,
  sameMods,
} from "@/admin/shared/domain/mods";
import { bumpSemver, normalizeSemver } from "@/admin/shared/domain/release";
import {
  readBootstrapPayload,
  readFabricVersionsPayload,
} from "@/admin/shared/services/bootstrap";

type BusyState = {
  bootstrap: boolean;
  search: boolean;
  publish: boolean;
  install: boolean;
};

type AdminStoreValue = {
  view: AdminView;
  setView: (view: AdminView) => void;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  setTextFieldFromEvent: (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  setSearchQuery: (query: string) => void;
  selectedMods: AdminMod[];
  setSelectedMods: Dispatch<SetStateAction<AdminMod[]>>;
  coreModPolicy: CoreModPolicy;
  setCoreModPolicy: Dispatch<SetStateAction<CoreModPolicy>>;
  effectiveCorePolicy: CoreModPolicy;
  searchResults: SearchResult[];
  setSearchResults: Dispatch<SetStateAction<SearchResult[]>>;
  dependencyMap: Record<string, DependencyAnalysis>;
  setDependencyMap: Dispatch<
    SetStateAction<Record<string, DependencyAnalysis>>
  >;
  pendingInstall: PendingInstall | null;
  setPendingInstall: Dispatch<SetStateAction<PendingInstall | null>>;
  modVersionOptions: Record<
    string,
    Array<{
      id: string;
      name: string;
      versionType: "release" | "beta" | "alpha";
      publishedAt: string;
    }>
  >;
  setModVersionOptions: Dispatch<
    SetStateAction<
      Record<
        string,
        Array<{
          id: string;
          name: string;
          versionType: "release" | "beta" | "alpha";
          publishedAt: string;
        }>
      >
    >
  >;
  loaderOptions: LoaderOption[];
  setLoaderOptions: Dispatch<SetStateAction<LoaderOption[]>>;
  statuses: StatusState;
  setStatus: (name: keyof StatusState, text: string, tone?: StatusTone) => void;
  exaroton: ExarotonState;
  setExaroton: Dispatch<SetStateAction<ExarotonState>>;
  sessionState: "pending" | "active";
  setSessionState: Dispatch<SetStateAction<"pending" | "active">>;
  hasSavedDraft: boolean;
  setHasSavedDraft: Dispatch<SetStateAction<boolean>>;
  isBusy: BusyState;
  setBusy: (name: keyof BusyState, value: boolean) => void;
  baselineMods: AdminMod[];
  setBaselineMods: Dispatch<SetStateAction<AdminMod[]>>;
  baselineRuntime: {
    minecraftVersion: string;
    loaderVersion: string;
  };
  setBaselineRuntime: Dispatch<
    SetStateAction<{
      minecraftVersion: string;
      loaderVersion: string;
    }>
  >;
  lastPublishedSnapshot: PublishSnapshot | null;
  setLastPublishedSnapshot: Dispatch<SetStateAction<PublishSnapshot | null>>;
  rail: RailState;
  summaryStats: {
    add: number;
    remove: number;
    update: number;
    keep: number;
  };
  hasPendingPublish: boolean;
  hasPendingServerModChanges: boolean;
  publishBlockReason: string | null;
  loadBootstrap: (force?: boolean) => Promise<void>;
  loadFabricVersions: (
    minecraftVersionInput: string,
    force?: boolean,
  ) => Promise<void>;
  ensureCoreMods: (
    mods: AdminMod[],
    fancyEnabled: boolean,
    minecraftVersion: string,
  ) => Promise<AdminMod[]>;
  logout: () => Promise<void>;
};

const AdminStoreContext = createContext<AdminStoreValue | null>(null);

export function AdminStoreProvider({
  children,
  initialView = "overview",
}: PropsWithChildren<{ initialView?: AdminView }>): ReactElement {
  const router = useRouter();
  const [view, setCurrentView] = useState<AdminView>(initialView);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [selectedMods, setSelectedMods] = useState<AdminMod[]>([]);
  const [coreModPolicy, setCoreModPolicy] =
    useState<CoreModPolicy>(DEFAULT_POLICY);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [dependencyMap, setDependencyMap] = useState<
    Record<string, DependencyAnalysis>
  >({});
  const [pendingInstall, setPendingInstall] = useState<PendingInstall | null>(
    null,
  );
  const [modVersionOptions, setModVersionOptions] = useState<
    Record<
      string,
      Array<{
        id: string;
        name: string;
        versionType: "release" | "beta" | "alpha";
        publishedAt: string;
      }>
    >
  >({});
  const [loaderOptions, setLoaderOptions] = useState<LoaderOption[]>([]);
  const [sessionState, setSessionState] = useState<"pending" | "active">(
    "pending",
  );
  const [statuses, setStatuses] = useState<StatusState>(DEFAULT_STATUS);
  const [exaroton, setExaroton] = useState<ExarotonState>(DEFAULT_EXAROTON);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [isBusy, setBusyState] = useState<BusyState>({
    bootstrap: false,
    search: false,
    publish: false,
    install: false,
  });
  const [baselineMods, setBaselineMods] = useState<AdminMod[]>([]);
  const [baselineRuntime, setBaselineRuntime] = useState({
    minecraftVersion: "",
    loaderVersion: "",
  });
  const [lastPublishedSnapshot, setLastPublishedSnapshot] =
    useState<PublishSnapshot | null>(null);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);

  useEffect(() => {
    setCurrentView(initialView);
  }, [initialView]);

  const setView = useCallback(
    (nextView: AdminView) => {
      setCurrentView(nextView);
      const nextPath = getAdminPathForView(nextView);
      if (
        typeof window !== "undefined" &&
        window.location.pathname === nextPath
      ) {
        return;
      }
      startTransition(() => {
        router.push(nextPath);
      });
    },
    [router],
  );

  const setStatus = useCallback(
    (name: keyof StatusState, text: string, tone: StatusTone = "idle") => {
      setStatuses((current) => ({
        ...current,
        [name]: { text, tone },
      }));
    },
    [],
  );

  const setBusy = useCallback((name: keyof BusyState, value: boolean) => {
    setBusyState((current) => ({ ...current, [name]: value }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setForm((current) => ({ ...current, searchQuery: query }));
  }, []);

  const setTextFieldFromEvent = useCallback(
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const target = event.currentTarget;
      const key = target.name as keyof FormState;
      setForm((current) => ({
        ...current,
        [key]: target.value,
      }));
    },
    [],
  );

  const loadFabricVersions = useCallback(
    async (minecraftVersionInput: string, force = false) => {
      const minecraftVersion = minecraftVersionInput.trim();
      if (!minecraftVersion) {
        setStatus("settings", "Set Minecraft version first.", "error");
        return;
      }

      setStatus("settings", "Loading Fabric versions...");
      try {
        const payload: FabricVersionsPayload = await readFabricVersionsPayload(
          minecraftVersion,
          force,
        );

        const options = payload.loaders ?? [];
        setLoaderOptions(options);
        setForm((current) => {
          const hasCurrent = options.some(
            (entry) => entry.version === current.loaderVersion,
          );
          if (hasCurrent) {
            return current;
          }

          const nextLoader =
            payload.latestStable ??
            options[0]?.version ??
            current.loaderVersion;
          return {
            ...current,
            loaderVersion: nextLoader,
          };
        });
        setStatus("settings", "Fabric versions updated.", "ok");
      } catch (error) {
        setStatus(
          "settings",
          (error as Error).message || "Failed loading Fabric versions.",
          "error",
        );
      }
    },
    [setStatus],
  );

  const ensureCoreMods = useCallback(
    async (
      mods: AdminMod[],
      fancyEnabled: boolean,
      minecraftVersion: string,
    ) => {
      const cleanVersion = minecraftVersion.trim();
      if (!cleanVersion) {
        return mods;
      }

      let next = [...mods];
      if (!fancyEnabled) {
        next = next.filter(
          (mod) => mod.projectId !== coreModPolicy.fancyMenuProjectId,
        );
      }

      const resolveProject = async (projectId: string): Promise<AdminMod> =>
        requestJson<AdminMod>(
          `/v1/admin/mods/resolve?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(cleanVersion)}`,
          "GET",
        );

      const hasFabric = next.some(
        (mod) => mod.projectId === coreModPolicy.fabricApiProjectId,
      );
      if (!hasFabric) {
        try {
          const fabric = await resolveProject(coreModPolicy.fabricApiProjectId);
          next = mergeMods(next, [fabric]);
        } catch {
          setStatus("mods", "Could not auto-sync Fabric API.", "error");
        }
      }

      if (fancyEnabled) {
        const hasFancy = next.some(
          (mod) => mod.projectId === coreModPolicy.fancyMenuProjectId,
        );
        if (!hasFancy) {
          try {
            const fancy = await resolveProject(
              coreModPolicy.fancyMenuProjectId,
            );
            next = mergeMods(next, [fancy]);
          } catch {
            setStatus("mods", "Could not auto-sync FancyMenu mod.", "error");
          }
        }
      }

      return next;
    },
    [
      coreModPolicy.fabricApiProjectId,
      coreModPolicy.fancyMenuProjectId,
      setStatus,
    ],
  );

  const loadBootstrap = useCallback(
    async (force = false) => {
      setBusy("bootstrap", true);
      setStatus("bootstrap", "Loading bootstrap...");

      try {
        const payload = await readBootstrapPayload(force);
        const nextForm = mapBootstrapToForm(payload);
        setForm(nextForm);
        setExaroton((current) =>
          mapStatusToExarotonState(payload.exaroton, current),
        );
        setCoreModPolicy(payload.latestProfile.coreModPolicy ?? DEFAULT_POLICY);
        setSelectedMods(payload.latestProfile.mods ?? []);
        setBaselineMods(payload.latestProfile.mods ?? []);
        setBaselineRuntime({
          minecraftVersion: payload.latestProfile.minecraftVersion ?? "",
          loaderVersion: payload.latestProfile.loaderVersion ?? "",
        });
        setSessionState("active");
        setHasSavedDraft(payload.hasSavedDraft ?? payload.draft !== null);
        setStatus("bootstrap", "Bootstrap loaded.", "ok");
        await loadFabricVersions(nextForm.minecraftVersion);
        const syncedMods = await ensureCoreMods(
          payload.latestProfile.mods ?? [],
          nextForm.fancyMenuEnabled === "true",
          nextForm.minecraftVersion,
        );
        setSelectedMods(syncedMods);
        if (payload.exaroton.connected) {
          const serverPayload = await requestJson<ExarotonServersPayload>(
            "/v1/admin/exaroton/servers",
            "GET",
          ).catch(() => null);
          if (serverPayload) {
            setExaroton((current) => ({
              ...current,
              servers: serverPayload.servers ?? [],
            }));
          }
        }
        setLastPublishedSnapshot(buildPublishSnapshot(nextForm, syncedMods));
      } catch (error) {
        setStatus(
          "bootstrap",
          (error as Error).message || "Bootstrap failed.",
          "error",
        );
      } finally {
        setBusy("bootstrap", false);
      }
    },
    [ensureCoreMods, loadFabricVersions, setBusy, setStatus],
  );

  useEffect(() => {
    if (hasBootstrapped) {
      return;
    }
    setHasBootstrapped(true);
    void loadBootstrap();
  }, [hasBootstrapped, loadBootstrap]);

  useEffect(() => {
    if (sessionState !== "active") {
      return;
    }
    void (async () => {
      const synced = await ensureCoreMods(
        selectedMods,
        form.fancyMenuEnabled === "true",
        form.minecraftVersion,
      );
      if (!sameMods(synced, selectedMods)) {
        setSelectedMods(synced);
      }
    })();
  }, [
    ensureCoreMods,
    form.fancyMenuEnabled,
    form.minecraftVersion,
    selectedMods,
    sessionState,
  ]);

  const effectiveCorePolicy = useMemo<CoreModPolicy>(() => {
    const nonRemovable = new Set(coreModPolicy.nonRemovableProjectIds);
    const locked = new Set(coreModPolicy.lockedProjectIds);
    if (form.fancyMenuEnabled === "true") {
      nonRemovable.add(coreModPolicy.fancyMenuProjectId);
      locked.add(coreModPolicy.fancyMenuProjectId);
    } else {
      nonRemovable.delete(coreModPolicy.fancyMenuProjectId);
      locked.delete(coreModPolicy.fancyMenuProjectId);
    }

    return {
      ...coreModPolicy,
      lockedProjectIds: Array.from(locked),
      nonRemovableProjectIds: Array.from(nonRemovable),
      rules: {
        ...coreModPolicy.rules,
        fancyMenuEnabled: form.fancyMenuEnabled === "true",
      },
    };
  }, [coreModPolicy, form.fancyMenuEnabled]);

  const rail = useMemo<RailState>(() => {
    let bumpType: "major" | "minor" | "patch" = "patch";
    if (
      baselineRuntime.minecraftVersion.trim() !==
        form.minecraftVersion.trim() ||
      baselineRuntime.loaderVersion.trim() !== form.loaderVersion.trim()
    ) {
      bumpType = "major";
    } else if (!sameMods(selectedMods, baselineMods)) {
      bumpType = "minor";
    }
    const currentRelease = normalizeSemver(form.currentReleaseVersion);
    const nextRelease = bumpSemver(currentRelease, bumpType);
    return {
      minecraft: `MC: ${form.minecraftVersion.trim() || "-"}`,
      fabric: `Fabric: ${form.loaderVersion.trim() || "-"}`,
      nextRelease: `Next release: ${nextRelease} (${bumpType})`,
    };
  }, [baselineMods, baselineRuntime, form, selectedMods]);

  const summaryStats = useMemo(() => {
    const baselineMap = new Map<string, AdminMod>();
    for (const mod of baselineMods) {
      baselineMap.set(mod.projectId || mod.name, mod);
    }

    const currentMap = new Map<string, AdminMod>();
    for (const mod of selectedMods) {
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
        base.sha256 !== mod.sha256
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

    return { add, remove, update, keep };
  }, [baselineMods, selectedMods]);

  const serverModSummary = useMemo(
    () => computeServerModDiffSummary(selectedMods, baselineMods),
    [baselineMods, selectedMods],
  );

  const hasPendingServerModChanges = serverModSummary.hasChanges;

  const publishBlockReason = useMemo<string | null>(() => {
    if (!hasPendingServerModChanges) {
      return null;
    }
    if (!exaroton.connected || !exaroton.selectedServer) {
      return null;
    }
    if (!exaroton.settings.modsSyncEnabled) {
      return null;
    }

    const status = exaroton.selectedServer.status;
    if (![0, 7].includes(status)) {
      return "Cannot publish pending server mod changes while Exaroton server is running. Stop the server first.";
    }
    return null;
  }, [
    exaroton.connected,
    exaroton.selectedServer,
    exaroton.settings.modsSyncEnabled,
    hasPendingServerModChanges,
  ]);

  const hasPendingPublish = useMemo(() => {
    if (sessionState !== "active") {
      return false;
    }
    const nextSnapshot = buildPublishSnapshot(form, selectedMods);
    return (
      !samePublishSnapshot(lastPublishedSnapshot, nextSnapshot) ||
      !sameMods(nextSnapshot.mods, lastPublishedSnapshot?.mods ?? [])
    );
  }, [form, lastPublishedSnapshot, selectedMods, sessionState]);

  const logout = useCallback(async () => {
    try {
      await authFetch("/v1/admin/auth/logout", { method: "POST" });
    } finally {
      clearAdminSession();
      window.location.href = "/login";
    }
  }, []);

  const value = useMemo<AdminStoreValue>(
    () => ({
      view,
      setView,
      form,
      setForm,
      setTextFieldFromEvent,
      setSearchQuery,
      selectedMods,
      setSelectedMods,
      coreModPolicy,
      setCoreModPolicy,
      effectiveCorePolicy,
      searchResults,
      setSearchResults,
      dependencyMap,
      setDependencyMap,
      pendingInstall,
      setPendingInstall,
      modVersionOptions,
      setModVersionOptions,
      loaderOptions,
      setLoaderOptions,
      statuses,
      setStatus,
      exaroton,
      setExaroton,
      sessionState,
      setSessionState,
      hasSavedDraft,
      setHasSavedDraft,
      isBusy,
      setBusy,
      baselineMods,
      setBaselineMods,
      baselineRuntime,
      setBaselineRuntime,
      lastPublishedSnapshot,
      setLastPublishedSnapshot,
      rail,
      summaryStats,
      hasPendingPublish,
      hasPendingServerModChanges,
      publishBlockReason,
      loadBootstrap,
      loadFabricVersions,
      ensureCoreMods,
      logout,
    }),
    [
      baselineMods,
      baselineRuntime,
      coreModPolicy,
      dependencyMap,
      effectiveCorePolicy,
      exaroton,
      form,
      hasPendingPublish,
      hasPendingServerModChanges,
      hasSavedDraft,
      isBusy,
      lastPublishedSnapshot,
      loadBootstrap,
      loadFabricVersions,
      loaderOptions,
      logout,
      modVersionOptions,
      pendingInstall,
      publishBlockReason,
      rail,
      searchResults,
      selectedMods,
      sessionState,
      setBusy,
      setSearchQuery,
      setStatus,
      setTextFieldFromEvent,
      setView,
      statuses,
      summaryStats,
      ensureCoreMods,
      view,
    ],
  );

  return (
    <AdminStoreContext.Provider value={value}>
      {children}
    </AdminStoreContext.Provider>
  );
}

export function useAdminStore(): AdminStoreValue {
  const context = useContext(AdminStoreContext);
  if (!context) {
    throw new Error("useAdminStore must be used inside AdminStoreProvider");
  }
  return context;
}
