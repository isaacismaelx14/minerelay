use crate::{launcher_control, utils::*, launcher_apps::selected_launcher_id};
use std::sync::{
  atomic::{AtomicBool, Ordering},
  Arc,
};

use serde::Deserialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_updater::UpdaterExt;
use url::Url;
use uuid::Uuid;

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
    LauncherServerControlsState, LauncherUpdateAction, LauncherUpdateCommandError,
    LauncherUpdateErrorCode,
    LauncherCandidate, LauncherDetectionResult, LauncherUpdateInstallResponse,
    LauncherUpdateStatus, MinecraftRootStatus, OpenLauncherResponse,
    SyncApplyResponse, SyncPlan, UpdatesResponse, VersionReadiness,
  },
};

const DEFAULT_UPDATER_ENDPOINT: &str =
  "https://github.com/isaacismaelx14/minerelay/releases/latest/download/latest.json";
const LEGACY_DEFAULT_UPDATER_ENDPOINT: &str =
  "https://github.com/isaacismaelx14/mc-client-center/releases/latest/download/latest.json";
const GITHUB_RELEASES_API: &str =
  "https://api.github.com/repos/isaacismaelx14/minerelay/releases?per_page=20";
const LAUNCHER_TAG_PREFIX: &str = "@minerelay/launcher/v";
const LEGACY_LAUNCHER_TAG_PREFIX: &str = "@mss/launcher/v";

#[derive(Debug, Clone, Deserialize)]
struct GithubReleaseAsset {
  name: String,
  browser_download_url: String,
}

#[derive(Debug, Clone, Deserialize)]
struct GithubRelease {
  tag_name: String,
  draft: bool,
  prerelease: bool,
  assets: Vec<GithubReleaseAsset>,
}

#[derive(Debug, Clone)]
struct ResolvedUpdaterEndpoint {
  url: Url,
  source: &'static str,
  release_tag: Option<String>,
}

