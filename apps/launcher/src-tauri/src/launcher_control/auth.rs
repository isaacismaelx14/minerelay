use std::time::{SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use url::Url;
use uuid::Uuid;

use crate::state::{AppState, LauncherAuthState};

use super::device::{build_device_fingerprint, load_or_create_device_signing_key, load_or_create_installation_id};
use super::pairing::{clear_pairing_materials, load_pending_pairing_token};

const AUTH_INPUT: &str = "launcher-auth-v1";
const REQUEST_INPUT: &str = "launcher-request-v1";

// ── API-mode guard ─────────────────────────────────────────────────────────────

pub(super) fn clear_auth(state: &AppState) {
  *state.launcher_auth.lock() = None;
}

pub(super) fn api_mode_base(state: &AppState) -> Result<Option<String>, String> {
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

// ── Signed HTTP request ────────────────────────────────────────────────────────

/// Builds a signed HTTP request with the three `x-mvl-*` auth headers and an
/// optional JSON body, avoiding duplicated setup between the initial request
/// and the 401-retry path.
fn build_signed_http_request(
  client: &reqwest::Client,
  method: Method,
  url: String,
  auth: &LauncherAuthState,
  timestamp: i64,
  nonce: String,
  signature: String,
  body: Option<&Value>,
) -> reqwest::RequestBuilder {
  let mut request = client
    .request(method, url)
    .header("Authorization", format!("Bearer {}", auth.access_token))
    .header("x-mvl-timestamp", timestamp.to_string())
    .header("x-mvl-nonce", nonce)
    .header("x-mvl-signature", signature);

  if let Some(json_body) = body {
    request = request.json(json_body);
  }

  request
}

pub(super) async fn signed_request(
  state: &AppState,
  api_base: &str,
  method: Method,
  path: &str,
  body: Option<Value>,
) -> Result<reqwest::Response, String> {
  let url = format!("{api_base}{path}");
  let auth = ensure_auth(state, api_base).await?;
  let (timestamp, nonce, signature) = sign_request(&auth, &method, path, body.clone())?;

  let response = build_signed_http_request(
    &state.http,
    method.clone(),
    url.clone(),
    &auth,
    timestamp,
    nonce,
    signature,
    body.as_ref(),
  )
  .send()
  .await
  .map_err(|error| format!("Network request failed: {error}"))?;

  if response.status() == reqwest::StatusCode::UNAUTHORIZED {
    clear_auth(state);
    let refreshed = ensure_auth(state, api_base).await?;
    let (retry_timestamp, retry_nonce, retry_signature) =
      sign_request(&refreshed, &method, path, body.clone())?;

    return build_signed_http_request(
      &state.http,
      method,
      url,
      &refreshed,
      retry_timestamp,
      retry_nonce,
      retry_signature,
      body.as_ref(),
    )
    .send()
    .await
    .map_err(|error| format!("Network retry failed: {error}"));
  }

  Ok(response)
}

// ── Authentication / enrollment ────────────────────────────────────────────────

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

// ── Request signing ────────────────────────────────────────────────────────────

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

// ── JSON canonicalization ──────────────────────────────────────────────────────

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
