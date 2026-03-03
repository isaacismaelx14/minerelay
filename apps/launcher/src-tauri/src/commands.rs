use crate::{utils::*, launcher_apps::selected_launcher_id};
use std::sync::{
  atomic::Ordering,
  Arc,
};

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_updater::UpdaterExt;
use url::Url;

use crate::{
  instance::{
    ensure_layout, load_local_lock, resolve_launcher_minecraft_root, InstancePaths,
  },
  launcher_apps,
  profile,
  providers::validate_service_url,
  session,
  settings,
  state::AppState,
  sync,
  types::{
    AppCloseResponse, AppSettings, CatalogSnapshot, FabricRuntimeStatus, GameRunningProbe,
    GameSessionPhase, GameSessionStatus, InstanceState, 
    LauncherCandidate, LauncherDetectionResult, LauncherUpdateInstallResponse,
    LauncherUpdateStatus, MinecraftRootStatus, OpenLauncherResponse,
    SyncApplyResponse, SyncPlan, UpdatesResponse, VersionReadiness,
  },
};

const DEFAULT_UPDATER_ENDPOINT: &str =
  "https://github.com/isaacismaelx14/mc-client-center/releases/latest/download/latest.json";
const GITHUB_RELEASES_API: &str =
  "https://api.github.com/repos/isaacismaelx14/mc-client-center/releases?per_page=20";

#[derive(Debug, Deserialize)]
struct GithubReleaseAsset {
  name: String,
  browser_download_url: String,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
  draft: bool,
  prerelease: bool,
  assets: Vec<GithubReleaseAsset>,
}

#[tauri::command]
pub fn settings_get(state: State<'_, Arc<AppState>>) -> AppSettings {
  state.settings.lock().clone()
}

#[tauri::command]
pub fn settings_set(app: AppHandle, state: State<'_, Arc<AppState>>, settings_payload: AppSettings) -> Result<AppSettings, String> {
  let sanitized = sanitize_settings_payload(settings_payload)?;
  settings::save(&state.config.settings_path(), &sanitized).map_err(|e| format!("{e}"))?;
  *state.settings.lock() = sanitized.clone();
  
  let _ = app.emit("settings://updated", &sanitized);
  
  Ok(sanitized)
}

#[tauri::command]
pub fn launcher_detect(state: State<'_, Arc<AppState>>) -> Vec<LauncherCandidate> {
  let mut detected = launcher_apps::detect_installed_launchers();

  if let Some(custom) = state.settings.lock().custom_launcher_path.clone() {
    let trimmed = custom.trim().to_string();
    if !trimmed.is_empty() {
      detected.push(LauncherCandidate {
        id: "custom".to_string(),
        name: "Custom Executable".to_string(),
        path: trimmed,
      });
    }
  }

  detected
}

#[tauri::command]
pub async fn launcher_detect_with_timeout(state: State<'_, Arc<AppState>>, timeout_ms: Option<u64>) -> Result<LauncherDetectionResult, String> {
  let mut result = launcher_apps::detect_with_timeout(timeout_ms.unwrap_or(5_000))
    .await
    .map_err(|e| format!("{e}"))?;

  if let Some(custom) = state.settings.lock().custom_launcher_path.clone() {
    let trimmed = custom.trim().to_string();
    if !trimmed.is_empty() {
      if !result.candidates.iter().any(|c| c.id == "custom") {
        result.candidates.push(LauncherCandidate {
          id: "custom".to_string(),
          name: "Custom Executable".to_string(),
          path: trimmed,
        });
      }
    }
  }

  Ok(result)
}

#[tauri::command]
pub fn launcher_pick_manual_path() -> Option<String> {
  launcher_apps::pick_manual_launcher_path()
}

