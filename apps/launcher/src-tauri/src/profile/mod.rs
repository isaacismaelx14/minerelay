use crate::{instance::{InstancePaths, ensure_layout, load_local_lock}, utils::*, types::CatalogSnapshot};
use base64::{engine::general_purpose, Engine as _};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::Serialize;
use serde_json::{Map, Value};
use url::Url;

use crate::{
  error::{LauncherError, LauncherResult},
  providers::validate_service_url,
  state::AppState,
  types::{ProfileLock, ProfileMetadataResponse},
};

const PROFILE_SIGNATURE_INPUT: &str = "profile-metadata-v1";
const LOCK_SIGNATURE_INPUT: &str = "lock-v1";
const SIGNATURE_ALGORITHM: &str = "ed25519";

#[derive(Debug, Clone, Default)]
struct LockSignatureHeaders {
  signature: Option<String>,
  algorithm: Option<String>,
  key_id: Option<String>,
  input: Option<String>,
  signed_at: Option<String>,
}

async fn fetch_lockfile(state: &AppState, lock_url: &str) -> LauncherResult<ProfileLock> {
  validate_service_url(lock_url)?;

  let response = state.http.get(lock_url).send().await?;
  if !response.status().is_success() {
    return Err(LauncherError::Network(
      response
        .text()
        .await
        .unwrap_or_else(|_| "Failed to fetch lockfile".to_string()),
    ));
  }

  let signature_headers = lock_signature_headers(&response);
  let lock = response
    .json::<ProfileLock>()
    .await
    .map_err(|error| LauncherError::InvalidData(format!("invalid lockfile format: {error}")))?;

  if lock.loader != "fabric" {
    return Err(LauncherError::InvalidData(format!(
      "unsupported loader '{}' for MVP; expected fabric",
      lock.loader
    )));
  }

  verify_lock_signature(state, lock_url, &lock, &signature_headers)?;
  Ok(lock)
}

pub async fn fetch_profile_metadata(
  state: &AppState,
  server_id: &str,
) -> LauncherResult<ProfileMetadataResponse> {
  let api_base = configured_api_base(state).ok_or_else(|| {
    LauncherError::Config(
      "Profile source is not configured. Set API Base URL or Profile Lock URL in Settings."
        .to_string(),
    )
  })?;
  validate_service_url(&api_base)?;

  let legacy_server_url = format!("{api_base}/v1/servers/{server_id}/profile");
  let direct_profile_url = format!("{api_base}/v1/profile");

  // Prefer server-scoped metadata so session restore/dashboard refreshes cannot
  // accidentally pull default profile metadata from /v1/profile.
  let preferred = state.http.get(&legacy_server_url).send().await?;
  if preferred.status().is_success() {
    let mut profile = preferred.json::<ProfileMetadataResponse>().await.map_err(|error| {
      LauncherError::InvalidData(format!(
        "invalid /v1/servers/:serverId/profile payload: {error}"
      ))
    })?;

    if profile.allowed_minecraft_versions.is_empty() {
      profile.allowed_minecraft_versions = vec![profile.minecraft_version.clone()];
    }

    verify_profile_signature(state, &legacy_server_url, &profile)?;
    return Ok(profile);
  }

  if preferred.status() != reqwest::StatusCode::NOT_FOUND {
    return Err(LauncherError::Network(
      preferred
        .text()
        .await
        .unwrap_or_else(|_| "Failed to fetch server profile metadata".to_string()),
    ));
  }

  let fallback = state.http.get(&direct_profile_url).send().await?;
  if !fallback.status().is_success() {
    return Err(LauncherError::Network(
      fallback
        .text()
        .await
        .unwrap_or_else(|_| "Failed to fetch profile metadata".to_string()),
    ));
  }

  let mut profile = fallback
    .json::<ProfileMetadataResponse>()
    .await
    .map_err(|error| LauncherError::InvalidData(format!("invalid /v1/profile payload: {error}")))?;

  if profile.allowed_minecraft_versions.is_empty() {
    profile.allowed_minecraft_versions = vec![profile.minecraft_version.clone()];
  }

  verify_profile_signature(state, &direct_profile_url, &profile)?;
  Ok(profile)
}

