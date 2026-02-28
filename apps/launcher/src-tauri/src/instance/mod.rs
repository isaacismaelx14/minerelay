use std::{
  fs,
  path::{Path, PathBuf},
};

use crate::{
  config::LauncherConfig,
  error::{LauncherError, LauncherResult},
  types::{AppSettings, DefaultServer, InstallMode, ProfileLock},
};

pub mod servers_dat;

#[derive(Debug, Clone)]
pub struct InstancePaths {
  pub root: PathBuf,
  pub minecraft_dir: PathBuf,
  pub mods: PathBuf,
  pub resourcepacks: PathBuf,
  pub shaderpacks: PathBuf,
  pub config: PathBuf,
  pub logs: PathBuf,
  pub manifest_lock: PathBuf,
  pub sync_dir: PathBuf,
  pub servers_dat: PathBuf,
}

impl InstancePaths {
  pub fn new(
    config: &LauncherConfig,
    server_id: &str,
    mode: &InstallMode,
    minecraft_root_override: Option<&str>,
  ) -> LauncherResult<Self> {
    let root = config.instances_dir().join(server_id);
    let minecraft_dir = match mode {
      InstallMode::Dedicated => root.join("minecraft_dir"),
      InstallMode::Global => resolve_minecraft_root_with_override(minecraft_root_override)?,
    };

    Ok(Self {
      root: root.clone(),
      mods: minecraft_dir.join("mods"),
      resourcepacks: minecraft_dir.join("resourcepacks"),
      shaderpacks: minecraft_dir.join("shaderpacks"),
      config: minecraft_dir.join("config"),
      logs: root.join("logs"),
      manifest_lock: root.join("manifest.lock.json"),
      sync_dir: root.join(".sync"),
      servers_dat: minecraft_dir.join("servers.dat"),
      minecraft_dir,
    })
  }
}

pub fn resolve_launcher_minecraft_root(settings: &AppSettings) -> LauncherResult<(PathBuf, bool)> {
  if let Some(path) = settings.minecraft_root_override.as_deref() {
    let trimmed = path.trim();
    if !trimmed.is_empty() {
      return Ok((PathBuf::from(trimmed), true));
    }
  }

  Ok((default_minecraft_dir()?, false))
}

pub fn resolve_minecraft_root_with_override(minecraft_root_override: Option<&str>) -> LauncherResult<PathBuf> {
  if let Some(path) = minecraft_root_override {
    let trimmed = path.trim();
    if !trimmed.is_empty() {
      return Ok(PathBuf::from(trimmed));
    }
  }

  default_minecraft_dir()
}

pub fn default_minecraft_dir() -> LauncherResult<PathBuf> {
  #[cfg(target_os = "windows")]
  {
    let base = dirs::data_dir().ok_or_else(|| {
      LauncherError::Fs("Unable to resolve AppData for default .minecraft directory".to_string())
    })?;

    return Ok(base.join(".minecraft"));
  }

  #[cfg(target_os = "macos")]
  {
    let home = dirs::home_dir().ok_or_else(|| {
      LauncherError::Fs("Unable to resolve home directory for default minecraft path".to_string())
    })?;

    return Ok(home.join("Library").join("Application Support").join("minecraft"));
  }

  #[cfg(not(any(target_os = "windows", target_os = "macos")))]
  {
    let home = dirs::home_dir().ok_or_else(|| {
      LauncherError::Fs("Unable to resolve home directory for default minecraft path".to_string())
    })?;

    Ok(home.join(".minecraft"))
  }
}

pub fn ensure_layout(paths: &InstancePaths) -> LauncherResult<()> {
  fs::create_dir_all(&paths.root)?;
  fs::create_dir_all(&paths.mods)?;
  fs::create_dir_all(&paths.resourcepacks)?;
  fs::create_dir_all(&paths.shaderpacks)?;
  fs::create_dir_all(&paths.config)?;
  fs::create_dir_all(&paths.logs)?;
  fs::create_dir_all(&paths.sync_dir)?;
  Ok(())
}

pub fn load_local_lock(paths: &InstancePaths) -> LauncherResult<Option<ProfileLock>> {
  if !paths.manifest_lock.exists() {
    return Ok(None);
  }

  let content = fs::read_to_string(&paths.manifest_lock)?;
  let lock = serde_json::from_str::<ProfileLock>(&content)
    .map_err(|error| LauncherError::InvalidData(format!("invalid local manifest.lock.json: {error}")))?;

  Ok(Some(lock))
}

pub fn write_manifest_lock(paths: &InstancePaths, lock: &ProfileLock) -> LauncherResult<()> {
  let content = serde_json::to_string_pretty(lock)?;
  fs::write(&paths.manifest_lock, content)?;
  Ok(())
}

pub fn ensure_default_server(paths: &InstancePaths, server: &DefaultServer) -> LauncherResult<()> {
  servers_dat::write_default_server_dat(&paths.servers_dat, server)
}

pub fn resolve_target_path(paths: &InstancePaths, relative: &str) -> PathBuf {
  paths.minecraft_dir.join(Path::new(relative))
}
