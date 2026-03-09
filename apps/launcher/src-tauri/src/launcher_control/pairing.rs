use std::fs;

use serde::Serialize;
use url::Url;

use crate::{providers::validate_service_url, settings, state::AppState};

pub const EVENT_PAIRING_LINK_APPLIED: &str = "launcher://pairing-link-applied";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingLinkAppliedEvent {
  pub url: String,
  pub api_base_url: Option<String>,
}

// ── Public API ─────────────────────────────────────────────────────────────────

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

pub fn pairing_link_applied_event(state: &AppState, raw_url: &str) -> PairingLinkAppliedEvent {
  let api_base_url = state
    .settings
    .lock()
    .api_base_url
    .clone()
    .map(|value| value.trim().trim_end_matches('/').to_string())
    .filter(|value| !value.is_empty());

  PairingLinkAppliedEvent {
    url: raw_url.trim().to_string(),
    api_base_url,
  }
}

// ── Token storage (used by auth.rs during enrollment) ─────────────────────────

pub(super) fn load_pending_pairing_token(state: &AppState) -> Option<String> {
  fs::read_to_string(pairing_token_path(state))
    .ok()
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
}

pub(super) fn clear_pairing_materials(state: &AppState) -> Result<(), String> {
  let _ = fs::remove_file(pairing_token_path(state));

  let mut settings_state = state.settings.lock();
  if settings_state.pairing_code.is_none() {
    return Ok(());
  }

  settings_state.pairing_code = None;
  settings::save(&state.config.settings_path(), &settings_state)
    .map_err(|error| format!("Failed to clear pairing code: {error}"))
}

fn pairing_token_path(state: &AppState) -> std::path::PathBuf {
  state.config.data_root.join("launcher-pairing-token")
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