pub async fn fetch_remote_lock(state: &AppState, server_id: &str) -> LauncherResult<ProfileLock> {
  let cache_key = remote_lock_cache_key(state, server_id);
  let fetch_result = if let Some(lock_url) = configured_lock_url(state) {
    fetch_lockfile(state, &lock_url).await
  } else {
    match fetch_profile_metadata(state, server_id).await {
      Ok(profile) => {
        let normalized_lock_url = normalize_remote_lock_url(&profile.lock_url);
        fetch_lockfile(state, &normalized_lock_url).await
      }
      Err(error) => Err(error),
    }
  };

  match fetch_result {
    Ok(lock) => {
      state
        .remote_lock_cache
        .lock()
        .insert(cache_key.clone(), lock.clone());
      Ok(lock)
    }
    Err(error) => match &error {
      LauncherError::Network(_) => state
        .remote_lock_cache
        .lock()
        .get(&cache_key)
        .cloned()
        .ok_or(error),
      _ => Err(error),
    },
  }
}

fn verify_profile_signature(
  state: &AppState,
  request_url: &str,
  profile: &ProfileMetadataResponse,
) -> LauncherResult<()> {
  if !signature_required(request_url) {
    return Ok(());
  }

  let signature = profile
    .signature
    .as_deref()
    .ok_or_else(|| LauncherError::InvalidData("missing profile signature".to_string()))?;
  let signature_algorithm = profile
    .signature_algorithm
    .as_deref()
    .ok_or_else(|| LauncherError::InvalidData("missing profile signature algorithm".to_string()))?;
  let signature_input = profile
    .signature_input
    .as_deref()
    .ok_or_else(|| LauncherError::InvalidData("missing profile signature input".to_string()))?;
  let signature_key_id = profile
    .signature_key_id
    .as_deref()
    .ok_or_else(|| LauncherError::InvalidData("missing profile signature key id".to_string()))?;
  let signed_at = profile
    .signed_at
    .as_deref()
    .ok_or_else(|| LauncherError::InvalidData("missing profile signedAt".to_string()))?;

  if signature_key_id.trim().is_empty() {
    return Err(LauncherError::InvalidData(
      "invalid profile signature key id".to_string(),
    ));
  }

  let unsigned_payload = serde_json::json!({
    "profileId": profile.profile_id.clone(),
    "version": profile.version,
    "minecraftVersion": profile.minecraft_version.clone(),
    "loader": profile.loader.clone(),
    "loaderVersion": profile.loader_version.clone(),
    "lockUrl": profile.lock_url.clone(),
    "serverName": profile.server_name.clone(),
    "serverAddress": profile.server_address.clone(),
    "allowedMinecraftVersions": profile.allowed_minecraft_versions.clone(),
    "fancyMenuEnabled": profile.fancy_menu_enabled,
    "fancyMenu": profile.fancy_menu.clone()
  });

  verify_signature(
    state,
    signature,
    signature_algorithm,
    signature_input,
    PROFILE_SIGNATURE_INPUT,
    signed_at,
    &unsigned_payload,
  )
}

fn verify_lock_signature(
  state: &AppState,
  lock_url: &str,
  lock: &ProfileLock,
  headers: &LockSignatureHeaders,
) -> LauncherResult<()> {
  if !signature_required(lock_url) {
    return Ok(());
  }

  let signature = headers
    .signature
    .as_deref()
    .ok_or_else(|| LauncherError::InvalidData("missing lock signature header".to_string()))?;
  let signature_algorithm = headers.algorithm.as_deref().ok_or_else(|| {
    LauncherError::InvalidData("missing lock signature algorithm header".to_string())
  })?;
  let signature_input = headers
    .input
    .as_deref()
    .ok_or_else(|| LauncherError::InvalidData("missing lock signature input header".to_string()))?;
  let signature_key_id = headers
    .key_id
    .as_deref()
    .ok_or_else(|| LauncherError::InvalidData("missing lock signature key id header".to_string()))?;
  let signed_at = headers
    .signed_at
    .as_deref()
    .ok_or_else(|| LauncherError::InvalidData("missing lock signedAt header".to_string()))?;

  if signature_key_id.trim().is_empty() {
    return Err(LauncherError::InvalidData(
      "invalid lock signature key id header".to_string(),
    ));
  }

  verify_signature(
    state,
    signature,
    signature_algorithm,
    signature_input,
    LOCK_SIGNATURE_INPUT,
    signed_at,
    lock,
  )
}

