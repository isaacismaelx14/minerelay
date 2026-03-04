import type { UpdateSummary } from "@mvl/shared";

export type ScreenState = "booting" | "syncing" | "ready";
export type InstallMode = "dedicated" | "global";
export type OnboardingStep = "source" | "paths" | "runtime" | "sync";
export type GameSessionPhase =
  | "idle"
  | "awaiting_game_start"
  | "playing"
  | "restoring";
export type WorkspaceView =
  | "overview"
  | "onboarding"
  | "sourcePaths"
  | "catalog"
  | "activity";

export interface AppSettings {
  selectedLauncherId: string | null;
  customLauncherPath: string | null;
  apiBaseUrl: string | null;
  profileLockUrl: string | null;
  pairingCode: string | null;
  installMode: InstallMode;
  wizardCompleted: boolean;
  minecraftRootOverride: string | null;
  onboardingVersion: number | null;
}

export interface LauncherCandidate {
  id: string;
  name: string;
  path: string;
}

export interface LauncherDetectionResult {
  candidates: LauncherCandidate[];
  timedOut: boolean;
  elapsedMs: number;
  officialMaybeUwp: boolean;
}

export interface SyncProgressEvent {
  phase: string;
  completedBytes: number;
  totalBytes: number;
  currentFile?: string;
  speedBps: number;
  etaSec?: number;
}

export interface InstanceState {
  installedVersion: number | null;
  mode: InstallMode;
  instanceRoot: string;
  minecraftDir: string;
  ready: boolean;
}

export interface VersionReadiness {
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

export interface OpenLauncherResponse {
  opened: boolean;
  path: string | null;
  bootstrap: { message: string } | null;
  session: GameSessionStatus | null;
}

export interface GameSessionStatus {
  phase: GameSessionPhase;
  liveMinecraftDir: string | null;
  launcherId: string | null;
  sessionId: string | null;
  startedAt: number | null;
}

export interface GameRunningProbe {
  running: boolean;
  source: "session" | "process";
  launcherId: string | null;
  liveMinecraftDir: string | null;
}

export interface ToastMessage {
  id: number;
  tone: "error" | "hint";
  text: string;
}

export interface MinecraftRootStatus {
  path: string;
  exists: boolean;
  usingOverride: boolean;
}

export interface FabricRuntimeStatus {
  minecraftVersion: string;
  loaderVersion: string;
  versionId: string;
  minecraftRoot: string;
  presentBefore: boolean;
  installedNow: boolean;
  managedVersionId: string;
  managedMessage: string;
}

export interface SyncApplyResponse {
  appliedVersion: number;
  modUpdatesDownloaded: number;
  serverName: string;
}

export interface SyncApplyOptions {
  showSyncScreen?: boolean;
}

export interface SyncCycleOptions {
  suppressSyncScreen?: boolean;
}

export interface AppCloseResponse {
  closed: boolean;
  reason: string | null;
}

export interface LauncherUpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  available: boolean;
  body: string | null;
  pubDate: string | null;
}

export interface LauncherUpdateInstallResponse {
  updated: boolean;
  version: string | null;
  message: string;
}

export interface LauncherServerPermissions {
  canViewStatus: boolean;
  canViewOnlinePlayers: boolean;
  canStartServer: boolean;
  canStopServer: boolean;
  canRestartServer: boolean;
}

export interface LauncherServerStatus {
  id: string;
  name: string;
  address: string;
  motd: string;
  status: number;
  statusLabel: string;
  players: { max: number; count: number };
  software: { id: string; name: string; version: string } | null;
  shared: boolean;
}

export interface LauncherServerControlsState {
  enabled: boolean;
  reason: string | null;
  permissions: LauncherServerPermissions;
  selectedServer: LauncherServerStatus | null;
}

export interface CatalogSnapshot {
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
  fancyMenuMode: "simple" | "custom";
  fancyMenuPresent: boolean;
  fancyMenuCustomBundlePresent: boolean;
  mods: string[];
  resourcepacks: string[];
  shaderpacks: string[];
  configs: string[];
}
