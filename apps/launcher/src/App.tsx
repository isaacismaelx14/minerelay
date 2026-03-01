import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SyncPlan, UpdateSummary } from "@mvl/shared";

const SERVER_ID = import.meta.env.VITE_SERVER_ID ?? "mvl";
const APP_NAME = import.meta.env.VITE_APP_NAME ?? "MSS+ Client";
const ONBOARDING_VERSION = 2;
const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000;

type ScreenState = "booting" | "syncing" | "ready";
type InstallMode = "dedicated" | "global";
type OnboardingStep = "source" | "paths" | "runtime" | "sync";
type GameSessionPhase =
  | "idle"
  | "awaiting_game_start"
  | "playing"
  | "restoring";
type WorkspaceView =
  | "overview"
  | "onboarding"
  | "sourcePaths"
  | "catalog"
  | "activity";

interface AppSettings {
  selectedLauncherId: string | null;
  customLauncherPath: string | null;
  apiBaseUrl: string | null;
  profileLockUrl: string | null;
  installMode: InstallMode;
  wizardCompleted: boolean;
  minecraftRootOverride: string | null;
  onboardingVersion: number | null;
}

interface LauncherCandidate {
  id: string;
  name: string;
  path: string;
}

interface LauncherDetectionResult {
  candidates: LauncherCandidate[];
  timedOut: boolean;
  elapsedMs: number;
  officialMaybeUwp: boolean;
}

interface SyncProgressEvent {
  phase: string;
  completedBytes: number;
  totalBytes: number;
  currentFile?: string;
  speedBps: number;
  etaSec?: number;
}

interface InstanceState {
  installedVersion: number | null;
  mode: InstallMode;
  instanceRoot: string;
  minecraftDir: string;
  ready: boolean;
}

interface VersionReadiness {
  minecraftVersion: string;
  loader: string;
  loaderVersion: string;
  managedMinecraftDir: string;
  liveMinecraftRoot: string;
  minecraftRoot: string;
  foundInMinecraftRootDir: boolean;
  usingOverrideRoot: boolean;
  allowlisted: boolean;
  allowedMinecraftVersions: string[];
  expectedFabricVersionId: string;
  expectedManagedVersionId: string;
  managedVersionPresent: boolean;
  guidance: string;
}

interface OpenLauncherResponse {
  opened: boolean;
  path: string | null;
  bootstrap: { message: string } | null;
  session: GameSessionStatus | null;
}

interface GameSessionStatus {
  phase: GameSessionPhase;
  liveMinecraftDir: string | null;
  launcherId: string | null;
  sessionId: string | null;
  startedAt: number | null;
}

interface GameRunningProbe {
  running: boolean;
  source: "session" | "process";
  launcherId: string | null;
  liveMinecraftDir: string | null;
}

interface ToastMessage {
  id: number;
  tone: "error" | "hint";
  text: string;
}

interface MinecraftRootStatus {
  path: string;
  exists: boolean;
  usingOverride: boolean;
}

interface FabricRuntimeStatus {
  minecraftVersion: string;
  loaderVersion: string;
  versionId: string;
  minecraftRoot: string;
  presentBefore: boolean;
  installedNow: boolean;
  managedVersionId: string;
  managedMessage: string;
}

interface SyncApplyResponse {
  appliedVersion: number;
  modUpdatesDownloaded: number;
  serverName: string;
}

interface SyncApplyOptions {
  showSyncScreen?: boolean;
}

interface SyncCycleOptions {
  suppressSyncScreen?: boolean;
}

interface AppCloseResponse {
  closed: boolean;
  reason: string | null;
}

interface LauncherUpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  available: boolean;
  body: string | null;
  pubDate: string | null;
}

interface LauncherUpdateInstallResponse {
  updated: boolean;
  version: string | null;
  message: string;
}

interface CatalogSnapshot {
  serverId: string;
  serverName: string;
  serverAddress: string;
  logoUrl?: string;
  backgroundUrl?: string;
  profileVersion: number;
  localVersion: number | null;
  minecraftVersion: string;
  loader: string;
  loaderVersion: string;
  allowedMinecraftVersions: string[];
  hasUpdates: boolean;
  summary: UpdateSummary;
  fancyMenuEnabled: boolean;
  fancyMenuPresent: boolean;
  fancyMenuRequiresAssets: boolean;
  fancyMenuConfigured: boolean;
  mods: string[];
  resourcepacks: string[];
  shaderpacks: string[];
  configs: string[];
}

function bytesToHuman(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const amount = bytes / 1024 ** exponent;
  return `${amount.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatEta(seconds?: number): string {
  if (!seconds || seconds <= 0) {
    return "--";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}m ${remaining}s`;
}

