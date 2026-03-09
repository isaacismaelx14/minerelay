/// Launcher app orchestration module.
///
/// Public API surface is re-exported from focused sub-modules:
/// - [`detection`] — platform-specific launcher detection
/// - [`selection`] — selection strategy (preferred / saved)
/// - [`spawn`] — process spawning and path validation
/// - [`bootstrap`] — Prism and official launcher bootstrap
/// - [`windows`] — Windows-only registry, store app, and caching logic
///
/// Complex workflow functions (`open_game`, `pick_manual_launcher_path`) live
/// here because they orchestrate across several sub-modules.
use std::sync::Arc;

use crate::{
  instance::{InstancePaths, ensure_layout, load_local_lock, resolve_launcher_minecraft_root},
  types::{AppSettings, LauncherBootstrapResult, OpenLauncherResponse},
  utils::effective_server_id,
};

use detection::{detect_installed_launchers_detailed, to_public_candidates};
use spawn::{spawn_launcher, validate_launcher_path};
use types::LaunchTarget;

// ─── Sub-modules ─────────────────────────────────────────────────────────────

pub(crate) mod types;
pub(crate) mod detection;
pub(crate) mod selection;
pub(crate) mod spawn;
pub(crate) mod bootstrap;

// The windows module is always compiled so its pure parsing helpers are
// available to unit tests on non-Windows platforms.
pub(crate) mod windows;

// ─── Public re-exports ────────────────────────────────────────────────────────

pub use bootstrap::{
  bootstrap_official_version, bootstrap_prism_instance, managed_version_exists, prism_root_dir,
  server_release_name, server_release_version_id, slugify,
};
pub use detection::{detect_installed_launchers, detect_with_timeout};
pub use selection::{preferred_detected_launcher_id, selected_launcher_id};

// ─── File-picker dialog ───────────────────────────────────────────────────────

pub fn pick_manual_launcher_path() -> Option<String> {
  #[cfg(target_os = "windows")]
  {
    return rfd::FileDialog::new()
      .add_filter("Executable", &["exe"])
      .pick_file()
      .map(|p| p.to_string_lossy().to_string());
  }

  #[cfg(target_os = "macos")]
  {
    return rfd::FileDialog::new()
      .set_directory("/Applications")
      .pick_file()
      .map(|p| p.to_string_lossy().to_string());
  }

  #[cfg(not(any(target_os = "windows", target_os = "macos")))]
  {
    rfd::FileDialog::new()
      .pick_file()
      .map(|p| p.to_string_lossy().to_string())
  }
}

// ─── Open launcher (internal) ─────────────────────────────────────────────────

fn open_from_settings(
  settings: &AppSettings,
  detected: &[types::DetectedLauncher],
) -> crate::error::LauncherResult<OpenLauncherResponse> {
  let public_detected = to_public_candidates(detected);
  let Some(selected_id) = selected_launcher_id(settings, &public_detected) else {
    return Ok(OpenLauncherResponse {
      opened: false,
      path: None,
      bootstrap: None,
      session: None,
    });
  };

  if selected_id == "custom" {
    let custom = settings
      .custom_launcher_path
      .as_deref()
      .ok_or_else(|| crate::error::LauncherError::Config("launcher path is empty".to_string()))?;
    let launcher_path = validate_launcher_path(custom)?;
    spawn_launcher(&LaunchTarget::Executable(launcher_path.clone()))?;
    return Ok(OpenLauncherResponse {
      opened: true,
      path: Some(launcher_path.to_string_lossy().to_string()),
      bootstrap: None,
      session: None,
    });
  }

  let Some(launcher) = detected.iter().find(|l| l.id == selected_id) else {
    return Ok(OpenLauncherResponse {
      opened: false,
      path: None,
      bootstrap: None,
      session: None,
    });
  };

  spawn_launcher(&launcher.target)?;

  let path = match &launcher.target {
    LaunchTarget::Executable(p) => Some(p.to_string_lossy().to_string()),
    LaunchTarget::AppUserModelId(_) => None,
  };

  Ok(OpenLauncherResponse {
    opened: true,
    path,
    bootstrap: None,
    session: None,
  })
}

// ─── open_game — full game launch workflow ────────────────────────────────────

