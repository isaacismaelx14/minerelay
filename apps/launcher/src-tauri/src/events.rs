use tauri::{AppHandle, Emitter};

use crate::types::{GameSessionStatus, SyncErrorEvent, SyncProgressEvent};

pub fn emit_sync_progress(app: &AppHandle, payload: &SyncProgressEvent) {
  let _ = app.emit("sync://progress", payload);
}

pub fn emit_sync_error(app: &AppHandle, payload: &SyncErrorEvent) {
  let _ = app.emit("sync://error", payload);
}

pub fn emit_session_status(app: &AppHandle, payload: &GameSessionStatus) {
  let _ = app.emit("session://status", payload);
}