function formatTime(date: Date | null): string {
  if (!date) {
    return "--";
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function onboardingRequired(settings: AppSettings): boolean {
  return (
    !settings.wizardCompleted ||
    settings.onboardingVersion !== ONBOARDING_VERSION ||
    !settings.apiBaseUrl
  );
}

function normalizeApiBaseUrl(input: string): string {
  return normalizeSecureUrl(input, true);
}

function normalizeProfileLockUrl(input: string): string {
  return normalizeSecureUrl(input, false);
}

function normalizeSecureUrl(input: string, trimTrailingSlash: boolean): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  const candidate = trimTrailingSlash
    ? trimmed.replace(/\/+$/u, "")
    : trimmed;

  try {
    const parsed = new URL(candidate);
    const localhost =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1";
    const secure = parsed.protocol === "https:";
    const localHttp = parsed.protocol === "http:" && localhost;

    if (!secure && !localHttp) {
      return "";
    }

    if (parsed.username || parsed.password || parsed.hash) {
      return "";
    }

    return candidate;
  } catch {
    return "";
  }
}

export default function App() {
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
  const fancyMenuRequiresAssets = catalog?.fancyMenuRequiresAssets ?? false;
  const hasFancyMenuConfig = catalog?.fancyMenuConfigured ?? false;
  const sessionActive = sessionStatus.phase !== "idle";
  const isPlaying = sessionStatus.phase === "playing";
  const compactPlaying = isPlaying || probePlaying;

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

  const renderWizard = () => {
    return (
      <div className="wizard-shell">
        <div className="wizard-steps" aria-label="Onboarding steps">
          <span className={wizardStep === "source" ? "step active" : "step"}>
            1. Source
          </span>
          <span className={wizardStep === "paths" ? "step active" : "step"}>
            2. Paths
          </span>
          <span className={wizardStep === "runtime" ? "step active" : "step"}>
            3. Fabric Runtime
          </span>
          <span className={wizardStep === "sync" ? "step active" : "step"}>
            4. Initial Sync
          </span>
        </div>

        {wizardStep === "source" ? (
          <div className="wizard-panel">
            <h2>Step 1: Connect to Server API</h2>
            <p>
              Set your server API URL to load profile metadata, allowed
              Minecraft versions, and sync catalog.
            </p>
            <input
              className="wizard-input"
              type="text"
              value={profileSourceDraft.apiBaseUrl}
              placeholder="https://api.example.com"
              onChange={(event) =>
                setProfileSourceDraft((current) => ({
                  ...current,
                  apiBaseUrl: event.target.value,
                }))
              }
            />
            <input
              className="wizard-input"
              type="text"
              value={profileSourceDraft.profileLockUrl}
              placeholder="Optional direct lock URL"
              onChange={(event) =>
                setProfileSourceDraft((current) => ({
                  ...current,
                  profileLockUrl: event.target.value,
                }))
              }
            />
            <div className="actions-row">
              <button
                className="btn primary"
                onClick={() => void beginWizardPathsStep()}
              >
                Continue to Path Setup
              </button>
              <button className="btn disabled" disabled>
                Log In
                <span className="badge">COMING SOON</span>
              </button>
            </div>
          </div>
        ) : null}

        {wizardStep === "paths" ? (
          <div className="wizard-panel">
            <h2>Step 2: Launcher and Minecraft Directory</h2>
            <p>
              Auto-detect launchers and launcher directory. If missing, choose
              paths manually.
            </p>

            <div
              className="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={wizardProgress}
            >
              <div
                className="meter-fill"
                style={{ width: `${wizardProgress}%` }}
              />
            </div>
            <p className="wizard-meta">Detection progress: {wizardProgress}%</p>

            <div className="wizard-box">
              <p className="small-dark">Detected launchers</p>
              <select
                className="wizard-select"
                value={wizardSelectedLauncherId}
                onChange={(event) =>
                  setWizardSelectedLauncherId(event.target.value)
                }
              >
                <option value="">No launcher selected</option>
                {wizardDetection?.candidates.map((candidate) => (
                  <option
                    key={`${candidate.id}:${candidate.path}`}
                    value={candidate.id}
                  >
                    {candidate.name} ({candidate.path})
                  </option>
                ))}
                <option value="custom">Custom path</option>
              </select>

              {wizardSelectedLauncherId === "custom" ? (
                <>
                  <input
                    className="wizard-input"
                    type="text"
                    value={wizardManualLauncherPath}
                    placeholder="/Applications/Prism Launcher.app or C:\\...\\MinecraftLauncher.exe"
                    onChange={(event) =>
                      setWizardManualLauncherPath(event.target.value)
                    }
                  />
                  <button
                    className="btn ghost"
                    onClick={() => void pickWizardManualLauncherPath()}
                  >
                    Pick Launcher Path
                  </button>
                </>
              ) : null}
            </div>

            <div className="wizard-box">
              <p className="small-dark">Minecraft launcher directory</p>
              <input
                className="wizard-input"
                type="text"
                value={wizardMinecraftRootPath}
                placeholder="/Users/.../Library/Application Support/minecraft"
                onChange={(event) =>
                  setWizardMinecraftRootPath(event.target.value)
                }
              />
              <div className="actions-row">
                <button
                  className="btn ghost"
                  onClick={() => void pickWizardMinecraftRootPath()}
                >
                  Pick Minecraft Dir
                </button>
                <button
                  className="btn ghost"
                  onClick={() => void startWizardDetection()}
                >
                  Rescan
                </button>
              </div>
              <p className="wizard-meta">
                {wizardMinecraftRootStatus?.exists
                  ? "Detected path exists."
                  : "Detected path not found. Select manually."}
              </p>
            </div>

            <div className="actions-row">
              <button
                className="btn ghost"
                onClick={() => setWizardStep("source")}
              >
                Back
              </button>
              <button
                className="btn primary"
                onClick={() => void continueWizardRuntimeStep()}
              >
                Continue to Runtime Check
              </button>
            </div>
          </div>
        ) : null}

        {wizardStep === "runtime" ? (
          <div className="wizard-panel">
            <h2>Step 3: Fabric Runtime Readiness</h2>
            <p>
              Target: {versionReadiness?.minecraftVersion ?? "--"} /{" "}
              {versionReadiness?.loader ?? "--"}{" "}
              {versionReadiness?.loaderVersion ?? "--"}
            </p>
            <p className="wizard-meta">
              Live minecraft dir: {versionReadiness?.liveMinecraftRoot ?? "--"}
            </p>
            <p className="wizard-meta">
              Managed sync dir: {versionReadiness?.managedMinecraftDir ?? "--"}
            </p>
            <p className="wizard-meta">
              Allowlisted versions:{" "}
              {versionReadiness?.allowedMinecraftVersions.join(", ") || "--"}
            </p>
            <p className="wizard-meta">
              Fabric target id:{" "}
              {versionReadiness?.expectedFabricVersionId ?? "--"}
            </p>
            <p className="wizard-meta">
              Managed version target:{" "}
              {versionReadiness?.expectedManagedVersionId ?? "--"} (
              {versionReadiness?.managedVersionPresent ? "present" : "missing"})
            </p>
            <p className="wizard-meta">
              {versionReadiness?.guidance ??
                "Checking runtime compatibility..."}
            </p>
            <p className="wizard-meta">
              Note: menu customization appears after Step 4 sync installs
              FancyMenu/menu customization assets.
            </p>
            {catalog?.fancyMenuEnabled && !hasFancyMenuMod ? (
              <p className="wizard-meta" style={{ color: "#b84e4e" }}>
                FancyMenu mod is missing in server profile. Custom menu will not
                apply.
              </p>
            ) : null}
            {catalog?.fancyMenuEnabled &&
            hasFancyMenuMod &&
            fancyMenuRequiresAssets &&
            !hasFancyMenuConfig ? (
              <p className="wizard-meta" style={{ color: "#b84e4e" }}>
                FancyMenu is present but no FancyMenu config/assets were found
                in profile configs.
              </p>
            ) : null}

            {wizardRuntimeStatus ? (
              <div className="wizard-box">
                <p className="small-dark">Last runtime action</p>
                <p className="wizard-meta">
                  {wizardRuntimeStatus.presentBefore
                    ? `Fabric runtime already present: ${wizardRuntimeStatus.versionId}`
                    : `Installed Fabric runtime: ${wizardRuntimeStatus.versionId}`}
                </p>
                <p className="wizard-meta">
                  Managed version ensured:{" "}
                  {wizardRuntimeStatus.managedVersionId}
                </p>
                <p className="wizard-meta">
                  {wizardRuntimeStatus.managedMessage}
                </p>
              </div>
            ) : null}

            <div className="actions-row">
              <button
                className="btn ghost"
                onClick={() => setWizardStep("paths")}
              >
                Back
              </button>
              <button
                className="btn ghost"
                onClick={() => void installFabricRuntime()}
              >
                Install / Ensure Fabric Runtime
              </button>
              <button
                className="btn primary"
                onClick={() => void continueWizardSyncStep()}
                disabled={
                  !versionReadiness?.allowlisted ||
                  !versionReadiness?.foundInMinecraftRootDir
                }
              >
                Continue to Initial Sync
              </button>
            </div>
          </div>
        ) : null}

        {wizardStep === "sync" ? (
          <div className="wizard-panel">
            {catalog?.logoUrl ? (
              <img
                className="wizard-logo"
                src={catalog.logoUrl}
                alt={`${catalog.serverName ?? SERVER_ID} logo`}
              />
            ) : null}
            <h2>Step 4: Initial Sync</h2>
            <p>
              Server: {catalog?.serverName ?? SERVER_ID} (
              {catalog?.serverAddress ?? "--"})
            </p>
            <p className="wizard-meta">
              Mods {catalog?.mods.length ?? 0} | Resourcepacks{" "}
              {catalog?.resourcepacks.length ?? 0} | Shaders{" "}
              {catalog?.shaderpacks.length ?? 0} | Configs{" "}
              {catalog?.configs.length ?? 0}
            </p>

            <ul className="summary-grid">
              <li>
                <strong>{catalog?.summary.add ?? 0}</strong>
                <span>Add</span>
              </li>
              <li>
                <strong>{catalog?.summary.remove ?? 0}</strong>
                <span>Remove</span>
              </li>
              <li>
                <strong>{catalog?.summary.update ?? 0}</strong>
                <span>Update</span>
              </li>
              <li>
                <strong>{catalog?.summary.keep ?? 0}</strong>
                <span>Keep</span>
              </li>
            </ul>

            {wizardSyncing ? (
              <>
                <div
                  className="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={hasSyncTotal ? progressPercent : undefined}
                  aria-valuetext={
                    syncHasUnknownTotal
                      ? "Download progress total unknown"
                      : undefined
                  }
                >
                  <div
                    className={`meter-fill${syncHasUnknownTotal ? " indeterminate" : ""}`}
                    style={{
                      width: syncHasUnknownTotal ? "30%" : `${progressPercent}%`,
                    }}
                  />
                </div>
                <p className="wizard-meta">
                  {sync.currentFile ?? "Applying sync..."}{" "}
                  {hasSyncTotal ? `(${progressPercent}%)` : ""}
                </p>
                <div className="metrics-row">
                  <span>{syncBytesLabel}</span>
                  <span>{bytesToHuman(sync.speedBps)}/s</span>
                  <span>ETA {formatEta(sync.etaSec)}</span>
                </div>
              </>
            ) : null}

            <div className="actions-row">
              <button
                className="btn ghost"
                onClick={() => setWizardStep("runtime")}
                disabled={wizardSyncing}
              >
                Back
              </button>
              <button
                className="btn primary"
                onClick={() => void completeWizard()}
                disabled={wizardSyncing}
              >
                {wizardSyncing ? "Syncing..." : "Run Sync and Finish Setup"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderPrimary = () => {
    if (screen === "booting") {
      return (
        <div className="status-block">
          <h2>Checking Server State</h2>
          <p>
            Loading remote profile lock, comparing local manifest, and
            evaluating updates.
          </p>
        </div>
      );
    }

    if (screen === "syncing") {
      return (
        <div className="status-block">
          <h2>Applying Sync</h2>
          <p>{sync.currentFile ?? sync.phase}</p>
          <div
            className="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={hasSyncTotal ? progressPercent : undefined}
            aria-valuetext={
              syncHasUnknownTotal ? "Download progress total unknown" : undefined
            }
          >
            <div
              className={`meter-fill${syncHasUnknownTotal ? " indeterminate" : ""}`}
              style={{ width: syncHasUnknownTotal ? "30%" : `${progressPercent}%` }}
            />
          </div>
          <div className="metrics-row">
            <span>{syncBytesLabel}</span>
            <span>{bytesToHuman(sync.speedBps)}/s</span>
            <span>ETA {formatEta(sync.etaSec)}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="status-block">
        <h2>
          {sessionStatus.phase === "playing"
            ? "Playing"
            : catalog?.hasUpdates
              ? "Updates Detected"
              : "Instance Up to Date"}
        </h2>
        <p>
          {sessionActive
            ? `Live session active in ${sessionStatus.liveMinecraftDir ?? "Minecraft directory"}.`
            : catalog?.hasUpdates
            ? "New server changes were detected. Auto-sync runs every 30 minutes while this app is open."
            : "All mods/resourcepacks/shaders/configs match server profile."}
        </p>
        {catalog?.fancyMenuEnabled && !hasFancyMenuMod ? (
          <p className="wizard-meta" style={{ color: "#b84e4e" }}>
            Profile has no FancyMenu mod. Play-only menu customization will not
            be active.
          </p>
        ) : null}
        {catalog?.fancyMenuEnabled &&
        hasFancyMenuMod &&
        fancyMenuRequiresAssets &&
        !hasFancyMenuConfig ? (
          <p className="wizard-meta" style={{ color: "#b84e4e" }}>
            FancyMenu mod exists, but FancyMenu config/assets are missing.
          </p>
        ) : null}
        {isChecking ? (
          <p className="wizard-meta">Checking server changes...</p>
        ) : null}

        <ul className="summary-grid">
          <li>
            <strong>{catalog?.summary.add ?? 0}</strong>
            <span>Add</span>
          </li>
          <li>
            <strong>{catalog?.summary.remove ?? 0}</strong>
            <span>Remove</span>
          </li>
          <li>
            <strong>{catalog?.summary.update ?? 0}</strong>
            <span>Update</span>
          </li>
          <li>
            <strong>{catalog?.summary.keep ?? 0}</strong>
            <span>Keep</span>
          </li>
        </ul>

        <div className="pane-grid">
          <section className="panel-card">
            <h3>Server Profile</h3>
            <p className="small-dark">Name: {catalog?.serverName ?? "--"}</p>
            <p className="small-dark">Server URL: {catalog?.serverAddress ?? "--"}</p>
            <p className="small-dark">Source URL: {sourceLabel}</p>
            <p className="small-dark">
              Runtime target: {catalog?.loader ?? "fabric"} {catalog?.loaderVersion ?? "--"} | MC {catalog?.minecraftVersion ?? "--"}
            </p>
          </section>

          <section className="panel-card">
            <h3>Current Settings</h3>
            <p className="small-dark">Launcher: {settings?.selectedLauncherId ?? "--"}</p>
            <p className="small-dark">Custom launcher path: {settings?.customLauncherPath ?? "--"}</p>
            <p className="small-dark">Live minecraft root: {versionReadiness?.liveMinecraftRoot ?? "--"}</p>
            <p className="small-dark">Managed sync dir: {instance?.minecraftDir ?? "--"}</p>
          </section>

          <section className="panel-card">
            <h3>Mods ({catalog?.mods.length ?? 0})</h3>
            <div className="overview-list">
              {(catalog?.mods ?? []).map((item) => (
                <span key={item} className="overview-chip">{item}</span>
              ))}
            </div>
          </section>

          <section className="panel-card">
            <h3>Resourcepacks ({catalog?.resourcepacks.length ?? 0})</h3>
            <div className="overview-list">
              {(catalog?.resourcepacks ?? []).map((item) => (
                <span key={item} className="overview-chip">{item}</span>
              ))}
            </div>
          </section>

          <section className="panel-card">
            <h3>Shaders ({catalog?.shaderpacks.length ?? 0})</h3>
            <div className="overview-list">
              {(catalog?.shaderpacks ?? []).map((item) => (
                <span key={item} className="overview-chip">{item}</span>
              ))}
            </div>
          </section>

          <section className="panel-card">
            <h3>Configs ({catalog?.configs.length ?? 0})</h3>
            <div className="overview-list">
              {(catalog?.configs ?? []).map((item) => (
                <span key={item} className="overview-chip">{item}</span>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  };

  const renderSourcePaths = () => {
    return (
      <div className="workspace-pane">
        <div className="pane-head">
          <h2>Source & Paths</h2>
          <p className="pane-subtitle">
            Configure profile source, launcher executable, and live Minecraft root.
          </p>
        </div>

        <div className="pane-grid">
          <section className="panel-card">
            <h3>Profile Source</h3>
            <input
              className="input"
              type="text"
              value={profileSourceDraft.apiBaseUrl}
              placeholder="https://api.example.com"
              onChange={(event) =>
                setProfileSourceDraft((current) => ({
                  ...current,
                  apiBaseUrl: event.target.value,
                }))
              }
            />
            <input
              className="input"
              type="text"
              value={profileSourceDraft.profileLockUrl}
              placeholder="Optional direct lock URL"
              onChange={(event) =>
                setProfileSourceDraft((current) => ({
                  ...current,
                  profileLockUrl: event.target.value,
                }))
              }
            />
            <button className="btn primary" onClick={() => void saveProfileSource()}>
              Save Source
            </button>
          </section>

          <section className="panel-card">
            <h3>Launcher</h3>
            <select
              className="select"
              value={settings?.selectedLauncherId ?? ""}
              onChange={(event) => void updateLauncherSelection(event.target.value)}
            >
              <option value="">No launcher selected</option>
              {launchers
                .filter((candidate) => candidate.id !== "custom")
                .map((candidate) => (
                  <option key={`${candidate.id}:${candidate.path}`} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              <option value="custom">Custom path</option>
            </select>
            {settings?.selectedLauncherId === "custom" ? (
              <>
                <input
                  className="input"
                  type="text"
                  value={settings.customLauncherPath ?? ""}
                  placeholder="/Applications/Minecraft.app or C:\\...\\MinecraftLauncher.exe"
                  onChange={(event) => void updateCustomPath(event.target.value)}
                />
                <button
                  className="btn ghost"
                  onClick={() => void pickManualLauncherFromSettings()}
                >
                  Pick Launcher Path
                </button>
              </>
            ) : null}
          </section>

          <section className="panel-card">
            <h3>Live Minecraft Root</h3>
            <input
              className="input"
              type="text"
              value={settings?.minecraftRootOverride ?? ""}
              placeholder="Leave empty for default launcher dir"
              onChange={(event) =>
                settings
                  ? void saveSettings({
                      ...settings,
                      minecraftRootOverride: event.target.value.trim() || null,
                    })
                  : undefined
              }
            />
            <div className="actions-row">
              <button
                className="btn ghost"
                onClick={() => void pickMinecraftRootFromSettings()}
              >
                Pick Minecraft Dir
              </button>
              <button className="btn ghost" onClick={() => void refreshVersionReadiness()}>
                Refresh Readiness
              </button>
            </div>
            <p className="small-dark">
              Readiness:{" "}
              {versionReadiness?.foundInMinecraftRootDir
                ? "runtime found"
                : "runtime missing"}
            </p>
            <p className="small-dark">
              Allowlisted: {versionReadiness?.allowlisted ? "yes" : "no"}
            </p>
          </section>

          <section className="panel-card">
            <h3>Instance Paths</h3>
            <p className="small-dark">Root: {instance?.instanceRoot ?? "--"}</p>
            <p className="small-dark">Managed game dir: {instance?.minecraftDir ?? "--"}</p>
            <p className="small-dark">
              Live game dir: {versionReadiness?.liveMinecraftRoot ?? "--"}
            </p>
            <p className="small-dark">
              Sync writes only to managed game dir. Live Minecraft files are swapped during active play sessions.
            </p>
          </section>
        </div>
      </div>
    );
  };

  const renderCatalogPane = () => {
    return (
      <div className="workspace-pane">
        <div className="pane-head">
          <h2>Catalog</h2>
          <p className="pane-subtitle">
            Managed content inventory and lockfile version alignment.
          </p>
        </div>
        <div className="pane-grid">
          <section className="panel-card">
            <h3>Content Totals</h3>
            <ul className="summary-grid">
              <li>
                <strong>{catalog?.mods.length ?? 0}</strong>
                <span>Mods</span>
              </li>
              <li>
                <strong>{catalog?.resourcepacks.length ?? 0}</strong>
                <span>Resourcepacks</span>
              </li>
              <li>
                <strong>{catalog?.shaderpacks.length ?? 0}</strong>
                <span>Shaders</span>
              </li>
              <li>
                <strong>{catalog?.configs.length ?? 0}</strong>
                <span>Configs</span>
              </li>
            </ul>
          </section>

          <section className="panel-card">
            <h3>Lock Versions</h3>
            <p className="small-dark">
              Installed lock version: {instance?.installedVersion ?? "none"}
            </p>
            <p className="small-dark">
              Remote lock version: {catalog?.profileVersion ?? "--"}
            </p>
            <p className="small-dark">
              Local lock version: {catalog?.localVersion ?? "--"}
            </p>
          </section>

          <section className="panel-card">
            <h3>Runtime Targets</h3>
            <p className="small-dark">
              {catalog?.loader ?? "fabric"} {catalog?.loaderVersion ?? "--"} | MC{" "}
              {catalog?.minecraftVersion ?? "--"}
            </p>
            <p className="small-dark">
              Allowed MC versions:{" "}
              {versionReadiness?.allowedMinecraftVersions.join(", ") || "--"}
            </p>
          </section>
        </div>
      </div>
    );
  };

  const renderActivityPane = () => {
    return (
      <div className="workspace-pane">
        <div className="pane-head">
          <h2>Activity</h2>
          <p className="pane-subtitle">Sync schedule, telemetry, and operator messages.</p>
        </div>

        <div className="pane-grid">
          <section className="panel-card">
            <h3>Schedule</h3>
            <p className="small-dark">
              Auto-apply every 30 minutes while the app is open.
            </p>
            <p className="small-dark">Last check: {formatTime(lastCheckAt)}</p>
            <p className="small-dark">Next check: {formatTime(nextCheckAt)}</p>
            <button
              className="btn ghost"
              onClick={() => void runSyncCycle(true)}
              disabled={sessionActive}
            >
              Run Check + Auto Apply
            </button>
          </section>

          <section className="panel-card">
            <h3>Launcher Updates</h3>
            <p className="small-dark">
              Current version: {launcherUpdate?.currentVersion ?? "--"}
            </p>
            <p className="small-dark">
              Latest release: {launcherUpdate?.latestVersion ?? "--"}
            </p>
            <p className="small-dark">
              Published: {formatDateTime(launcherUpdate?.pubDate ?? null)}
            </p>
            <p className="small-dark">
              Status:{" "}
              {launcherUpdate?.available
                ? "update available"
                : launcherUpdate
                  ? "up to date"
                  : "not checked"}
            </p>
            <p className="small-dark">
              {launcherUpdateNotice ??
                "Updater checks run at startup and every 30 minutes."}
            </p>
            {launcherUpdate?.body ? (
              <p className="small-dark">{launcherUpdate.body}</p>
            ) : null}
            <div className="actions-row">
              <button
                className="btn ghost"
                onClick={() => void checkLauncherUpdate(false)}
                disabled={isCheckingLauncherUpdate || isInstallingLauncherUpdate}
              >
                {isCheckingLauncherUpdate ? "Checking..." : "Check Updates"}
              </button>
              {launcherUpdate?.available ? (
                <button
                  className="btn ghost"
                  onClick={() =>
                    void installLauncherUpdate(
                      launcherUpdate.latestVersion ?? undefined,
                    )
                  }
                  disabled={isInstallingLauncherUpdate || isPlaying}
                >
                  {isInstallingLauncherUpdate
                    ? "Installing..."
                    : "Download & Install"}
                </button>
              ) : null}
            </div>
          </section>

          <section className="panel-card">
            <h3>Current Session</h3>
            <p className="small-dark">
              Phase: {sessionStatus.phase.replaceAll("_", " ")}
            </p>
            <p className="small-dark">
              Live dir: {sessionStatus.liveMinecraftDir ?? "--"}
            </p>
          </section>

          <section className="panel-card">
            <h3>Current Transfer</h3>
            <p className="small-dark">{sync.currentFile ?? sync.phase}</p>
            <div
              className="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={hasSyncTotal ? progressPercent : undefined}
              aria-valuetext={
                syncHasUnknownTotal ? "Download progress total unknown" : undefined
              }
            >
              <div
                className={`meter-fill${syncHasUnknownTotal ? " indeterminate" : ""}`}
                style={{ width: syncHasUnknownTotal ? "30%" : `${progressPercent}%` }}
              />
            </div>
            <div className="metrics-row">
              <span>{syncBytesLabel}</span>
              <span>{bytesToHuman(sync.speedBps)}/s</span>
              <span>ETA {formatEta(sync.etaSec)}</span>
            </div>
          </section>

          <section className="panel-card">
            <h3>Messages</h3>
            <p className="small-dark">{hint ?? "No recent hints."}</p>
            <p className="small-dark">{error ?? "No active errors."}</p>
          </section>
        </div>
      </div>
    );
  };

  const renderWorkspace = () => {
    if (activeView === "onboarding") {
      if (!wizardActive) {
        return renderPrimary();
      }
      return renderWizard();
    }

    if (activeView === "sourcePaths") {
      return renderSourcePaths();
    }

    if (activeView === "catalog") {
      return renderCatalogPane();
    }

    if (activeView === "activity") {
      return renderActivityPane();
    }

    return renderPrimary();
  };

  const renderCompactWindow = () => {
    const compactHasServerInfo = catalog !== null;
    const compactNeedsConnect = !compactHasServerInfo;
    const statusTitle = compactPlaying
      ? "Playing"
      : compactNeedsConnect
        ? "Disconnected"
        : "Ready";
    const statusSubtitle = compactPlaying
      ? `Playing in ${sessionStatus.liveMinecraftDir ?? "Minecraft directory"}`
      : compactNeedsConnect
        ? "Server info unavailable. Connect to refresh profile data."
        : `Server ${catalog?.serverName ?? SERVER_ID} is synced and ready.`;

    return (
      <main className="compact-shell">
        <div className="compact-frame">
          <header className="compact-head">
            <div className="compact-server-row">
              {catalog?.logoUrl ? (
                <img
                  className="compact-server-logo"
                  src={catalog.logoUrl}
                  alt={`${catalog.serverName ?? SERVER_ID} logo`}
                />
              ) : null}
              <div className="compact-server-meta">
                <p className="compact-app">{APP_NAME}</p>
                <p className="compact-server">{catalog?.serverName ?? `Server ${SERVER_ID}`}</p>
                <p className="compact-version">
                  MC {catalog?.minecraftVersion ?? "--"} · {catalog?.loader ?? "fabric"} {catalog?.loaderVersion ?? "--"}
                </p>
              </div>
            </div>
          </header>

          <section className={`compact-core${compactPlaying ? " is-playing" : ""}`}>
            <div className="compact-ring" aria-hidden="true">
              <div className="compact-ring-inner" />
            </div>
            <h2>{statusTitle}</h2>
            <p>{statusSubtitle}</p>
            <div className="actions-row compact-actions">
              <button
                className={compactNeedsConnect ? "btn connect" : "btn primary"}
                onClick={() =>
                  compactNeedsConnect
                    ? void runSyncCycle(false)
                    : void openLauncherFromCompact()
                }
                disabled={compactNeedsConnect ? isChecking : compactPlaying}
              >
                {compactNeedsConnect
                  ? isChecking
                    ? "Connecting..."
                    : "Connect"
                  : compactPlaying
                    ? "Playing"
                    : "Play"}
              </button>
              <button className="btn ghost" onClick={() => void openSetupWindow()}>
                Overview
              </button>
            </div>
          </section>

          <section className="compact-stats">
            <article>
              <strong>{catalog?.summary.keep ?? 0}</strong>
              <span>Keep</span>
            </article>
            <article>
              <strong>{catalog?.summary.add ?? 0}</strong>
              <span>Add</span>
            </article>
            <article>
              <strong>{catalog?.summary.remove ?? 0}</strong>
              <span>Remove</span>
            </article>
            <article>
              <strong>{catalog?.summary.update ?? 0}</strong>
              <span>Update</span>
            </article>
          </section>

          <footer className="compact-foot">
            <p>Session: {sessionStatus.phase.replaceAll("_", " ")}</p>
            <p>Last check: {formatTime(lastCheckAt)}</p>
          </footer>
        </div>
      </main>
    );
  };

  const sourceLabel =
    settings?.apiBaseUrl ??
    settings?.profileLockUrl ??
    "API source not configured";

  const toastStack = toasts.length ? (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-item ${toast.tone === "error" ? "error" : "hint"}`}
          role="status"
        >
          {toast.text}
        </div>
      ))}
    </div>
  ) : null;

  if (isCompactWindow) {
    return (
      <>
        {renderCompactWindow()}
        {toastStack}
      </>
    );
  }

  if (isSetupWindow && wizardActive) {
    return (
      <main className="setup-onboarding-shell">
        <header className="setup-onboarding-head">
          <p className="eyebrow">First-time setup</p>
          <h1>{APP_NAME}</h1>
          <p className="small-dark">Complete onboarding to continue.</p>
        </header>

        {renderWizard()}

        {toastStack}
      </main>
    );
  }

  return (
    <main className="desktop-shell">
      <aside className="desktop-nav">
        <div className="nav-brand">
          <p className="eyebrow">Desktop Sync Console</p>
          <h1>{APP_NAME}</h1>
          <p className="small-dark">Source: {sourceLabel}</p>
        </div>

        <nav className="nav-groups" aria-label="Workspace sections">
          <button
            className={activeView === "overview" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveView("overview")}
          >
            Overview
          </button>
          <button
            className={activeView === "sourcePaths" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveView("sourcePaths")}
          >
            Source & Paths
          </button>
          <button
            className={activeView === "catalog" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveView("catalog")}
          >
            Catalog
          </button>
          <button
            className={activeView === "activity" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveView("activity")}
          >
            Activity
          </button>
        </nav>

        <section className="nav-status">
          <p className="small-dark">Last check: {formatTime(lastCheckAt)}</p>
          <p className="small-dark">Next check: {formatTime(nextCheckAt)}</p>
          <p className="small-dark">
            Runtime:{" "}
            {versionReadiness?.foundInMinecraftRootDir ? "configured" : "pending"}
          </p>
          <p className="small-dark">
            Lock drift: {catalog?.hasUpdates ? "detected" : "none"}
          </p>
          <p className="small-dark">
            App update:{" "}
            {launcherUpdate?.available
              ? `v${launcherUpdate.latestVersion ?? "new"} ready`
              : "none"}
          </p>
          <p className="small-dark">
            Session: {sessionStatus.phase.replaceAll("_", " ")}
          </p>
          {sessionStatus.liveMinecraftDir ? (
            <p className="small-dark">Playing dir: {sessionStatus.liveMinecraftDir}</p>
          ) : null}
        </section>
      </aside>

      <section className="desktop-workspace">
        <header className="workspace-header">
          <div className="workspace-title">
            {catalog?.logoUrl ? (
              <img
                className="server-logo"
                src={catalog.logoUrl}
                alt={`${catalog.serverName ?? SERVER_ID} logo`}
              />
            ) : null}
            <div>
            <span className="eyebrow">MSS+ Client Center</span>
            <h2>{catalog?.serverName ?? `Server ${SERVER_ID}`}</h2>
            {sessionStatus.phase === "playing" ? (
              <p className="playing-status">
                Playing in {sessionStatus.liveMinecraftDir ?? "Minecraft directory"}
              </p>
            ) : null}
            </div>
          </div>
          <div className="workspace-header-actions">
            <div className="version-pill">
              {catalog?.loader ?? "fabric"} {catalog?.loaderVersion ?? "--"} | MC{" "}
              {catalog?.minecraftVersion ?? "--"}
            </div>
            <button className="btn ghost" onClick={() => void returnToMainWindow()}>
              Back to Launcher
            </button>
          </div>
        </header>

        {renderWorkspace()}

        {toastStack}
      </section>
    </main>
  );
}
