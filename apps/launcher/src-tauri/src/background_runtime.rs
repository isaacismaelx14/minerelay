use std::{
  path::Path,
  sync::Arc,
  time::{Duration, Instant},
};

use crate::{
  session,
  state::AppState,
  telemetry,
  types::GameSessionPhase,
};
use tauri::AppHandle;

const HOURLY_INTERVAL: Duration = Duration::from_secs(60 * 60);
const WATCH_INTERVAL: Duration = Duration::from_secs(5);
const WATCH_RESTORE_GRACE: Duration = Duration::from_secs(10);
const WATCH_SESSION_TIMEOUT: Duration = Duration::from_secs(5 * 60);

pub fn on_ui_started(state: &AppState) {
  state.ui_open.store(true, std::sync::atomic::Ordering::SeqCst);
  lifecycle_log("UI_STARTED", None);
  stop_hourly_worker(state);
  stop_process_watcher(state);
}

pub fn on_ui_closed(app: &AppHandle, state: Arc<AppState>) {
  state.ui_open.store(false, std::sync::atomic::Ordering::SeqCst);
  lifecycle_log("UI_CLOSED", None);
  lifecycle_log("BACKGROUND_MODE_ACTIVE", None);

  let status = session::get_status(state.as_ref());
  let active_session = matches!(
    status.phase,
    GameSessionPhase::AwaitingGameStart | GameSessionPhase::Playing
  );

  if active_session {
    start_process_watcher(app, state);
  } else {
    stop_process_watcher(state.as_ref());
    start_hourly_worker(app, state);
  }
}

pub fn shutdown(state: &AppState) {
  stop_hourly_worker(state);
  stop_process_watcher(state);
}

fn start_hourly_worker(app: &AppHandle, state: Arc<AppState>) {
  {
    let mut slot = state.hourly_mod_update_worker.lock();
    if let Some(task) = slot.take() {
      task.abort();
    }
  }

  lifecycle_log("START_HOURLY_WORKER", Some("HourlyModUpdateWorker"));

  let app_handle = app.clone();
  let task_state = Arc::clone(&state);
  let task = tauri::async_runtime::spawn(async move {
    loop {
      tokio::time::sleep(HOURLY_INTERVAL).await;

      if task_state.ui_open.load(std::sync::atomic::Ordering::SeqCst) {
        break;
      }

      if session::get_status(task_state.as_ref()).is_active() {
        continue;
      }

      let server_id = task_state.config.server_id.clone();

      let updates = crate::sync::check_updates(task_state.as_ref(), &server_id).await;
      let Ok(updates) = updates else {
        continue;
      };

      if !updates.has_updates {
        continue;
      }

      let _ = crate::sync::sync_apply(&app_handle, task_state.as_ref(), &server_id).await;
    }

    lifecycle_log("STOP_HOURLY_WORKER", Some("HourlyModUpdateWorker"));
  });

  *state.hourly_mod_update_worker.lock() = Some(task);
}

fn stop_hourly_worker(state: &AppState) {
  if let Some(task) = state.hourly_mod_update_worker.lock().take() {
    task.abort();
    lifecycle_log("STOP_HOURLY_WORKER", Some("HourlyModUpdateWorker"));
  }
}

fn start_process_watcher(app: &AppHandle, state: Arc<AppState>) {
  stop_hourly_worker(state.as_ref());

  {
    let mut slot = state.minecraft_process_watcher.lock();
    if let Some(task) = slot.take() {
      task.abort();
    }
  }

  let initial = session::get_status(state.as_ref());
  let Some(session_id) = initial.session_id.clone() else {
    start_hourly_worker(app, state);
    return;
  };
  let Some(live_minecraft_dir) = initial.live_minecraft_dir.clone() else {
    start_hourly_worker(app, state);
    return;
  };
  let Some(launcher_id) = initial.launcher_id.clone() else {
    start_hourly_worker(app, state);
    return;
  };

  lifecycle_log("START_PROCESS_WATCHER", Some("MinecraftProcessWatcher"));

  let app_handle = app.clone();
  let task_state = Arc::clone(&state);
  let task = tauri::async_runtime::spawn(async move {
    let started = Instant::now();
    let mut seen_running = false;
    let mut missing_since: Option<Instant> = None;

    loop {
      if task_state.ui_open.load(std::sync::atomic::Ordering::SeqCst) {
        break;
      }

      let current = session::get_status(task_state.as_ref());
      if current.session_id.as_deref() != Some(session_id.as_str()) {
        break;
      }

      let running = session::probe_game_running(Path::new(&live_minecraft_dir), &launcher_id);

      if running {
        seen_running = true;
        missing_since = None;
      } else if seen_running {
        let since = missing_since.get_or_insert_with(Instant::now);
        if since.elapsed() >= WATCH_RESTORE_GRACE {
          run_post_game_cleanup(&app_handle, Arc::clone(&task_state)).await;
          start_hourly_worker(&app_handle, Arc::clone(&task_state));
          break;
        }
      } else if started.elapsed() >= WATCH_SESSION_TIMEOUT {
        run_post_game_cleanup(&app_handle, Arc::clone(&task_state)).await;
        start_hourly_worker(&app_handle, Arc::clone(&task_state));
        break;
      }

      tokio::time::sleep(WATCH_INTERVAL).await;
    }

    if !task_state.ui_open.load(std::sync::atomic::Ordering::SeqCst)
      && !session::get_status(task_state.as_ref()).is_active()
    {
      start_hourly_worker(&app_handle, Arc::clone(&task_state));
    }

    lifecycle_log("STOP_PROCESS_WATCHER", Some("MinecraftProcessWatcher"));
  });

  *state.minecraft_process_watcher.lock() = Some(task);
}

fn stop_process_watcher(state: &AppState) {
  if let Some(task) = state.minecraft_process_watcher.lock().take() {
    task.abort();
    lifecycle_log("STOP_PROCESS_WATCHER", Some("MinecraftProcessWatcher"));
  }
}

async fn run_post_game_cleanup(app: &AppHandle, state: Arc<AppState>) {
  lifecycle_log("POST_GAME_CLEANUP_START", Some("PostGameCleanup"));
  let _ = session::restore_active_session(app, state).await;
  lifecycle_log("POST_GAME_CLEANUP_DONE", Some("PostGameCleanup"));
}

fn lifecycle_log(stage: &str, worker: Option<&str>) {
  let details = worker
    .map(|name| format!("{{\"worker\":\"{name}\"}}"))
    .unwrap_or_else(|| "{}".to_string());
  telemetry::record_structured_event("lifecycle", stage, Some(details.as_str()));
}
