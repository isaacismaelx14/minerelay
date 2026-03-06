use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileMetadataResponse {
  pub profile_id: String,
  pub version: i64,
  pub minecraft_version: String,
  pub loader: String,
  pub loader_version: String,
  pub lock_url: String,
  pub server_name: String,
  pub server_address: String,
  #[serde(default)]
  pub allowed_minecraft_versions: Vec<String>,
  #[serde(default)]
  pub fancy_menu_enabled: bool,
  #[serde(default)]
  pub fancy_menu: Option<FancyMenuSettings>,
  #[serde(default)]
  pub signature: Option<String>,
  #[serde(default)]
  pub signature_algorithm: Option<String>,
  #[serde(default)]
  pub signature_key_id: Option<String>,
  #[serde(default)]
  pub signature_input: Option<String>,
  #[serde(default)]
  pub signed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FancyMenuSettings {
  #[serde(default)]
  pub enabled: bool,
  #[serde(default = "default_fancy_menu_mode")]
  pub mode: String,
  #[serde(default = "default_play_button_label")]
  pub play_button_label: String,
  #[serde(default = "default_true")]
  pub hide_singleplayer: bool,
  #[serde(default = "default_true")]
  pub hide_multiplayer: bool,
  #[serde(default = "default_true")]
  pub hide_realms: bool,
  #[serde(default)]
  pub custom_layout_url: Option<String>,
  #[serde(default)]
  pub custom_layout_sha256: Option<String>,
}

impl Default for FancyMenuSettings {
  fn default() -> Self {
    Self {
      enabled: false,
      mode: default_fancy_menu_mode(),
      play_button_label: default_play_button_label(),
      hide_singleplayer: true,
      hide_multiplayer: true,
      hide_realms: true,
      custom_layout_url: None,
      custom_layout_sha256: None,
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSummary {
  pub add: i64,
  pub remove: i64,
  pub update: i64,
  pub keep: i64,
}

impl UpdateSummary {
  pub fn has_work(&self) -> bool {
    self.add > 0 || self.remove > 0 || self.update > 0
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatesResponse {
  pub has_updates: bool,
  pub from: Option<i64>,
  pub to: i64,
  pub summary: UpdateSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileLock {
  pub profile_id: String,
  pub version: i64,
  pub minecraft_version: String,
  pub loader: String,
  pub loader_version: String,
  pub default_server: DefaultServer,
  pub items: Vec<LockItem>,
  #[serde(default)]
  pub resources: Vec<ResourcePack>,
  #[serde(default)]
  pub shaders: Vec<ShaderPack>,
  #[serde(default)]
  pub configs: Vec<ConfigTemplate>,
  pub runtime_hints: RuntimeHints,
  pub branding: Branding,
  #[serde(default)]
  pub fancy_menu: FancyMenuSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LockItem {
  pub kind: String,
  pub name: String,
  pub provider: String,
  pub project_id: Option<String>,
  pub version_id: Option<String>,
  pub url: String,
  pub sha256: String,
  pub side: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourcePack {
  pub kind: String,
  pub name: String,
  pub url: String,
  pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShaderPack {
  pub kind: String,
  pub name: String,
  pub url: String,
  pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigTemplate {
  pub kind: String,
  pub name: String,
  pub url: String,
  pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeHints {
  pub java_major: i32,
  pub min_memory_mb: i32,
  pub max_memory_mb: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Branding {
  pub server_name: String,
  pub logo_url: Option<String>,
  pub background_url: Option<String>,
  pub news_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultServer {
  pub name: String,
  pub address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncOperation {
  pub op: String,
  pub path: String,
  pub name: String,
  pub kind: String,
  pub sha256: Option<String>,
  pub from_sha256: Option<String>,
  pub to_sha256: Option<String>,
  pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPlan {
  pub server_id: String,
  pub from_version: Option<i64>,
  pub to_version: i64,
  pub summary: UpdateSummary,
  pub operations: Vec<SyncOperation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncProgressEvent {
  pub phase: String,
  pub completed_bytes: u64,
  pub total_bytes: u64,
  pub current_file: Option<String>,
  pub speed_bps: u64,
  pub eta_sec: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncErrorEvent {
  pub code: String,
  pub message: String,
  pub action_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncApplyResponse {
  pub applied_version: i64,
  pub mod_updates_downloaded: usize,
  pub server_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum InstallMode {
  Dedicated,
  Global,
}

impl Default for InstallMode {
  fn default() -> Self {
    Self::Global
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
  #[serde(default)]
  pub selected_launcher_id: Option<String>,
  #[serde(default)]
  pub custom_launcher_path: Option<String>,
  #[serde(default)]
  pub api_base_url: Option<String>,
  #[serde(default)]
  pub profile_lock_url: Option<String>,
  #[serde(default)]
  pub pairing_code: Option<String>,
  #[serde(default)]
  pub install_mode: InstallMode,
  #[serde(default)]
  pub wizard_completed: bool,
  #[serde(default)]
  pub minecraft_root_override: Option<String>,
  #[serde(default)]
  pub onboarding_version: Option<i32>,
}

impl Default for AppSettings {
  fn default() -> Self {
    Self {
      selected_launcher_id: None,
      custom_launcher_path: None,
      api_base_url: None,
      profile_lock_url: None,
      pairing_code: None,
      install_mode: InstallMode::Global,
      wizard_completed: false,
      minecraft_root_override: None,
      onboarding_version: None,
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherCandidate {
  pub id: String,
  pub name: String,
  pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherDetectionResult {
  pub candidates: Vec<LauncherCandidate>,
  pub timed_out: bool,
  pub elapsed_ms: u64,
  pub official_maybe_uwp: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherBootstrapResult {
  pub launcher_id: String,
  pub instance_name: String,
  pub instance_path: Option<String>,
  pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenLauncherResponse {
  pub opened: bool,
  pub path: Option<String>,
  pub bootstrap: Option<LauncherBootstrapResult>,
  #[serde(default)]
  pub session: Option<GameSessionStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppCloseResponse {
  pub closed: bool,
  #[serde(default)]
  pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherServerPermissions {
  pub can_view_status: bool,
  #[serde(default)]
  pub can_view_online_players: bool,
  pub can_start_server: bool,
  pub can_stop_server: bool,
  pub can_restart_server: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherServerStatus {
  pub id: String,
  pub name: String,
  pub address: String,
  pub motd: String,
  pub status: i32,
  pub status_label: String,
  pub players: LauncherServerPlayers,
  pub software: Option<LauncherServerSoftware>,
  pub shared: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherServerPlayers {
  pub max: i32,
  pub count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherServerSoftware {
  pub id: String,
  pub name: String,
  pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherServerControlsState {
  pub enabled: bool,
  pub reason: Option<String>,
  pub permissions: LauncherServerPermissions,
  pub selected_server: Option<LauncherServerStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherUpdateStatus {
  pub current_version: String,
  #[serde(default)]
  pub latest_version: Option<String>,
  pub available: bool,
  #[serde(default)]
  pub body: Option<String>,
  #[serde(default)]
  pub pub_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherUpdateInstallResponse {
  pub updated: bool,
  #[serde(default)]
  pub version: Option<String>,
  pub message: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LauncherUpdateAction {
  Check,
  Install,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum LauncherUpdateErrorCode {
  #[serde(rename = "LUPD-ENDPOINT-INVALID")]
  EndpointInvalid,
  #[serde(rename = "LUPD-MANIFEST-UNAVAILABLE")]
  ManifestUnavailable,
  #[serde(rename = "LUPD-UPDATER-INIT")]
  UpdaterInit,
  #[serde(rename = "LUPD-CHECK-FAILED")]
  CheckFailed,
  #[serde(rename = "LUPD-DOWNLOAD-FAILED")]
  DownloadFailed,
  #[serde(rename = "LUPD-INSTALL-FAILED")]
  InstallFailed,
}

impl LauncherUpdateErrorCode {
  pub fn as_str(self) -> &'static str {
    match self {
      Self::EndpointInvalid => "LUPD-ENDPOINT-INVALID",
      Self::ManifestUnavailable => "LUPD-MANIFEST-UNAVAILABLE",
      Self::UpdaterInit => "LUPD-UPDATER-INIT",
      Self::CheckFailed => "LUPD-CHECK-FAILED",
      Self::DownloadFailed => "LUPD-DOWNLOAD-FAILED",
      Self::InstallFailed => "LUPD-INSTALL-FAILED",
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherUpdateCommandError {
  pub code: LauncherUpdateErrorCode,
  pub action: LauncherUpdateAction,
  pub user_message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameRunningProbe {
  pub running: bool,
  pub source: String,
  #[serde(default)]
  pub launcher_id: Option<String>,
  #[serde(default)]
  pub live_minecraft_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GameSessionPhase {
  Idle,
  AwaitingGameStart,
  Playing,
  Restoring,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSessionStatus {
  pub phase: GameSessionPhase,
  #[serde(default)]
  pub live_minecraft_dir: Option<String>,
  #[serde(default)]
  pub launcher_id: Option<String>,
  #[serde(default)]
  pub session_id: Option<String>,
  #[serde(default)]
  pub started_at: Option<i64>,
}

impl Default for GameSessionStatus {
  fn default() -> Self {
    Self {
      phase: GameSessionPhase::Idle,
      live_minecraft_dir: None,
      launcher_id: None,
      session_id: None,
      started_at: None,
    }
  }
}

impl GameSessionStatus {
  pub fn is_active(&self) -> bool {
    self.phase != GameSessionPhase::Idle
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstanceState {
  pub installed_version: Option<i64>,
  pub mode: InstallMode,
  pub instance_root: String,
  pub minecraft_dir: String,
  pub ready: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionReadiness {
  pub minecraft_version: String,
  pub loader: String,
  pub loader_version: String,
  pub managed_minecraft_dir: String,
  pub live_minecraft_root: String,
  pub minecraft_root: String,
  pub found_in_minecraft_root_dir: bool,
  pub using_override_root: bool,
  pub allowlisted: bool,
  pub allowed_minecraft_versions: Vec<String>,
  pub expected_fabric_version_id: String,
  pub expected_managed_version_id: String,
  pub managed_version_present: bool,
  pub guidance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MinecraftRootStatus {
  pub path: String,
  pub exists: bool,
  pub using_override: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FabricRuntimeStatus {
  pub minecraft_version: String,
  pub loader_version: String,
  pub version_id: String,
  pub minecraft_root: String,
  pub present_before: bool,
  pub installed_now: bool,
  pub managed_version_id: String,
  pub managed_message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogSnapshot {
  pub server_id: String,
  pub server_name: String,
  pub server_address: String,
  pub logo_url: Option<String>,
  pub background_url: Option<String>,
  pub profile_version: i64,
  pub local_version: Option<i64>,
  pub minecraft_version: String,
  pub loader: String,
  pub loader_version: String,
  pub allowed_minecraft_versions: Vec<String>,
  pub has_updates: bool,
  pub summary: UpdateSummary,
  pub fancy_menu_enabled: bool,
  pub fancy_menu_mode: String,
  pub fancy_menu_present: bool,
  pub fancy_menu_custom_bundle_present: bool,
  pub mods: Vec<String>,
  pub resourcepacks: Vec<String>,
  pub shaderpacks: Vec<String>,
  pub configs: Vec<String>,
}

fn default_true() -> bool {
  true
}

fn default_play_button_label() -> String {
  "Play".to_string()
}

fn default_fancy_menu_mode() -> String {
  "simple".to_string()
}
