mod commands;
mod config;
mod error;
mod events;
mod instance;
mod launcher_apps;
mod notifications;
mod profile;
mod providers;
mod runtime;
mod settings;
mod state;
mod sync;
mod telemetry;
mod types;

use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  telemetry::init();

  let config = config::LauncherConfig::from_env();
  let state = Arc::new(state::AppState::new(config));

  tauri::Builder::default()
    .manage(state)
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(tauri::generate_handler![
      commands::settings_get,
      commands::settings_set,
      commands::launcher_detect,
      commands::launcher_detect_with_timeout,
      commands::launcher_pick_manual_path,
      commands::minecraft_root_detect,
      commands::minecraft_root_pick_manual_path,
      commands::launcher_open,
      commands::profile_check_updates,
      commands::profile_catalog_snapshot,
      commands::sync_plan,
      commands::sync_apply,
      commands::sync_cancel,
      commands::instance_get_state,
      commands::instance_check_version_readiness,
      commands::runtime_ensure_fabric,
    ])
    .run(tauri::generate_context!())
    .expect("error while running Minecraft Server Syncer application");
}
