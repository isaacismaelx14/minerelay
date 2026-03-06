use std::{env, fs, path::{Path, PathBuf}};

use serde::Deserialize;

#[derive(Debug, Clone)]
pub struct LauncherConfig {
  pub api_base_url: Option<String>,
  pub profile_lock_url: Option<String>,
  pub profile_signature_public_key: Option<String>,
  pub server_control_trusted_hosts: Option<String>,
  pub devtools_secret_command: Option<String>,
  pub launcher_install_code: Option<String>,
  pub server_id: String,
  pub data_root: PathBuf,
  pub updater_endpoint: String,
  pub updater_pubkey: Option<String>,
  pub resolution_report: Vec<ConfigResolution>,
}

#[derive(Debug, Clone)]
pub struct ConfigResolution {
  pub key: &'static str,
  pub source: ConfigSource,
  pub configured: bool,
  pub sensitive: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigSource {
  Environment,
  RuntimeFile,
  BuildDefault,
  HardcodedDefault,
  Unset,
}

impl ConfigSource {
  fn as_str(self) -> &'static str {
    match self {
      Self::Environment => "env",
      Self::RuntimeFile => "runtime-file",
      Self::BuildDefault => "build-default",
      Self::HardcodedDefault => "hardcoded-default",
      Self::Unset => "unset",
    }
  }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeConfigFile {
  #[serde(default, alias = "API_BASE_URL")]
  api_base_url: Option<String>,
  #[serde(default, alias = "PROFILE_LOCK_URL")]
  profile_lock_url: Option<String>,
  #[serde(default, alias = "PROFILE_SIGNATURE_PUBLIC_KEY")]
  profile_signature_public_key: Option<String>,
  #[serde(default, alias = "LAUNCHER_SERVER_CONTROL_TRUSTED_HOSTS")]
  server_control_trusted_hosts: Option<String>,
  #[serde(default, alias = "DEVTOOLS_SECRET_COMMAND")]
  devtools_secret_command: Option<String>,
  #[serde(default, alias = "LAUNCHER_INSTALL_CODE")]
  launcher_install_code: Option<String>,
  #[serde(default, alias = "SERVER_ID")]
  server_id: Option<String>,
  #[serde(default, alias = "LAUNCHER_UPDATE_ENDPOINT")]
  updater_endpoint: Option<String>,
  #[serde(default, alias = "LAUNCHER_UPDATE_PUBKEY")]
  updater_pubkey: Option<String>,
}

impl LauncherConfig {
  pub fn from_env() -> Self {
    let base = dirs::data_local_dir()
      .or_else(dirs::data_dir)
      .unwrap_or_else(|| PathBuf::from("."));
    let data_root = base.join(data_dir_name());
    let legacy_data_root = base.join(legacy_data_dir_name());

    let runtime = load_runtime_config(
      &runtime_config_path(&data_root),
      &runtime_config_path(&legacy_data_root),
    );

    let mut resolution_report = Vec::new();

    let (api_base_url, api_base_url_source) = read_optional_with_source(
      "API_BASE_URL",
      runtime.api_base_url,
      option_env!("API_BASE_URL"),
    );
    resolution_report.push(ConfigResolution {
      key: "API_BASE_URL",
      source: api_base_url_source,
      configured: api_base_url.is_some(),
      sensitive: false,
    });

    let (profile_lock_url, profile_lock_url_source) = read_optional_with_source(
      "PROFILE_LOCK_URL",
      runtime.profile_lock_url,
      option_env!("PROFILE_LOCK_URL"),
    );
    resolution_report.push(ConfigResolution {
      key: "PROFILE_LOCK_URL",
      source: profile_lock_url_source,
      configured: profile_lock_url.is_some(),
      sensitive: false,
    });

    let (profile_signature_public_key, profile_signature_public_key_source) = read_optional_with_source(
      "PROFILE_SIGNATURE_PUBLIC_KEY",
      runtime.profile_signature_public_key,
      option_env!("PROFILE_SIGNATURE_PUBLIC_KEY"),
    );
    resolution_report.push(ConfigResolution {
      key: "PROFILE_SIGNATURE_PUBLIC_KEY",
      source: profile_signature_public_key_source,
      configured: profile_signature_public_key.is_some(),
      sensitive: true,
    });

    let (server_control_trusted_hosts, server_control_trusted_hosts_source) = read_optional_with_source(
      "LAUNCHER_SERVER_CONTROL_TRUSTED_HOSTS",
      runtime.server_control_trusted_hosts,
      option_env!("LAUNCHER_SERVER_CONTROL_TRUSTED_HOSTS"),
    );
    resolution_report.push(ConfigResolution {
      key: "LAUNCHER_SERVER_CONTROL_TRUSTED_HOSTS",
      source: server_control_trusted_hosts_source,
      configured: server_control_trusted_hosts.is_some(),
      sensitive: false,
    });

    let (raw_devtools_secret_command, devtools_secret_command_source) = read_optional_with_source(
      "DEVTOOLS_SECRET_COMMAND",
      runtime.devtools_secret_command,
      option_env!("DEVTOOLS_SECRET_COMMAND"),
    );
    let devtools_secret_command = if cfg!(debug_assertions) {
      raw_devtools_secret_command
    } else {
      None
    };
    resolution_report.push(ConfigResolution {
      key: "DEVTOOLS_SECRET_COMMAND",
      source: if cfg!(debug_assertions) {
        devtools_secret_command_source
      } else {
        ConfigSource::HardcodedDefault
      },
      configured: devtools_secret_command.is_some(),
      sensitive: true,
    });

    let (launcher_install_code, launcher_install_code_source) = read_optional_with_source(
      "LAUNCHER_INSTALL_CODE",
      runtime.launcher_install_code,
      option_env!("LAUNCHER_INSTALL_CODE"),
    );
    resolution_report.push(ConfigResolution {
      key: "LAUNCHER_INSTALL_CODE",
      source: launcher_install_code_source,
      configured: launcher_install_code.is_some(),
      sensitive: true,
    });

    let (raw_server_id, server_id_source) = read_optional_with_source(
      "SERVER_ID",
      runtime.server_id,
      option_env!("SERVER_ID"),
    );
    let server_id_configured = raw_server_id.is_some();
    let server_id = raw_server_id
      .and_then(|value| normalize_server_id(&value))
      .unwrap_or_else(|| "mvl".to_string());
    resolution_report.push(ConfigResolution {
      key: "SERVER_ID",
      source: if server_id_configured {
        server_id_source
      } else {
        ConfigSource::HardcodedDefault
      },
      configured: true,
      sensitive: false,
    });

    let (raw_updater_endpoint, updater_endpoint_source) = read_optional_with_source(
      "LAUNCHER_UPDATE_ENDPOINT",
      runtime.updater_endpoint,
      option_env!("LAUNCHER_UPDATE_ENDPOINT"),
    );
    let updater_endpoint = raw_updater_endpoint.unwrap_or_else(|| {
      "https://github.com/isaacismaelx14/minerelay/releases/latest/download/latest.json"
        .to_string()
    });
    resolution_report.push(ConfigResolution {
      key: "LAUNCHER_UPDATE_ENDPOINT",
      source: if updater_endpoint_source == ConfigSource::Unset {
        ConfigSource::HardcodedDefault
      } else {
        updater_endpoint_source
      },
      configured: true,
      sensitive: false,
    });

    let (updater_pubkey, updater_pubkey_source) = read_optional_with_source(
      "LAUNCHER_UPDATE_PUBKEY",
      runtime.updater_pubkey,
      option_env!("LAUNCHER_UPDATE_PUBKEY"),
    );
    resolution_report.push(ConfigResolution {
      key: "LAUNCHER_UPDATE_PUBKEY",
      source: updater_pubkey_source,
      configured: updater_pubkey.is_some(),
      sensitive: true,
    });

    Self {
      api_base_url,
      profile_lock_url,
      profile_signature_public_key,
      server_control_trusted_hosts,
      devtools_secret_command,
      launcher_install_code,
      server_id,
      data_root,
      updater_endpoint,
      updater_pubkey,
      resolution_report,
    }
  }

