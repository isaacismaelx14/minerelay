use std::sync::{
  atomic::AtomicBool,
  Arc,
};

use parking_lot::Mutex;

use crate::{
  config::LauncherConfig,
  settings,
  types::{AppSettings, InstallMode},
};

pub struct AppState {
  pub config: LauncherConfig,
  pub http: reqwest::Client,
  pub cancel_sync: Arc<AtomicBool>,
  pub settings: Mutex<AppSettings>,
}

impl AppState {
  pub fn new(config: LauncherConfig) -> Self {
    let settings_path = config.settings_path();
    let mut loaded = settings::load(&settings_path).unwrap_or_default();

    if loaded.install_mode != InstallMode::Global {
      loaded.install_mode = InstallMode::Global;
      let _ = settings::save(&settings_path, &loaded);
    }

    Self {
      config,
      http: reqwest::Client::builder()
        .user_agent("minecraft-server-syncer/0.1.0")
        .build()
        .expect("http client should initialize"),
      cancel_sync: Arc::new(AtomicBool::new(false)),
      settings: Mutex::new(loaded),
    }
  }
}
