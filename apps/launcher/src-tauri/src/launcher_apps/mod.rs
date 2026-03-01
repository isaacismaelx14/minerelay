use std::{
  fs,
  path::{Path, PathBuf},
  process::Command,
  time::Instant,
};

use serde_json::json;
use tokio::time::{timeout, Duration};

use crate::{
  error::{LauncherError, LauncherResult},
  types::{
    AppSettings, LauncherBootstrapResult, LauncherCandidate, LauncherDetectionResult, OpenLauncherResponse,
    ProfileLock,
  },
};

pub fn detect_installed_launchers() -> Vec<LauncherCandidate> {
  let mut candidates = Vec::new();

  #[cfg(target_os = "windows")]
  {
    let common = [
      (
        "official",
        "Minecraft Launcher",
        [
          r"C:\\Program Files (x86)\\Minecraft Launcher\\MinecraftLauncher.exe",
          r"C:\\Program Files\\Minecraft Launcher\\MinecraftLauncher.exe",
        ],
      ),
      (
        "prism",
        "Prism Launcher",
        [
          r"C:\\Program Files\\PrismLauncher\\prismlauncher.exe",
          r"C:\\Program Files (x86)\\PrismLauncher\\prismlauncher.exe",
        ],
      ),
      (
        "tlauncher",
        "TLauncher",
        [
          r"C:\\Program Files\\TLauncher\\TLauncher.exe",
          r"C:\\Program Files (x86)\\TLauncher\\TLauncher.exe",
        ],
      ),
      (
        "lunar",
        "Lunar Client",
        [
          r"C:\\Program Files\\Lunar Client\\Lunar Client.exe",
          r"C:\\Program Files (x86)\\Lunar Client\\Lunar Client.exe",
        ],
      ),
      (
        "multimc",
        "MultiMC",
        [
          r"C:\\Program Files\\MultiMC\\MultiMC.exe",
          r"C:\\Program Files (x86)\\MultiMC\\MultiMC.exe",
        ],
      ),
    ];

    for (id, name, paths) in common {
      for path in paths {
        push_candidate_if_exists(&mut candidates, id, name, Path::new(path));
      }
    }

    if let Some(local_data) = dirs::data_local_dir() {
      push_candidate_if_exists(
        &mut candidates,
        "tlauncher",
        "TLauncher",
        &local_data.join("Programs").join("TLauncher").join("TLauncher.exe"),
      );
      push_candidate_if_exists(
        &mut candidates,
        "lunar",
        "Lunar Client",
        &local_data
          .join("Programs")
          .join("lunarclient")
          .join("Lunar Client.exe"),
      );
      push_candidate_if_exists(
        &mut candidates,
        "lunar",
        "Lunar Client",
        &local_data.join("LunarClient").join("Lunar Client.exe"),
      );
    }

    if let Some(roaming_data) = dirs::data_dir() {
      push_candidate_if_exists(
        &mut candidates,
        "tlauncher",
        "TLauncher",
        &roaming_data.join(".minecraft").join("TLauncher.exe"),
      );
    }
  }

  #[cfg(target_os = "macos")]
  {
    let common = [
      ("official", "Minecraft Launcher", "/Applications/Minecraft.app"),
      ("official", "Minecraft Launcher", "/Applications/Minecraft Launcher.app"),
      ("prism", "Prism Launcher", "/Applications/Prism Launcher.app"),
      ("tlauncher", "TLauncher", "/Applications/TLauncher.app"),
      ("lunar", "Lunar Client", "/Applications/Lunar Client.app"),
      ("multimc", "MultiMC", "/Applications/MultiMC.app"),
    ];

    for (id, name, path) in common {
      push_candidate_if_exists(&mut candidates, id, name, Path::new(path));
    }
  }

  candidates
}

pub async fn detect_with_timeout(timeout_ms: u64) -> LauncherResult<LauncherDetectionResult> {
  let start = Instant::now();
  let timeout_ms = timeout_ms.clamp(500, 5_000);

  let task = tokio::task::spawn_blocking(detect_installed_launchers);

  let result = timeout(Duration::from_millis(timeout_ms), task).await;

  let (candidates, timed_out) = match result {
    Ok(joined) => {
      let candidates = joined.map_err(|error| {
        LauncherError::Fs(format!("launcher detection task failed to join: {error}"))
      })?;
      (candidates, false)
    }
    Err(_) => (Vec::new(), true),
  };

  let elapsed_ms = start.elapsed().as_millis() as u64;

  #[cfg(target_os = "windows")]
  let official_maybe_uwp = !candidates.iter().any(|candidate| candidate.id == "official");

  #[cfg(not(target_os = "windows"))]
  let official_maybe_uwp = false;

  Ok(LauncherDetectionResult {
    candidates,
    timed_out,
    elapsed_ms,
    official_maybe_uwp,
  })
}