  pub fn instances_dir(&self) -> PathBuf {
    self.data_root.join("instances")
  }

  pub fn settings_path(&self) -> PathBuf {
    self.data_root.join("settings.json")
  }

  pub fn legacy_settings_path(&self) -> PathBuf {
    self.legacy_data_root().join("settings.json")
  }

  pub fn legacy_data_root(&self) -> PathBuf {
    self.data_root
      .parent()
      .map(|base| base.join(legacy_data_dir_name()))
      .unwrap_or_else(|| PathBuf::from(legacy_data_dir_name()))
  }

  pub fn log_resolution_report(&self) {
    for entry in &self.resolution_report {
      let details = if entry.sensitive {
        format!(
          "{{\"key\":\"{}\",\"source\":\"{}\",\"configured\":{},\"sensitive\":true}}",
          entry.key,
          entry.source.as_str(),
          entry.configured
        )
      } else {
        format!(
          "{{\"key\":\"{}\",\"source\":\"{}\",\"configured\":{},\"sensitive\":false}}",
          entry.key,
          entry.source.as_str(),
          entry.configured
        )
      };

      crate::telemetry::record_exception_event(
        "config",
        "resolved launcher configuration",
        Some(details.as_str()),
      );

      println!(
        "[config] {} => {} (configured={}, sensitive={})",
        entry.key,
        entry.source.as_str(),
        entry.configured,
        entry.sensitive
      );
    }
  }
}

fn runtime_config_path(data_root: &Path) -> PathBuf {
  data_root.join("launcher.runtime.json")
}

fn load_runtime_config(primary_path: &Path, legacy_path: &Path) -> RuntimeConfigFile {
  let content = fs::read_to_string(primary_path)
    .ok()
    .or_else(|| fs::read_to_string(legacy_path).ok());
  let Some(content) = content else {
    return RuntimeConfigFile::default();
  };

  serde_json::from_str::<RuntimeConfigFile>(&content).unwrap_or_default()
}

fn read_optional_with_source(
  env_name: &str,
  runtime_value: Option<String>,
  build_value: Option<&'static str>,
) -> (Option<String>, ConfigSource) {
  if let Some(value) = normalize_optional(env::var(env_name).ok()) {
    return (Some(value), ConfigSource::Environment);
  }

  if let Some(value) = normalize_optional(runtime_value) {
    return (Some(value), ConfigSource::RuntimeFile);
  }

  if let Some(value) = normalize_optional(build_value.map(ToString::to_string)) {
    return (Some(value), ConfigSource::BuildDefault);
  }

  (None, ConfigSource::Unset)
}

fn normalize_optional(value: Option<String>) -> Option<String> {
  value.map(|raw| raw.trim().to_string()).filter(|raw| !raw.is_empty())
}

fn data_dir_name() -> &'static str {
  if cfg!(debug_assertions) {
    "minerelay-dev"
  } else {
    "minerelay"
  }
}

fn legacy_data_dir_name() -> &'static str {
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
