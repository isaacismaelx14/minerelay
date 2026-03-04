use std::{
  sync::Arc,
  time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use futures_util::StreamExt;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::time::{sleep, Duration};
use uuid::Uuid;

use crate::{
  state::{AppState, LauncherAuthState},
  types::{
    LauncherServerControlsState, LauncherServerPermissions, LauncherServerStatus,
  },
};

const AUTH_INPUT: &str = "launcher-auth-v1";
const REQUEST_INPUT: &str = "launcher-request-v1";
const EVENT_STATUS: &str = "launcher-server://status";
const EVENT_ERROR: &str = "launcher-server://error";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChallengeResponse {
  challenge_id: String,
  nonce: String,
  issued_at: String,
  expires_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionRequest {
  challenge_id: String,
  client_public_key: String,
  signature: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionResponse {
  access_token: String,
  token_id: String,
}

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

pub async fn fetch_controls_status(state: &AppState) -> Result<LauncherServerControlsState, String> {
  let Some(api_base) = api_mode_base(state) else {
    clear_auth(state);
    return Ok(disabled_state(
      "Server control is disabled when Direct Lock URL mode is active.",
    ));
  };

  let response = signed_request(
    state,
    &api_base,
    Method::GET,
    "/v1/launcher/server/status",
    None,
  )
  .await?;

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

pub async fn perform_action(
  state: &AppState,
  action: &str,
) -> Result<LauncherServerControlsState, String> {
  let Some(api_base) = api_mode_base(state) else {
    clear_auth(state);
    return Ok(disabled_state(
      "Server control is disabled when Direct Lock URL mode is active.",
    ));
  };

  let body = serde_json::to_value(ActionRequest { action })
    .map_err(|error| format!("Failed to serialize launcher action: {error}"))?;

  let response = signed_request(
    state,
    &api_base,
    Method::POST,
    "/v1/launcher/server/action",
    Some(body),
  )
  .await?;

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

pub fn stop_stream(state: &AppState) {
  if let Some(handle) = state.launcher_server_stream.lock().take() {
    handle.abort();
  }
}

pub async fn start_stream(app: AppHandle, state: Arc<AppState>) -> Result<(), String> {
  stop_stream(state.as_ref());

  let Some(api_base) = api_mode_base(state.as_ref()) else {
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
        let _ = app_handle.emit(
          EVENT_ERROR,
          "Could not connect to launcher server stream",
        );
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
                  if let Ok(status) = serde_json::from_value::<LauncherServerStatus>(server.clone()) {
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

fn clear_auth(state: &AppState) {
  *state.launcher_auth.lock() = None;
}

fn api_mode_base(state: &AppState) -> Option<String> {
  let settings = state.settings.lock().clone();
  if settings.profile_lock_url.is_some() {
    return None;
  }

  settings
    .api_base_url
    .map(|value| value.trim().trim_end_matches('/').to_string())
    .filter(|value| !value.is_empty())
}

async fn signed_request(
  state: &AppState,
  api_base: &str,
  method: Method,
  path: &str,
  body: Option<Value>,
) -> Result<reqwest::Response, String> {
  let auth = ensure_auth(state, api_base).await?;
  let (timestamp, nonce, signature) = sign_request(&auth, &method, path, body.clone())?;

  let mut request = state
    .http
    .request(method.clone(), format!("{api_base}{path}"))
    .header("Authorization", format!("Bearer {}", auth.access_token))
    .header("x-mvl-timestamp", timestamp.to_string())
    .header("x-mvl-nonce", nonce)
    .header("x-mvl-signature", signature);

  if let Some(ref json_body) = body {
    request = request.json(json_body);
  }

  let response = request
    .send()
    .await
    .map_err(|error| format!("Network request failed: {error}"))?;

  if response.status() == reqwest::StatusCode::UNAUTHORIZED {
    clear_auth(state);
    let refreshed = ensure_auth(state, api_base).await?;
    let (retry_timestamp, retry_nonce, retry_signature) =
      sign_request(&refreshed, &method, path, body.clone())?;

    let mut retry_request = state
      .http
      .request(method, format!("{api_base}{path}"))
      .header("Authorization", format!("Bearer {}", refreshed.access_token))
      .header("x-mvl-timestamp", retry_timestamp.to_string())
      .header("x-mvl-nonce", retry_nonce)
      .header("x-mvl-signature", retry_signature);

    if let Some(ref json_body) = body {
      retry_request = retry_request.json(json_body);
    }

    return retry_request
      .send()
      .await
      .map_err(|error| format!("Network retry failed: {error}"));
  }

  Ok(response)
}

async fn ensure_auth(state: &AppState, api_base: &str) -> Result<LauncherAuthState, String> {
  if let Some(existing) = state.launcher_auth.lock().clone() {
    if existing.api_base == api_base {
      return Ok(existing);
    }
  }

  let challenge = state
    .http
    .post(format!("{api_base}/v1/launcher/auth/challenge"))
    .send()
    .await
    .map_err(|error| format!("Launcher challenge request failed: {error}"))?
    .json::<ChallengeResponse>()
    .await
    .map_err(|error| format!("Invalid launcher challenge payload: {error}"))?;

  let signing_secret: [u8; 32] = rand::random();
  let signing_key = SigningKey::from_bytes(&signing_secret);
  let verifying_key = VerifyingKey::from(&signing_key);

  let signed_payload = stable_stringify(serde_json::json!({
    "signatureInput": AUTH_INPUT,
    "payload": {
      "challengeId": challenge.challenge_id,
      "nonce": challenge.nonce,
      "issuedAt": challenge.issued_at,
      "expiresAt": challenge.expires_at
    }
  }));

  let signature = signing_key.sign(signed_payload.as_bytes());
  let signature_b64 = STANDARD.encode(signature.to_bytes());
  let public_key_b64 = STANDARD.encode(verifying_key.to_bytes());

  let session_payload = SessionRequest {
    challenge_id: challenge.challenge_id,
    client_public_key: public_key_b64,
    signature: signature_b64,
  };

  let session = state
    .http
    .post(format!("{api_base}/v1/launcher/auth/session"))
    .json(&session_payload)
    .send()
    .await
    .map_err(|error| format!("Launcher session request failed: {error}"))?
    .json::<SessionResponse>()
    .await
    .map_err(|error| format!("Invalid launcher session payload: {error}"))?;

  let auth = LauncherAuthState {
    api_base: api_base.to_string(),
    access_token: session.access_token,
    token_id: session.token_id,
    signing_secret: signing_key.to_bytes(),
  };

  *state.launcher_auth.lock() = Some(auth.clone());
  Ok(auth)
}

fn sign_request(
  auth: &LauncherAuthState,
  method: &Method,
  path: &str,
  body: Option<Value>,
) -> Result<(i64, String, String), String> {
  let timestamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|error| format!("System clock error: {error}"))?
    .as_millis() as i64;

  let nonce = Uuid::new_v4().to_string();
  let signing_key = SigningKey::from_bytes(&auth.signing_secret);

  let canonical_body = body.unwrap_or_else(|| serde_json::json!({}));
  let payload = serde_json::json!({
    "signatureInput": REQUEST_INPUT,
    "payload": {
      "tokenId": auth.token_id,
      "method": method.as_str().to_uppercase(),
      "path": path,
      "timestamp": timestamp,
      "nonce": nonce,
      "body": canonical_body
    }
  });

  let message = stable_stringify(payload);
  let signature: Signature = signing_key.sign(message.as_bytes());
  let signature_b64 = STANDARD.encode(signature.to_bytes());

  Ok((timestamp, nonce, signature_b64))
}

fn stable_stringify(value: Value) -> String {
  serde_json::to_string(&normalize_json(value)).unwrap_or_else(|_| "{}".to_string())
}

fn normalize_json(value: Value) -> Value {
  match value {
    Value::Array(values) => Value::Array(values.into_iter().map(normalize_json).collect()),
    Value::Object(values) => {
      let mut entries = values.into_iter().collect::<Vec<(String, Value)>>();
      entries.sort_by(|left, right| left.0.cmp(&right.0));
      let mut ordered = serde_json::Map::new();
      for (key, entry) in entries {
        ordered.insert(key, normalize_json(entry));
      }
      Value::Object(ordered)
    }
    other => other,
  }
}