#[tauri::command]
pub fn minecraft_root_pick_manual_path() -> Option<String> {
  rfd::FileDialog::new()
    .pick_folder()
    .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn minecraft_root_detect(state: State<'_, Arc<AppState>>) -> Result<MinecraftRootStatus, String> {
  let settings = state.settings.lock().clone();
  let (path, using_override) = resolve_launcher_minecraft_root(&settings).map_err(|e| format!("{e}"))?;

  Ok(MinecraftRootStatus {
    path: path.to_string_lossy().to_string(),
    exists: path.exists(),
    using_override,
  })
}

#[tauri::command]
pub fn session_status_get(state: State<'_, Arc<AppState>>) -> GameSessionStatus {
  session::get_status(state.inner())
}

#[tauri::command]
pub async fn session_restore_now(
  app: AppHandle,
  state: State<'_, Arc<AppState>>,
) -> Result<GameSessionStatus, String> {
  session::restore_active_session(&app, Arc::clone(state.inner()))
    .await
    .map_err(|e| format!("{e}"))
}

#[tauri::command]
pub async fn app_request_close(
  app: AppHandle,
  state: State<'_, Arc<AppState>>,
) -> Result<AppCloseResponse, String> {
  let current = session::get_status(state.inner());
  if current.phase == GameSessionPhase::Playing {
    return Ok(AppCloseResponse {
      closed: false,
      reason: Some("Cannot close while Minecraft is playing.".to_string()),
    });
  }

  let app_state = Arc::clone(state.inner());
  if app_state.is_exiting.swap(true, Ordering::SeqCst) {
    return Ok(AppCloseResponse {
      closed: true,
      reason: None,
    });
  }
  app_state.allow_exit_once.store(true, Ordering::SeqCst);

  let app_handle = app.clone();
  tauri::async_runtime::spawn(async move {
    let _ = session::restore_active_session(&app_handle, app_state).await;
    app_handle.exit(0);
  });

  Ok(AppCloseResponse {
    closed: true,
    reason: None,
  })
}

#[tauri::command]
pub fn app_keep_running_in_background(app: AppHandle) -> Result<(), String> {
  let selected = app
    .get_webview_window("main")
    .filter(|window| window.is_visible().unwrap_or(false))
    .or_else(|| {
      app
        .get_webview_window("setup")
        .filter(|window| window.is_visible().unwrap_or(false))
    })
    .or_else(|| app.get_webview_window("main"))
    .or_else(|| app.get_webview_window("setup"));

  let Some(window) = selected else {
    return Err("No app window is available.".to_string());
  };

  if window.hide().is_ok() {
    return Ok(());
  }

  window
    .minimize()
    .map_err(|error| format!("Failed to keep app in background: {error}"))?;

  Ok(())
}

#[tauri::command]
pub fn app_open_setup_window(app: AppHandle) -> Result<(), String> {
  switch_to_window(&app, "setup", "main")
}

#[tauri::command]
pub fn app_return_to_main_window(app: AppHandle) -> Result<(), String> {
  switch_to_window(&app, "main", "setup")
}

#[tauri::command]
pub fn game_running_probe(state: State<'_, Arc<AppState>>) -> Result<GameRunningProbe, String> {
  let status = session::get_status(state.inner());
  if status.phase != GameSessionPhase::Idle {
    return Ok(GameRunningProbe {
      running: true,
      source: "session".to_string(),
      launcher_id: status.launcher_id.clone(),
      live_minecraft_dir: status.live_minecraft_dir.clone(),
    });
  }

  let settings = state.settings.lock().clone();
  let detected = launcher_apps::detect_installed_launchers();
  let selected = selected_launcher_id(&settings, &detected);
  let probe_launcher = selected.clone().unwrap_or_else(|| "official".to_string());

  let Ok((minecraft_root, _)) = resolve_launcher_minecraft_root(&settings) else {
    return Ok(GameRunningProbe {
      running: false,
      source: "process".to_string(),
      launcher_id: selected,
      live_minecraft_dir: None,
    });
  };

  let running = session::probe_game_running(&minecraft_root, &probe_launcher);

  Ok(GameRunningProbe {
    running,
    source: "process".to_string(),
    launcher_id: Some(probe_launcher),
    live_minecraft_dir: Some(minecraft_root.to_string_lossy().to_string()),
  })
}

#[tauri::command]
pub async fn launcher_update_check(
  app: AppHandle,
  state: State<'_, Arc<AppState>>,
) -> Result<LauncherUpdateStatus, String> {
  let current_version = app.package_info().version.to_string();
  let updater_endpoint = resolve_updater_endpoint(state.inner(), &current_version)
    .await?;
  let mut updater_builder = app.updater_builder();
  if let Some(pubkey) = state.config.updater_pubkey.clone() {
    updater_builder = updater_builder.pubkey(pubkey);
  }
  let updater = updater_builder
    .endpoints(vec![
      updater_endpoint,
    ])
    .map_err(|error| format!("Failed to configure launcher updater endpoint: {error}"))?
    .build()
    .map_err(|error| format!("Failed to initialize launcher updater: {error}"))?;
  let update = updater
    .check()
    .await
    .map_err(|error| format!("Failed to check launcher updates: {error}"))?;

  let Some(update) = update else {
    return Ok(LauncherUpdateStatus {
      current_version,
      latest_version: None,
      available: false,
      body: None,
      pub_date: None,
    });
  };

  if should_ignore_prerelease_update(&current_version, &update.version) {
    return Ok(LauncherUpdateStatus {
      current_version,
      latest_version: None,
      available: false,
      body: None,
      pub_date: None,
    });
  }

  Ok(LauncherUpdateStatus {
    current_version,
    latest_version: Some(update.version.clone()),
    available: true,
    body: update.body.clone(),
    pub_date: update.date.map(|date| date.to_string()),
  })
}

#[tauri::command]
pub async fn launcher_update_install(
  app: AppHandle,
  state: State<'_, Arc<AppState>>,
) -> Result<LauncherUpdateInstallResponse, String> {
  let current_version = app.package_info().version.to_string();
  let updater_endpoint = resolve_updater_endpoint(state.inner(), &current_version)
    .await?;
  let mut updater_builder = app.updater_builder();
  if let Some(pubkey) = state.config.updater_pubkey.clone() {
    updater_builder = updater_builder.pubkey(pubkey);
  }
  let updater = updater_builder
    .endpoints(vec![
      updater_endpoint,
    ])
    .map_err(|error| format!("Failed to configure launcher updater endpoint: {error}"))?
    .build()
    .map_err(|error| format!("Failed to initialize launcher updater: {error}"))?;
  let update = updater
    .check()
    .await
    .map_err(|error| format!("Failed to check launcher updates: {error}"))?;

  let Some(update) = update else {
    return Ok(LauncherUpdateInstallResponse {
      updated: false,
      version: None,
      message: "Launcher is already up to date.".to_string(),
    });
  };

  if should_ignore_prerelease_update(&current_version, &update.version) {
    return Ok(LauncherUpdateInstallResponse {
      updated: false,
      version: None,
      message:
        "Prerelease update ignored because this launcher is on a stable version."
          .to_string(),
    });
  }

  let target_version = update.version.clone();
  update
    .download_and_install(
      |_chunk_length, _content_length| {},
      || {},
    )
    .await
    .map_err(|error| format!("Failed to install launcher update: {error}"))?;

  app.request_restart();

  Ok(LauncherUpdateInstallResponse {
    updated: true,
    version: Some(target_version.clone()),
    message: format!(
      "Launcher update {target_version} installed. Restarting to apply the new version."
    ),
  })
}

#[tauri::command]
pub async fn launcher_open(
  app: AppHandle,
  state: State<'_, Arc<AppState>>,
  server_id: String,
) -> Result<OpenLauncherResponse, String> {
  crate::launcher_apps::open_game(&app, std::sync::Arc::clone(state.inner()), &server_id).await
}

#[tauri::command]
pub async fn profile_check_updates(
  state: State<'_, Arc<AppState>>,
  server_id: String,
  _local_version: Option<i64>,
) -> Result<UpdatesResponse, String> {
  let effective_server = effective_server_id(state.inner(), &server_id);
  let remote = profile::fetch_remote_lock(state.inner(), &effective_server)
    .await
    .map_err(|e| format!("{e}"))?;
  let _ = ensure_allowlisted(state.inner(), &effective_server, &remote).await?;

  sync::check_updates(state.inner(), &effective_server)
    .await
    .map_err(|e| format!("{e}"))
}

#[tauri::command]
pub async fn profile_catalog_snapshot(
  state: State<'_, Arc<AppState>>,
  server_id: String,
) -> Result<CatalogSnapshot, String> {
  crate::profile::catalog_snapshot(state.inner(), &server_id).await
}

#[tauri::command]
pub async fn sync_plan(state: State<'_, Arc<AppState>>, server_id: String) -> Result<SyncPlan, String> {
  let effective_server = effective_server_id(state.inner(), &server_id);
  let remote = profile::fetch_remote_lock(state.inner(), &effective_server)
    .await
    .map_err(|e| format!("{e}"))?;
  let _ = ensure_allowlisted(state.inner(), &effective_server, &remote).await?;

  sync::sync_plan(state.inner(), &effective_server)
    .await
    .map_err(|e| format!("{e}"))
}

#[tauri::command]
pub async fn sync_apply(
  app: AppHandle,
  state: State<'_, Arc<AppState>>,
  server_id: String,
) -> Result<SyncApplyResponse, String> {
  session::sync_allowed(state.inner()).map_err(|e| format!("{e}"))?;

  let effective_server = effective_server_id(state.inner(), &server_id);
  let remote = profile::fetch_remote_lock(state.inner(), &effective_server)
    .await
    .map_err(|e| format!("{e}"))?;
  let _ = ensure_allowlisted(state.inner(), &effective_server, &remote).await?;

  sync::sync_apply(&app, state.inner(), &effective_server)
    .await
    .map_err(|e| format!("{e}"))
}

#[tauri::command]
pub fn sync_cancel(state: State<'_, Arc<AppState>>) {
  sync::cancel_sync(state.inner());
}

#[tauri::command]
pub async fn instance_get_state(state: State<'_, Arc<AppState>>, server_id: String) -> Result<InstanceState, String> {
  let effective_server = effective_server_id(state.inner(), &server_id);
  let settings = state.settings.lock().clone();
  let mut paths = InstancePaths::new(
    &state.config,
    &effective_server,
    &settings.install_mode,
    settings.minecraft_root_override.as_deref(),
  )
  .map_err(|e| format!("{e}"))?;

  let detected = crate::launcher_apps::detect_installed_launchers();
  let selected = selected_launcher_id(&settings, &detected);
  
  if selected.as_deref() == Some("prism") {
    // Fallback to cached or remote lock to find the correct instance name for Prism
    let lock_for_prism = load_local_lock(&paths).unwrap_or(None)
        .or(crate::profile::fetch_remote_lock(state.inner(), &effective_server).await.ok());
    if let Some(ref lock) = lock_for_prism {
      let _ = paths.apply_prism(lock);
    }
  }

  ensure_layout(&paths).map_err(|e| format!("{e}"))?;

  let installed_lock = load_local_lock(&paths).map_err(|e| format!("{e}"))?;
  let installed_version = installed_lock.map(|lock| lock.version);

  Ok(InstanceState {
    installed_version,
    mode: settings.install_mode,
    instance_root: paths.root.to_string_lossy().to_string(),
    minecraft_dir: paths.minecraft_dir.to_string_lossy().to_string(),
    ready: installed_version.is_some(),
  })
}

#[tauri::command]
pub async fn instance_check_version_readiness(
  state: State<'_, Arc<AppState>>,
  server_id: String,
) -> Result<VersionReadiness, String> {
  crate::instance::check_version_readiness(state.inner(), &server_id).await
}

#[tauri::command]
pub async fn runtime_ensure_fabric(
  state: State<'_, Arc<AppState>>,
  server_id: String,
) -> Result<FabricRuntimeStatus, String> {
  crate::runtime::ensure_fabric_and_bootstrap(state.inner(), &server_id).await
}







async fn resolve_updater_endpoint(
  state: &AppState,
  current_version: &str,
) -> Result<Url, String> {
  let configured = state.config.updater_endpoint.trim();
  if configured.is_empty() {
    return Err("Updater endpoint is not configured.".to_string());
  }

  let maybe_beta_endpoint =
    if configured == DEFAULT_UPDATER_ENDPOINT && is_prerelease_version(current_version) {
      fetch_latest_beta_updater_endpoint(state).await
    } else {
      None
    };

  let chosen = maybe_beta_endpoint.as_deref().unwrap_or(configured);
  Url::parse(chosen).map_err(|error| format!("Invalid updater endpoint URL: {error}"))
}

fn is_prerelease_version(version: &str) -> bool {
  version.contains('-')
}

fn should_ignore_prerelease_update(current_version: &str, candidate_version: &str) -> bool {
  !is_prerelease_version(current_version) && is_prerelease_version(candidate_version)
}

async fn fetch_latest_beta_updater_endpoint(state: &AppState) -> Option<String> {
  let response = state.http.get(GITHUB_RELEASES_API).send().await.ok()?;
  if !response.status().is_success() {
    return None;
  }

  let releases = response.json::<Vec<GithubRelease>>().await.ok()?;
  releases
    .into_iter()
    .find(|release| release.prerelease && !release.draft)
    .and_then(|release| {
      release
        .assets
        .into_iter()
        .find(|asset| asset.name == "latest.json")
    })
    .map(|asset| asset.browser_download_url)
}





fn sanitize_settings_payload(mut payload: AppSettings) -> Result<AppSettings, String> {
  payload.api_base_url = normalize_optional_service_url(payload.api_base_url, true)?;
  payload.profile_lock_url = normalize_optional_service_url(payload.profile_lock_url, false)?;
  payload.custom_launcher_path = normalize_optional_string(payload.custom_launcher_path);
  payload.minecraft_root_override = normalize_optional_string(payload.minecraft_root_override);

  Ok(payload)
}

fn normalize_optional_service_url(value: Option<String>, trim_trailing_slash: bool) -> Result<Option<String>, String> {
  let Some(raw) = value else {
    return Ok(None);
  };

  let trimmed = raw.trim();
  if trimmed.is_empty() {
    return Ok(None);
  }

  validate_service_url(trimmed).map_err(|e| format!("{e}"))?;

  let normalized = if trim_trailing_slash {
    trimmed.trim_end_matches('/').to_string()
  } else {
    trimmed.to_string()
  };

  Ok(Some(normalized))
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
  value
    .map(|raw| raw.trim().to_string())
    .filter(|raw| !raw.is_empty())
}

fn switch_to_window(app: &AppHandle, target: &str, hide: &str) -> Result<(), String> {
  let Some(target_window) = app.get_webview_window(target) else {
    return Err(format!("Window `{target}` is not available."));
  };

  if let Some(hide_window) = app.get_webview_window(hide) {
    let _ = hide_window.hide();
  }

  let _ = target_window.unminimize();
  target_window
    .show()
    .map_err(|error| format!("Failed to show `{target}` window: {error}"))?;
  target_window
    .set_focus()
    .map_err(|error| format!("Failed to focus `{target}` window: {error}"))?;

  Ok(())
}