#[derive(Debug, Clone)]
struct SelectedGithubReleaseAsset {
  release_tag: String,
  download_url: String,
  source: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LauncherReleaseChannel {
  Stable,
  Prerelease,
}

#[derive(Debug)]
enum UpdaterEndpointResolveError {
  EndpointInvalid(String),
  ManifestUnavailable(String),
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
pub fn app_log_client_exception(
  source: String,
  message: String,
  details: Option<String>,
) {
  crate::telemetry::record_exception_event(
    source.trim(),
    message.trim(),
    details.as_deref().map(|entry| entry.trim()),
  );
}

#[tauri::command]
pub fn app_open_devtools_secret(
  app: AppHandle,
  state: State<'_, Arc<AppState>>,
  secret_command: String,
) -> Result<(), String> {
  #[cfg(not(feature = "devtools"))]
  {
    let _ = (app, state, secret_command);
    return Err("Devtools are disabled in this build".to_string());
  }

  #[cfg(feature = "devtools")]
  {
  let Some(expected) = state.config.devtools_secret_command.as_deref() else {
    return Err("Devtools secret command is not configured".to_string());
  };

  let attempted = secret_command.trim();
  if attempted.is_empty() || attempted != expected {
    crate::telemetry::record_exception_event(
      "devtools",
      "Rejected secret command",
      Some("invalid secret command"),
    );
    return Err("Invalid secret command".to_string());
  }

  let mut opened = 0usize;
  for (_, window) in app.webview_windows() {
    window.open_devtools();
    opened += 1;
  }

  if opened == 0 {
    return Err("No webview windows available to open devtools".to_string());
  }

  crate::telemetry::record_exception_event(
    "devtools",
    "Opened devtools",
    Some("secret command accepted"),
  );
  Ok(())
  }
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
) -> Result<LauncherUpdateStatus, LauncherUpdateCommandError> {
  let action = LauncherUpdateAction::Check;
  let op_id = Uuid::new_v4().to_string();
  let current_version = app.package_info().version.to_string();
  let configured_endpoint = state.config.updater_endpoint.trim().to_string();
  log_updater_event(
    &op_id,
    action,
    "started",
    &current_version,
    &configured_endpoint,
    None,
    None,
    None,
    None,
    None,
  );

  let updater_endpoint = resolve_updater_endpoint(state.inner(), &current_version)
    .await
    .map_err(|error| {
      updater_resolution_error(
        &op_id,
        action,
        "resolve_endpoint_failed",
        &current_version,
        &configured_endpoint,
        &error,
      )
    })?;
  log_updater_event(
    &op_id,
    action,
    "endpoint_resolved",
    &current_version,
    &configured_endpoint,
    Some(updater_endpoint.url.as_str()),
    updater_endpoint.release_tag.as_deref(),
    None,
    None,
    Some(json!({ "source": updater_endpoint.source })),
  );

  let mut updater_builder = app.updater_builder();
  if let Some(pubkey) = state.config.updater_pubkey.clone() {
    updater_builder = updater_builder.pubkey(pubkey);
  }
  let updater = updater_builder
    .endpoints(vec![
      updater_endpoint.url.clone(),
    ])
    .map_err(|error| {
      updater_command_error(
        &op_id,
        action,
        LauncherUpdateErrorCode::UpdaterInit,
        "configure_updater_failed",
        &current_version,
        &configured_endpoint,
        Some(updater_endpoint.url.as_str()),
        updater_endpoint.release_tag.as_deref(),
        None,
        error.to_string(),
      )
    })?
    .build()
    .map_err(|error| {
      updater_command_error(
        &op_id,
        action,
        LauncherUpdateErrorCode::UpdaterInit,
        "initialize_updater_failed",
        &current_version,
        &configured_endpoint,
        Some(updater_endpoint.url.as_str()),
        updater_endpoint.release_tag.as_deref(),
        None,
        error.to_string(),
      )
    })?;
  let update = updater
    .check()
    .await
    .map_err(|error| {
      let raw = error.to_string();
      updater_command_error(
        &op_id,
        action,
        classify_check_error_code(&raw),
        "check_failed",
        &current_version,
        &configured_endpoint,
        Some(updater_endpoint.url.as_str()),
        updater_endpoint.release_tag.as_deref(),
        None,
        raw,
      )
    })?;

  let Some(update) = update else {
    log_updater_event(
      &op_id,
      action,
      "no_update",
      &current_version,
      &configured_endpoint,
      Some(updater_endpoint.url.as_str()),
      updater_endpoint.release_tag.as_deref(),
      None,
      None,
      None,
    );
    return Ok(LauncherUpdateStatus {
      current_version,
      latest_version: None,
      available: false,
      body: None,
      pub_date: None,
    });
  };

  if should_ignore_prerelease_update(&current_version, &update.version) {
    log_updater_event(
      &op_id,
      action,
      "ignored_prerelease",
      &current_version,
      &configured_endpoint,
      Some(updater_endpoint.url.as_str()),
      updater_endpoint.release_tag.as_deref(),
      Some(update.version.as_str()),
      None,
      None,
    );
    return Ok(LauncherUpdateStatus {
      current_version,
      latest_version: None,
      available: false,
      body: None,
      pub_date: None,
    });
  }

  log_updater_event(
    &op_id,
    action,
    "update_available",
    &current_version,
    &configured_endpoint,
    Some(updater_endpoint.url.as_str()),
    updater_endpoint.release_tag.as_deref(),
    Some(update.version.as_str()),
    None,
    None,
  );

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
) -> Result<LauncherUpdateInstallResponse, LauncherUpdateCommandError> {
  let action = LauncherUpdateAction::Install;
  let op_id = Uuid::new_v4().to_string();
  let current_version = app.package_info().version.to_string();
  let configured_endpoint = state.config.updater_endpoint.trim().to_string();
  log_updater_event(
    &op_id,
    action,
    "started",
    &current_version,
    &configured_endpoint,
    None,
    None,
    None,
    None,
    None,
  );

  let updater_endpoint = resolve_updater_endpoint(state.inner(), &current_version)
    .await
    .map_err(|error| {
      updater_resolution_error(
        &op_id,
        action,
        "resolve_endpoint_failed",
        &current_version,
        &configured_endpoint,
        &error,
      )
    })?;
  log_updater_event(
    &op_id,
    action,
    "endpoint_resolved",
    &current_version,
    &configured_endpoint,
    Some(updater_endpoint.url.as_str()),
    updater_endpoint.release_tag.as_deref(),
    None,
    None,
    Some(json!({ "source": updater_endpoint.source })),
  );

  let mut updater_builder = app.updater_builder();
  if let Some(pubkey) = state.config.updater_pubkey.clone() {
    updater_builder = updater_builder.pubkey(pubkey);
  }
  let updater = updater_builder
    .endpoints(vec![
      updater_endpoint.url.clone(),
    ])
    .map_err(|error| {
      updater_command_error(
        &op_id,
        action,
        LauncherUpdateErrorCode::UpdaterInit,
        "configure_updater_failed",
        &current_version,
        &configured_endpoint,
        Some(updater_endpoint.url.as_str()),
        updater_endpoint.release_tag.as_deref(),
        None,
        error.to_string(),
      )
    })?
    .build()
    .map_err(|error| {
      updater_command_error(
        &op_id,
        action,
        LauncherUpdateErrorCode::UpdaterInit,
        "initialize_updater_failed",
        &current_version,
        &configured_endpoint,
        Some(updater_endpoint.url.as_str()),
        updater_endpoint.release_tag.as_deref(),
        None,
        error.to_string(),
      )
    })?;
  let update = updater
    .check()
    .await
    .map_err(|error| {
      let raw = error.to_string();
      updater_command_error(
        &op_id,
        action,
        classify_check_error_code(&raw),
        "check_failed",
        &current_version,
        &configured_endpoint,
        Some(updater_endpoint.url.as_str()),
        updater_endpoint.release_tag.as_deref(),
        None,
        raw,
      )
    })?;

  let Some(update) = update else {
    log_updater_event(
      &op_id,
      action,
      "no_update",
      &current_version,
      &configured_endpoint,
      Some(updater_endpoint.url.as_str()),
      updater_endpoint.release_tag.as_deref(),
      None,
      None,
      None,
    );
    return Ok(LauncherUpdateInstallResponse {
      updated: false,
      version: None,
      message: "Launcher is already up to date.".to_string(),
    });
  };

  if should_ignore_prerelease_update(&current_version, &update.version) {
    log_updater_event(
      &op_id,
      action,
      "ignored_prerelease",
      &current_version,
      &configured_endpoint,
      Some(updater_endpoint.url.as_str()),
      updater_endpoint.release_tag.as_deref(),
      Some(update.version.as_str()),
      None,
      None,
    );
    return Ok(LauncherUpdateInstallResponse {
      updated: false,
      version: None,
      message:
        "Prerelease update ignored because this launcher is on a stable version."
          .to_string(),
    });
  }

  let target_version = update.version.clone();
  let selected_endpoint = updater_endpoint.url.to_string();
  let release_tag = updater_endpoint.release_tag.clone();
  log_updater_event(
    &op_id,
    action,
    "download_prepared",
    &current_version,
    &configured_endpoint,
    Some(selected_endpoint.as_str()),
    release_tag.as_deref(),
    Some(target_version.as_str()),
    None,
    None,
  );

  let download_started = Arc::new(AtomicBool::new(false));
  let install_started = Arc::new(AtomicBool::new(false));
  let download_started_ref = Arc::clone(&download_started);
  let install_started_ref = Arc::clone(&install_started);
  let progress_op_id = op_id.clone();
  let progress_current_version = current_version.clone();
  let progress_configured_endpoint = configured_endpoint.clone();
  let progress_selected_endpoint = selected_endpoint.clone();
  let progress_release_tag = release_tag.clone();
  let progress_target_version = target_version.clone();
  let install_op_id = op_id.clone();
  let install_current_version = current_version.clone();
  let install_configured_endpoint = configured_endpoint.clone();
  let install_selected_endpoint = selected_endpoint.clone();
  let install_release_tag = release_tag.clone();
  let install_target_version = target_version.clone();

  update
    .download_and_install(
      move |_chunk_length, content_length| {
        if !download_started_ref.swap(true, Ordering::SeqCst) {
          log_updater_event(
            &progress_op_id,
            action,
            "download_started",
            &progress_current_version,
            &progress_configured_endpoint,
            Some(progress_selected_endpoint.as_str()),
            progress_release_tag.as_deref(),
            Some(progress_target_version.as_str()),
            None,
            Some(json!({ "contentLength": content_length })),
          );
        }
      },
      move || {
        install_started_ref.store(true, Ordering::SeqCst);
        log_updater_event(
          &install_op_id,
          action,
          "install_started",
          &install_current_version,
          &install_configured_endpoint,
          Some(install_selected_endpoint.as_str()),
          install_release_tag.as_deref(),
          Some(install_target_version.as_str()),
          None,
          None,
        );
      },
    )
    .await
    .map_err(|error| {
      let raw = error.to_string();
      updater_command_error(
        &op_id,
        action,
        classify_install_error_code(install_started.load(Ordering::SeqCst)),
        "install_failed",
        &current_version,
        &configured_endpoint,
        Some(selected_endpoint.as_str()),
        release_tag.as_deref(),
        Some(target_version.as_str()),
        raw,
      )
    })?;

  log_updater_event(
    &op_id,
    action,
    "completed",
    &current_version,
    &configured_endpoint,
    Some(selected_endpoint.as_str()),
    release_tag.as_deref(),
    Some(target_version.as_str()),
    None,
    None,
  );

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

#[tauri::command]
pub async fn launcher_server_controls_get(
  state: State<'_, Arc<AppState>>,
) -> Result<LauncherServerControlsState, String> {
  launcher_control::fetch_controls_status(state.inner()).await
}

#[tauri::command]
pub async fn launcher_server_action(
  state: State<'_, Arc<AppState>>,
  action: String,
) -> Result<LauncherServerControlsState, String> {
  let clean_action = action.trim().to_lowercase();
  if clean_action != "start" && clean_action != "stop" && clean_action != "restart" {
    return Err("Action must be one of: start, stop, restart".to_string());
  }

  launcher_control::perform_action(state.inner(), clean_action.as_str()).await
}

#[tauri::command]
pub async fn launcher_server_stream_start(
  app: AppHandle,
  state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
  launcher_control::start_stream(app, Arc::clone(state.inner())).await
}

#[tauri::command]
pub fn launcher_server_stream_stop(state: State<'_, Arc<AppState>>) {
  launcher_control::stop_stream(state.inner());
}

#[tauri::command]
pub fn launcher_pairing_apply_link(
  state: State<'_, Arc<AppState>>,
  url: String,
) -> Result<bool, String> {
  launcher_control::ingest_pairing_link(state.inner(), &url)
}







async fn resolve_updater_endpoint(
  state: &AppState,
  current_version: &str,
) -> Result<ResolvedUpdaterEndpoint, UpdaterEndpointResolveError> {
  let configured = state.config.updater_endpoint.trim();
  if configured.is_empty() {
    return Err(UpdaterEndpointResolveError::EndpointInvalid(
      "Updater endpoint is not configured.".to_string(),
    ));
  }

  if !is_managed_updater_endpoint(configured) {
    return Url::parse(configured)
      .map(|url| ResolvedUpdaterEndpoint {
        url,
        source: "configured",
        release_tag: None,
      })
      .map_err(|error| {
        UpdaterEndpointResolveError::EndpointInvalid(format!(
          "Invalid updater endpoint URL: {error}"
        ))
      });
  }

  let channel = if is_prerelease_version(current_version) {
    LauncherReleaseChannel::Prerelease
  } else {
    LauncherReleaseChannel::Stable
  };

  let selected = fetch_latest_release_updater_asset(state, channel).await?;
  let url = Url::parse(&selected.download_url).map_err(|error| {
    UpdaterEndpointResolveError::EndpointInvalid(format!(
      "Invalid updater asset URL: {error}"
    ))
  })?;

  Ok(ResolvedUpdaterEndpoint {
    url,
    source: selected.source,
    release_tag: Some(selected.release_tag),
  })
}

fn is_managed_updater_endpoint(endpoint: &str) -> bool {
  endpoint == DEFAULT_UPDATER_ENDPOINT || endpoint == LEGACY_DEFAULT_UPDATER_ENDPOINT
}

fn is_prerelease_version(version: &str) -> bool {
  version.contains('-')
}

fn should_ignore_prerelease_update(current_version: &str, candidate_version: &str) -> bool {
  !is_prerelease_version(current_version) && is_prerelease_version(candidate_version)
}

async fn fetch_latest_release_updater_asset(
  state: &AppState,
  channel: LauncherReleaseChannel,
) -> Result<SelectedGithubReleaseAsset, UpdaterEndpointResolveError> {
  let response = state
    .http
    .get(GITHUB_RELEASES_API)
    .header("Accept", "application/vnd.github+json")
    .send()
    .await
    .map_err(|error| {
      UpdaterEndpointResolveError::ManifestUnavailable(format!(
        "Failed to fetch GitHub releases: {error}"
      ))
    })?;

  if !response.status().is_success() {
    return Err(UpdaterEndpointResolveError::ManifestUnavailable(format!(
      "GitHub releases API returned status {}",
      response.status()
    )));
  }

  let releases = response.json::<Vec<GithubRelease>>().await.map_err(|error| {
    UpdaterEndpointResolveError::ManifestUnavailable(format!(
      "Failed to decode GitHub releases response: {error}"
    ))
  })?;

  select_release_updater_asset(&releases, channel).ok_or_else(|| {
    let reason = match channel {
      LauncherReleaseChannel::Stable => {
        "No stable launcher release with latest.json is currently published."
      }
      LauncherReleaseChannel::Prerelease => {
        "No prerelease launcher build with latest.json is currently published."
      }
    };
    UpdaterEndpointResolveError::ManifestUnavailable(reason.to_string())
  })
}

fn select_release_updater_asset(
  releases: &[GithubRelease],
  channel: LauncherReleaseChannel,
) -> Option<SelectedGithubReleaseAsset> {
  let selected = releases.iter().find_map(|release| {
    if !release_matches_channel(release, channel) {
      return None;
    }

    release
      .assets
      .iter()
      .find(|asset| asset.name == "latest.json")
      .map(|asset| SelectedGithubReleaseAsset {
        release_tag: release.tag_name.clone(),
        download_url: asset.browser_download_url.clone(),
        source: match channel {
          LauncherReleaseChannel::Stable => "github-stable",
          LauncherReleaseChannel::Prerelease => "github-prerelease",
        },
      })
  });
  if selected.is_some() {
    return selected;
  }

  if channel == LauncherReleaseChannel::Stable {
    return releases.iter().find_map(|release| {
      if release.draft || !release_looks_like_launcher_prerelease(release) {
        return None;
      }

      release
        .assets
        .iter()
        .find(|asset| asset.name == "latest.json")
        .map(|asset| SelectedGithubReleaseAsset {
          release_tag: release.tag_name.clone(),
          download_url: asset.browser_download_url.clone(),
          source: "github-stable-fallback",
        })
    });
  }

  None
}

fn release_matches_channel(
  release: &GithubRelease,
  channel: LauncherReleaseChannel,
) -> bool {
  if release.draft {
    return false;
  }

  match channel {
    LauncherReleaseChannel::Stable => {
      !release.prerelease && is_namespaced_launcher_release_tag(&release.tag_name)
    }
    LauncherReleaseChannel::Prerelease => {
      release_looks_like_launcher_prerelease(release)
    }
  }
}

fn is_namespaced_launcher_release_tag(tag_name: &str) -> bool {
  tag_name.starts_with(LAUNCHER_TAG_PREFIX)
    || tag_name.starts_with(LEGACY_LAUNCHER_TAG_PREFIX)
}

fn release_looks_like_launcher_prerelease(release: &GithubRelease) -> bool {
  release.prerelease
    && (is_namespaced_launcher_release_tag(&release.tag_name)
      || release.tag_name.starts_with('v'))
}

fn classify_check_error_code(raw: &str) -> LauncherUpdateErrorCode {
  let normalized = raw.to_ascii_lowercase();
  if normalized.contains("valid release json")
    || normalized.contains("latest.json")
    || normalized.contains("404")
    || normalized.contains("not found")
  {
    LauncherUpdateErrorCode::ManifestUnavailable
  } else {
    LauncherUpdateErrorCode::CheckFailed
  }
}

fn classify_install_error_code(install_started: bool) -> LauncherUpdateErrorCode {
  if install_started {
    LauncherUpdateErrorCode::InstallFailed
  } else {
    LauncherUpdateErrorCode::DownloadFailed
  }
}

fn updater_resolution_error(
  op_id: &str,
  action: LauncherUpdateAction,
  stage: &str,
  current_version: &str,
  configured_endpoint: &str,
  error: &UpdaterEndpointResolveError,
) -> LauncherUpdateCommandError {
  let (code, raw_error) = match error {
    UpdaterEndpointResolveError::EndpointInvalid(raw) => {
      (LauncherUpdateErrorCode::EndpointInvalid, raw.as_str())
    }
    UpdaterEndpointResolveError::ManifestUnavailable(raw) => {
      (LauncherUpdateErrorCode::ManifestUnavailable, raw.as_str())
    }
  };

  updater_command_error(
    op_id,
    action,
    code,
    stage,
    current_version,
    configured_endpoint,
    None,
    None,
    None,
    raw_error.to_string(),
  )
}

fn updater_command_error(
  op_id: &str,
  action: LauncherUpdateAction,
  code: LauncherUpdateErrorCode,
  stage: &str,
  current_version: &str,
  configured_endpoint: &str,
  selected_endpoint: Option<&str>,
  release_tag: Option<&str>,
  target_version: Option<&str>,
  raw_error: String,
) -> LauncherUpdateCommandError {
  log_updater_event(
    op_id,
    action,
    stage,
    current_version,
    configured_endpoint,
    selected_endpoint,
    release_tag,
    target_version,
    Some(code),
    Some(json!({ "rawError": raw_error })),
  );

  LauncherUpdateCommandError {
    code,
    action,
    user_message: updater_user_message(action, code),
  }
}

fn updater_user_message(
  action: LauncherUpdateAction,
  code: LauncherUpdateErrorCode,
) -> String {
  format!(
    "Cannot perform {}. Code: {}.",
    updater_action_label(action),
    code.as_str()
  )
}

fn updater_action_name(action: LauncherUpdateAction) -> &'static str {
  match action {
    LauncherUpdateAction::Check => "check",
    LauncherUpdateAction::Install => "install",
  }
}

fn updater_action_label(action: LauncherUpdateAction) -> &'static str {
  match action {
    LauncherUpdateAction::Check => "update check",
    LauncherUpdateAction::Install => "update installation",
  }
}

fn log_updater_event(
  op_id: &str,
  action: LauncherUpdateAction,
  stage: &str,
  current_version: &str,
  configured_endpoint: &str,
  selected_endpoint: Option<&str>,
  release_tag: Option<&str>,
  target_version: Option<&str>,
  code: Option<LauncherUpdateErrorCode>,
  extra: Option<serde_json::Value>,
) {
  let mut details = json!({
    "opId": op_id,
    "action": updater_action_name(action),
    "stage": stage,
    "currentVersion": current_version,
    "configuredEndpoint": configured_endpoint,
    "customEndpoint": !is_managed_updater_endpoint(configured_endpoint),
  });

  if let Some(selected) = selected_endpoint {
    details["selectedEndpoint"] = json!(selected);
  }
  if let Some(tag) = release_tag {
    details["releaseTag"] = json!(tag);
  }
  if let Some(version) = target_version {
    details["targetVersion"] = json!(version);
  }
  if let Some(error_code) = code {
    details["code"] = json!(error_code.as_str());
  }
  if let Some(extra_value) = extra {
    details["extra"] = extra_value;
  }

  let message = format!("launcher update {} {}", updater_action_name(action), stage);
  let details_payload = details.to_string();
  crate::telemetry::record_structured_event(
    "launcher.update",
    &message,
    Some(details_payload.as_str()),
  );
}





#[cfg(test)]
mod tests {
  use super::*;

