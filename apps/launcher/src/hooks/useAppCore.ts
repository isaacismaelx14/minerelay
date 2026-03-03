import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SyncPlan, UpdateSummary } from "@mvl/shared";

const SERVER_ID = import.meta.env.VITE_SERVER_ID ?? "mvl";
const APP_NAME = import.meta.env.VITE_APP_NAME ?? "MSS+ Client";
const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000;

import {
  type ScreenState,
  type InstallMode,
  type OnboardingStep,
  type GameSessionPhase,
  type WorkspaceView,
  type AppSettings,
  type LauncherCandidate,
  type LauncherDetectionResult,
  type SyncProgressEvent,
  type InstanceState,
  type VersionReadiness,
  type OpenLauncherResponse,
  type GameSessionStatus,
  type GameRunningProbe,
  type ToastMessage,
  type MinecraftRootStatus,
  type FabricRuntimeStatus,
  type SyncApplyResponse,
  type SyncApplyOptions,
  type SyncCycleOptions,
  type AppCloseResponse,
  type LauncherUpdateStatus,
  type LauncherUpdateInstallResponse,
  type CatalogSnapshot,
} from "../types";

import {
  bytesToHuman,
  formatEta,
  formatTime,
  formatDateTime,
  onboardingRequired,
  normalizeApiBaseUrl,
  normalizeProfileLockUrl,
  normalizeSecureUrl,
  ONBOARDING_VERSION,
} from "../utils";

