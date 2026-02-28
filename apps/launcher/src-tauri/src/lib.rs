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
mod session;
mod settings;
mod state;
mod sync;
mod telemetry;
mod types;

use std::{
  sync::{
    atomic::Ordering,
    Arc,
  },
};

use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  Manager, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  telemetry::init();

  let config = config::LauncherConfig::from_env();
  let state = Arc::new(state::AppState::new(config));

  let app = tauri::Builder::default()
    .manage(state)
    .plugin(tauri_plugin_notification::init())
    .setup(|app| {
      build_tray(app)?;

      let app_handle = app.handle().clone();
      let app_state = app.state::<Arc<state::AppState>>().inner().clone();
      tauri::async_runtime::spawn(async move {
        let _ = session::recover_on_startup(&app_handle, app_state).await;
      });

      Ok(())
    })
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
      }
    })
    .invoke_handler(tauri::generate_handler![
      commands::settings_get,
      commands::settings_set,
      commands::launcher_detect,
      commands::launcher_detect_with_timeout,
      commands::launcher_pick_manual_path,
      commands::minecraft_root_detect,
      commands::minecraft_root_pick_manual_path,
      commands::launcher_open,
      commands::session_status_get,
      commands::session_restore_now,
      commands::profile_check_updates,
      commands::profile_catalog_snapshot,
      commands::sync_plan,
      commands::sync_apply,
      commands::sync_cancel,
      commands::instance_get_state,
      commands::instance_check_version_readiness,
      commands::runtime_ensure_fabric,
    ])
    .build(tauri::generate_context!())
    .expect("error while building Minecraft Server Syncer application");

  app.run(|app_handle, event| {
    if let tauri::RunEvent::ExitRequested { api, .. } = event {
      let app_state = app_handle.state::<Arc<state::AppState>>().inner().clone();

      if app_state.is_exiting.swap(true, Ordering::SeqCst) {
        return;
      }

      api.prevent_exit();

      let app_handle = app_handle.clone();
      tauri::async_runtime::spawn(async move {
        let _ = session::restore_active_session(&app_handle, app_state).await;
        app_handle.exit(0);
      });
    }
  });
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
  let open = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&open, &quit])?;

  let mut tray = TrayIconBuilder::with_id("main")
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| match event.id().as_ref() {
      "open" => {
        show_main_window(app);
      }
      "quit" => {
        let app_state = app.state::<Arc<state::AppState>>().inner().clone();
        if app_state.is_exiting.swap(true, Ordering::SeqCst) {
          return;
        }

        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
          let _ = session::restore_active_session(&app_handle, app_state).await;
          app_handle.exit(0);
        });
      }
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        show_main_window(tray.app_handle());
      }
    });

  if let Some(icon) = app.default_window_icon() {
    tray = tray.icon(icon.clone());
  }

  let _ = tray.build(app)?;

  Ok(())
}

fn show_main_window(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.set_focus();
    return;
  }

  if let Some((_, window)) = app.webview_windows().into_iter().next() {
    let _ = window.show();
    let _ = window.set_focus();
  }
}
