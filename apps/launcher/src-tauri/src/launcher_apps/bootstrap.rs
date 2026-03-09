/// Bootstrap routines for Prism Launcher and the official Minecraft Launcher,
/// plus shared helpers (slugify, server release naming, loader components).
use std::{
  fs,
  path::{Path, PathBuf},
};

use serde_json::json;
use sysinfo::System;

use crate::{
  error::{LauncherError, LauncherResult},
  types::{LauncherBootstrapResult, ProfileLock},
};

const FALLBACK_ICON_BYTES: &[u8] = include_bytes!("../../icons/icon.png");

// ─── Public helpers ───────────────────────────────────────────────────────────

/// Convert a server name into a filesystem-safe slug.
///
/// - Alphanumerics are lowercased and kept.
/// - Spaces, hyphens, and underscores are collapsed into a single `-`.
/// - Leading/trailing `-` characters are trimmed.
pub fn slugify(input: &str) -> String {
  let mut out = String::with_capacity(input.len());
  for ch in input.chars() {
    if ch.is_ascii_alphanumeric() {
      out.push(ch.to_ascii_lowercase());
    } else if ch == ' ' || ch == '-' || ch == '_' {
      if !out.ends_with('-') {
        out.push('-');
      }
    }
  }
  out.trim_matches('-').to_string()
}

pub fn server_release_name(lock: &ProfileLock) -> String {
  lock.branding.server_name.clone()
}

pub fn server_release_version_id(lock: &ProfileLock) -> String {
  server_release_key(lock)
}

fn server_release_key(lock: &ProfileLock) -> String {
  format!(
    "release-{}-loader-{}-{}",
    slugify(&lock.branding.server_name),
    lock.loader_version.replace('.', "-"),
    lock.minecraft_version.replace('.', "-")
  )
}

/// Resolve the root PrismLauncher config directory.
pub fn prism_root_dir() -> LauncherResult<PathBuf> {
  let config_dir = dirs::config_dir()
    .ok_or_else(|| LauncherError::Fs("failed to resolve user config directory for Prism".to_string()))?;
  Ok(config_dir.join("PrismLauncher"))
}

pub fn managed_version_exists(minecraft_root: &Path, version_id: &str) -> bool {
  minecraft_root
    .join("versions")
    .join(version_id)
    .join(format!("{version_id}.json"))
    .exists()
}

// ─── Prism bootstrap ─────────────────────────────────────────────────────────

pub async fn bootstrap_prism_instance(
  state: &crate::state::AppState,
  lock: &ProfileLock,
) -> LauncherResult<LauncherBootstrapResult> {
  let prism_root = prism_root_dir()?;
  let instances_root = prism_root.join("instances");
  fs::create_dir_all(&instances_root)?;

  let instance_name = lock.branding.server_name.clone();
  let instance_key = slugify(&lock.branding.server_name);
  let instance_dir = instances_root.join(&instance_key);
  fs::create_dir_all(&instance_dir)?;

  write_mmc_pack(&instance_dir, lock)?;
  write_instance_cfg_if_missing(&instance_dir, &instance_key, &instance_name)?;

  #[cfg(target_os = "macos")]
  let minecraft_folder = "minecraft";
  #[cfg(not(target_os = "macos"))]
  let minecraft_folder = ".minecraft";

  let minecraft_dir = instance_dir.join(minecraft_folder);
  let icons_dir = prism_root.join("icons");
  let _ = fs::create_dir_all(&icons_dir);
  let prism_icon_path = icons_dir.join(format!("{instance_key}.png"));

  write_instance_icons(state, lock, &minecraft_dir, &instance_dir, &prism_icon_path).await;

  upsert_prism_instance_group(&prism_root, &instance_key);

  Ok(LauncherBootstrapResult {
    launcher_id: "prism".to_string(),
    instance_name,
    instance_path: Some(instance_dir.to_string_lossy().to_string()),
    message: "Prism instance created/updated.".to_string(),
  })
}

fn write_mmc_pack(instance_dir: &Path, lock: &ProfileLock) -> LauncherResult<()> {
  let loader_component = build_loader_component(lock)?;
  let pack = json!({
    "formatVersion": 1,
    "components": [
      {
        "important": true,
        "uid": "net.minecraft",
        "version": lock.minecraft_version,
      },
      loader_component,
    ],
  });
  fs::write(
    instance_dir.join("mmc-pack.json"),
    serde_json::to_string_pretty(&pack)
      .map_err(|e| LauncherError::InvalidData(format!("failed to serialize mmc-pack.json: {e}")))?,
  )?;
  Ok(())
}