fn verify_signature(
  state: &AppState,
  signature_base64: &str,
  signature_algorithm: &str,
  signature_input: &str,
  expected_input: &str,
  signed_at: &str,
  payload: &impl Serialize,
) -> LauncherResult<()> {
  if signature_algorithm != SIGNATURE_ALGORITHM {
    return Err(LauncherError::InvalidData(format!(
      "unsupported signature algorithm '{signature_algorithm}'",
    )));
  }

  if signature_input != expected_input {
    return Err(LauncherError::InvalidData(format!(
      "unexpected signature input '{signature_input}'",
    )));
  }

  let public_key_base64 = state
    .config
    .profile_signature_public_key
    .as_deref()
    .ok_or_else(|| {
      LauncherError::Config(
        "PROFILE_SIGNATURE_PUBLIC_KEY is required for non-localhost profile sync".to_string(),
      )
    })?;

  let key_bytes = general_purpose::STANDARD
    .decode(public_key_base64)
    .map_err(|_| LauncherError::Config("PROFILE_SIGNATURE_PUBLIC_KEY is not valid base64".to_string()))?;

  let verifying_key = VerifyingKey::from_bytes(
    key_bytes
      .as_slice()
      .try_into()
      .map_err(|_| LauncherError::Config("PROFILE_SIGNATURE_PUBLIC_KEY must decode to 32 bytes".to_string()))?,
  )
  .map_err(|error| LauncherError::Config(format!("invalid signature public key: {error}")))?;

  let signature_bytes = general_purpose::STANDARD
    .decode(signature_base64)
    .map_err(|_| LauncherError::InvalidData("signature is not valid base64".to_string()))?;
  let signature = Signature::from_slice(signature_bytes.as_slice())
    .map_err(|error| LauncherError::InvalidData(format!("invalid signature bytes: {error}")))?;

  let message = canonical_signed_message(signature_input, signed_at, payload)?;
  verifying_key
    .verify(message.as_slice(), &signature)
    .map_err(|_| LauncherError::InvalidData("signature verification failed".to_string()))
}

fn canonical_signed_message(
  signature_input: &str,
  signed_at: &str,
  payload: &impl Serialize,
) -> LauncherResult<Vec<u8>> {
  let raw_payload =
    serde_json::to_value(payload).map_err(|error| LauncherError::InvalidData(error.to_string()))?;
  let envelope = serde_json::json!({
    "signatureInput": signature_input,
    "payload": raw_payload,
    "signedAt": signed_at
  });

  let canonical = normalize_json(envelope);
  serde_json::to_vec(&canonical).map_err(|error| LauncherError::InvalidData(error.to_string()))
}

fn normalize_json(value: Value) -> Value {
  match value {
    Value::Array(values) => Value::Array(values.into_iter().map(normalize_json).collect()),
    Value::Object(values) => {
      let mut entries = values.into_iter().collect::<Vec<(String, Value)>>();
      entries.sort_by(|left, right| left.0.cmp(&right.0));
      let mut ordered = Map::new();
      for (key, entry) in entries {
        ordered.insert(key, normalize_json(entry));
      }
      Value::Object(ordered)
    }
    other => other,
  }
}

fn lock_signature_headers(response: &reqwest::Response) -> LockSignatureHeaders {
  let read = |name: &str| -> Option<String> {
    response
      .headers()
      .get(name)
      .and_then(|value| value.to_str().ok())
      .map(|value| value.trim().to_string())
      .filter(|value| !value.is_empty())
  };

  LockSignatureHeaders {
    signature: read("x-mvl-signature"),
    algorithm: read("x-mvl-signature-algorithm"),
    key_id: read("x-mvl-signature-key-id"),
    input: read("x-mvl-signature-input"),
    signed_at: read("x-mvl-signed-at"),
  }
}

fn remote_lock_cache_key(state: &AppState, server_id: &str) -> String {
  let source = configured_lock_url(state)
    .or_else(|| configured_api_base(state))
    .unwrap_or_default();
  format!("{server_id}|{source}")
}

fn configured_lock_url(state: &AppState) -> Option<String> {
  let from_settings = state.settings.lock().profile_lock_url.clone();
  normalize(from_settings).or_else(|| normalize(state.config.profile_lock_url.clone()))
}

fn configured_api_base(state: &AppState) -> Option<String> {
  let from_settings = state.settings.lock().api_base_url.clone();
  normalize_api_base(from_settings).or_else(|| normalize_api_base(state.config.api_base_url.clone()))
}

fn normalize(value: Option<String>) -> Option<String> {
  value.map(|raw| raw.trim().to_string()).filter(|raw| !raw.is_empty())
}

fn normalize_api_base(value: Option<String>) -> Option<String> {
  normalize(value).map(|raw| raw.trim_end_matches('/').to_string())
}

