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

#[cfg(target_os = "macos")]
use objc2_app_kit::{NSWindow, NSWindowTitleVisibility};
use rfd::{MessageButtons, MessageDialog, MessageDialogResult, MessageLevel};

use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  Manager,
};

use crate::types::{AppSettings, GameSessionPhase};

const REQUIRED_ONBOARDING_VERSION: i32 = 2;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  telemetry::init();

  let config = config::LauncherConfig::from_env();
  let state = Arc::new(state::AppState::new(config));

  let app = tauri::Builder::default()
    .manage(state)
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(|app| {
      build_tray(app)?;

      #[cfg(target_os = "macos")]
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title_bar_style(tauri::TitleBarStyle::Transparent);
        apply_macos_transparent_titlebar(&window);
      }

      show_primary_window(app.handle());

      let app_handle = app.handle().clone();
      let app_state = app.state::<Arc<state::AppState>>().inner().clone();
      tauri::async_runtime::spawn(async move {
        let _ = session::recover_on_startup(&app_handle, app_state).await;
      });

      Ok(())
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
      commands::launcher_update_check,
      commands::launcher_update_install,
      commands::app_request_close,
      commands::app_keep_running_in_background,
      commands::app_open_setup_window,
      commands::app_return_to_main_window,
      commands::game_running_probe,
    ])
    .build(tauri::generate_context!())
    .expect("error while building MSS+ Client application");

  app.run(|app_handle, event| {
    if let tauri::RunEvent::ExitRequested { api, .. } = event {
      let app_state = app_handle.state::<Arc<state::AppState>>().inner().clone();

      if app_state.allow_exit_once.swap(false, Ordering::SeqCst) {
        return;
      }

      api.prevent_exit();
      handle_quit_request(app_handle, app_state);
    }
  });
}

#[cfg(target_os = "macos")]
fn apply_macos_transparent_titlebar(window: &tauri::WebviewWindow) {
  let _ = window.with_webview(|webview| {
    // SAFETY: Tauri provides the native NSWindow pointer on macOS.
    unsafe {
      let ns_window: &NSWindow = &*webview.ns_window().cast();
      ns_window.setTitleVisibility(NSWindowTitleVisibility::Hidden);
      ns_window.setTitlebarAppearsTransparent(true);
      ns_window.setMovableByWindowBackground(false);
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
        show_primary_window(app);
      }
      "quit" => {
        app.exit(0);
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
        show_primary_window(tray.app_handle());
      }
    });

  if let Some(icon) = app.default_window_icon() {
    tray = tray.icon(icon.clone());
  }

  let _ = tray.build(app)?;

  Ok(())
}

fn show_primary_window(app: &tauri::AppHandle) {
  let app_state = app.state::<Arc<state::AppState>>();
  let settings = app_state.settings.lock().clone();
  let target = if onboarding_required(&settings) {
    "setup"
  } else {
    "main"
  };
  let hide = if target == "main" { "setup" } else { "main" };

  if let Some(window) = app.get_webview_window(hide) {
    let _ = window.hide();
  }

  if let Some(window) = app.get_webview_window(target) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    return;
  }

  if let Some((_, window)) = app.webview_windows().into_iter().next() {
    let _ = window.show();
    let _ = window.set_focus();
  }
}

fn handle_quit_request(app: &tauri::AppHandle, app_state: Arc<state::AppState>) {
  if app_state.is_exiting.load(Ordering::SeqCst) {
    return;
  }

  if session::get_status(&app_state).phase == GameSessionPhase::Playing {
    keep_running_in_background(app);
    let _ = MessageDialog::new()
      .set_level(MessageLevel::Warning)
      .set_title("Minecraft is currently playing")
      .set_description(
        "The app will keep running in the background while your play session is active.",
      )
      .set_buttons(MessageButtons::Ok)
      .show();
    return;
  }

  let result = MessageDialog::new()
    .set_level(MessageLevel::Info)
    .set_title("Quit MSS+ Client?")
    .set_description(
      "Select Yes to quit the app. Select No to keep it running in the background.",
    )
    .set_buttons(MessageButtons::YesNo)
    .show();

  if result == MessageDialogResult::Yes {
    if app_state.is_exiting.swap(true, Ordering::SeqCst) {
      return;
    }
    app_state.allow_exit_once.store(true, Ordering::SeqCst);

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
      let _ = session::restore_active_session(&app_handle, app_state).await;
      app_handle.exit(0);
    });
    return;
  }

  keep_running_in_background(app);
}

fn keep_running_in_background(app: &tauri::AppHandle) {
  if let Some(main) = app.get_webview_window("main") {
    let _ = main.hide();
  }
  if let Some(setup) = app.get_webview_window("setup") {
    let _ = setup.hide();
  }
}

fn onboarding_required(settings: &AppSettings) -> bool {
  !settings.wizard_completed
    || settings.onboarding_version != Some(REQUIRED_ONBOARDING_VERSION)
    || settings
      .api_base_url
      .as_deref()
      .map(|value| value.trim().is_empty())
      .unwrap_or(true)
}
