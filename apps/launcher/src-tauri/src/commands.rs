use std::{
  path::Path,
  sync::{
    atomic::Ordering,
    Arc,
  },
};

use serde::Deserialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_updater::UpdaterExt;
use url::Url;

use crate::{
  instance::{
    ensure_layout, load_local_lock, resolve_launcher_minecraft_root, InstancePaths,
  },
  launcher_apps,
  profile,
  providers::validate_service_url,
  runtime,
  session,
  settings,
  state::AppState,
  sync,
  types::{
    AppCloseResponse, AppSettings, CatalogSnapshot, FabricRuntimeStatus, GameRunningProbe,
    GameSessionPhase, GameSessionStatus, InstanceState, LauncherBootstrapResult,
    LauncherCandidate, LauncherDetectionResult, LauncherUpdateInstallResponse,
    LauncherUpdateStatus, MinecraftRootStatus, OpenLauncherResponse,
    ProfileMetadataResponse, SyncApplyResponse, SyncPlan, UpdatesResponse, VersionReadiness,
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
pub fn settings_set(state: State<'_, Arc<AppState>>, settings_payload: AppSettings) -> Result<AppSettings, String> {
  let sanitized = sanitize_settings_payload(settings_payload)?;
  settings::save(&state.config.settings_path(), &sanitized).map_err(|error| error.to_string())?;
  *state.settings.lock() = sanitized.clone();
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
pub async fn launcher_detect_with_timeout(timeout_ms: Option<u64>) -> Result<LauncherDetectionResult, String> {
  launcher_apps::detect_with_timeout(timeout_ms.unwrap_or(5_000))
    .await
    .map_err(|error| error.to_string())
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
  let (path, using_override) = resolve_launcher_minecraft_root(&settings).map_err(|error| error.to_string())?;

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
    .map_err(|error| error.to_string())
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
  let settings = state.settings.lock().clone();
  let detected = launcher_apps::detect_installed_launchers();
  let selected_id = selected_launcher_id(&settings, &detected);
  let selected_launcher = selected_id
    .clone()
    .unwrap_or_else(|| "unknown".to_string());
  let effective_server = effective_server_id(state.inner(), &server_id);
  let (minecraft_root, _) = resolve_launcher_minecraft_root(&settings).map_err(|error| error.to_string())?;

  let mut pending_bootstrap: Option<LauncherBootstrapResult> = None;

  if selected_id.as_deref() == Some("prism") || selected_id.as_deref() == Some("official") {
    let paths = InstancePaths::new(
      &state.config,
      &effective_server,
      &settings.install_mode,
      settings.minecraft_root_override.as_deref(),
    )
    .map_err(|error| error.to_string())?;
    ensure_layout(&paths).map_err(|error| error.to_string())?;

    let lock = load_local_lock(&paths)
      .map_err(|error| error.to_string())?
      .or(profile::fetch_remote_lock(state.inner(), &effective_server).await.ok());

    if let Some(remote) = lock.as_ref() {
      if remote.loader == "fabric" {
        let _ = runtime::ensure_fabric_runtime(
          state.inner(),
          &minecraft_root,
          &remote.minecraft_version,
          &remote.loader_version,
        )
        .await
        .map_err(|error| error.to_string())?;
      }
    }

    pending_bootstrap = Some(match (selected_id.as_deref(), lock) {
      (Some("prism"), Some(lock)) => {
        launcher_apps::bootstrap_prism_instance(&lock, &minecraft_root).map_err(|error| error.to_string())?
      }
      (Some("official"), Some(lock)) => launcher_apps::bootstrap_official_version(
        &lock,
        &minecraft_root,
        &minecraft_root,
      )
      .map_err(|error| error.to_string())?,
      (Some(id), None) => LauncherBootstrapResult {
        launcher_id: id.to_string(),
        instance_name: "Not created".to_string(),
        instance_path: None,
        message: "Sync profile first so launcher bootstrap can be generated.".to_string(),
      },
      _ => LauncherBootstrapResult {
        launcher_id: "unknown".to_string(),
        instance_name: "Not created".to_string(),
        instance_path: None,
        message: "Launcher bootstrap skipped.".to_string(),
      },
    });
  }

  let session = session::start_or_get_session(
    &app,
    Arc::clone(state.inner()),
    &effective_server,
    &selected_launcher,
    &minecraft_root,
  )
  .await
  .map_err(|error| error.to_string())?;

  let mut response = match launcher_apps::open_from_settings(&settings, &detected) {
    Ok(value) => value,
    Err(error) => {
      let _ = session::restore_active_session(&app, Arc::clone(state.inner())).await;
      return Err(error.to_string());
    }
  };
  response.bootstrap = pending_bootstrap;
  response.session = Some(session.clone());

  if !response.opened {
    let _ = session::restore_active_session(&app, Arc::clone(state.inner())).await;
    response.session = Some(session::get_status(state.inner()));
  }

  Ok(response)
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
    .map_err(|error| error.to_string())?;
  let _ = ensure_allowlisted(state.inner(), &effective_server, &remote).await?;

  sync::check_updates(state.inner(), &effective_server)
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn profile_catalog_snapshot(
  state: State<'_, Arc<AppState>>,
  server_id: String,
) -> Result<CatalogSnapshot, String> {
  let effective_server = effective_server_id(state.inner(), &server_id);
  let settings = state.settings.lock().clone();
  let remote = profile::fetch_remote_lock(state.inner(), &effective_server)
    .await
    .map_err(|error| error.to_string())?;
  let metadata = profile::fetch_profile_metadata(state.inner(), &effective_server).await.ok();

  let paths = InstancePaths::new(
    &state.config,
    &effective_server,
    &settings.install_mode,
    settings.minecraft_root_override.as_deref(),
  )
  .map_err(|error| error.to_string())?;
  ensure_layout(&paths).map_err(|error| error.to_string())?;

  let local_version = load_local_lock(&paths)
    .map_err(|error| error.to_string())?
    .map(|lock| lock.version);

  let updates = sync::check_updates(state.inner(), &effective_server)
    .await
    .map_err(|error| error.to_string())?;

  let allowed_minecraft_versions = allowed_versions(metadata.as_ref(), &remote.minecraft_version);
  let metadata_server_name = metadata
    .as_ref()
    .map(|value| value.server_name.trim().to_string())
    .filter(|value| !value.is_empty());
  let metadata_server_address = metadata
    .as_ref()
    .map(|value| value.server_address.trim().to_string())
    .filter(|value| !value.is_empty());
  let lock_server_name = remote.branding.server_name.trim().to_string();
  let lock_server_address = remote.default_server.address.trim().to_string();

  let server_name = metadata_server_name
    .or_else(|| (!lock_server_name.is_empty()).then_some(lock_server_name))
    .unwrap_or_else(|| "Managed Server".to_string());
  let server_address = metadata_server_address
    .or_else(|| (!lock_server_address.is_empty()).then_some(lock_server_address))
    .unwrap_or_else(|| "--".to_string());
  let fancy_menu_enabled = metadata
    .as_ref()
    .map(|value| value.fancy_menu_enabled)
    .unwrap_or(remote.fancy_menu.enabled);
  let fancy_menu_mode = if remote.fancy_menu.mode.trim().eq_ignore_ascii_case("custom") {
    "custom".to_string()
  } else {
    "simple".to_string()
  };
  let fancy_menu_present = remote
    .items
    .iter()
    .any(|entry| entry.name.to_lowercase().contains("fancymenu"));
  let fancy_menu_custom_bundle_present = remote.configs.iter().any(|entry| {
    entry.name == "FancyMenu Custom Bundle"
      || remote
        .fancy_menu
        .custom_layout_url
        .as_ref()
        .is_some_and(|url| url == &entry.url)
  });

  Ok(CatalogSnapshot {
    server_id: effective_server,
    server_name,
    server_address,
    logo_url: remote.branding.logo_url.clone(),
    background_url: remote.branding.background_url.clone(),
    profile_version: remote.version,
    local_version,
    minecraft_version: remote.minecraft_version,
    loader: remote.loader,
    loader_version: remote.loader_version,
    allowed_minecraft_versions,
    has_updates: updates.has_updates,
    summary: updates.summary,
    fancy_menu_enabled,
    fancy_menu_mode,
    fancy_menu_present,
    fancy_menu_custom_bundle_present,
    mods: remote.items.into_iter().map(|entry| entry.name).collect(),
    resourcepacks: remote.resources.into_iter().map(|entry| entry.name).collect(),
    shaderpacks: remote.shaders.into_iter().map(|entry| entry.name).collect(),
    configs: remote.configs.into_iter().map(|entry| entry.name).collect(),
  })
}

#[tauri::command]
pub async fn sync_plan(state: State<'_, Arc<AppState>>, server_id: String) -> Result<SyncPlan, String> {
  let effective_server = effective_server_id(state.inner(), &server_id);
  let remote = profile::fetch_remote_lock(state.inner(), &effective_server)
    .await
    .map_err(|error| error.to_string())?;
  let _ = ensure_allowlisted(state.inner(), &effective_server, &remote).await?;

  sync::sync_plan(state.inner(), &effective_server)
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn sync_apply(
  app: AppHandle,
  state: State<'_, Arc<AppState>>,
  server_id: String,
) -> Result<SyncApplyResponse, String> {
  session::sync_allowed(state.inner()).map_err(|error| error.to_string())?;

  let effective_server = effective_server_id(state.inner(), &server_id);
  let remote = profile::fetch_remote_lock(state.inner(), &effective_server)
    .await
    .map_err(|error| error.to_string())?;
  let _ = ensure_allowlisted(state.inner(), &effective_server, &remote).await?;

  sync::sync_apply(&app, state.inner(), &effective_server)
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn sync_cancel(state: State<'_, Arc<AppState>>) {
  sync::cancel_sync(state.inner());
}

#[tauri::command]
pub fn instance_get_state(state: State<'_, Arc<AppState>>, server_id: String) -> Result<InstanceState, String> {
  let effective_server = effective_server_id(state.inner(), &server_id);
  let settings = state.settings.lock().clone();
  let paths = InstancePaths::new(
    &state.config,
    &effective_server,
    &settings.install_mode,
    settings.minecraft_root_override.as_deref(),
  )
  .map_err(|error| error.to_string())?;
  ensure_layout(&paths).map_err(|error| error.to_string())?;

  let installed_version = load_local_lock(&paths)
    .map_err(|error| error.to_string())?
    .map(|lock| lock.version);

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
  let effective_server = effective_server_id(state.inner(), &server_id);
  let settings = state.settings.lock().clone();
  let remote = profile::fetch_remote_lock(state.inner(), &effective_server)
    .await
    .map_err(|error| error.to_string())?;
  let metadata = profile::fetch_profile_metadata(state.inner(), &effective_server).await.ok();

  let allowed_minecraft_versions = allowed_versions(metadata.as_ref(), &remote.minecraft_version);
  let allowlisted = allowed_minecraft_versions
    .iter()
    .any(|value| value == &remote.minecraft_version);

  let paths = InstancePaths::new(
    &state.config,
    &effective_server,
    &settings.install_mode,
    settings.minecraft_root_override.as_deref(),
  )
  .map_err(|error| error.to_string())?;
  ensure_layout(&paths).map_err(|error| error.to_string())?;

  let (minecraft_root, using_override_root) =
    resolve_launcher_minecraft_root(&settings).map_err(|error| error.to_string())?;
  let versions_dir = minecraft_root.join("versions");

  let expected_fabric = runtime::fabric_version_id(&remote.minecraft_version, &remote.loader_version);
  let fabric_present = versions_dir
    .join(&expected_fabric)
    .join(format!("{expected_fabric}.json"))
    .exists();

  let expected_managed = launcher_apps::server_release_version_id(&remote);
  let selected_launcher = settings.selected_launcher_id.as_deref().unwrap_or("official");
  let requires_managed_version = selected_launcher != "prism";

  let managed_version_present = if requires_managed_version {
    managed_version_exists(&minecraft_root, &expected_managed)
  } else {
    true
  };

  let found = fabric_present && managed_version_present;

  let guidance = if !allowlisted {
    format!(
      "Minecraft {} is not allowlisted for this server. Allowed: {}",
      remote.minecraft_version,
      allowed_minecraft_versions.join(", ")
    )
  } else if !fabric_present {
    format!(
      "Fabric runtime '{}' is missing in your minecraft root. Use onboarding Step 3 to install it.",
      expected_fabric
    )
  } else if !managed_version_present {
    format!(
      "Managed launcher version '{}' is missing. Use onboarding Step 3 to create/update it.",
      expected_managed
    )
  } else {
    "Fabric runtime and managed launcher version look available. Sync stays in app-managed storage; live Minecraft files are swapped only while playing."
      .to_string()
  };

  Ok(VersionReadiness {
    minecraft_version: remote.minecraft_version,
    loader: remote.loader,
    loader_version: remote.loader_version,
    managed_minecraft_dir: paths.minecraft_dir.to_string_lossy().to_string(),
    live_minecraft_root: minecraft_root.to_string_lossy().to_string(),
    minecraft_root: minecraft_root.to_string_lossy().to_string(),
    found_in_minecraft_root_dir: found,
    using_override_root,
    allowlisted,
    allowed_minecraft_versions,
    expected_fabric_version_id: expected_fabric,
    expected_managed_version_id: expected_managed,
    managed_version_present,
    guidance,
  })
}

#[tauri::command]
pub async fn runtime_ensure_fabric(
  state: State<'_, Arc<AppState>>,
  server_id: String,
) -> Result<FabricRuntimeStatus, String> {
  let effective_server = effective_server_id(state.inner(), &server_id);
  let settings = state.settings.lock().clone();
  let remote = profile::fetch_remote_lock(state.inner(), &effective_server)
    .await
    .map_err(|error| error.to_string())?;

  let _ = ensure_allowlisted(state.inner(), &effective_server, &remote).await?;

  let (minecraft_root, _) = resolve_launcher_minecraft_root(&settings).map_err(|error| error.to_string())?;
  std::fs::create_dir_all(&minecraft_root).map_err(|error| error.to_string())?;

  let fabric_status = runtime::ensure_fabric_runtime(
    state.inner(),
    &minecraft_root,
    &remote.minecraft_version,
    &remote.loader_version,
  )
  .await
  .map_err(|error| error.to_string())?;

  let paths = InstancePaths::new(
    &state.config,
    &effective_server,
    &settings.install_mode,
    settings.minecraft_root_override.as_deref(),
  )
  .map_err(|error| error.to_string())?;
  ensure_layout(&paths).map_err(|error| error.to_string())?;

  let detected = launcher_apps::detect_installed_launchers();
  let selected_id = selected_launcher_id(&settings, &detected);
  let managed_version_id = launcher_apps::server_release_version_id(&remote);

  let bootstrap = if selected_id.as_deref() == Some("prism") {
    launcher_apps::bootstrap_prism_instance(&remote, &minecraft_root)
      .map_err(|error| error.to_string())?
  } else {
    launcher_apps::bootstrap_official_version(&remote, &minecraft_root, &minecraft_root)
      .map_err(|error| error.to_string())?
  };

  Ok(FabricRuntimeStatus {
    minecraft_version: fabric_status.minecraft_version,
    loader_version: fabric_status.loader_version,
    version_id: fabric_status.version_id,
    minecraft_root: fabric_status.minecraft_root,
    present_before: fabric_status.present_before,
    installed_now: fabric_status.installed_now,
    managed_version_id,
    managed_message: bootstrap.message,
  })
}

async fn ensure_allowlisted(
  state: &AppState,
  server_id: &str,
  remote: &crate::types::ProfileLock,
) -> Result<Vec<String>, String> {
  let metadata = profile::fetch_profile_metadata(state, server_id).await.ok();
  let allowed = allowed_versions(metadata.as_ref(), &remote.minecraft_version);

  if allowed.iter().any(|value| value == &remote.minecraft_version) {
    return Ok(allowed);
  }

  Err(format!(
    "Minecraft version {} is not allowlisted for server {}. Allowed versions: {}",
    remote.minecraft_version,
    server_id,
    allowed.join(", ")
  ))
}

fn allowed_versions(metadata: Option<&ProfileMetadataResponse>, fallback: &str) -> Vec<String> {
  let mut values = if let Some(value) = metadata {
    if value.allowed_minecraft_versions.is_empty() {
      vec![fallback.to_string()]
    } else {
      value.allowed_minecraft_versions.clone()
    }
  } else {
    vec![fallback.to_string()]
  };

  values.sort();
  values.dedup();
  values
}

fn effective_server_id(state: &AppState, requested: &str) -> String {
  sanitize_server_id(requested)
    .or_else(|| sanitize_server_id(&state.config.server_id))
    .unwrap_or_else(|| "mvl".to_string())
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

fn selected_launcher_id(settings: &AppSettings, detected: &[LauncherCandidate]) -> Option<String> {
  if let Some(id) = settings.selected_launcher_id.as_deref() {
    return Some(id.to_string());
  }

  if detected.iter().any(|candidate| candidate.id == "official") {
    return Some("official".to_string());
  }

  detected.first().map(|candidate| candidate.id.clone())
}

fn managed_version_exists(minecraft_root: &Path, version_id: &str) -> bool {
  minecraft_root
    .join("versions")
    .join(version_id)
    .join(format!("{version_id}.json"))
    .exists()
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

  validate_service_url(trimmed).map_err(|error| error.to_string())?;

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

fn sanitize_server_id(raw: &str) -> Option<String> {
  let trimmed = raw.trim();
  if trimmed.is_empty() || trimmed.len() > 64 {
    return None;
  }

  if trimmed
    .chars()
    .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
  {
    return Some(trimmed.to_string());
  }

  None
}
