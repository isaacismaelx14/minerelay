use std::sync::{
  atomic::AtomicBool,
  Arc,
};
use std::time::Duration;
use std::collections::HashMap;

use parking_lot::Mutex;
use tokio::task::JoinHandle;

use crate::{
  config::LauncherConfig,
  settings,
  types::{AppSettings, GameSessionStatus, InstallMode, ProfileLock},
};

#[derive(Clone)]
pub struct LauncherAuthState {
  pub api_base: String,
  pub access_token: String,
  pub token_id: String,
  pub signing_secret: [u8; 32],
}

pub struct AppState {
  pub config: LauncherConfig,
  pub http: reqwest::Client,
  pub cancel_sync: Arc<AtomicBool>,
  pub is_exiting: AtomicBool,
  pub allow_exit_once: AtomicBool,
  pub settings: Mutex<AppSettings>,
  pub remote_lock_cache: Mutex<HashMap<String, ProfileLock>>,
  pub session_status: Mutex<GameSessionStatus>,
  pub session_monitor: Mutex<Option<JoinHandle<()>>>,
  pub launcher_auth: Mutex<Option<LauncherAuthState>>,
  pub launcher_server_stream: Mutex<Option<JoinHandle<()>>>,
}

impl AppState {
  pub fn new(config: LauncherConfig) -> Self {
    let settings_path = config.settings_path();
    let legacy_settings_path = config.legacy_settings_path();
    let mut loaded = settings::load_with_fallback(&settings_path, &legacy_settings_path)
      .unwrap_or_default();

    if loaded.install_mode != InstallMode::Global {
      loaded.install_mode = InstallMode::Global;
      let _ = settings::save(&settings_path, &loaded);
    }

    Self {
      config,
      http: reqwest::Client::builder()
        .user_agent("minerelay/0.1.0")
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("http client should initialize"),
      cancel_sync: Arc::new(AtomicBool::new(false)),
      is_exiting: AtomicBool::new(false),
      allow_exit_once: AtomicBool::new(false),
      settings: Mutex::new(loaded),
      remote_lock_cache: Mutex::new(HashMap::new()),
      session_status: Mutex::new(GameSessionStatus::default()),
      session_monitor: Mutex::new(None),
      launcher_auth: Mutex::new(None),
      launcher_server_stream: Mutex::new(None),
    }
  }
}