pub async fn open_game(
  app: &tauri::AppHandle,
  state: Arc<crate::state::AppState>,
  server_id: &str,
) -> Result<OpenLauncherResponse, String> {
  let settings = state.settings.lock().clone();
  let detected = detect_installed_launchers_detailed();
  let public_detected = to_public_candidates(&detected);
  let selected_id = selected_launcher_id(&settings, &public_detected);
  let selected_launcher = selected_id.clone().unwrap_or_else(|| "unknown".to_string());
  let effective_server = effective_server_id(state.as_ref(), server_id);
  let (minecraft_root, _) =
    resolve_launcher_minecraft_root(&settings).map_err(|e| format!("{e}"))?;

  let mut pending_bootstrap: Option<LauncherBootstrapResult> = None;

  if matches!(selected_id.as_deref(), Some("prism") | Some("official")) {
    let mut paths = InstancePaths::new(
      &state.config,
      &effective_server,
      &settings.install_mode,
      settings.minecraft_root_override.as_deref(),
    )
    .map_err(|e| format!("{e}"))?;

    let lock = load_local_lock(&paths)
      .map_err(|e| format!("{e}"))?
      .or(crate::profile::fetch_remote_lock(state.as_ref(), &effective_server).await.ok());

    if selected_id.as_deref() == Some("prism") {
      if let Some(ref l) = lock {
        let _ = paths.apply_prism(l);
      }
    }

    ensure_layout(&paths).map_err(|e| format!("{e}"))?;

    if let Some(remote) = lock.as_ref() {
      if remote.loader == "fabric" {
        let _ = crate::runtime::ensure_fabric_runtime(
          state.as_ref(),
          &minecraft_root,
          &remote.minecraft_version,
          &remote.loader_version,
        )
        .await
        .map_err(|e| format!("{e}"))?;
      }
    }

    pending_bootstrap = Some(match (selected_id.as_deref(), lock) {
      (Some("prism"), Some(lock)) => {
        bootstrap_prism_instance(&state, &lock).await.map_err(|e| format!("{e}"))?
      }
      (Some("official"), Some(lock)) => {
        bootstrap_official_version(&state, &lock, &minecraft_root, &minecraft_root)
          .await
          .map_err(|e| format!("{e}"))?
      }
      (Some(id), None::<crate::types::ProfileLock>) => LauncherBootstrapResult {
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

  let paths = InstancePaths::new(
    &state.config,
    &effective_server,
    &settings.install_mode,
    settings.minecraft_root_override.as_deref(),
  )
  .map_err(|e| format!("{e}"))?;

  let live_mc_dir = if selected_id.as_deref() == Some("prism") {
    let mut modified_paths = paths.clone();
    let lock = load_local_lock(&paths)
      .map_err(|e| format!("{e}"))?
      .or(crate::profile::fetch_remote_lock(state.as_ref(), &effective_server).await.ok());
    if let Some(ref l) = lock {
      let _ = modified_paths.apply_prism(l);
    }
    modified_paths.minecraft_dir
  } else {
    minecraft_root.clone()
  };

  // Apply any pending updates before launch.
  if crate::session::sync_allowed(state.as_ref()).is_ok() {
    if let Ok(snapshot) = crate::profile::catalog_snapshot(state.as_ref(), &effective_server).await
    {
      if snapshot.has_updates {
        let _ = crate::sync::sync_apply(app, state.as_ref(), &effective_server).await;
      }
    }
  }

  let session = crate::session::start_or_get_session(
    app,
    Arc::clone(&state),
    &effective_server,
    &selected_launcher,
    &live_mc_dir,
  )
  .await
  .map_err(|e| format!("{e}"))?;

  let mut response = match open_from_settings(&settings, &detected) {
    Ok(v) => v,
    Err(error) => {
      let _ = crate::session::restore_active_session(app, Arc::clone(&state)).await;
      return Err(error.to_string());
    }
  };
  response.bootstrap = pending_bootstrap;
  response.session = Some(session.clone());

  if !response.opened {
    let _ = crate::session::restore_active_session(app, Arc::clone(&state)).await;
    response.session = Some(crate::session::get_status(state.as_ref()));
  }

  Ok(response)
}