fn write_instance_cfg_if_missing(
  instance_dir: &Path,
  instance_key: &str,
  instance_name: &str,
) -> LauncherResult<()> {
  let cfg_path = instance_dir.join("instance.cfg");
  if cfg_path.exists() {
    return Ok(());
  }

  let mut system = System::new_all();
  system.refresh_memory();
  let total_memory = system.total_memory();
  // Accept both real bytes (>=16 GB) and the sysinfo legacy MiB representation.
  let has_more_than_16gb =
    total_memory >= 16 * 1024 * 1024 * 1024 || total_memory >= 16 * 1024 * 1024;
  let (max_mem, min_mem): (u32, u32) = if has_more_than_16gb { (4096, 1024) } else { (2048, 512) };

  let cfg = format!(
    "[General]\nConfigVersion=1.3\nInstanceType=OneSix\nJoinServerOnLaunch=false\n\
ManagedPack=false\nMaxMemAlloc={max_mem}\nMinMemAlloc={min_mem}\n\
OverrideCommands=false\nOverrideConsole=false\nOverrideEnv=false\n\
OverrideGameTime=false\nOverrideJavaArgs=false\nOverrideJavaLocation=false\n\
OverrideLegacySettings=false\nOverrideMemory=true\nOverrideMiscellaneous=false\n\
OverrideNativeWorkarounds=false\nOverridePerformance=false\nOverrideWindow=false\n\
PermGen=128\nUseAccountForInstance=false\niconKey={instance_key}\nname={instance_name}\n\
notes=Managed by Minerelay.\n"
  );
  fs::write(&cfg_path, cfg)?;
  Ok(())
}

async fn write_instance_icons(
  state: &crate::state::AppState,
  lock: &ProfileLock,
  minecraft_dir: &Path,
  instance_dir: &Path,
  prism_icon_path: &Path,
) {
  let icon_path = minecraft_dir.join("icon.png");
  let instance_icon_path = instance_dir.join("icon.png");

  let mut icon_written = false;
  if let Some(logo_url) = lock.branding.logo_url.as_deref() {
    let client = state.http.clone();
    if let Ok(response) = client.get(logo_url).send().await {
      if response.status().is_success() {
        if let Ok(bytes) = response.bytes().await {
          let _ = fs::create_dir_all(minecraft_dir);
          let _ = fs::write(&icon_path, &bytes);
          let _ = fs::write(&instance_icon_path, &bytes);
          let _ = fs::write(prism_icon_path, &bytes);
          icon_written = true;
        }
      }
    }
  }

  if !icon_written {
    let _ = fs::create_dir_all(minecraft_dir);
    let _ = fs::write(&icon_path, FALLBACK_ICON_BYTES);
    let _ = fs::write(&instance_icon_path, FALLBACK_ICON_BYTES);
    let _ = fs::write(prism_icon_path, FALLBACK_ICON_BYTES);
  }
}

/// Adds `instance_key` to the "Minerelay" group in PrismLauncher's `instgroups.json`.
/// Creates the file / group if they don't exist yet. Idempotent.
fn upsert_prism_instance_group(prism_root: &Path, instance_key: &str) {
  const GROUP_NAME: &str = "Minerelay";
  let path = prism_root.join("instances").join("instgroups.json");

  let mut root: serde_json::Value = if path.exists() {
    fs::read_to_string(&path)
      .ok()
      .and_then(|s| serde_json::from_str(&s).ok())
      .unwrap_or_else(|| json!({ "formatVersion": 1, "groups": {} }))
  } else {
    json!({ "formatVersion": 1, "groups": {} })
  };

  let groups = root
    .as_object_mut()
    .and_then(|o| o.entry("groups").or_insert_with(|| json!({})).as_object_mut());

  if let Some(groups) = groups {
    let group = groups
      .entry(GROUP_NAME)
      .or_insert_with(|| json!({ "hidden": false, "instances": [] }));

    if let Some(instances) = group
      .as_object_mut()
      .and_then(|o| o.get_mut("instances"))
      .and_then(|v| v.as_array_mut())
    {
      if !instances.iter().any(|v| v.as_str() == Some(instance_key)) {
        instances.push(serde_json::Value::String(instance_key.to_string()));
      }
    }
  }

  if let Ok(serialized) = serde_json::to_string_pretty(&root) {
    let _ = fs::write(&path, serialized);
  }
}

// ─── Official launcher bootstrap ─────────────────────────────────────────────

