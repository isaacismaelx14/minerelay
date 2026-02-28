use std::{path::Path, sync::Arc};

use tauri::{AppHandle, State};

use crate::{
  instance::{
    ensure_layout, load_local_lock, resolve_launcher_minecraft_root, InstancePaths,
  },
  launcher_apps,
  profile,
  runtime,
  session,
  settings,
  state::AppState,
  sync,
  types::{
    AppSettings, CatalogSnapshot, FabricRuntimeStatus, InstanceState, LauncherBootstrapResult,
    LauncherCandidate, LauncherDetectionResult, MinecraftRootStatus, OpenLauncherResponse,
    ProfileMetadataResponse, SyncApplyResponse, SyncPlan, UpdatesResponse, VersionReadiness,
    GameSessionStatus,
  },
};

#[tauri::command]
pub fn settings_get(state: State<'_, Arc<AppState>>) -> AppSettings {
  state.settings.lock().clone()
}

#[tauri::command]
pub fn settings_set(state: State<'_, Arc<AppState>>, settings_payload: AppSettings) -> Result<AppSettings, String> {
  settings::save(&state.config.settings_path(), &settings_payload).map_err(|error| error.to_string())?;
  *state.settings.lock() = settings_payload.clone();
  Ok(settings_payload)
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

  let server_name = if !lock_server_name.is_empty() {
    lock_server_name
  } else {
    metadata_server_name.unwrap_or_else(|| "Managed Server".to_string())
  };
  let server_address = if !lock_server_address.is_empty() {
    lock_server_address
  } else {
    metadata_server_address.unwrap_or_else(|| "--".to_string())
  };
  let fancy_menu_enabled = metadata
    .as_ref()
    .map(|value| value.fancy_menu_enabled)
    .unwrap_or(remote.fancy_menu.enabled);
  let fancy_menu_present = remote
    .items
    .iter()
    .any(|entry| entry.name.to_lowercase().contains("fancymenu"));
  let fancy_menu_requires_assets =
    remote.fancy_menu.config_url.is_some() || remote.fancy_menu.assets_url.is_some();
  let fancy_menu_configured = remote
    .configs
    .iter()
    .any(|entry| entry.name.to_lowercase().contains("fancymenu"));

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
    fancy_menu_present,
    fancy_menu_requires_assets,
    fancy_menu_configured,
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
  let trimmed = requested.trim();
  if trimmed.is_empty() {
    state.config.server_id.clone()
  } else {
    trimmed.to_string()
  }
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
