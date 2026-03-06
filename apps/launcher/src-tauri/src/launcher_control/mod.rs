use std::{
  fs,
  path::PathBuf,
  sync::Arc,
  time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use futures_util::StreamExt;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::Digest;
use tauri::{AppHandle, Emitter};
use tokio::time::{sleep, Duration};
use url::Url;
use uuid::Uuid;

use crate::{
  providers::validate_service_url,
  settings,
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
  installation_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct EnrollRequest {
  challenge_id: String,
  client_public_key: String,
  signature: String,
  installation_id: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  install_code: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pairing_token: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pairing_code: Option<String>,
  device_fingerprint: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  app_version: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  platform: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionResponse {
  access_token: String,
  token_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EnrollResponse {
  trusted: bool,
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
  let Some(api_base) = api_mode_base(state)? else {
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
  let Some(api_base) = api_mode_base(state)? else {
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

fn api_mode_base(state: &AppState) -> Result<Option<String>, String> {
  let settings = state.settings.lock().clone();
  if settings.profile_lock_url.is_some() {
    return Ok(None);
  }

  let api_base = settings
    .api_base_url
    .map(|value| value.trim().trim_end_matches('/').to_string())
    .filter(|value| !value.is_empty());

  let Some(api_base) = api_base else {
    return Ok(None);
  };

  if let Some(reason) = blocked_host_reason(state, &api_base) {
    return Err(reason);
  }

  Ok(Some(api_base))
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

  let signing_key = load_or_create_device_signing_key(state)?;
  let installation_id = load_or_create_installation_id(state)?;
  let verifying_key = VerifyingKey::from(&signing_key);
  let public_key_b64 = STANDARD.encode(verifying_key.to_bytes());

  let enroll_challenge = request_challenge(state, api_base).await?;
  let enroll_signature_b64 = sign_challenge_payload(&signing_key, &enroll_challenge);
  let pairing_token = load_pending_pairing_token(state);
  let pairing_code = state
    .settings
    .lock()
    .pairing_code
    .clone()
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty());
  let install_code = state
    .config
    .launcher_install_code
    .as_ref()
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty());

  let enroll_payload = EnrollRequest {
    challenge_id: enroll_challenge.challenge_id,
    client_public_key: public_key_b64.clone(),
    signature: enroll_signature_b64,
    installation_id: installation_id.clone(),
    install_code,
    pairing_token,
    pairing_code,
    device_fingerprint: build_device_fingerprint()?,
    app_version: Some(env!("CARGO_PKG_VERSION").to_string()),
    platform: Some(std::env::consts::OS.to_string()),
  };

  let enroll = state
    .http
    .post(format!("{api_base}/v1/launcher/auth/enroll"))
    .json(&enroll_payload)
    .send()
    .await
    .map_err(|error| format!("Launcher enrollment request failed: {error}"))?;

  if !enroll.status().is_success() {
    let message = enroll
      .text()
      .await
      .unwrap_or_else(|_| "Launcher enrollment failed".to_string());
    return Err(message);
  }

  let enroll_data = enroll
    .json::<EnrollResponse>()
    .await
    .map_err(|error| format!("Invalid launcher enrollment payload: {error}"))?;

  if !enroll_data.trusted {
    return Err("Launcher enrollment rejected by server".to_string());
  }
  clear_pairing_materials(state)?;

  let challenge = request_challenge(state, api_base).await?;

  let signature_b64 = sign_challenge_payload(&signing_key, &challenge);

  let session_payload = SessionRequest {
    challenge_id: challenge.challenge_id,
    client_public_key: public_key_b64,
    signature: signature_b64,
    installation_id,
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

async fn request_challenge(state: &AppState, api_base: &str) -> Result<ChallengeResponse, String> {
  state
    .http
    .post(format!("{api_base}/v1/launcher/auth/challenge"))
    .send()
    .await
    .map_err(|error| format!("Launcher challenge request failed: {error}"))?
    .json::<ChallengeResponse>()
    .await
    .map_err(|error| format!("Invalid launcher challenge payload: {error}"))
}

fn sign_challenge_payload(signing_key: &SigningKey, challenge: &ChallengeResponse) -> String {
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
  STANDARD.encode(signature.to_bytes())
}

fn load_or_create_device_signing_key(state: &AppState) -> Result<SigningKey, String> {
  let path = launcher_device_key_path(state);
  if let Ok(existing) = fs::read(&path) {
    let key_bytes: [u8; 32] = existing
      .as_slice()
      .try_into()
      .map_err(|_| "Invalid launcher device key length".to_string())?;
    return Ok(SigningKey::from_bytes(&key_bytes));
  }

  let secret: [u8; 32] = rand::random();
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)
      .map_err(|error| format!("Failed to prepare launcher key directory: {error}"))?;
  }
  fs::write(&path, secret)
    .map_err(|error| format!("Failed to persist launcher device key: {error}"))?;
  Ok(SigningKey::from_bytes(&secret))
}

fn launcher_device_key_path(state: &AppState) -> PathBuf {
  state.config.data_root.join("launcher-device.key")
}

fn load_or_create_installation_id(state: &AppState) -> Result<String, String> {
  let path = launcher_installation_id_path(state);
  if let Ok(existing) = fs::read_to_string(&path) {
    let value = existing.trim();
    if !value.is_empty() {
      return Ok(value.to_string());
    }
  }

  let installation_id = Uuid::new_v4().to_string();
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)
      .map_err(|error| format!("Failed to prepare installation id directory: {error}"))?;
  }
  fs::write(&path, installation_id.as_bytes())
    .map_err(|error| format!("Failed to persist installation id: {error}"))?;
  Ok(installation_id)
}

fn launcher_installation_id_path(state: &AppState) -> PathBuf {
  state.config.data_root.join("launcher-installation.id")
}

pub fn ingest_pairing_link(state: &AppState, raw_url: &str) -> Result<bool, String> {
  let parsed = Url::parse(raw_url.trim()).map_err(|error| format!("Invalid pairing link: {error}"))?;
  if parsed.scheme() != "minerelay" {
    return Ok(false);
  }

  let host = parsed.host_str().unwrap_or_default();
  if !host.eq_ignore_ascii_case("pair") {
    return Ok(false);
  }

  let token = parsed
    .query_pairs()
    .find_map(|(key, value)| (key == "token").then(|| value.to_string()))
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
    .ok_or_else(|| "Pairing link is missing token".to_string())?;

  let api = parsed
    .query_pairs()
    .find_map(|(key, value)| (key == "api").then(|| value.to_string()))
    .map(|value| value.trim().trim_end_matches('/').to_string())
    .filter(|value| !value.is_empty());

  if let Some(ref api_base) = api {
    validate_service_url(api_base).map_err(|error| format!("{error}"))?;
  }

  save_pending_pairing_token(state, &token)?;

  if let Some(api_base) = api {
    let mut settings_state = state.settings.lock();
    settings_state.api_base_url = Some(api_base);
    settings::save(&state.config.settings_path(), &settings_state)
      .map_err(|error| format!("Failed to persist pairing api base: {error}"))?;
  }

  Ok(true)
}

fn blocked_host_reason(state: &AppState, api_base: &str) -> Option<String> {
  let allowlist = state.config.server_control_trusted_hosts.as_ref()?;
  let parsed_api = Url::parse(api_base).ok()?;
  let Some(host) = parsed_api.host_str() else {
    return Some("Server control is disabled because API host is invalid.".to_string());
  };

  let allowed = allowlist
    .split(',')
    .map(|entry| entry.trim().to_ascii_lowercase())
    .filter(|entry| !entry.is_empty())
    .collect::<Vec<_>>();

  if allowed.is_empty() {
    return None;
  }

  let host_lower = host.to_ascii_lowercase();
  if allowed.iter().any(|entry| entry == &host_lower) {
    return None;
  }

  Some("Server control is disabled for untrusted API host.".to_string())
}

fn pairing_token_path(state: &AppState) -> PathBuf {
  state.config.data_root.join("launcher-pairing-token")
}

fn load_pending_pairing_token(state: &AppState) -> Option<String> {
  fs::read_to_string(pairing_token_path(state))
    .ok()
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
}

fn save_pending_pairing_token(state: &AppState, token: &str) -> Result<(), String> {
  let path = pairing_token_path(state);
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)
      .map_err(|error| format!("Failed to create pairing token directory: {error}"))?;
  }

  fs::write(path, token.as_bytes())
    .map_err(|error| format!("Failed to persist pairing token: {error}"))
}

fn clear_pairing_materials(state: &AppState) -> Result<(), String> {
  let _ = fs::remove_file(pairing_token_path(state));

  let mut settings_state = state.settings.lock();
  if settings_state.pairing_code.is_none() {
    return Ok(());
  }

  settings_state.pairing_code = None;
  settings::save(&state.config.settings_path(), &settings_state)
    .map_err(|error| format!("Failed to clear pairing code: {error}"))
}

fn build_device_fingerprint() -> Result<String, String> {
  let mut system = sysinfo::System::new();
  system.refresh_all();
  let host = sysinfo::System::host_name().unwrap_or_else(|| "unknown-host".to_string());
  let platform = std::env::consts::OS;
  let arch = std::env::consts::ARCH;

  let raw = format!("{host}|{platform}|{arch}");
  let digest = sha2::Sha256::digest(raw.as_bytes());
  Ok(hex::encode(digest))
}