export function useAppCore() {
  const currentWindow = getCurrentWindow();
  const isSetupWindow = currentWindow.label === "setup";
  const isCompactWindow = currentWindow.label === "main";

  const [screen, setScreen] = useState<ScreenState>("booting");
  const [isChecking, setIsChecking] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [launchers, setLaunchers] = useState<LauncherCandidate[]>([]);
  const [instance, setInstance] = useState<InstanceState | null>(null);
  const [sessionStatus, setSessionStatus] = useState<GameSessionStatus>({
    phase: "idle",
    liveMinecraftDir: null,
    launcherId: null,
    sessionId: null,
    startedAt: null,
  });
  const [versionReadiness, setVersionReadiness] =
    useState<VersionReadiness | null>(null);
  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null);
  const [plan, setPlan] = useState<SyncPlan | null>(null);
  const [sync, setSync] = useState<SyncProgressEvent>({
    phase: "idle",
    completedBytes: 0,
    totalBytes: 0,
    speedBps: 0,
  });

  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [launcherUpdate, setLauncherUpdate] =
    useState<LauncherUpdateStatus | null>(null);
  const [isCheckingLauncherUpdate, setIsCheckingLauncherUpdate] =
    useState(false);
  const [isInstallingLauncherUpdate, setIsInstallingLauncherUpdate] =
    useState(false);
  const [launcherUpdateNotice, setLauncherUpdateNotice] = useState<
    string | null
  >(null);

  const [lastCheckAt, setLastCheckAt] = useState<Date | null>(null);
  const [nextCheckAt, setNextCheckAt] = useState<Date | null>(null);

  const [wizardActive, setWizardActive] = useState(false);
  const [wizardStep, setWizardStep] = useState<OnboardingStep>("source");
  const [activeView, setActiveView] = useState<WorkspaceView>("overview");
  const [wizardProgress, setWizardProgress] = useState(0);
  const [wizardDetection, setWizardDetection] =
    useState<LauncherDetectionResult | null>(null);
  const [wizardSelectedLauncherId, setWizardSelectedLauncherId] = useState("");
  const [wizardManualLauncherPath, setWizardManualLauncherPath] = useState("");
  const [wizardMinecraftRootPath, setWizardMinecraftRootPath] = useState("");
  const [wizardMinecraftRootStatus, setWizardMinecraftRootStatus] =
    useState<MinecraftRootStatus | null>(null);
  const [wizardRuntimeStatus, setWizardRuntimeStatus] =
    useState<FabricRuntimeStatus | null>(null);
  const [wizardSyncing, setWizardSyncing] = useState(false);

  const [profileSourceDraft, setProfileSourceDraft] = useState({
    apiBaseUrl: "",
    profileLockUrl: "",
  });
  const [probePlaying, setProbePlaying] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [brokenLogoUrls, setBrokenLogoUrls] = useState<Record<string, true>>({});

  const cycleInFlight = useRef(false);
  const checkingLauncherUpdateRef = useRef(false);
  const installingLauncherUpdateRef = useRef(false);
  const isPlayingRef = useRef(false);
  const toastCounterRef = useRef(0);
  const closePromptBusyRef = useRef(false);

  const progressPercent = useMemo(() => {
    if (sync.totalBytes <= 0) {
      return 0;
    }
    return Math.min(
      100,
      Math.round((sync.completedBytes / sync.totalBytes) * 100),
    );
  }, [sync.completedBytes, sync.totalBytes]);
  const hasSyncTotal = sync.totalBytes > 0;
  const syncHasUnknownTotal =
    !hasSyncTotal && sync.phase === "downloading" && sync.completedBytes > 0;
  const syncBytesLabel = hasSyncTotal
    ? `${bytesToHuman(sync.completedBytes)} / ${bytesToHuman(sync.totalBytes)}`
    : sync.completedBytes > 0
      ? `${bytesToHuman(sync.completedBytes)} / --`
      : "0 B / --";

  const hasFancyMenuMod = catalog?.fancyMenuPresent ?? false;
  const fancyMenuMode = catalog?.fancyMenuMode ?? "simple";
  const hasFancyMenuCustomBundle = catalog?.fancyMenuCustomBundlePresent ?? false;
  const sessionActive = sessionStatus.phase !== "idle";
  const isPlaying = sessionStatus.phase === "playing";
  const compactPlaying = isPlaying || probePlaying;
  const serverInitial = (catalog?.serverName ?? SERVER_ID).trim().charAt(0).toUpperCase() || "S";

  const markLogoAsBroken = useCallback((url?: string) => {
    if (!url) {
      return;
    }
    setBrokenLogoUrls((current) => {
      if (current[url]) {
        return current;
      }
      return {
        ...current,
        [url]: true,
      };
    });
  }, []);

  const canRenderLogo = !!catalog?.logoUrl && !brokenLogoUrls[catalog.logoUrl];

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const pushToast = useCallback((tone: "error" | "hint", text: string) => {
    const id = toastCounterRef.current + 1;
    toastCounterRef.current = id;
    setToasts((current) => [...current, { id, tone, text }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== id));
    }, 3600);
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }
    pushToast("error", error);
    setError(null);
  }, [error, pushToast]);

  useEffect(() => {
    if (!hint) {
      return;
    }
    pushToast("hint", hint);
    setHint(null);
  }, [hint, pushToast]);

  const saveSettings = useCallback(async (next: AppSettings) => {
    const persisted = await invoke<AppSettings>("settings_set", {
      settingsPayload: next,
    });
    setSettings(persisted);
    setProfileSourceDraft({
      apiBaseUrl: persisted.apiBaseUrl ?? "",
      profileLockUrl: persisted.profileLockUrl ?? "",
    });
  }, []);

  const loadSettingsAndLaunchers = useCallback(async () => {
    const current = await invoke<AppSettings>("settings_get");
    const detected = await invoke<LauncherCandidate[]>("launcher_detect");

    let merged = current;
    if (!merged.selectedLauncherId && detected.length > 0) {
      const official = detected.find(
        (candidate) => candidate.id === "official",
      );
      merged = {
        ...merged,
        selectedLauncherId: official?.id ?? detected[0]?.id ?? null,
      };
    }

    if (merged !== current) {
      await saveSettings(merged);
    } else {
      setSettings(merged);
      setProfileSourceDraft({
        apiBaseUrl: merged.apiBaseUrl ?? "",
        profileLockUrl: merged.profileLockUrl ?? "",
      });
    }

    setLaunchers(detected);
    return { settings: merged, launchers: detected };
  }, [saveSettings]);

  const refreshSessionStatus = useCallback(async () => {
    const status = await invoke<GameSessionStatus>("session_status_get");
    setSessionStatus(status);
    return status;
  }, []);

  const refreshVersionReadiness = useCallback(async () => {
    const readiness = await invoke<VersionReadiness>(
      "instance_check_version_readiness",
      { serverId: SERVER_ID },
    );
    setVersionReadiness(readiness);
    return readiness;
  }, []);

  const refreshDashboardState = useCallback(async () => {
    const [instanceState, readiness, snapshot] = await Promise.all([
      invoke<InstanceState>("instance_get_state", { serverId: SERVER_ID }),
      invoke<VersionReadiness>("instance_check_version_readiness", {
        serverId: SERVER_ID,
      }),
      invoke<CatalogSnapshot>("profile_catalog_snapshot", {
        serverId: SERVER_ID,
      }),
    ]);

    setInstance(instanceState);
    setVersionReadiness(readiness);
    setCatalog(snapshot);

    if (snapshot.hasUpdates) {
      const syncPlan = await invoke<SyncPlan>("sync_plan", {
        serverId: SERVER_ID,
      });
      setPlan(syncPlan);
    } else {
      setPlan(null);
    }

    const now = new Date();
    setLastCheckAt(now);
    setNextCheckAt(new Date(now.getTime() + AUTO_SYNC_INTERVAL_MS));

    return snapshot;
  }, []);

  const executeSyncApply = useCallback(async (options?: SyncApplyOptions) => {
    if (sessionActive) {
      throw new Error("Cannot sync during active play session.");
    }

    const showSyncScreen = options?.showSyncScreen ?? true;
    if (showSyncScreen) {
      setScreen("syncing");
    }
    setSync({
      phase: "planning",
      completedBytes: 0,
      totalBytes: 0,
      speedBps: 0,
    });

    const response = await invoke<SyncApplyResponse>("sync_apply", {
      serverId: SERVER_ID,
    });

    if (response.modUpdatesDownloaded > 0) {
      setHint(
        `${response.serverName}: ${response.modUpdatesDownloaded} mod updates downloaded.`,
      );
    } else {
      setHint(`Sync applied to profile version ${response.appliedVersion}.`);
    }

    return response;
  }, [sessionActive]);

  const installLauncherUpdate = useCallback(
    async (availableVersion?: string): Promise<boolean> => {
      if (installingLauncherUpdateRef.current) {
        return false;
      }

      if (isPlayingRef.current) {
        const message =
          "Finish current play session before installing launcher updates.";
        setLauncherUpdateNotice(message);
        setHint(message);
        return false;
      }

      installingLauncherUpdateRef.current = true;
      setIsInstallingLauncherUpdate(true);
      setLauncherUpdateNotice(
        availableVersion
          ? `Preparing launcher update ${availableVersion}...`
          : "Preparing launcher update...",
      );
      setHint(
        availableVersion
          ? `Downloading launcher update ${availableVersion}...`
          : "Downloading launcher update...",
      );

      try {
        const result = await invoke<LauncherUpdateInstallResponse>(
          "launcher_update_install",
        );
        setHint(result.message);
        setLauncherUpdateNotice(result.message);
        setLauncherUpdate((current) =>
          current
            ? {
                ...current,
                available: false,
                latestVersion: result.version ?? current.latestVersion,
              }
            : current,
        );
        return result.updated;
      } catch (cause) {
        const raw = cause instanceof Error ? cause.message : String(cause);
        const message = /valid release json/iu.test(raw)
          ? "No updater release metadata is published yet. This does not affect server sync."
          : "Could not install launcher update right now. Please try again later.";
        setLauncherUpdateNotice(message);
        setHint(message);
        return false;
      } finally {
        installingLauncherUpdateRef.current = false;
        setIsInstallingLauncherUpdate(false);
      }
    },
    [],
  );

  const checkLauncherUpdate = useCallback(
    async (
      autoInstall: boolean,
      suppressErrors = false,
    ): Promise<boolean> => {
      if (
        checkingLauncherUpdateRef.current ||
        installingLauncherUpdateRef.current
      ) {
        return false;
      }

      checkingLauncherUpdateRef.current = true;
      setIsCheckingLauncherUpdate(true);
      setLauncherUpdateNotice("Checking launcher updates...");

      try {
        const status = await invoke<LauncherUpdateStatus>("launcher_update_check");
        setLauncherUpdate(status);

        if (!status.available) {
          const message = `Launcher is up to date (${status.currentVersion}).`;
          setLauncherUpdateNotice(message);
          if (!suppressErrors) {
            setHint(message);
          }
          return false;
        }

        if (!autoInstall) {
          const message = `Launcher update ${status.latestVersion ?? "available"} is ready to install.`;
          setLauncherUpdateNotice(message);
          setHint(
            `Launcher update ${status.latestVersion ?? "available"} detected. Click Download & Install.`,
          );
          return true;
        }

        return installLauncherUpdate(status.latestVersion ?? undefined);
      } catch (cause) {
        const raw = cause instanceof Error ? cause.message : String(cause);
        const message = /valid release json/iu.test(raw)
          ? "No updater release metadata is published yet. This does not affect server sync."
          : "Launcher updates are temporarily unavailable. This does not affect server sync.";
        setLauncherUpdateNotice(message);
        if (!suppressErrors) {
          setHint(message);
        }
        return false;
      } finally {
        checkingLauncherUpdateRef.current = false;
        setIsCheckingLauncherUpdate(false);
      }
    },
    [installLauncherUpdate],
  );

  const runSyncCycle = useCallback(
    async (autoApply: boolean, options?: SyncCycleOptions) => {
      if (cycleInFlight.current) {
        return;
      }

      cycleInFlight.current = true;
      setIsChecking(true);
      setError(null);

      try {
        const snapshot = await refreshDashboardState();

        if (
          autoApply &&
          !sessionActive &&
          (snapshot.hasUpdates || snapshot.fancyMenuEnabled)
        ) {
          const isInitialSync = snapshot.localVersion === null;
          const showSyncScreen =
            !(options?.suppressSyncScreen ?? false) &&
            !(autoApply && isInitialSync);
          await executeSyncApply({ showSyncScreen });
          await refreshDashboardState();
        }

        setScreen("ready");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setScreen("ready");
      } finally {
        setIsChecking(false);
        cycleInFlight.current = false;
      }
    },
    [executeSyncApply, refreshDashboardState, sessionActive],
  );

  const startWizardDetection = useCallback(async () => {
    setError(null);
    setWizardProgress(0);
    setWizardDetection(null);

    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const pct = Math.min(95, Math.round((elapsed / 5000) * 95));
      setWizardProgress(pct);
    }, 120);

    try {
      const [detected, rootStatus] = await Promise.all([
        invoke<LauncherDetectionResult>("launcher_detect_with_timeout", {
          timeoutMs: 5000,
        }),
        invoke<MinecraftRootStatus>("minecraft_root_detect"),
      ]);

      setWizardDetection(detected);
      setLaunchers(detected.candidates);
      setWizardMinecraftRootStatus(rootStatus);
      setWizardMinecraftRootPath(rootStatus.path);
      setWizardProgress(100);

      if (detected.candidates.length > 0) {
        const official = detected.candidates.find(
          (entry) => entry.id === "official",
        );
        const first = detected.candidates[0];
        setWizardSelectedLauncherId(official?.id ?? first?.id ?? "");
      } else {
        setWizardSelectedLauncherId("custom");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      window.clearInterval(timer);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      setError(null);
      const loaded = await loadSettingsAndLaunchers();
      await refreshSessionStatus();

      if (onboardingRequired(loaded.settings)) {
        if (isCompactWindow) {
          await invoke("app_open_setup_window");
        }
        setWizardActive(true);
        setWizardStep("source");
        setScreen("ready");
        return;
      }

      setWizardActive(false);
      await runSyncCycle(true);
      await checkLauncherUpdate(true, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setScreen("ready");
    }
  }, [
    checkLauncherUpdate,
    isCompactWindow,
    loadSettingsAndLaunchers,
    refreshSessionStatus,
    runSyncCycle,
  ]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    let stopSyncListener: UnlistenFn | undefined;
    let stopErrorListener: UnlistenFn | undefined;
    let stopSessionListener: UnlistenFn | undefined;

    void listen<SyncProgressEvent>("sync://progress", (event) => {
      setSync(event.payload);
    }).then((off) => {
      stopSyncListener = off;
    });

    void listen<{ message: string; actionHint?: string }>(
      "sync://error",
      (event) => {
        setError(event.payload.message);
        setHint(event.payload.actionHint ?? null);
        setScreen("ready");
      },
    ).then((off) => {
      stopErrorListener = off;
    });

    void listen<GameSessionStatus>("session://status", (event) => {
      setSessionStatus(event.payload);
    }).then((off) => {
      stopSessionListener = off;
    });

    return () => {
      stopSyncListener?.();
      stopErrorListener?.();
      stopSessionListener?.();
    };
  }, []);

  const requestSystemCloseModal = useCallback(async () => {
    if (closePromptBusyRef.current) {
      return;
    }
    closePromptBusyRef.current = true;

    try {
      if (isPlayingRef.current) {
        await invoke("app_keep_running_in_background");
        pushToast(
          "hint",
          "Minecraft is running. App was kept in the background.",
        );
        return;
      }

      const shouldClose = window.confirm(
        "Close MSS+ Client?\n\nSelect OK to quit the app. Select Cancel to keep it running in the background.",
      );

      if (shouldClose) {
        const result = await invoke<AppCloseResponse>("app_request_close");
        if (!result.closed) {
          pushToast(
            "error",
            result.reason ?? "Close request was blocked by an active session.",
          );
        }
        return;
      }

      await invoke("app_keep_running_in_background");
    } catch (cause) {
      pushToast("error", cause instanceof Error ? cause.message : String(cause));
    } finally {
      closePromptBusyRef.current = false;
    }
  }, [pushToast]);

  useEffect(() => {
    let unlistenCloseRequested: UnlistenFn | undefined;

    void currentWindow
      .onCloseRequested((event) => {
        if (isSetupWindow && !wizardActive) {
          event.preventDefault();
          void invoke("app_return_to_main_window");
          return;
        }

        event.preventDefault();
        void requestSystemCloseModal();
      })
      .then((off) => {
        unlistenCloseRequested = off;
      });

    return () => {
      unlistenCloseRequested?.();
    };
  }, [currentWindow, isSetupWindow, requestSystemCloseModal, wizardActive]);

  useEffect(() => {
    if (!isCompactWindow || wizardActive || !settings || sessionActive) {
      return;
    }

    const timer = window.setInterval(() => {
      void runSyncCycle(true);
      void checkLauncherUpdate(true, true);
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    checkLauncherUpdate,
    isCompactWindow,
    runSyncCycle,
    sessionActive,
    settings,
    wizardActive,
  ]);

  useEffect(() => {
    if (!isCompactWindow || wizardActive) {
      setProbePlaying(false);
      return;
    }

    let cancelled = false;
    const checkProbe = async () => {
      try {
        const status = await invoke<GameRunningProbe>("game_running_probe");
        if (!cancelled) {
          setProbePlaying(status.running);
        }
      } catch {
        if (!cancelled) {
          setProbePlaying(false);
        }
      }
    };

    void checkProbe();
    const timer = window.setInterval(() => {
      void checkProbe();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isCompactWindow, wizardActive]);

  useEffect(() => {
    if (wizardActive) {
      setActiveView("onboarding");
      return;
    }

    if (activeView === "onboarding") {
      setActiveView("overview");
    }
  }, [activeView, wizardActive]);

  const beginWizardPathsStep = useCallback(async () => {
    if (!settings) {
      return;
    }

    const apiBaseUrl = normalizeApiBaseUrl(profileSourceDraft.apiBaseUrl);
    if (!apiBaseUrl) {
      setError(
        "API base URL must be a valid https URL (or localhost http for development).",
      );
      return;
    }
    const profileLockInput = profileSourceDraft.profileLockUrl.trim();
    const profileLockUrl = normalizeProfileLockUrl(profileLockInput);
    if (profileLockInput && !profileLockUrl) {
      setError(
        "Profile lock URL must be a valid https URL (or localhost http for development).",
      );
      return;
    }

    const next: AppSettings = {
      ...settings,
      apiBaseUrl,
      profileLockUrl: profileLockUrl || null,
    };

    await saveSettings(next);
    setWizardStep("paths");
    await startWizardDetection();
  }, [
    profileSourceDraft.apiBaseUrl,
    profileSourceDraft.profileLockUrl,
    saveSettings,
    settings,
    startWizardDetection,
  ]);

  const pickWizardManualLauncherPath = useCallback(async () => {
    const picked = await invoke<string | null>("launcher_pick_manual_path");
    if (!picked) {
      return;
    }

    setWizardManualLauncherPath(picked);
    setWizardSelectedLauncherId("custom");
  }, []);

  const pickWizardMinecraftRootPath = useCallback(async () => {
    const picked = await invoke<string | null>(
      "minecraft_root_pick_manual_path",
    );
    if (!picked) {
      return;
    }

    setWizardMinecraftRootPath(picked);
  }, []);

  const continueWizardRuntimeStep = useCallback(async () => {
    if (!settings) {
      return;
    }

    const selectedLauncherId = wizardSelectedLauncherId.trim() || null;
    const customLauncherPath =
      wizardSelectedLauncherId === "custom"
        ? wizardManualLauncherPath.trim()
        : null;

    if (selectedLauncherId === "custom" && !customLauncherPath) {
      setError(
        "Select a launcher executable/app path or choose a detected launcher.",
      );
      return;
    }

    const minecraftRoot = wizardMinecraftRootPath.trim();
    if (!minecraftRoot) {
      setError("Select a Minecraft launcher directory path.");
      return;
    }

    const keepDefaultRoot =
      wizardMinecraftRootStatus &&
      !wizardMinecraftRootStatus.usingOverride &&
      wizardMinecraftRootStatus.path === minecraftRoot;

    const next: AppSettings = {
      ...settings,
      installMode: "global",
      selectedLauncherId,
      customLauncherPath,
      minecraftRootOverride: keepDefaultRoot ? null : minecraftRoot,
    };

    await saveSettings(next);
    setWizardStep("runtime");
    await refreshVersionReadiness();
  }, [
    refreshVersionReadiness,
    saveSettings,
    settings,
    wizardManualLauncherPath,
    wizardMinecraftRootPath,
    wizardMinecraftRootStatus,
    wizardSelectedLauncherId,
  ]);

  const installFabricRuntime = useCallback(async () => {
    try {
      setError(null);
      const installed = await invoke<FabricRuntimeStatus>(
        "runtime_ensure_fabric",
        { serverId: SERVER_ID },
      );
      setWizardRuntimeStatus(installed);
      await refreshVersionReadiness();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [refreshVersionReadiness]);

  const continueWizardSyncStep = useCallback(async () => {
    if (!versionReadiness) {
      setError("Readiness data not loaded.");
      return;
    }

    if (!versionReadiness.allowlisted) {
      setError(versionReadiness.guidance);
      return;
    }

    if (!versionReadiness.foundInMinecraftRootDir) {
      setError(
        "Install/ensure Fabric runtime and managed launcher version before continuing.",
      );
      return;
    }

    setWizardStep("sync");
    await refreshDashboardState();
    setScreen("ready");
  }, [refreshDashboardState, versionReadiness]);

  const completeWizard = useCallback(async () => {
    if (!settings) {
      return;
    }

    setWizardSyncing(true);
    setError(null);

    try {
      await runSyncCycle(true, { suppressSyncScreen: true });

      const next: AppSettings = {
        ...settings,
        wizardCompleted: true,
        onboardingVersion: ONBOARDING_VERSION,
      };

      await saveSettings(next);
      setWizardActive(false);
      setHint(
        "Setup complete. Auto-sync every 30 minutes is active while the app is open.",
      );
      setScreen("ready");

      if (isSetupWindow) {
        await invoke("app_return_to_main_window");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setWizardSyncing(false);
    }
  }, [isSetupWindow, runSyncCycle, saveSettings, settings]);

  const returnToMainWindow = useCallback(async () => {
    try {
      await invoke("app_return_to_main_window");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const openSetupWindow = useCallback(async () => {
    try {
      await invoke("app_open_setup_window");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const openLauncherFromCompact = useCallback(async () => {
    if (compactPlaying) {
      return;
    }

    try {
      setError(null);
      setHint(null);
      const result = await invoke<OpenLauncherResponse>("launcher_open", {
        serverId: SERVER_ID,
      });

      if (result.session) {
        setSessionStatus(result.session);
      }

      if (!result.opened) {
        setHint(
          "No launcher executable was selected. Choose one in settings or set a custom path.",
        );
        return;
      }

      const message = result.bootstrap?.message
        ? `Launcher opened. ${result.bootstrap.message}`
        : "Launcher opened.";
      setHint(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [compactPlaying]);

  const updateLauncherSelection = useCallback(
    async (value: string) => {
      if (!settings) {
        return;
      }

      await saveSettings({ ...settings, selectedLauncherId: value || null });
      setHint(null);
    },
    [saveSettings, settings],
  );

  const updateCustomPath = useCallback(
    async (value: string) => {
      if (!settings) {
        return;
      }

      await saveSettings({
        ...settings,
        customLauncherPath: value,
        selectedLauncherId: "custom",
      });
      setHint(null);
    },
    [saveSettings, settings],
  );

  const pickManualLauncherFromSettings = useCallback(async () => {
    if (!settings) {
      return;
    }

    const picked = await invoke<string | null>("launcher_pick_manual_path");
    if (!picked) {
      return;
    }

    await saveSettings({
      ...settings,
      customLauncherPath: picked,
      selectedLauncherId: "custom",
    });
    setHint("Custom launcher path selected.");
  }, [saveSettings, settings]);

  const pickMinecraftRootFromSettings = useCallback(async () => {
    if (!settings) {
      return;
    }

    const picked = await invoke<string | null>(
      "minecraft_root_pick_manual_path",
    );
    if (!picked) {
      return;
    }

    await saveSettings({ ...settings, minecraftRootOverride: picked });
    setHint("Minecraft root directory selected.");
  }, [saveSettings, settings]);

  const saveProfileSource = useCallback(async () => {
    if (!settings) {
      return;
    }

    const apiBaseUrl = normalizeApiBaseUrl(profileSourceDraft.apiBaseUrl);
    if (!apiBaseUrl) {
      setError(
        "API base URL must be a valid https URL (or localhost http for development).",
      );
      return;
    }
    const profileLockInput = profileSourceDraft.profileLockUrl.trim();
    const profileLockUrl = normalizeProfileLockUrl(profileLockInput);
    if (profileLockInput && !profileLockUrl) {
      setError(
        "Profile lock URL must be a valid https URL (or localhost http for development).",
      );
      return;
    }

    const next: AppSettings = {
      ...settings,
      apiBaseUrl,
      profileLockUrl: profileLockUrl || null,
    };

    await saveSettings(next);
    await runSyncCycle(false);
    setHint("Profile source settings saved.");
  }, [
    profileSourceDraft.apiBaseUrl,
    profileSourceDraft.profileLockUrl,
    runSyncCycle,
    saveSettings,
    settings,
  ]);

  const sourceLabel =
    settings?.apiBaseUrl ??
    settings?.profileLockUrl ??
    "API source not configured";

  return {
    screen, setScreen,
    isChecking, setIsChecking,
    settings, setSettings,
    launchers, setLaunchers,
    instance, setInstance,
    sessionStatus, setSessionStatus,
    versionReadiness, setVersionReadiness,
    catalog, setCatalog,
    plan, setPlan,
    sync, setSync,
    error, setError,
    hint, setHint,
    launcherUpdate, setLauncherUpdate,
    isCheckingLauncherUpdate, setIsCheckingLauncherUpdate,
    isInstallingLauncherUpdate, setIsInstallingLauncherUpdate,
    launcherUpdateNotice, setLauncherUpdateNotice,
    lastCheckAt, setLastCheckAt,
    nextCheckAt, setNextCheckAt,
    wizardActive, setWizardActive,
    wizardStep, setWizardStep,
    activeView, setActiveView,
    wizardProgress, setWizardProgress,
    wizardDetection, setWizardDetection,
    wizardSelectedLauncherId, setWizardSelectedLauncherId,
    wizardManualLauncherPath, setWizardManualLauncherPath,
    wizardMinecraftRootPath, setWizardMinecraftRootPath,
    wizardMinecraftRootStatus, setWizardMinecraftRootStatus,
    wizardRuntimeStatus, setWizardRuntimeStatus,
    wizardSyncing, setWizardSyncing,
    profileSourceDraft, setProfileSourceDraft,
    probePlaying, setProbePlaying,
    toasts, setToasts,
    brokenLogoUrls, setBrokenLogoUrls,
    progressPercent, hasSyncTotal, syncHasUnknownTotal, syncBytesLabel,
    hasFancyMenuMod, fancyMenuMode, hasFancyMenuCustomBundle,
    sessionActive, isPlaying, compactPlaying, serverInitial,
    markLogoAsBroken, canRenderLogo, pushToast,
    saveSettings, loadSettingsAndLaunchers, refreshSessionStatus, refreshVersionReadiness, refreshDashboardState,
    executeSyncApply, installLauncherUpdate, checkLauncherUpdate, runSyncCycle, startWizardDetection,
    bootstrap, installFabricRuntime, continueWizardSyncStep, completeWizard,
    returnToMainWindow, openSetupWindow, openLauncherFromCompact, updateLauncherSelection,
    updateCustomPath, pickManualLauncherFromSettings, pickMinecraftRootFromSettings,
    saveProfileSource, beginWizardPathsStep, continueWizardRuntimeStep,
    pickWizardManualLauncherPath, pickWizardMinecraftRootPath, sourceLabel,
    currentWindow, isSetupWindow, isCompactWindow, APP_NAME, SERVER_ID
  };
};