pub fn pick_manual_launcher_path() -> Option<String> {
  #[cfg(target_os = "windows")]
  {
    return rfd::FileDialog::new()
      .add_filter("Executable", &["exe"])
      .pick_file()
      .map(|path| path.to_string_lossy().to_string());
  }

  #[cfg(target_os = "macos")]
  {
    if let Some(app_path) = rfd::FileDialog::new().set_directory("/Applications").pick_folder() {
      if app_path.extension().and_then(|ext| ext.to_str()) == Some("app") {
        return Some(app_path.to_string_lossy().to_string());
      }
    }

    return rfd::FileDialog::new()
      .set_directory("/Applications")
      .pick_file()
      .map(|path| path.to_string_lossy().to_string());
  }

  #[cfg(not(any(target_os = "windows", target_os = "macos")))]
  {
    rfd::FileDialog::new()
      .pick_file()
      .map(|path| path.to_string_lossy().to_string())
  }
}

pub fn open_from_settings(settings: &AppSettings, detected: &[LauncherCandidate]) -> LauncherResult<OpenLauncherResponse> {
  let selected = resolve_selected_path(settings, detected);

  let Some(path) = selected else {
    return Ok(OpenLauncherResponse {
      opened: false,
      path: None,
      bootstrap: None,
      session: None,
    });
  };

  spawn_launcher(&path)?;

  Ok(OpenLauncherResponse {
    opened: true,
    path: Some(path),
    bootstrap: None,
    session: None,
  })
}

pub fn bootstrap_prism_instance(lock: &ProfileLock, minecraft_dir: &Path) -> LauncherResult<LauncherBootstrapResult> {
  let prism_root = prism_root_dir()?;
  let instances_root = prism_root.join("instances");
  fs::create_dir_all(&instances_root)?;

  let instance_name = server_release_name(lock);
  let instance_key = server_release_key(lock);

  let instance_dir = instances_root.join(instance_key);
  fs::create_dir_all(&instance_dir)?;

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
      .map_err(|error| LauncherError::InvalidData(format!("failed to serialize mmc-pack.json: {error}")))?,
  )?;

  let game_dir = minecraft_dir.to_string_lossy().to_string();
  let cfg = format!(
    "InstanceType=OneSix\nManagedPack=false\niconKey=default\nname={instance_name}\nOverrideGameDir=true\nGameDir={game_dir}\n"
  );
  fs::write(instance_dir.join("instance.cfg"), cfg)?;

  Ok(LauncherBootstrapResult {
    launcher_id: "prism".to_string(),
    instance_name,
    instance_path: Some(instance_dir.to_string_lossy().to_string()),
    message: "Prism instance created/updated and linked to your live Minecraft game directory.".to_string(),
  })
}

pub fn bootstrap_official_version(
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
        "Could not create official custom version yet. Missing parent version '{}' in .minecraft/versions. Install that Fabric version once, then click Open Launcher again.",
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
      .map_err(|error| LauncherError::InvalidData(format!("failed to serialize custom version json: {error}")))?,
  )?;

  upsert_official_launcher_profile(minecraft_root, &version_id, &display_name, minecraft_dir)?;

  Ok(LauncherBootstrapResult {
    launcher_id: "official".to_string(),
    instance_name: display_name,
    instance_path: Some(version_json_path.to_string_lossy().to_string()),
    message: "Official custom version + launcher profile entry created and linked to your live game directory."
      .to_string(),
  })
}

fn push_candidate_if_exists(candidates: &mut Vec<LauncherCandidate>, id: &str, name: &str, path: &Path) {
  if !path.exists() {
    return;
  }

  let text = path.to_string_lossy().to_string();
  if candidates.iter().any(|candidate| candidate.path == text) {
    return;
  }

  candidates.push(LauncherCandidate {
    id: id.to_string(),
    name: name.to_string(),
    path: text,
  });
}