pub async fn bootstrap_official_version(
  state: &crate::state::AppState,
  lock: &ProfileLock,
  minecraft_root: &Path,
  minecraft_dir: &Path,
) -> LauncherResult<LauncherBootstrapResult> {
  let parent_version = expected_loader_parent(lock)?;
  let parent_json = minecraft_root
    .join("versions")
    .join(&parent_version)
    .join(format!("{parent_version}.json"));

  let display_name = server_release_name(lock);
  let version_id = server_release_version_id(lock);

  if !parent_json.exists() {
    return Ok(LauncherBootstrapResult {
      launcher_id: "official".to_string(),
      instance_name: display_name,
      instance_path: None,
      message: format!(
        "Could not create official custom version yet. Missing parent version '{}' in \
.minecraft/versions. Install that Fabric version once, then click Open Launcher again.",
        parent_version
      ),
    });
  }

  let version_dir = minecraft_root.join("versions").join(&version_id);
  fs::create_dir_all(&version_dir)?;

  let payload = json!({
    "id": version_id,
    "inheritsFrom": parent_version,
    "type": "release",
  });
  let version_json_path = version_dir.join(format!("{version_id}.json"));
  fs::write(
    &version_json_path,
    serde_json::to_string_pretty(&payload)
      .map_err(|e| LauncherError::InvalidData(format!("failed to serialize custom version json: {e}")))?,
  )?;

  let icon_bytes: Option<Vec<u8>> = fetch_icon_bytes(state, lock).await;
  let icon_data_url = icon_bytes
    .as_deref()
    .or(Some(FALLBACK_ICON_BYTES))
    .map(|bytes| {
      use base64::Engine as _;
      format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes),
      )
    });

  upsert_official_launcher_profile(
    minecraft_root,
    &version_id,
    &display_name,
    minecraft_dir,
    icon_data_url.as_deref(),
  )?;

  Ok(LauncherBootstrapResult {
    launcher_id: "official".to_string(),
    instance_name: display_name,
    instance_path: Some(version_json_path.to_string_lossy().to_string()),
    message: "Official custom version + launcher profile entry created and linked to your live game directory."
      .to_string(),
  })
}

async fn fetch_icon_bytes(state: &crate::state::AppState, lock: &ProfileLock) -> Option<Vec<u8>> {
  let logo_url = lock.branding.logo_url.as_deref()?;
  let client = state.http.clone();
  let response = client.get(logo_url).send().await.ok()?;
  if response.status().is_success() {
    response.bytes().await.ok().map(|b| b.to_vec())
  } else {
    None
  }
}

fn upsert_official_launcher_profile(
  minecraft_root: &Path,
  version_id: &str,
  display_name: &str,
  minecraft_dir: &Path,
  icon_data_url: Option<&str>,
) -> LauncherResult<()> {
  let profiles_path = minecraft_root.join("launcher_profiles.json");

  let mut root: serde_json::Value = if profiles_path.exists() {
    let content = fs::read_to_string(&profiles_path)?;
    serde_json::from_str(&content).map_err(|e| {
      LauncherError::InvalidData(format!("failed to parse launcher_profiles.json: {e}"))
    })?
  } else {
    json!({})
  };

  if !root.is_object() {
    root = json!({});
  }

  let Some(root_obj) = root.as_object_mut() else {
    return Err(LauncherError::InvalidData(
      "launcher_profiles.json root must be object".to_string(),
    ));
  };

  let profiles = root_obj.entry("profiles").or_insert_with(|| json!({}));
  if !profiles.is_object() {
    *profiles = json!({});
  }

  let Some(profiles_obj) = profiles.as_object_mut() else {
    return Err(LauncherError::InvalidData(
      "launcher_profiles.json `profiles` field must be object".to_string(),
    ));
  };

  let mut profile = json!({
    "name": display_name,
    "type": "custom",
    "lastVersionId": version_id,
    "gameDir": minecraft_dir.to_string_lossy().to_string(),
  });
  if let Some(icon) = icon_data_url {
    profile["icon"] = serde_json::Value::String(icon.to_string());
  }
  profiles_obj.insert(version_id.to_string(), profile);

  fs::create_dir_all(minecraft_root)?;
  fs::write(
    profiles_path,
    serde_json::to_string_pretty(&root).map_err(|e| {
      LauncherError::InvalidData(format!("failed to serialize launcher_profiles.json: {e}"))
    })?,
  )?;

  Ok(())
}

// ─── Loader helpers ───────────────────────────────────────────────────────────

fn build_loader_component(lock: &ProfileLock) -> LauncherResult<serde_json::Value> {
  match lock.loader.as_str() {
    "fabric" => Ok(json!({
      "important": true,
      "uid": "net.fabricmc.fabric-loader",
      "version": lock.loader_version,
    })),
    "forge" => Ok(json!({
      "important": true,
      "uid": "net.minecraftforge",
      "version": lock.loader_version,
    })),
    other => Err(LauncherError::InvalidData(format!(
      "unsupported loader '{}' for Prism bootstrap",
      other
    ))),
  }
}