  fn release(
    tag_name: &str,
    prerelease: bool,
    draft: bool,
    assets: &[(&str, &str)],
  ) -> GithubRelease {
    GithubRelease {
      tag_name: tag_name.to_string(),
      prerelease,
      draft,
      assets: assets
        .iter()
        .map(|(name, url)| GithubReleaseAsset {
          name: (*name).to_string(),
          browser_download_url: (*url).to_string(),
        })
        .collect(),
    }
  }

  #[test]
  fn stable_release_selection_ignores_non_launcher_and_missing_manifest() {
    let releases = vec![
      release(
        "@minerelay/shared/v0.2.0",
        false,
        false,
        &[("latest.json", "https://example.com/shared/latest.json")],
      ),
      release("@minerelay/launcher/v0.2.1", false, false, &[]),
      release(
        "@minerelay/launcher/v0.2.0",
        false,
        false,
        &[("latest.json", "https://example.com/launcher/latest.json")],
      ),
    ];

    let selected = select_release_updater_asset(&releases, LauncherReleaseChannel::Stable)
      .expect("expected stable launcher release");

    assert_eq!(selected.release_tag, "@minerelay/launcher/v0.2.0");
    assert_eq!(
      selected.download_url,
      "https://example.com/launcher/latest.json"
    );
  }