pub fn resolve_selected_path(settings: &AppSettings, detected: &[LauncherCandidate]) -> Option<String> {
  if let Some(id) = settings.selected_launcher_id.as_deref() {
    if id == "custom" {
      let custom = settings.custom_launcher_path.as_deref()?.trim();
      if !custom.is_empty() {
        return Some(custom.to_string());
      }
    }

    if let Some(candidate) = detected.iter().find(|item| item.id == id) {
      return Some(candidate.path.clone());
    }
  }

  if let Some(official) = detected.iter().find(|item| item.id == "official") {
    return Some(official.path.clone());
  }

  if let Some(first) = detected.first() {
    return Some(first.path.clone());
  }

  if let Some(custom) = settings.custom_launcher_path.as_deref() {
    let trimmed = custom.trim();
    if !trimmed.is_empty() {
      return Some(trimmed.to_string());
    }
  }

  None
}

fn spawn_launcher(path: &str) -> LauncherResult<()> {
  let launcher_path = validate_launcher_path(path)?;

  #[cfg(target_os = "macos")]
  {
    if launcher_path
      .extension()
      .and_then(|ext| ext.to_str())
      .is_some_and(|ext| ext.eq_ignore_ascii_case("app"))
    {
      Command::new("open")
        .arg(&launcher_path)
        .spawn()
        .map_err(|error| LauncherError::Fs(format!("failed to open launcher app: {error}")))?;
      return Ok(());
    }

    Command::new(&launcher_path)
      .spawn()
      .map_err(|error| LauncherError::Fs(format!("failed to open launcher executable: {error}")))?;

    return Ok(());
  }

  #[cfg(target_os = "windows")]
  {
    Command::new(&launcher_path)
      .spawn()
      .map_err(|error| LauncherError::Fs(format!("failed to open launcher executable: {error}")))?;

    return Ok(());
  }

  #[cfg(not(any(target_os = "windows", target_os = "macos")))]
  {
    Command::new(&launcher_path)
      .spawn()
      .map_err(|error| LauncherError::Fs(format!("failed to open launcher executable: {error}")))?;

    Ok(())
  }
}

fn validate_launcher_path(path: &str) -> LauncherResult<PathBuf> {
  let trimmed = path.trim();
  if trimmed.is_empty() {
    return Err(LauncherError::Config("launcher path is empty".to_string()));
  }

  let candidate = PathBuf::from(trimmed);
  if !candidate.is_absolute() {
    return Err(LauncherError::Config(
      "launcher path must be an absolute path".to_string(),
    ));
  }

  if !candidate.exists() {
    return Err(LauncherError::Config(
      "launcher path does not exist".to_string(),
    ));
  }

  Ok(candidate)
}

fn prism_root_dir() -> LauncherResult<PathBuf> {
  let config_dir = dirs::config_dir()
    .ok_or_else(|| LauncherError::Fs("failed to resolve user config directory for Prism".to_string()))?;

  Ok(config_dir.join("PrismLauncher"))
}

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

pub fn server_release_name(lock: &ProfileLock) -> String {
  format!(
    "release {}-loader-{}-{}",
    slugify(&lock.branding.server_name),
    lock.loader_version,
    lock.minecraft_version
  )
}

fn server_release_key(lock: &ProfileLock) -> String {
  format!(
    "release-{}-loader-{}-{}",
    slugify(&lock.branding.server_name),
    lock.loader_version.replace('.', "-"),
    lock.minecraft_version.replace('.', "-")
  )
}

pub fn server_release_version_id(lock: &ProfileLock) -> String {
  server_release_key(lock)
}

fn upsert_official_launcher_profile(
  minecraft_root: &Path,
  version_id: &str,
  display_name: &str,
  minecraft_dir: &Path,
) -> LauncherResult<()> {
  let profiles_path = minecraft_root.join("launcher_profiles.json");

  let mut root = if profiles_path.exists() {
    let content = fs::read_to_string(&profiles_path)?;
    serde_json::from_str::<serde_json::Value>(&content)
      .map_err(|error| LauncherError::InvalidData(format!("failed to parse launcher_profiles.json: {error}")))?
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

  profiles_obj.insert(
    version_id.to_string(),
    json!({
      "name": display_name,
      "type": "custom",
      "lastVersionId": version_id,
      "gameDir": minecraft_dir.to_string_lossy().to_string(),
    }),
  );

  fs::create_dir_all(minecraft_root)?;
  fs::write(
    profiles_path,
    serde_json::to_string_pretty(&root)
      .map_err(|error| LauncherError::InvalidData(format!("failed to serialize launcher_profiles.json: {error}")))?,
  )?;

  Ok(())
}

fn slugify(input: &str) -> String {
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
