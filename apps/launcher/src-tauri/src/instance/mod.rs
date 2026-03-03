use crate::{utils::*, types::VersionReadiness};
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
    _mode: &InstallMode,
    _minecraft_root_override: Option<&str>,
  ) -> LauncherResult<Self> {
    let root = config.instances_dir().join(server_id);
    let minecraft_dir = root.join("minecraft_dir");

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

pub async fn check_version_readiness(state: &crate::state::AppState, server_id: &str) -> Result<crate::types::VersionReadiness, String> {

  let effective_server = effective_server_id(state, server_id);
  let settings = state.settings.lock().clone();
  let remote = crate::profile::fetch_remote_lock(state, &effective_server)
    .await
    .map_err(|e| format!("{e}"))?;
  let metadata = crate::profile::fetch_profile_metadata(state, &effective_server).await.ok();

  let allowed_minecraft_versions = allowed_versions(metadata.as_ref(), &remote.minecraft_version);
  let allowlisted = allowed_minecraft_versions
    .iter()
    .any(|value| value == &remote.minecraft_version);

  let paths = InstancePaths::new(
    &state.config,
    &effective_server,
    &settings.install_mode,
    settings.minecraft_root_override.as_deref(),
  )
  .map_err(|e| format!("{e}"))?;
  ensure_layout(&paths).map_err(|e| format!("{e}"))?;

  let (minecraft_root, using_override_root) =
    resolve_launcher_minecraft_root(&settings).map_err(|e| format!("{e}"))?;
  let versions_dir = minecraft_root.join("versions");

  let expected_fabric = crate::runtime::fabric_version_id(&remote.minecraft_version, &remote.loader_version);
  let fabric_present = versions_dir
    .join(&expected_fabric)
    .join(format!("{expected_fabric}.json"))
    .exists();

  let expected_managed = crate::launcher_apps::server_release_version_id(&remote);
  let selected_launcher = settings.selected_launcher_id.as_deref().unwrap_or("official");
  let requires_managed_version = selected_launcher != "prism";

  let managed_version_present = if requires_managed_version {
    crate::launcher_apps::managed_version_exists(&minecraft_root, &expected_managed)
  } else {
    true
  };

  let found = fabric_present && managed_version_present;

  let guidance = if !allowlisted {
    format!(
      "Minecraft {} is not allowlisted for this server. Allowed: {}",
      remote.minecraft_version,
      allowed_minecraft_versions.join(", ")
    )
  } else if !fabric_present {
    format!(
      "Fabric runtime '{}' is missing in your minecraft root. Use onboarding Step 3 to install it.",
      expected_fabric
    )
  } else if !managed_version_present {
    format!(
      "Managed launcher version '{}' is missing. Use onboarding Step 3 to create/update it.",
      expected_managed
    )
  } else {
    "Fabric runtime and managed launcher version look available. Sync stays in app-managed storage; live Minecraft files are swapped only while playing."
      .to_string()
  };

  Ok(VersionReadiness {
    minecraft_version: remote.minecraft_version,
    loader: remote.loader,
    loader_version: remote.loader_version,
    managed_minecraft_dir: paths.minecraft_dir.to_string_lossy().to_string(),
    live_minecraft_root: minecraft_root.to_string_lossy().to_string(),
    minecraft_root: minecraft_root.to_string_lossy().to_string(),
    found_in_minecraft_root_dir: found,
    using_override_root,
    allowlisted,
    allowed_minecraft_versions,
    expected_fabric_version_id: expected_fabric,
    expected_managed_version_id: expected_managed,
    managed_version_present,
    guidance,
  })

}
