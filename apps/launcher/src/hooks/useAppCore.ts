import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SyncPlan, UpdateSummary } from "@mvl/shared";

const SERVER_ID = import.meta.env.VITE_SERVER_ID ?? "mvl";
const APP_NAME = import.meta.env.VITE_APP_NAME ?? "MSS+ Client";
const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000;
const LAUNCHER_STREAM_RETRY_DELAY_MS = 30_000;
const LAUNCHER_STREAM_MAX_RETRIES = 3;

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
  type LauncherServerControlsState,
  type LauncherServerStatus,
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
  const [launcherServerControls, setLauncherServerControls] =
    useState<LauncherServerControlsState | null>(null);
  const [isServerActionBusy, setIsServerActionBusy] = useState(false);
  const [launcherStreamStatus, setLauncherStreamStatus] = useState<
    "connected" | "retrying" | "disconnected"
  >("connected");
  const [launcherStreamRetryCount, setLauncherStreamRetryCount] = useState(0);
  const [launcherStreamRetryCountdownSec, setLauncherStreamRetryCountdownSec] =
    useState(0);

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
    pairingCode: "",
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
  const launcherStreamRetryCountRef = useRef(0);
  const launcherStreamRetryTimerRef = useRef<number | null>(null);
  const launcherStreamRetryCountdownRef = useRef<number | null>(null);
  const launcherPermissionRemovedNotifiedRef = useRef(false);
  const launcherServerAccessGrantedRef = useRef(false);
  const devtoolsUnlockActiveRef = useRef(false);
  const devtoolsUnlockBufferRef = useRef("");
  const devtoolsUnlockTimeoutRef = useRef<number | null>(null);

  const hasLauncherServerPermission = useCallback(
    (controls: LauncherServerControlsState | null) => {
      if (!controls) {
        return false;
      }
      const permissions = controls.permissions;
      return (
        permissions.canViewStatus ||
        permissions.canViewOnlinePlayers ||
        permissions.canStartServer ||
        permissions.canStopServer ||
        permissions.canRestartServer
      );
    },
    [],
  );

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

  const isApiSourceMode = useMemo(() => {
    if (!settings?.apiBaseUrl) {
      return false;
    }
    return !settings.profileLockUrl;
  }, [settings?.apiBaseUrl, settings?.profileLockUrl]);

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

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      const message = event.message || "Unknown window error";
      const details = [
        event.filename ? `file=${event.filename}` : null,
        event.lineno ? `line=${event.lineno}` : null,
        event.colno ? `col=${event.colno}` : null,
      ]
        .filter(Boolean)
        .join(" ");

      void invoke("app_log_client_exception", {
        source: "window.error",
        message,
        details: details || undefined,
      }).catch(() => undefined);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : JSON.stringify(reason ?? "Unhandled rejection");

      void invoke("app_log_client_exception", {
        source: "window.unhandledrejection",
        message,
      }).catch(() => undefined);
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const clearUnlockTimeout = () => {
      if (devtoolsUnlockTimeoutRef.current !== null) {
        window.clearTimeout(devtoolsUnlockTimeoutRef.current);
        devtoolsUnlockTimeoutRef.current = null;
      }
    };

    const cancelUnlock = (message?: string) => {
      clearUnlockTimeout();
      devtoolsUnlockActiveRef.current = false;
      devtoolsUnlockBufferRef.current = "";
      if (message) {
        setHint(message);
      }
    };

    const startUnlock = () => {
      clearUnlockTimeout();
      devtoolsUnlockActiveRef.current = true;
      devtoolsUnlockBufferRef.current = "";
      setHint("Devtools unlock active: type secret command, then press Enter. Press Esc to cancel.");
      devtoolsUnlockTimeoutRef.current = window.setTimeout(() => {
        cancelUnlock("Devtools unlock timed out.");
      }, 12_000);
    };

    const onSecretDevtoolsShortcut = (event: KeyboardEvent) => {
      const isUnlockCombo =
        (event.ctrlKey || event.metaKey) &&
        event.altKey &&
        event.shiftKey &&
        event.code === "KeyD";

      if (devtoolsUnlockActiveRef.current) {
        if (event.key === "Escape") {
          event.preventDefault();
          cancelUnlock("Devtools unlock canceled.");
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          const secretCommand = devtoolsUnlockBufferRef.current.trim();
          if (!secretCommand) {
            cancelUnlock("Devtools unlock canceled.");
            return;
          }

          cancelUnlock();
          void invoke("app_open_devtools_secret", { secretCommand })
            .then(() => {
              setHint("Devtools opened.");
            })
            .catch((cause) => {
              setError(cause instanceof Error ? cause.message : String(cause));
            });
          return;
        }

        if (event.key === "Backspace") {
          event.preventDefault();
          devtoolsUnlockBufferRef.current =
            devtoolsUnlockBufferRef.current.slice(0, -1);
          return;
        }

        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          devtoolsUnlockBufferRef.current += event.key;
        }
        return;
      }

      if (!isUnlockCombo) {
        return;
      }

      event.preventDefault();
      startUnlock();
    };

    window.addEventListener("keydown", onSecretDevtoolsShortcut);
    return () => {
      cancelUnlock();
      window.removeEventListener("keydown", onSecretDevtoolsShortcut);
    };
  }, []);

  const saveSettings = useCallback(async (next: AppSettings) => {
    const persisted = await invoke<AppSettings>("settings_set", {
      settingsPayload: next,
    });
    setSettings(persisted);
    setProfileSourceDraft({
      apiBaseUrl: persisted.apiBaseUrl ?? "",
      profileLockUrl: persisted.profileLockUrl ?? "",
      pairingCode: persisted.pairingCode ?? "",
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
        pairingCode: merged.pairingCode ?? "",
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

  const refreshLauncherServerControls = useCallback(async () => {
    if (!isApiSourceMode) {
      setLauncherServerControls(null);
      return null;
    }

    try {
      const next = await invoke<LauncherServerControlsState>(
        "launcher_server_controls_get",
      );
      launcherPermissionRemovedNotifiedRef.current = false;
      launcherServerAccessGrantedRef.current = hasLauncherServerPermission(next);
      setLauncherServerControls(
        launcherServerAccessGrantedRef.current ? next : null,
      );
      return next;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const lowered = message.toLowerCase();
      const permissionRemoved =
        lowered.includes("forbidden") ||
        lowered.includes("permission") ||
        lowered.includes("status access is disabled") ||
        lowered.includes("access is disabled") ||
        lowered.includes("403");

      if (permissionRemoved) {
        setLauncherServerControls(null);
        setLauncherStreamStatus("connected");
        setLauncherStreamRetryCount(0);
        setLauncherStreamRetryCountdownSec(0);
        launcherStreamRetryCountRef.current = 0;
        void invoke("launcher_server_stream_stop");
        if (
          launcherServerAccessGrantedRef.current &&
          !launcherPermissionRemovedNotifiedRef.current
        ) {
          launcherPermissionRemovedNotifiedRef.current = true;
          setHint("Permission removed");
        }
        launcherServerAccessGrantedRef.current = false;
        return null;
      }

      setLauncherServerControls((current) =>
        current ?? {
          enabled: false,
          reason: message,
          permissions: {
            canViewStatus: false,
            canViewOnlinePlayers: false,
            canStartServer: false,
            canStopServer: false,
            canRestartServer: false,
          },
          selectedServer: null,
        },
      );
      return null;
    }
  }, [hasLauncherServerPermission, isApiSourceMode]);

  const runLauncherServerAction = useCallback(
    async (action: "start" | "stop" | "restart") => {
      if (!isApiSourceMode || isServerActionBusy) {
        return;
      }

      setIsServerActionBusy(true);
      try {
        const next = await invoke<LauncherServerControlsState>(
          "launcher_server_action",
          { action },
        );
        setLauncherServerControls(next);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setIsServerActionBusy(false);
      }
    },
    [isApiSourceMode, isServerActionBusy],
  );

  const clearLauncherStreamRetryTimers = useCallback(() => {
    if (launcherStreamRetryTimerRef.current !== null) {
      window.clearTimeout(launcherStreamRetryTimerRef.current);
      launcherStreamRetryTimerRef.current = null;
    }
    if (launcherStreamRetryCountdownRef.current !== null) {
      window.clearInterval(launcherStreamRetryCountdownRef.current);
      launcherStreamRetryCountdownRef.current = null;
    }
  }, []);

  const resetLauncherStreamConnectionState = useCallback(() => {
    clearLauncherStreamRetryTimers();
    launcherStreamRetryCountRef.current = 0;
    setLauncherStreamStatus("connected");
    setLauncherStreamRetryCount(0);
    setLauncherStreamRetryCountdownSec(0);
  }, [clearLauncherStreamRetryTimers]);

  const handleLauncherStreamDisconnected = useCallback(
    (message: string) => {
      const lowered = message.toLowerCase();
      const permissionRemoved =
        lowered.includes("forbidden") ||
        lowered.includes("permission") ||
        lowered.includes("status access is disabled") ||
        lowered.includes("access is disabled") ||
        lowered.includes("403");

      if (permissionRemoved) {
        clearLauncherStreamRetryTimers();
        setLauncherServerControls(null);
        setLauncherStreamStatus("connected");
        setLauncherStreamRetryCount(0);
        setLauncherStreamRetryCountdownSec(0);
        launcherStreamRetryCountRef.current = 0;
        void invoke("launcher_server_stream_stop");
        if (
          launcherServerAccessGrantedRef.current &&
          !launcherPermissionRemovedNotifiedRef.current
        ) {
          launcherPermissionRemovedNotifiedRef.current = true;
          setHint("Permission removed");
        }
        launcherServerAccessGrantedRef.current = false;
        return;
      }

      void invoke("launcher_server_stream_stop");
      setLauncherServerControls((current) =>
        current
          ? {
              ...current,
              enabled: false,
              reason: "Lost connection to server stream.",
            }
          : current,
      );

      clearLauncherStreamRetryTimers();

      const nextAttempt = launcherStreamRetryCountRef.current + 1;
      if (nextAttempt > LAUNCHER_STREAM_MAX_RETRIES) {
        setLauncherStreamStatus("disconnected");
        setLauncherStreamRetryCountdownSec(0);
        return;
      }

      launcherStreamRetryCountRef.current = nextAttempt;
      setLauncherStreamStatus("retrying");
      setLauncherStreamRetryCount(nextAttempt);
      setLauncherStreamRetryCountdownSec(
        Math.floor(LAUNCHER_STREAM_RETRY_DELAY_MS / 1000),
      );

      launcherStreamRetryCountdownRef.current = window.setInterval(() => {
        setLauncherStreamRetryCountdownSec((current) => {
          if (current <= 1) {
            if (launcherStreamRetryCountdownRef.current !== null) {
              window.clearInterval(launcherStreamRetryCountdownRef.current);
              launcherStreamRetryCountdownRef.current = null;
            }
            return 0;
          }
          return current - 1;
        });
      }, 1000);

      launcherStreamRetryTimerRef.current = window.setTimeout(() => {
        launcherStreamRetryTimerRef.current = null;
        void invoke("launcher_server_stream_start").catch((cause) => {
          handleLauncherStreamDisconnected(
            cause instanceof Error ? cause.message : String(cause),
          );
        });
      }, LAUNCHER_STREAM_RETRY_DELAY_MS);

    },
    [clearLauncherStreamRetryTimers],
  );

  const retryLauncherServerStreamNow = useCallback(() => {
    if (!isApiSourceMode) {
      return;
    }

    clearLauncherStreamRetryTimers();
    launcherStreamRetryCountRef.current = 0;
    setLauncherStreamStatus("retrying");
    setLauncherStreamRetryCount(0);
    setLauncherStreamRetryCountdownSec(0);

    void invoke("launcher_server_stream_stop").finally(() => {
      void invoke("launcher_server_stream_start").catch((cause) => {
        handleLauncherStreamDisconnected(
          cause instanceof Error ? cause.message : String(cause),
        );
      });
    });
  }, [
    clearLauncherStreamRetryTimers,
    handleLauncherStreamDisconnected,
    isApiSourceMode,
  ]);

  const refreshVersionReadiness = useCallback(async () => {
    const readiness = await invoke<VersionReadiness>(
      "instance_check_version_readiness",
      { serverId: SERVER_ID },
    );
    setVersionReadiness(readiness);
    return readiness;
  }, []);

  const fallbackVersionReadiness = useCallback(
    (guidance: string): VersionReadiness => ({
      minecraftVersion: "--",
      loader: "--",
      loaderVersion: "--",
      managedMinecraftDir: "--",
      liveMinecraftRoot: "--",
      minecraftRoot: "--",
      foundInMinecraftRootDir: false,
      usingOverrideRoot: false,
      allowlisted: false,
      allowedMinecraftVersions: [],
      expectedFabricVersionId: "--",
      expectedManagedVersionId: "--",
      managedVersionPresent: false,
      guidance,
    }),
    [],
  );

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

      if (settings?.selectedLauncherId) {
        setWizardSelectedLauncherId(settings.selectedLauncherId);
      } else if (detected.candidates.length > 0) {
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

    let stopSettingsListener: UnlistenFn | undefined;
    void listen<AppSettings>("settings://updated", (event) => {
      setSettings(event.payload);
      setProfileSourceDraft({
        apiBaseUrl: event.payload.apiBaseUrl ?? "",
        profileLockUrl: event.payload.profileLockUrl ?? "",
        pairingCode: event.payload.pairingCode ?? "",
      });
      // Important cross-window sync: refresh state when settings change
      void refreshDashboardState();
      void refreshVersionReadiness().catch((cause) => {
        const message = cause instanceof Error ? cause.message : String(cause);
        setVersionReadiness(fallbackVersionReadiness(message));
        setError(message);
      });
    }).then((off) => {
      stopSettingsListener = off;
    });

    let stopLauncherStatusListener: UnlistenFn | undefined;
    let stopLauncherErrorListener: UnlistenFn | undefined;

    void listen<LauncherServerStatus>("launcher-server://status", (event) => {
      launcherPermissionRemovedNotifiedRef.current = false;
      resetLauncherStreamConnectionState();
      setLauncherServerControls((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          enabled: true,
          reason: null,
          selectedServer: event.payload,
        };
      });
    }).then((off) => {
      stopLauncherStatusListener = off;
    });

    void listen<string>("launcher-server://error", (event) => {
      handleLauncherStreamDisconnected(event.payload);
    }).then((off) => {
      stopLauncherErrorListener = off;
    });

    return () => {
      stopSyncListener?.();
      stopErrorListener?.();
      stopSessionListener?.();
      stopSettingsListener?.();
      stopLauncherStatusListener?.();
      stopLauncherErrorListener?.();
      clearLauncherStreamRetryTimers();
    };
  }, [
    clearLauncherStreamRetryTimers,
    handleLauncherStreamDisconnected,
    refreshDashboardState,
    refreshVersionReadiness,
    resetLauncherStreamConnectionState,
  ]);

  useEffect(() => {
    if (!isApiSourceMode) {
      setLauncherServerControls(null);
      launcherServerAccessGrantedRef.current = false;
      resetLauncherStreamConnectionState();
      void invoke("launcher_server_stream_stop");
      return;
    }

    resetLauncherStreamConnectionState();
    void refreshLauncherServerControls().then((controls) => {
      const allowSubscribe = hasLauncherServerPermission(controls);
      launcherServerAccessGrantedRef.current = allowSubscribe;
      if (allowSubscribe) {
        void invoke("launcher_server_stream_start");
      } else {
        void invoke("launcher_server_stream_stop");
      }
    });

    return () => {
      launcherServerAccessGrantedRef.current = false;
      clearLauncherStreamRetryTimers();
      void invoke("launcher_server_stream_stop");
    };
  }, [
    clearLauncherStreamRetryTimers,
    hasLauncherServerPermission,
    isApiSourceMode,
    refreshLauncherServerControls,
    resetLauncherStreamConnectionState,
  ]);

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
      pairingCode: profileSourceDraft.pairingCode.trim() || null,
    };

    await saveSettings(next);
    setWizardStep("paths");
    await startWizardDetection();
  }, [
    profileSourceDraft.apiBaseUrl,
    profileSourceDraft.profileLockUrl,
    profileSourceDraft.pairingCode,
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
    try {
      await refreshVersionReadiness();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setVersionReadiness(fallbackVersionReadiness(message));
      setError(message);
    }
  }, [
    fallbackVersionReadiness,
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
      const message = cause instanceof Error ? cause.message : String(cause);
      setVersionReadiness(fallbackVersionReadiness(message));
      setError(message);
    }
  }, [fallbackVersionReadiness, refreshVersionReadiness]);

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

  const cancelSession = useCallback(async () => {
    try {
      await invoke("session_restore_now");
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
      pairingCode: profileSourceDraft.pairingCode.trim() || null,
    };

    await saveSettings(next);
    await runSyncCycle(false);
    await refreshLauncherServerControls();
    setHint("Profile source settings saved.");
  }, [
    profileSourceDraft.apiBaseUrl,
    profileSourceDraft.profileLockUrl,
    profileSourceDraft.pairingCode,
    runSyncCycle,
    refreshLauncherServerControls,
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
    launcherServerControls, setLauncherServerControls,
    isServerActionBusy, setIsServerActionBusy,
    launcherStreamStatus, setLauncherStreamStatus,
    launcherStreamRetryCount, setLauncherStreamRetryCount,
    launcherStreamRetryCountdownSec, setLauncherStreamRetryCountdownSec,
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
    cancelSession, returnToMainWindow, openSetupWindow, openLauncherFromCompact, updateLauncherSelection,
    updateCustomPath, pickManualLauncherFromSettings, pickMinecraftRootFromSettings,
    saveProfileSource, beginWizardPathsStep, continueWizardRuntimeStep,
    pickWizardManualLauncherPath, pickWizardMinecraftRootPath, sourceLabel,
    isApiSourceMode, refreshLauncherServerControls, runLauncherServerAction,
    retryLauncherServerStreamNow,
    currentWindow, isSetupWindow, isCompactWindow, APP_NAME, SERVER_ID
  };
};
