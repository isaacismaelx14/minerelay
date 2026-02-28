use std::{env, path::PathBuf};

#[derive(Debug, Clone)]
pub struct LauncherConfig {
  pub api_base_url: Option<String>,
  pub profile_lock_url: Option<String>,
  pub server_id: String,
  pub data_root: PathBuf,
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

    let server_id = env::var("SERVER_ID")
      .ok()
      .map(|value| value.trim().to_string())
      .filter(|value| !value.is_empty())
      .unwrap_or_else(|| "mvl".to_string());

    let base = dirs::data_local_dir()
      .or_else(dirs::data_dir)
      .unwrap_or_else(|| PathBuf::from("."));

    let data_root = base.join("minecraft-server-syncer");

    Self {
      api_base_url,
      profile_lock_url,
      server_id,
      data_root,
    }
  }

  pub fn instances_dir(&self) -> PathBuf {
    self.data_root.join("instances")
  }

  pub fn settings_path(&self) -> PathBuf {
    self.data_root.join("settings.json")
  }
}
