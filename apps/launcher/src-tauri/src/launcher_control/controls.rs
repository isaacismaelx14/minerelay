use std::sync::Arc;

use futures_util::StreamExt;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::time::{sleep, Duration};

use crate::{
  state::AppState,
  types::{LauncherServerControlsState, LauncherServerPermissions, LauncherServerStatus},
};

use super::auth::{api_mode_base, clear_auth, signed_request};

const EVENT_STATUS: &str = "launcher-server://status";
const EVENT_ERROR: &str = "launcher-server://error";

// ── Response / request types ───────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StatusResponse {
  selected_server: LauncherServerStatus,
  permissions: LauncherServerPermissions,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ActionRequest<'a> {
  action: &'a str,
}

// ── Public API ─────────────────────────────────────────────────────────────────

pub async fn fetch_controls_status(state: &AppState) -> Result<LauncherServerControlsState, String> {
  let Some(api_base) = api_mode_base(state)? else {
    clear_auth(state);
    return Ok(disabled_state(
      "Server control is disabled when Direct Lock URL mode is active.",
    ));
  };

  let response = signed_request(state, &api_base, Method::GET, "/v1/launcher/server/status", None).await?;

  if !response.status().is_success() {
    let body = response.text().await.unwrap_or_else(|_| "Request failed".to_string());
    return Err(body);
  }

  let payload = response
    .json::<StatusResponse>()
    .await
    .map_err(|error| format!("Invalid launcher status payload: {error}"))?;

  Ok(LauncherServerControlsState {
    enabled: true,
    reason: None,
    permissions: payload.permissions,
    selected_server: Some(payload.selected_server),
  })
}

pub async fn perform_action(state: &AppState, action: &str) -> Result<LauncherServerControlsState, String> {
  let Some(api_base) = api_mode_base(state)? else {
    clear_auth(state);
    return Ok(disabled_state(
      "Server control is disabled when Direct Lock URL mode is active.",
    ));
  };

  let body = serde_json::to_value(ActionRequest { action })
    .map_err(|error| format!("Failed to serialize launcher action: {error}"))?;

  let response =
    signed_request(state, &api_base, Method::POST, "/v1/launcher/server/action", Some(body)).await?;

  if !response.status().is_success() {
    let text = response
      .text()
      .await
      .unwrap_or_else(|_| format!("Failed to {action} server"));
    return Err(text);
  }

  let payload = response
    .json::<StatusResponse>()
    .await
    .map_err(|error| format!("Invalid launcher action payload: {error}"))?;

  Ok(LauncherServerControlsState {
    enabled: true,
    reason: None,
    permissions: payload.permissions,
    selected_server: Some(payload.selected_server),
  })
}

// ── SSE stream ─────────────────────────────────────────────────────────────────

pub fn stop_stream(state: &AppState) {
  if let Some(handle) = state.launcher_server_stream.lock().take() {
    handle.abort();
  }
}

pub async fn start_stream(app: AppHandle, state: Arc<AppState>) -> Result<(), String> {
  stop_stream(state.as_ref());

  let Some(api_base) = api_mode_base(state.as_ref())? else {
    clear_auth(state.as_ref());
    return Ok(());
  };

  let app_handle = app.clone();
  let state_clone = Arc::clone(&state);
  let stream_handle = tokio::spawn(async move {
    loop {
      let stream_response = signed_request(
        state_clone.as_ref(),
        &api_base,
        Method::GET,
        "/v1/launcher/server/stream",
        None,
      )
      .await;

      let Ok(response) = stream_response else {
        let _ = app_handle.emit(EVENT_ERROR, "Could not connect to launcher server stream");
        sleep(Duration::from_secs(4)).await;
        continue;
      };

      if !response.status().is_success() {
        let text = response
          .text()
          .await
          .unwrap_or_else(|_| "Launcher stream failed".to_string());
        let _ = app_handle.emit(EVENT_ERROR, text);
        sleep(Duration::from_secs(4)).await;
        continue;
      }

      let mut stream = response.bytes_stream();
      let mut buffer = String::new();
      let mut current_event = String::new();
      let mut current_data = String::new();

      while let Some(chunk) = stream.next().await {
        let Ok(chunk) = chunk else {
          break;
        };

        let next = String::from_utf8_lossy(&chunk);
        buffer.push_str(next.as_ref());

        while let Some(newline_index) = buffer.find('\n') {
          let mut line = buffer[..newline_index].to_string();
          if line.ends_with('\r') {
            line.pop();
          }
          buffer = buffer[newline_index + 1..].to_string();

          if line.is_empty() {
            if current_event == "status" {
              if let Ok(value) = serde_json::from_str::<Value>(&current_data) {
                if let Some(server) = value.get("selectedServer") {
                  if let Ok(status) =
                    serde_json::from_value::<LauncherServerStatus>(server.clone())
                  {
                    let _ = app_handle.emit(EVENT_STATUS, status);
                  }
                }
              }
            } else if current_event == "stream-error" {
              if let Ok(value) = serde_json::from_str::<Value>(&current_data) {
                let message = value
                  .get("message")
                  .and_then(|entry| entry.as_str())
                  .unwrap_or("Launcher stream error")
                  .to_string();
                let _ = app_handle.emit(EVENT_ERROR, message);
              }
            }

            current_event.clear();
            current_data.clear();
            continue;
          }

          if let Some(rest) = line.strip_prefix("event:") {
            current_event = rest.trim().to_string();
            continue;
          }

          if let Some(rest) = line.strip_prefix("data:") {
            if !current_data.is_empty() {
              current_data.push('\n');
            }
            current_data.push_str(rest.trim());
          }
        }
      }

      sleep(Duration::from_secs(2)).await;
    }
  });

  *state.launcher_server_stream.lock() = Some(stream_handle);
  Ok(())
}

// ── Helpers ────────────────────────────────────────────────────────────────────

fn disabled_state(reason: &str) -> LauncherServerControlsState {
  LauncherServerControlsState {
    enabled: false,
    reason: Some(reason.to_string()),
    permissions: LauncherServerPermissions {
      can_view_status: false,
      can_view_online_players: false,
      can_start_server: false,
      can_stop_server: false,
      can_restart_server: false,
    },
    selected_server: None,
  }
}