fn expected_loader_parent(lock: &ProfileLock) -> LauncherResult<String> {
  match lock.loader.as_str() {
    "fabric" => Ok(format!(
      "fabric-loader-{}-{}",
      lock.loader_version, lock.minecraft_version
    )),
    "forge" => Ok(lock.loader_version.clone()),
    other => Err(LauncherError::InvalidData(format!(
      "unsupported loader '{}' for official version bootstrap",
      other
    ))),
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
  use super::*;
  use crate::types::{Branding, DefaultServer, ProfileLock, RuntimeHints};

  fn make_lock(loader: &str, loader_version: &str, minecraft_version: &str) -> ProfileLock {
    ProfileLock {
      profile_id: "test-profile".to_string(),
      version: 1,
      minecraft_version: minecraft_version.to_string(),
      loader: loader.to_string(),
      loader_version: loader_version.to_string(),
      default_server: DefaultServer {
        name: "Test".to_string(),
        address: "localhost".to_string(),
      },
      items: vec![],
      resources: vec![],
      shaders: vec![],
      configs: vec![],
      runtime_hints: RuntimeHints {
        java_major: 17,
        min_memory_mb: 512,
        max_memory_mb: 2048,
      },
      branding: Branding {
        server_name: "Test Server".to_string(),
        logo_url: None,
        background_url: None,
        news_url: None,
      },
      fancy_menu: Default::default(),
    }
  }

  // ── slugify ────────────────────────────────────────────────────────────

  #[test]
  fn slugify_lowercases_alphanumeric() {
    assert_eq!(slugify("Hello"), "hello");
  }

  #[test]
  fn slugify_replaces_spaces_with_dashes() {
    assert_eq!(slugify("Prism Launcher"), "prism-launcher");
  }

  #[test]
  fn slugify_collapses_consecutive_separators() {
    assert_eq!(slugify("a  -  b"), "a-b");
  }

  #[test]
  fn slugify_strips_leading_and_trailing_dashes() {
    assert_eq!(slugify("-hello-"), "hello");
    assert_eq!(slugify("  hello  "), "hello");
  }

  #[test]
  fn slugify_removes_special_characters() {
    assert_eq!(slugify("My!Server#1"), "myserver1");
  }

  #[test]
  fn slugify_returns_empty_for_all_special_chars() {
    assert_eq!(slugify("!!!"), "");
  }

  // ── server_release_version_id ──────────────────────────────────────────

  #[test]
  fn server_release_version_id_has_expected_format() {
    let lock = make_lock("fabric", "0.15.3", "1.20.1");
    let id = server_release_version_id(&lock);
    // release-<server-slug>-loader-<loader-version>-<mc-version>
    assert!(id.starts_with("release-test-server-loader-"));
    assert!(id.contains("0-15-3"));
    assert!(id.contains("1-20-1"));
  }

  // ── build_loader_component ─────────────────────────────────────────────

  #[test]
  fn build_loader_component_returns_fabric_uid() {
    let lock = make_lock("fabric", "0.15.3", "1.20.1");
    let component = build_loader_component(&lock).unwrap();
    assert_eq!(component["uid"], "net.fabricmc.fabric-loader");
    assert_eq!(component["version"], "0.15.3");
  }

  #[test]
  fn build_loader_component_returns_forge_uid() {
    let lock = make_lock("forge", "47.2.0", "1.20.1");
    let component = build_loader_component(&lock).unwrap();
    assert_eq!(component["uid"], "net.minecraftforge");
    assert_eq!(component["version"], "47.2.0");
  }

  #[test]
  fn build_loader_component_rejects_unknown_loader() {
    let lock = make_lock("quilt", "0.20.0", "1.20.1");
    assert!(build_loader_component(&lock).is_err());
  }

  // ── expected_loader_parent ─────────────────────────────────────────────

  #[test]
  fn expected_loader_parent_fabric_format() {
    let lock = make_lock("fabric", "0.15.3", "1.20.1");
    let parent = expected_loader_parent(&lock).unwrap();
    assert_eq!(parent, "fabric-loader-0.15.3-1.20.1");
  }

  #[test]
  fn expected_loader_parent_forge_returns_loader_version() {
    let lock = make_lock("forge", "47.2.0", "1.20.1");
    let parent = expected_loader_parent(&lock).unwrap();
    assert_eq!(parent, "47.2.0");
  }

  #[test]
  fn expected_loader_parent_rejects_unknown_loader() {
    let lock = make_lock("quilt", "0.20.0", "1.20.1");
    assert!(expected_loader_parent(&lock).is_err());
  }
}
