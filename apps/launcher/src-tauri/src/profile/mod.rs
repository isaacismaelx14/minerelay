use crate::{
  error::{LauncherError, LauncherResult},
  providers::validate_service_url,
  state::AppState,
  types::{ProfileLock, ProfileMetadataResponse},
};
use url::Url;

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

  Ok(lock)
}

pub async fn fetch_profile_metadata(state: &AppState, server_id: &str) -> LauncherResult<ProfileMetadataResponse> {
  let api_base = configured_api_base(state).ok_or_else(|| {
    LauncherError::Config(
      "Profile source is not configured. Set API Base URL or Profile Lock URL in Settings.".to_string(),
    )
  })?;
  validate_service_url(&api_base)?;

  let legacy_server_url = format!("{api_base}/v1/servers/{server_id}/profile");
  let direct_profile_url = format!("{api_base}/v1/profile");

  // Prefer server-scoped metadata so session restore/dashboard refreshes cannot
  // accidentally pull default profile metadata from /v1/profile.
  let preferred = state.http.get(&legacy_server_url).send().await?;
  if preferred.status().is_success() {
    return preferred
      .json::<ProfileMetadataResponse>()
      .await
      .map(|mut profile| {
        if profile.allowed_minecraft_versions.is_empty() {
          profile.allowed_minecraft_versions = vec![profile.minecraft_version.clone()];
        }
        profile
      })
      .map_err(|error| {
        LauncherError::InvalidData(format!(
          "invalid /v1/servers/:serverId/profile payload: {error}"
        ))
      });
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

  fallback
    .json::<ProfileMetadataResponse>()
    .await
    .map(|mut profile| {
      if profile.allowed_minecraft_versions.is_empty() {
        profile.allowed_minecraft_versions = vec![profile.minecraft_version.clone()];
      }
      profile
    })
    .map_err(|error| LauncherError::InvalidData(format!("invalid /v1/profile payload: {error}")))
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
    Err(error) => state
      .remote_lock_cache
      .lock()
      .get(&cache_key)
      .cloned()
      .ok_or(error),
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
  value
    .map(|raw| raw.trim().to_string())
    .filter(|raw| !raw.is_empty())
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

fn is_loopback(host: &str) -> bool {
  host.eq_ignore_ascii_case("localhost") || host == "127.0.0.1" || host == "::1"
}
