use std::{env, path::PathBuf};

#[derive(Debug, Clone)]
pub struct LauncherConfig {
  pub api_base_url: Option<String>,
  pub profile_lock_url: Option<String>,
  pub profile_signature_public_key: Option<String>,
  pub server_id: String,
  pub data_root: PathBuf,
  pub updater_endpoint: String,
  pub updater_pubkey: Option<String>,
}

impl LauncherConfig {
  pub fn from_env() -> Self {
    let api_base_url = env::var("API_BASE_URL")
      .ok()
      .map(|value| value.trim().to_string())
      .filter(|value| !value.is_empty());

    let profile_lock_url = env::var("PROFILE_LOCK_URL")
      .ok()
      .map(|value| value.trim().to_string())
      .filter(|value| !value.is_empty());
    let profile_signature_public_key = env::var("PROFILE_SIGNATURE_PUBLIC_KEY")
      .ok()
      .map(|value| value.trim().to_string())
      .filter(|value| !value.is_empty())
      .or_else(|| {
        option_env!("PROFILE_SIGNATURE_PUBLIC_KEY")
          .map(|value| value.trim().to_string())
          .filter(|value| !value.is_empty())
      });

    let server_id = env::var("SERVER_ID")
      .ok()
      .and_then(|value| normalize_server_id(&value))
      .unwrap_or_else(|| "mvl".to_string());

    let base = dirs::data_local_dir()
      .or_else(dirs::data_dir)
      .unwrap_or_else(|| PathBuf::from("."));

    let data_root = base.join(data_dir_name());
    let updater_endpoint = env::var("LAUNCHER_UPDATE_ENDPOINT")
      .ok()
      .map(|value| value.trim().to_string())
      .filter(|value| !value.is_empty())
      .or_else(|| {
        option_env!("LAUNCHER_UPDATE_ENDPOINT")
          .map(|value| value.trim().to_string())
          .filter(|value| !value.is_empty())
      })
      .unwrap_or_else(|| {
        "https://github.com/isaacismaelx14/mc-client-center/releases/latest/download/latest.json"
          .to_string()
      });
    let updater_pubkey = env::var("LAUNCHER_UPDATE_PUBKEY")
      .ok()
      .map(|value| value.trim().to_string())
      .filter(|value| !value.is_empty())
      .or_else(|| {
        option_env!("LAUNCHER_UPDATE_PUBKEY")
          .map(|value| value.trim().to_string())
          .filter(|value| !value.is_empty())
      });

    Self {
      api_base_url,
      profile_lock_url,
      profile_signature_public_key,
      server_id,
      data_root,
      updater_endpoint,
      updater_pubkey,
    }
  }

  pub fn instances_dir(&self) -> PathBuf {
    self.data_root.join("instances")
  }

  pub fn settings_path(&self) -> PathBuf {
    self.data_root.join("settings.json")
  }
}

fn data_dir_name() -> &'static str {
  if cfg!(debug_assertions) {
    "minecraft-server-syncer-dev"
  } else {
    "minecraft-server-syncer"
  }
}

fn normalize_server_id(value: &str) -> Option<String> {
  let trimmed = value.trim();
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