fn normalize_remote_lock_url(lock_url: &str) -> String {
  let Ok(mut parsed) = Url::parse(lock_url) else {
    return lock_url.to_string();
  };

  let host = parsed.host_str().unwrap_or_default();
  if parsed.scheme() == "http" && !is_loopback(host) {
    let _ = parsed.set_scheme("https");
    return parsed.to_string();
  }

  lock_url.to_string()
}

fn signature_required(url: &str) -> bool {
  let Ok(parsed) = Url::parse(url) else {
    return true;
  };

  !is_loopback(parsed.host_str().unwrap_or_default())
}

fn is_loopback(host: &str) -> bool {
  host.eq_ignore_ascii_case("localhost") || host == "127.0.0.1" || host == "::1"
}

pub async fn catalog_snapshot(state: &crate::state::AppState, server_id: &str) -> Result<crate::types::CatalogSnapshot, String> {

  let effective_server = effective_server_id(state, server_id);
  let settings = state.settings.lock().clone();
  let remote = crate::profile::fetch_remote_lock(state, &effective_server)
    .await
    .map_err(|e| format!("{e}"))?;
  let metadata = crate::profile::fetch_profile_metadata(state, &effective_server).await.ok();

  let paths = InstancePaths::new(
    &state.config,
    &effective_server,
    &settings.install_mode,
    settings.minecraft_root_override.as_deref(),
  )
  .map_err(|e| format!("{e}"))?;
  ensure_layout(&paths).map_err(|e| format!("{e}"))?;

  let local_version = load_local_lock(&paths)
    .map_err(|e| format!("{e}"))?
    .map(|lock| lock.version);

  let updates = crate::sync::check_updates(state, &effective_server)
    .await
    .map_err(|e| format!("{e}"))?;

  let allowed_minecraft_versions = allowed_versions(metadata.as_ref(), &remote.minecraft_version);
  let metadata_server_name = metadata
    .as_ref()
    .map(|value| value.server_name.trim().to_string())
    .filter(|value| !value.is_empty());
  let metadata_server_address = metadata
    .as_ref()
    .map(|value| value.server_address.trim().to_string())
    .filter(|value| !value.is_empty());
  let lock_server_name = remote.branding.server_name.trim().to_string();
  let lock_server_address = remote.default_server.address.trim().to_string();

  let server_name = metadata_server_name
    .or_else(|| (!lock_server_name.is_empty()).then_some(lock_server_name))
    .unwrap_or_else(|| "Managed Server".to_string());
  let server_address = metadata_server_address
    .or_else(|| (!lock_server_address.is_empty()).then_some(lock_server_address))
    .unwrap_or_else(|| "--".to_string());
  let fancy_menu_enabled = metadata
    .as_ref()
    .map(|value| value.fancy_menu_enabled)
    .unwrap_or(remote.fancy_menu.enabled);
  let fancy_menu_mode = if remote.fancy_menu.mode.trim().eq_ignore_ascii_case("custom") {
    "custom".to_string()
  } else {
    "simple".to_string()
  };
  let fancy_menu_present = remote
    .items
    .iter()
    .any(|entry| entry.name.to_lowercase().contains("fancymenu"));
  let fancy_menu_custom_bundle_present = remote.configs.iter().any(|entry| {
    entry.name == "FancyMenu Custom Bundle"
      || remote
        .fancy_menu
        .custom_layout_url
        .as_ref()
        .is_some_and(|url| url == &entry.url)
  });

  Ok(CatalogSnapshot {
    server_id: effective_server,
    server_name,
    server_address,
    logo_url: remote.branding.logo_url.clone(),
    background_url: remote.branding.background_url.clone(),
    profile_version: remote.version,
    local_version,
    minecraft_version: remote.minecraft_version,
    loader: remote.loader,
    loader_version: remote.loader_version,
    allowed_minecraft_versions,
    has_updates: updates.has_updates,
    summary: updates.summary,
    fancy_menu_enabled,
    fancy_menu_mode,
    fancy_menu_present,
    fancy_menu_custom_bundle_present,
    mods: remote.items.into_iter().map(|entry| entry.name).collect(),
    resourcepacks: remote.resources.into_iter().map(|entry| entry.name).collect(),
    shaderpacks: remote.shaders.into_iter().map(|entry| entry.name).collect(),
    configs: remote.configs.into_iter().map(|entry| entry.name).collect(),
  })

}