  #[test]
  fn prerelease_selection_requires_latest_json() {
    let releases = vec![
      release(
        "v0.2.0-beta.36",
        true,
        false,
        &[("notes.txt", "https://example.com/notes.txt")],
      ),
      release(
        "v0.2.0-beta.35",
        true,
        false,
        &[("latest.json", "https://example.com/beta/latest.json")],
      ),
    ];

    let selected =
      select_release_updater_asset(&releases, LauncherReleaseChannel::Prerelease)
        .expect("expected prerelease launcher build");

    assert_eq!(selected.release_tag, "v0.2.0-beta.35");
    assert_eq!(
      selected.download_url,
      "https://example.com/beta/latest.json"
    );
  }

  #[test]
  fn stable_selection_supports_legacy_launcher_tag_prefix() {
    let releases = vec![release(
      "@mss/launcher/v0.2.1",
      false,
      false,
      &[("latest.json", "https://example.com/legacy/latest.json")],
    )];

    let selected = select_release_updater_asset(&releases, LauncherReleaseChannel::Stable)
      .expect("expected stable launcher release");

    assert_eq!(selected.release_tag, "@mss/launcher/v0.2.1");
    assert_eq!(
      selected.download_url,
      "https://example.com/legacy/latest.json"
    );
  }

  #[test]
  fn prerelease_selection_ignores_non_launcher_prerelease_tags() {
    let releases = vec![
      release(
        "@mss/api/v0.1.0-beta.32",
        true,
        false,
        &[("latest.json", "https://example.com/api/latest.json")],
      ),
      release(
        "v0.2.0-beta.35",
        true,
        false,
        &[("latest.json", "https://example.com/launcher/latest.json")],
      ),
    ];

    let selected =
      select_release_updater_asset(&releases, LauncherReleaseChannel::Prerelease)
        .expect("expected prerelease launcher build");

    assert_eq!(selected.release_tag, "v0.2.0-beta.35");
    assert_eq!(
      selected.download_url,
      "https://example.com/launcher/latest.json"
    );
  }

