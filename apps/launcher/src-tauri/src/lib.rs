mod background_runtime;
mod commands;
mod config;
mod error;
mod events;
pub mod instance;
pub mod launcher_control;
pub mod launcher_apps;
pub mod notifications;
pub mod profile;
pub mod providers;
pub mod runtime;
pub mod session;
pub mod settings;
pub mod state;
pub mod sync;
pub mod telemetry;
pub mod types;
pub mod utils;

use std::{
  sync::{
    atomic::Ordering,
    Arc,
  },
};

#[cfg(target_os = "macos")]
use objc2::AllocAnyThread;
#[cfg(target_os = "macos")]
use objc2_app_kit::{NSApplication, NSImage, NSWindow, NSWindowTitleVisibility};
#[cfg(target_os = "macos")]
use objc2_foundation::{MainThreadMarker, NSData};
use tauri::{
  Emitter,
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  Manager,
};
use tauri_plugin_deep_link::DeepLinkExt;

use crate::types::AppSettings;

const REQUIRED_ONBOARDING_VERSION: i32 = 2;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let config = config::LauncherConfig::from_env();
  telemetry::init(&config.data_root);
  config.log_resolution_report();
  let state = Arc::new(state::AppState::new(config));

  let app = tauri::Builder::default()
    .on_menu_event(|app, event| {
      // Route native app-menu quit actions through the same confirmation flow.
      if event.id().as_ref() == "quit" {
        request_quit_via_frontend(app);
      }
    })
    .manage(state)
    .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
      let app_state = app.state::<Arc<state::AppState>>().inner().clone();
      for arg in &args {
        ingest_pairing_link_and_notify(app, &app_state, arg.as_str());
      }
      show_primary_window(app);
    }))
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(|app| {
      #[cfg(any(target_os = "windows", target_os = "linux"))]
      app.deep_link()
        .register("minerelay")
        .map_err(|error| anyhow::anyhow!("failed to register deep link: {error}"))?;

      let app_state = app.state::<Arc<state::AppState>>().inner().clone();
      let app_handle = app.handle().clone();
      app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
          ingest_pairing_link_and_notify(
            &app_handle,
            &app_state,
            url.as_str(),
          );
        }
      });

      build_tray(app)?;

      #[cfg(target_os = "macos")]
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title_bar_style(tauri::TitleBarStyle::Transparent);
        apply_macos_transparent_titlebar(&window);
      }

      show_primary_window(app.handle());

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::app_performance_profile,
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
      commands::launcher_server_controls_get,
      commands::launcher_server_action,
      commands::launcher_server_stream_start,
      commands::launcher_server_stream_stop,
      commands::launcher_pairing_apply_link,
      commands::launcher_update_check,
      commands::launcher_update_install,
      commands::app_request_close,
      commands::app_keep_running_in_background,
      commands::app_open_setup_window,
      commands::app_return_to_main_window,
      commands::app_log_client_exception,
      commands::app_open_devtools_secret,
      commands::game_running_probe,
    ])
    .build(tauri::generate_context!())
    .expect("error while building MineRelay application");

  app.run(|app_handle, event| {
    #[cfg(target_os = "macos")]
    if matches!(event, tauri::RunEvent::Ready) {
      apply_macos_app_icon();
    }

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

fn ingest_pairing_link_and_notify(
  app: &tauri::AppHandle,
  state: &Arc<state::AppState>,
  raw_url: &str,
) {
  let Ok(handled) = crate::launcher_control::ingest_pairing_link(
    state.as_ref(),
    raw_url,
  ) else {
    return;
  };

  if !handled {
    return;
  }

  let settings = state.settings.lock().clone();
  let _ = app.emit("settings://updated", &settings);

  let payload = crate::launcher_control::pairing_link_applied_event(
    state.as_ref(),
    raw_url,
  );
  let _ = app.emit(crate::launcher_control::EVENT_PAIRING_LINK_APPLIED, payload);
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

#[cfg(target_os = "macos")]
fn apply_macos_app_icon() {
  let mtm = unsafe { MainThreadMarker::new_unchecked() };
  let app = NSApplication::sharedApplication(mtm);
  let data = NSData::with_bytes(include_bytes!("../icons/icon.png"));
  let Some(app_icon) = NSImage::initWithData(NSImage::alloc(), &data) else {
    return;
  };
  unsafe {
    app.setApplicationIconImage(Some(&app_icon));
  }
}

#[cfg(target_os = "macos")]
fn minerelay_tray_icon() -> Option<tauri::image::Image<'static>> {
  tauri::image::Image::from_bytes(include_bytes!("../icons/tray-icon.png")).ok()
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
        request_quit_via_frontend(app);
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

  #[cfg(target_os = "macos")]
  if let Some(icon) = minerelay_tray_icon() {
    tray = tray.icon(icon).icon_as_template(true);
  } else if let Some(icon) = app.default_window_icon() {
    tray = tray.icon(icon.clone());
  }

  #[cfg(not(target_os = "macos"))]
  if let Some(icon) = app.default_window_icon() {
    tray = tray.icon(icon.clone());
  }

  let _ = tray.build(app)?;

  Ok(())
}

fn show_primary_window(app: &tauri::AppHandle) {
  let app_state = app.state::<Arc<state::AppState>>();
  background_runtime::on_ui_started(app_state.as_ref());
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

fn request_quit_via_frontend(app: &tauri::AppHandle) {
  show_primary_window(app);
  events::emit_quit_requested(app);
}

fn handle_quit_request(app: &tauri::AppHandle, app_state: Arc<state::AppState>) {
  if app_state.is_exiting.load(Ordering::SeqCst) {
    return;
  }

  request_quit_via_frontend(app);
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
