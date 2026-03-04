use crate::{
  profile,
  state::AppState,
  types::{ProfileLock, ProfileMetadataResponse},
};

pub async fn ensure_allowlisted(
  state: &AppState,
  server_id: &str,
  remote: &ProfileLock,
) -> Result<Vec<String>, String> {
  let metadata = profile::fetch_profile_metadata(state, server_id).await.ok();
  let allowed = allowed_versions(metadata.as_ref(), &remote.minecraft_version);

  if allowed.iter().any(|value| value == &remote.minecraft_version) {
    return Ok(allowed);
  }

  Err(format!(
    "Minecraft version {} is not allowlisted for server {}. Allowed versions: {}",
    remote.minecraft_version,
    server_id,
    allowed.join(", ")
  ))
}

pub fn allowed_versions(metadata: Option<&ProfileMetadataResponse>, fallback: &str) -> Vec<String> {
  let mut values = if let Some(value) = metadata {
    if value.allowed_minecraft_versions.is_empty() {
      vec![fallback.to_string()]
    } else {
      value.allowed_minecraft_versions.clone()
    }
  } else {
    vec![fallback.to_string()]
  };

  values.sort();
  values.dedup();
  values
}

pub fn effective_server_id(state: &AppState, requested: &str) -> String {
  sanitize_server_id(requested)
    .or_else(|| sanitize_server_id(&state.config.server_id))
    .unwrap_or_else(|| "mvl".to_string())
}

pub fn sanitize_server_id(raw: &str) -> Option<String> {
  let trimmed = raw.trim();
  if trimmed.is_empty() || trimmed.len() > 64 {
    return None;
  }

  if trimmed
    .chars()
    .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
  {
    return Some(trimmed.to_string());
  }

  None
}

pub fn stringify_err(err: impl std::fmt::Display) -> String { err.to_string() }