  #[test]
  fn stable_selection_falls_back_to_launcher_prerelease_manifest() {
    let releases = vec![
      release("@minerelay/launcher/v0.3.1", false, false, &[]),
      release(
        "v0.3.2-beta.1",
        true,
        false,
        &[("latest.json", "https://example.com/beta/latest.json")],
      ),
    ];

    let selected = select_release_updater_asset(&releases, LauncherReleaseChannel::Stable)
      .expect("expected stable fallback release");

    assert_eq!(selected.release_tag, "v0.3.2-beta.1");
    assert_eq!(
      selected.download_url,
      "https://example.com/beta/latest.json"
    );
    assert_eq!(selected.source, "github-stable-fallback");
  }

  #[test]
  fn managed_updater_endpoint_includes_legacy_repo_url() {
    assert!(is_managed_updater_endpoint(DEFAULT_UPDATER_ENDPOINT));
    assert!(is_managed_updater_endpoint(LEGACY_DEFAULT_UPDATER_ENDPOINT));
    assert!(!is_managed_updater_endpoint("https://example.com/latest.json"));
  }

  #[test]
  fn check_error_classification_marks_missing_manifest() {
    let code = classify_check_error_code(
      "Failed to load updater response as a valid release json: HTTP status 404 Not Found",
    );

    assert_eq!(code, LauncherUpdateErrorCode::ManifestUnavailable);
  }

  #[test]
  fn install_error_classification_distinguishes_download_and_install() {
    assert_eq!(
      classify_install_error_code(false),
      LauncherUpdateErrorCode::DownloadFailed
    );
    assert_eq!(
      classify_install_error_code(true),
      LauncherUpdateErrorCode::InstallFailed
    );
  }
}

fn sanitize_settings_payload(mut payload: AppSettings) -> Result<AppSettings, String> {
  payload.api_base_url = normalize_optional_service_url(payload.api_base_url, true)?;
  payload.profile_lock_url = normalize_optional_service_url(payload.profile_lock_url, false)?;
  payload.pairing_code = normalize_optional_string(payload.pairing_code).map(|value| value.to_uppercase());
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
