import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SyncPlan, UpdateSummary } from "@mvl/shared";

const SERVER_ID = import.meta.env.VITE_SERVER_ID ?? "mvl";
const APP_NAME = import.meta.env.VITE_APP_NAME ?? "MVL Syncer";
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

interface LauncherBootstrapResult {
  launcherId: string;
  instanceName: string;
  instancePath: string | null;
  message: string;
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
  bootstrap: LauncherBootstrapResult | null;
  session: GameSessionStatus | null;
}

interface GameSessionStatus {
  phase: GameSessionPhase;
  liveMinecraftDir: string | null;
  launcherId: string | null;
  sessionId: string | null;
  startedAt: number | null;
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

function onboardingRequired(settings: AppSettings): boolean {
  return (
    !settings.wizardCompleted ||
    settings.onboardingVersion !== ONBOARDING_VERSION ||
    !settings.apiBaseUrl
  );
}

function normalizeApiBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/u, "");

  try {
    const parsed = new URL(withoutTrailingSlash);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return withoutTrailingSlash;
  } catch {
    return "";
  }
}

export default function App() {
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

  const [profileSourceDraft, setProfileSourceDraft] = useState({
    apiBaseUrl: "",
    profileLockUrl: "",
  });

  const cycleInFlight = useRef(false);

  const progressPercent = useMemo(() => {
    if (sync.totalBytes <= 0) {
      return 0;
    }
    return Math.min(
      100,
      Math.round((sync.completedBytes / sync.totalBytes) * 100),
    );
  }, [sync.completedBytes, sync.totalBytes]);

  const hasFancyMenuMod = catalog?.fancyMenuPresent ?? false;
  const fancyMenuRequiresAssets = catalog?.fancyMenuRequiresAssets ?? false;
  const hasFancyMenuConfig = catalog?.fancyMenuConfigured ?? false;
  const sessionActive = sessionStatus.phase !== "idle";

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

  const executeSyncApply = useCallback(async () => {
    if (sessionActive) {
      throw new Error("Cannot sync during active play session.");
    }

    setScreen("syncing");
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

  const runSyncCycle = useCallback(
    async (autoApply: boolean) => {
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
          await executeSyncApply();
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
        setWizardActive(true);
        setWizardStep("source");
        setScreen("ready");
        return;
      }

      setWizardActive(false);
      await runSyncCycle(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setScreen("ready");
    }
  }, [loadSettingsAndLaunchers, refreshSessionStatus, runSyncCycle]);

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

  useEffect(() => {
    if (wizardActive || !settings || sessionActive) {
      return;
    }

    const timer = window.setInterval(() => {
      void runSyncCycle(true);
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [runSyncCycle, sessionActive, settings, wizardActive]);

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
      setError("API base URL must be a valid http(s) URL.");
      return;
    }

    const next: AppSettings = {
      ...settings,
      apiBaseUrl,
      profileLockUrl: profileSourceDraft.profileLockUrl.trim() || null,
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

    await runSyncCycle(true);

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
  }, [runSyncCycle, saveSettings, settings]);

  const openLauncher = useCallback(async () => {
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

      const messages = [
        `Opened launcher: ${result.path ?? "selected launcher"}`,
      ];
      if (result.bootstrap) {
        messages.push(result.bootstrap.message);
      }
      setHint(messages.join(" | "));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const restoreSessionNow = useCallback(async () => {
    try {
      setError(null);
      const status = await invoke<GameSessionStatus>("session_restore_now");
      setSessionStatus(status);
      setHint("Session restored. Managed files moved back from live Minecraft dir.");
      await refreshDashboardState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [refreshDashboardState]);

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
      setError("API base URL must be a valid http(s) URL.");
      return;
    }

    const next: AppSettings = {
      ...settings,
      apiBaseUrl,
      profileLockUrl: profileSourceDraft.profileLockUrl.trim() || null,
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

            <div className="actions-row">
              <button
                className="btn ghost"
                onClick={() => setWizardStep("runtime")}
              >
                Back
              </button>
              <button
                className="btn primary"
                onClick={() => void completeWizard()}
              >
                Run Sync and Finish Setup
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
            aria-valuenow={progressPercent}
          >
            <div
              className="meter-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="metrics-row">
            <span>
              {bytesToHuman(sync.completedBytes)} /{" "}
              {bytesToHuman(sync.totalBytes)}
            </span>
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

        <div className="actions-row">
          <button
            className="btn primary"
            onClick={() => void openLauncher()}
            disabled={isChecking}
          >
            Open Launcher
          </button>
          <button
            className="btn ghost"
            onClick={() => void runSyncCycle(true)}
            disabled={isChecking || sessionActive}
          >
            Check + Auto Apply
          </button>
          {catalog?.hasUpdates ? (
            <button
              className="btn ghost"
              onClick={() =>
                void executeSyncApply().then(() => runSyncCycle(false))
              }
              disabled={isChecking || sessionActive}
            >
              Apply Updates Now
            </button>
          ) : null}
          {sessionActive ? (
            <button
              className="btn ghost"
              onClick={() => void restoreSessionNow()}
            >
              Restore Session Now
            </button>
          ) : null}
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
            <button className="btn ghost" onClick={() => void openLauncher()}>
              Open Launcher
            </button>
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
              Sync writes only to managed game dir. Live Minecraft files are swapped only after Open Launcher.
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
              aria-valuenow={progressPercent}
            >
              <div className="meter-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="metrics-row">
              <span>
                {bytesToHuman(sync.completedBytes)} / {bytesToHuman(sync.totalBytes)}
              </span>
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

  const sourceLabel =
    settings?.apiBaseUrl ??
    settings?.profileLockUrl ??
    "API source not configured";

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
            className={activeView === "onboarding" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveView("onboarding")}
          >
            Setup
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
            <span className="eyebrow">Minecraft Java Server Client Center</span>
            <h2>{catalog?.serverName ?? `Server ${SERVER_ID}`}</h2>
            {sessionStatus.phase === "playing" ? (
              <p className="playing-status">
                Playing in {sessionStatus.liveMinecraftDir ?? "Minecraft directory"}
              </p>
            ) : null}
            </div>
          </div>
          <div className="version-pill">
            {catalog?.loader ?? "fabric"} {catalog?.loaderVersion ?? "--"} | MC{" "}
            {catalog?.minecraftVersion ?? "--"}
          </div>
        </header>

        {renderWorkspace()}

        {error ? (
          <div className="alert error" role="alert">
            {error}
          </div>
        ) : null}

        {hint ? <div className="alert hint">{hint}</div> : null}
      </section>
    </main>
  );
}
