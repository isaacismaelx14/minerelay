use std::{fs, path::PathBuf};

use ed25519_dalek::SigningKey;
use sha2::Digest;
use uuid::Uuid;

use crate::state::AppState;

// ── Signing key ────────────────────────────────────────────────────────────────

pub(super) fn load_or_create_device_signing_key(state: &AppState) -> Result<SigningKey, String> {
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

// ── Installation ID ────────────────────────────────────────────────────────────

pub(super) fn load_or_create_installation_id(state: &AppState) -> Result<String, String> {
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

// ── Device fingerprint ─────────────────────────────────────────────────────────

pub(super) fn build_device_fingerprint() -> Result<String, String> {
  let mut system = sysinfo::System::new();
  system.refresh_all();
  let host = sysinfo::System::host_name().unwrap_or_else(|| "unknown-host".to_string());
  let platform = std::env::consts::OS;
  let arch = std::env::consts::ARCH;

  let raw = format!("{host}|{platform}|{arch}");
  let digest = sha2::Sha256::digest(raw.as_bytes());
  Ok(hex::encode(digest))
}
