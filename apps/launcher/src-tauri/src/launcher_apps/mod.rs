use crate::{
  instance::{InstancePaths, ensure_layout, load_local_lock, resolve_launcher_minecraft_root},
  utils::*,
};
use std::sync::Arc;
use std::{
  fs,
  path::{Path, PathBuf},
  process::Command,
  time::Instant,
};

#[cfg(target_os = "windows")]
use std::{
  sync::{Mutex, OnceLock},
  time::Duration as StdDuration,
};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::Deserialize;
use serde_json::json;
use sysinfo::System;
use tokio::time::{Duration as TokioDuration, timeout};

use crate::{
  error::{LauncherError, LauncherResult},
  types::{
    AppSettings, LauncherBootstrapResult, LauncherCandidate, LauncherDetectionResult,
    OpenLauncherResponse, ProfileLock,
  },
};

const FALLBACK_PRISM_ICON_BYTES: &[u8] = include_bytes!("../../icons/icon.png");

#[cfg(target_os = "windows")]
use winreg::{
  HKEY,
  RegKey,
  enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE},
};

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
#[derive(Debug, Clone, PartialEq, Eq)]
enum LaunchTarget {
  Executable(PathBuf),
  AppUserModelId(String),
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
#[derive(Debug, Clone)]
struct DetectedLauncher {
  id: String,
  name: String,
  display_path: String,
  target: LaunchTarget,
  priority: DetectionPriority,
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum DetectionPriority {
  StoreAppUserModelId,
  ProgramFilesExecutable,
  UserLocalExecutable,
  RegistryExecutable,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Copy)]
struct WindowsLauncherSpec {
  id: &'static str,
  name: &'static str,
  executable_names: &'static [&'static str],
  match_terms: &'static [&'static str],
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
#[derive(Debug, Clone, PartialEq, Eq)]
struct StartAppEntry {
  name: String,
  app_id: String,
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum StartAppsPayload {
  One(RawStartAppEntry),
  Many(Vec<RawStartAppEntry>),
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
#[derive(Debug, Deserialize)]
struct RawStartAppEntry {
  #[serde(rename = "Name")]
  name: Option<String>,
  #[serde(rename = "AppID")]
  app_id: Option<String>,
}

#[cfg(target_os = "windows")]
fn windows_launcher_specs() -> &'static [WindowsLauncherSpec] {
  const SPECS: &[WindowsLauncherSpec] = &[
    WindowsLauncherSpec {
      id: "official",
      name: "Minecraft Launcher",
      executable_names: &["MinecraftLauncher.exe"],
      match_terms: &["minecraft launcher", "minecraftlauncher"],
    },
    WindowsLauncherSpec {
      id: "prism",
      name: "Prism Launcher",
      executable_names: &["prismlauncher.exe"],
      match_terms: &["prism launcher", "prismlauncher"],
    },
    WindowsLauncherSpec {
      id: "tlauncher",
      name: "TLauncher",
      executable_names: &["TLauncher.exe"],
      match_terms: &["tlauncher"],
    },
    WindowsLauncherSpec {
      id: "lunar",
      name: "Lunar Client",
      executable_names: &["Lunar Client.exe"],
      match_terms: &["lunar client", "lunarclient"],
    },
    WindowsLauncherSpec {
      id: "multimc",
      name: "MultiMC",
      executable_names: &["MultiMC.exe"],
      match_terms: &["multimc"],
    },
  ];

  SPECS
}

#[cfg(target_os = "windows")]
const WINDOWS_DETECTION_CACHE_TTL: StdDuration = StdDuration::from_secs(30);

#[cfg(target_os = "windows")]
const WINDOWS_STORE_APP_CACHE_TTL: StdDuration = StdDuration::from_secs(120);

#[cfg(target_os = "windows")]
const WINDOWS_UNINSTALL_SCAN_BUDGET: StdDuration = StdDuration::from_millis(900);

#[cfg(target_os = "windows")]
const WINDOWS_STORE_LOOKUP_MAX_ELAPSED: StdDuration = StdDuration::from_millis(1200);

#[cfg(target_os = "windows")]
#[derive(Debug, Clone)]
struct WindowsDetectionCacheEntry {
  captured_at: Instant,
  candidates: Vec<DetectedLauncher>,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone)]
struct WindowsStoreAppCacheEntry {
  captured_at: Instant,
  app_id: Option<String>,
}

#[cfg(target_os = "windows")]
fn windows_detection_cache() -> &'static Mutex<Option<WindowsDetectionCacheEntry>> {
  static CACHE: OnceLock<Mutex<Option<WindowsDetectionCacheEntry>>> = OnceLock::new();
  CACHE.get_or_init(|| Mutex::new(None))
}

#[cfg(target_os = "windows")]
fn windows_store_app_cache() -> &'static Mutex<Option<WindowsStoreAppCacheEntry>> {
  static CACHE: OnceLock<Mutex<Option<WindowsStoreAppCacheEntry>>> = OnceLock::new();
  CACHE.get_or_init(|| Mutex::new(None))
}

fn detect_installed_launchers_detailed() -> Vec<DetectedLauncher> {
  #[cfg(target_os = "windows")]
  {
    return detect_windows_launchers();
  }

  #[cfg(target_os = "macos")]
  {
    let mut candidates = Vec::new();
    let common = [
      ("official", "Minecraft Launcher", "/Applications/Minecraft.app"),
      ("official", "Minecraft Launcher", "/Applications/Minecraft Launcher.app"),
      ("prism", "Prism Launcher", "/Applications/Prism Launcher.app"),
      ("tlauncher", "TLauncher", "/Applications/TLauncher.app"),
      ("lunar", "Lunar Client", "/Applications/Lunar Client.app"),
      ("multimc", "MultiMC", "/Applications/MultiMC.app"),
    ];

    for (id, name, path) in common {
      push_detected_executable_if_exists(
        &mut candidates,
        id,
        name,
        Path::new(path),
        DetectionPriority::ProgramFilesExecutable,
      );
    }

    return candidates;
  }

  #[cfg(not(any(target_os = "windows", target_os = "macos")))]
  {
    Vec::new()
  }
}

pub fn detect_installed_launchers() -> Vec<LauncherCandidate> {
  let candidates = detect_installed_launchers_detailed();
  to_public_candidates(&candidates)
}

pub async fn detect_with_timeout(timeout_ms: u64) -> LauncherResult<LauncherDetectionResult> {
  let start = Instant::now();
  let timeout_ms = timeout_ms.clamp(500, 5_000);

  let task = tokio::task::spawn_blocking(detect_installed_launchers);

  let result = timeout(TokioDuration::from_millis(timeout_ms), task).await;

  let (candidates, timed_out) = match result {
    Ok(joined) => {
      let candidates = joined
        .map_err(|error| LauncherError::Fs(format!("launcher detection task failed to join: {error}")))?;
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

fn open_from_settings(
  settings: &AppSettings,
  detected: &[DetectedLauncher],
) -> LauncherResult<OpenLauncherResponse> {
  let public_detected = to_public_candidates(detected);
  let Some(selected_id) = selected_launcher_id(settings, &public_detected) else {
    return Ok(OpenLauncherResponse {
      opened: false,
      path: None,
      bootstrap: None,
      session: None,
    });
  };

  if selected_id == "custom" {
    let custom = settings
      .custom_launcher_path
      .as_deref()
      .ok_or_else(|| LauncherError::Config("launcher path is empty".to_string()))?;
    let launcher_path = validate_launcher_path(custom)?;
    spawn_launcher(&LaunchTarget::Executable(launcher_path.clone()))?;

    return Ok(OpenLauncherResponse {
      opened: true,
      path: Some(launcher_path.to_string_lossy().to_string()),
      bootstrap: None,
      session: None,
    });
  }

  let Some(launcher) = detected.iter().find(|item| item.id == selected_id) else {
    return Ok(OpenLauncherResponse {
      opened: false,
      path: None,
      bootstrap: None,
      session: None,
    });
  };

  spawn_launcher(&launcher.target)?;

  let path = match &launcher.target {
    LaunchTarget::Executable(path) => Some(path.to_string_lossy().to_string()),
    LaunchTarget::AppUserModelId(_) => None,
  };

  Ok(OpenLauncherResponse {
    opened: true,
    path,
    bootstrap: None,
    session: None,
  })
}

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

  let mut cfg = format!(
    "InstanceType=OneSix\nManagedPack=false\niconKey=default\nname={instance_name}\n"
  );

  let mut system = System::new_all();
  system.refresh_memory();
  let total_memory = system.total_memory();
  let has_more_than_16gb = total_memory >= 16 * 1024 * 1024 * 1024
    || total_memory >= 16 * 1024 * 1024;
  if has_more_than_16gb {
    cfg.push_str("OverrideMemory=true\nMinMemAlloc=1024\nMaxMemAlloc=4096\n");
  }
  fs::write(instance_dir.join("instance.cfg"), cfg)?;

  #[cfg(target_os = "macos")]
  let minecraft_folder = "minecraft";
  #[cfg(not(target_os = "macos"))]
  let minecraft_folder = ".minecraft";

  let minecraft_dir = instance_dir.join(minecraft_folder);
  let icon_path = minecraft_dir.join("icon.png");
  let instance_icon_path = instance_dir.join("icon.png");

  let mut icon_written = false;
  if let Some(logo_url) = lock.branding.logo_url.as_deref() {
    let client = state.http.clone();
    if let Ok(response) = client.get(logo_url).send().await {
      if response.status().is_success() {
        if let Ok(bytes) = response.bytes().await {
          let _ = fs::create_dir_all(&minecraft_dir);
          let _ = fs::write(&icon_path, &bytes);
          let _ = fs::write(&instance_icon_path, &bytes);
          icon_written = true;
        }
      }
    }
  }

  if !icon_written {
    let _ = fs::create_dir_all(&minecraft_dir);
    let _ = fs::write(&icon_path, FALLBACK_PRISM_ICON_BYTES);
    let _ = fs::write(&instance_icon_path, FALLBACK_PRISM_ICON_BYTES);
  }

  Ok(LauncherBootstrapResult {
    launcher_id: "prism".to_string(),
    instance_name,
    instance_path: Some(instance_dir.to_string_lossy().to_string()),
    message: "Prism instance created/updated.".to_string(),
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

fn push_detected_executable_if_exists(
  candidates: &mut Vec<DetectedLauncher>,
  id: &str,
  name: &str,
  path: &Path,
  priority: DetectionPriority,
) {
  if !path.exists() {
    return;
  }

  upsert_detected_launcher(
    candidates,
    DetectedLauncher {
      id: id.to_string(),
      name: name.to_string(),
      display_path: path.to_string_lossy().to_string(),
      target: LaunchTarget::Executable(path.to_path_buf()),
      priority,
    },
  );
}

fn upsert_detected_launcher(candidates: &mut Vec<DetectedLauncher>, candidate: DetectedLauncher) {
  if let Some(existing) = candidates.iter_mut().find(|item| item.id == candidate.id) {
    if candidate.priority > existing.priority {
      *existing = candidate;
    }
    return;
  }

  candidates.push(candidate);
}

fn to_public_candidates(candidates: &[DetectedLauncher]) -> Vec<LauncherCandidate> {
  candidates
    .iter()
    .map(|candidate| LauncherCandidate {
      id: candidate.id.clone(),
      name: candidate.name.clone(),
      path: candidate.display_path.clone(),
    })
    .collect()
}

pub fn preferred_detected_launcher_id(candidates: &[LauncherCandidate]) -> Option<String> {
  preferred_detected_launcher_id_with_strategy(candidates, true)
}

fn preferred_detected_launcher_id_with_strategy(
  candidates: &[LauncherCandidate],
  prefer_prism: bool,
) -> Option<String> {
  let detected: Vec<&LauncherCandidate> = candidates
    .iter()
    .filter(|candidate| candidate.id != "custom")
    .collect();

  if prefer_prism && detected.iter().any(|candidate| candidate.id == "prism") {
    return Some("prism".to_string());
  }

  if detected.iter().any(|candidate| candidate.id == "official") {
    return Some("official".to_string());
  }

  detected.first().map(|candidate| candidate.id.clone())
}

pub fn selected_launcher_id(settings: &AppSettings, detected: &[LauncherCandidate]) -> Option<String> {
  selected_launcher_id_with_strategy(settings, detected, true)
}

fn selected_launcher_id_with_strategy(
  settings: &AppSettings,
  detected: &[LauncherCandidate],
  prefer_prism: bool,
) -> Option<String> {
  if settings
    .selected_launcher_id
    .as_deref()
    .is_some_and(|id| id == "custom")
  {
    let custom = settings.custom_launcher_path.as_deref()?.trim();
    if !custom.is_empty() {
      return Some("custom".to_string());
    }
  }

  if let Some(id) = settings.selected_launcher_id.as_deref() {
    if detected.iter().any(|candidate| candidate.id == id) {
      return Some(id.to_string());
    }
  }

  preferred_detected_launcher_id_with_strategy(detected, prefer_prism)
}

fn spawn_launcher(target: &LaunchTarget) -> LauncherResult<()> {
  match target {
    LaunchTarget::Executable(path) => spawn_executable_launcher(path),
    LaunchTarget::AppUserModelId(app_id) => spawn_store_app_launcher(app_id),
  }
}

fn spawn_executable_launcher(path: &Path) -> LauncherResult<()> {
  let launcher_path = validate_launcher_path_buf(path)?;

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
  }

  Command::new(&launcher_path)
    .spawn()
    .map_err(|error| LauncherError::Fs(format!("failed to open launcher executable: {error}")))?;

  Ok(())
}

fn spawn_store_app_launcher(app_id: &str) -> LauncherResult<()> {
  #[cfg(target_os = "windows")]
  {
    Command::new("explorer.exe")
      .arg(format!(r"shell:AppsFolder\{app_id}"))
      .spawn()
      .map_err(|error| LauncherError::Fs(format!("failed to open Microsoft Store launcher: {error}")))?;
    return Ok(());
  }

  #[cfg(not(target_os = "windows"))]
  {
    let _ = app_id;
    Err(LauncherError::Config(
      "Microsoft Store launcher targets are only supported on Windows".to_string(),
    ))
  }
}

fn validate_launcher_path(path: &str) -> LauncherResult<PathBuf> {
  let trimmed = path.trim();
  if trimmed.is_empty() {
    return Err(LauncherError::Config("launcher path is empty".to_string()));
  }

  validate_launcher_path_buf(Path::new(trimmed))
}

fn validate_launcher_path_buf(path: &Path) -> LauncherResult<PathBuf> {
  let candidate = path.to_path_buf();
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

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
fn normalize_windows_executable_candidate(raw: &str) -> Option<PathBuf> {
  let trimmed = raw.trim().trim_matches('"');
  if trimmed.is_empty() {
    return None;
  }

  let lower = trimmed.to_ascii_lowercase();
  let index = lower.find(".exe")?;
  Some(PathBuf::from(trimmed[..index + 4].trim_matches('"').trim()))
}

#[cfg(target_os = "windows")]
fn detect_windows_launchers() -> Vec<DetectedLauncher> {
  {
    let cache = windows_detection_cache().lock().unwrap_or_else(|e| e.into_inner());
    if let Some(entry) = cache.as_ref() {
      if entry.captured_at.elapsed() < WINDOWS_DETECTION_CACHE_TTL {
        return entry.candidates.clone();
      }
    }
  }

  let detection_start = Instant::now();
  let mut candidates = Vec::new();

  probe_registry_app_paths(&mut candidates);
  probe_registry_uninstall_entries(&mut candidates, WINDOWS_UNINSTALL_SCAN_BUDGET);
  probe_windows_filesystem_fallbacks(&mut candidates);

  if !candidates.iter().any(|candidate| candidate.id == "official")
    && detection_start.elapsed() < WINDOWS_STORE_LOOKUP_MAX_ELAPSED
  {
    if let Some(app_id) = resolve_official_store_app_id_cached() {
      upsert_detected_launcher(
        &mut candidates,
        DetectedLauncher {
          id: "official".to_string(),
          name: "Minecraft Launcher".to_string(),
          display_path: "Microsoft Store app".to_string(),
          target: LaunchTarget::AppUserModelId(app_id),
          priority: DetectionPriority::StoreAppUserModelId,
        },
      );
    }
  }

  candidates.sort_by_key(|candidate| windows_launcher_sort_key(&candidate.id));

  {
    let mut cache = windows_detection_cache().lock().unwrap_or_else(|e| e.into_inner());
    *cache = Some(WindowsDetectionCacheEntry {
      captured_at: Instant::now(),
      candidates: candidates.clone(),
    });
  }

  candidates
}

#[cfg(target_os = "windows")]
fn windows_launcher_sort_key(id: &str) -> usize {
  match id {
    "official" => 0,
    "prism" => 1,
    "multimc" => 2,
    "lunar" => 3,
    "tlauncher" => 4,
    _ => 10,
  }
}

#[cfg(target_os = "windows")]
fn probe_registry_app_paths(candidates: &mut Vec<DetectedLauncher>) {
  const APP_PATHS_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\App Paths";

  for hive in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
    let root = RegKey::predef(hive);
    let Ok(app_paths) = root.open_subkey(APP_PATHS_KEY) else {
      continue;
    };

    for spec in windows_launcher_specs() {
      for exe_name in spec.executable_names {
        let Ok(subkey) = app_paths.open_subkey(exe_name) else {
          continue;
        };

        let Ok(raw_path) = subkey.get_value::<String, _>("") else {
          continue;
        };

        let Some(path) = normalize_windows_executable_candidate(&raw_path) else {
          continue;
        };

        if !path.exists() {
          continue;
        }

        upsert_detected_launcher(
          candidates,
          DetectedLauncher {
            id: spec.id.to_string(),
            name: spec.name.to_string(),
            display_path: path.to_string_lossy().to_string(),
            target: LaunchTarget::Executable(path),
            priority: DetectionPriority::RegistryExecutable,
          },
        );
      }
    }
  }
}

#[cfg(target_os = "windows")]
fn probe_registry_uninstall_entries(
  candidates: &mut Vec<DetectedLauncher>,
  scan_budget: StdDuration,
) {
  const UNINSTALL_KEYS: &[(HKEY, &str)] = &[
    (HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Uninstall"),
    (HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Uninstall"),
    (
      HKEY_LOCAL_MACHINE,
      r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    ),
  ];

  let started = Instant::now();
  for (hive, key_path) in UNINSTALL_KEYS {
    if started.elapsed() >= scan_budget {
      break;
    }

    let root = RegKey::predef(*hive);
    let Ok(uninstall_root) = root.open_subkey(key_path) else {
      continue;
    };

    for subkey_name in uninstall_root.enum_keys().flatten() {
      if started.elapsed() >= scan_budget {
        break;
      }

      let Ok(subkey) = uninstall_root.open_subkey(&subkey_name) else {
        continue;
      };

      let display_name = subkey.get_value::<String, _>("DisplayName").ok();
      let display_icon = subkey.get_value::<String, _>("DisplayIcon").ok();
      let install_location = subkey.get_value::<String, _>("InstallLocation").ok();

      let Some(spec) = match_windows_launcher_spec(
        display_name.as_deref(),
        display_icon.as_deref(),
        install_location.as_deref(),
      ) else {
        continue;
      };

      let Some(path) = resolve_uninstall_candidate_path(
        spec,
        display_icon.as_deref(),
        install_location.as_deref(),
      ) else {
        continue;
      };

      if !path.exists() {
        continue;
      }

      upsert_detected_launcher(
        candidates,
        DetectedLauncher {
          id: spec.id.to_string(),
          name: spec.name.to_string(),
          display_path: path.to_string_lossy().to_string(),
          target: LaunchTarget::Executable(path),
          priority: DetectionPriority::RegistryExecutable,
        },
      );
    }
  }
}

#[cfg(target_os = "windows")]
fn match_windows_launcher_spec(
  display_name: Option<&str>,
  display_icon: Option<&str>,
  install_location: Option<&str>,
) -> Option<&'static WindowsLauncherSpec> {
  let haystack = [
    display_name.unwrap_or_default(),
    display_icon.unwrap_or_default(),
    install_location.unwrap_or_default(),
  ]
  .join(" ")
  .to_ascii_lowercase();

  windows_launcher_specs()
    .iter()
    .find(|spec| spec.match_terms.iter().any(|term| haystack.contains(term)))
}

#[cfg(target_os = "windows")]
fn resolve_uninstall_candidate_path(
  spec: &WindowsLauncherSpec,
  display_icon: Option<&str>,
  install_location: Option<&str>,
) -> Option<PathBuf> {
  if let Some(path) = display_icon
    .and_then(normalize_windows_executable_candidate)
    .filter(|path| path_matches_spec(path, spec))
  {
    return Some(path);
  }

  let install_location = install_location
    .map(|value| value.trim().trim_matches('"'))
    .filter(|value| !value.is_empty())?;
  let base = PathBuf::from(install_location);

  if base.is_file() && path_matches_spec(&base, spec) {
    return Some(base);
  }

  spec
    .executable_names
    .iter()
    .map(|exe| base.join(exe))
    .find(|candidate| candidate.exists())
}

#[cfg(target_os = "windows")]
fn path_matches_spec(path: &Path, spec: &WindowsLauncherSpec) -> bool {
  let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
    return false;
  };

  spec
    .executable_names
    .iter()
    .any(|exe| file_name.eq_ignore_ascii_case(exe))
}

#[cfg(target_os = "windows")]
fn probe_windows_filesystem_fallbacks(candidates: &mut Vec<DetectedLauncher>) {
  let program_files = [
    (
      "official",
      "Minecraft Launcher",
      r"C:\\Program Files (x86)\\Minecraft Launcher\\MinecraftLauncher.exe",
      DetectionPriority::ProgramFilesExecutable,
    ),
    (
      "official",
      "Minecraft Launcher",
      r"C:\\Program Files\\Minecraft Launcher\\MinecraftLauncher.exe",
      DetectionPriority::ProgramFilesExecutable,
    ),
    (
      "prism",
      "Prism Launcher",
      r"C:\\Program Files\\PrismLauncher\\prismlauncher.exe",
      DetectionPriority::ProgramFilesExecutable,
    ),
    (
      "prism",
      "Prism Launcher",
      r"C:\\Program Files (x86)\\PrismLauncher\\prismlauncher.exe",
      DetectionPriority::ProgramFilesExecutable,
    ),
    (
      "tlauncher",
      "TLauncher",
      r"C:\\Program Files\\TLauncher\\TLauncher.exe",
      DetectionPriority::ProgramFilesExecutable,
    ),
    (
      "tlauncher",
      "TLauncher",
      r"C:\\Program Files (x86)\\TLauncher\\TLauncher.exe",
      DetectionPriority::ProgramFilesExecutable,
    ),
    (
      "lunar",
      "Lunar Client",
      r"C:\\Program Files\\Lunar Client\\Lunar Client.exe",
      DetectionPriority::ProgramFilesExecutable,
    ),
    (
      "lunar",
      "Lunar Client",
      r"C:\\Program Files (x86)\\Lunar Client\\Lunar Client.exe",
      DetectionPriority::ProgramFilesExecutable,
    ),
    (
      "multimc",
      "MultiMC",
      r"C:\\Program Files\\MultiMC\\MultiMC.exe",
      DetectionPriority::ProgramFilesExecutable,
    ),
    (
      "multimc",
      "MultiMC",
      r"C:\\Program Files (x86)\\MultiMC\\MultiMC.exe",
      DetectionPriority::ProgramFilesExecutable,
    ),
  ];

  for (id, name, path, priority) in program_files {
    push_detected_executable_if_exists(candidates, id, name, Path::new(path), priority);
  }

  if let Some(local_data) = dirs::data_local_dir() {
    push_detected_executable_if_exists(
      candidates,
      "official",
      "Minecraft Launcher",
      &local_data
        .join("Microsoft")
        .join("WindowsApps")
        .join("MinecraftLauncher.exe"),
      DetectionPriority::UserLocalExecutable,
    );
    push_detected_executable_if_exists(
      candidates,
      "prism",
      "Prism Launcher",
      &local_data
        .join("Programs")
        .join("PrismLauncher")
        .join("prismlauncher.exe"),
      DetectionPriority::UserLocalExecutable,
    );
    push_detected_executable_if_exists(
      candidates,
      "tlauncher",
      "TLauncher",
      &local_data.join("Programs").join("TLauncher").join("TLauncher.exe"),
      DetectionPriority::UserLocalExecutable,
    );
    push_detected_executable_if_exists(
      candidates,
      "lunar",
      "Lunar Client",
      &local_data
        .join("Programs")
        .join("lunarclient")
        .join("Lunar Client.exe"),
      DetectionPriority::UserLocalExecutable,
    );
    push_detected_executable_if_exists(
      candidates,
      "lunar",
      "Lunar Client",
      &local_data.join("LunarClient").join("Lunar Client.exe"),
      DetectionPriority::UserLocalExecutable,
    );
  }

  if let Some(roaming_data) = dirs::data_dir() {
    push_detected_executable_if_exists(
      candidates,
      "tlauncher",
      "TLauncher",
      &roaming_data.join(".minecraft").join("TLauncher.exe"),
      DetectionPriority::UserLocalExecutable,
    );
  }
}

#[cfg(target_os = "windows")]
fn resolve_official_store_app_id() -> Option<String> {
  const CREATE_NO_WINDOW: u32 = 0x08000000;
  let command = "Get-StartApps | Where-Object { $_.Name -match 'Minecraft' -or $_.AppID -match 'Minecraft' } | Select-Object Name, AppID | ConvertTo-Json -Compress";

  let output = Command::new("powershell")
    .creation_flags(CREATE_NO_WINDOW)
    .args(["-NoProfile", "-Command", command])
    .output()
    .ok()?;

  if !output.status.success() {
    return None;
  }

  let payload = String::from_utf8_lossy(&output.stdout);
  official_store_app_id_from_json(&payload)
}

#[cfg(target_os = "windows")]
fn resolve_official_store_app_id_cached() -> Option<String> {
  {
    let cache = windows_store_app_cache().lock().unwrap_or_else(|e| e.into_inner());
    if let Some(entry) = cache.as_ref() {
      if entry.captured_at.elapsed() < WINDOWS_STORE_APP_CACHE_TTL {
        return entry.app_id.clone();
      }
    }
  }

  let resolved = resolve_official_store_app_id();
  let mut cache = windows_store_app_cache().lock().unwrap_or_else(|e| e.into_inner());
  *cache = Some(WindowsStoreAppCacheEntry {
    captured_at: Instant::now(),
    app_id: resolved.clone(),
  });
  resolved
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
fn official_store_app_id_from_json(payload: &str) -> Option<String> {
  parse_start_apps_json(payload)
    .into_iter()
    .find(|entry| is_official_store_app(entry))
    .map(|entry| entry.app_id)
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
fn parse_start_apps_json(payload: &str) -> Vec<StartAppEntry> {
  let trimmed = payload.trim();
  if trimmed.is_empty() {
    return Vec::new();
  }

  let Ok(parsed) = serde_json::from_str::<StartAppsPayload>(trimmed) else {
    return Vec::new();
  };

  match parsed {
    StartAppsPayload::One(entry) => start_app_from_raw(entry).into_iter().collect(),
    StartAppsPayload::Many(entries) => entries.into_iter().filter_map(start_app_from_raw).collect(),
  }
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
fn start_app_from_raw(entry: RawStartAppEntry) -> Option<StartAppEntry> {
  let name = entry.name?.trim().to_string();
  let app_id = entry.app_id?.trim().to_string();
  if name.is_empty() || app_id.is_empty() {
    return None;
  }

  Some(StartAppEntry { name, app_id })
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
fn is_official_store_app(entry: &StartAppEntry) -> bool {
  let name = entry.name.to_ascii_lowercase();
  let app_id = entry.app_id.to_ascii_lowercase();
  name.contains("minecraft launcher")
    || name == "minecraft"
    || app_id.contains("minecraftlauncher")
    || app_id.contains("minecraft")
}

pub fn prism_root_dir() -> LauncherResult<PathBuf> {
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
    serde_json::from_str::<serde_json::Value>(&content).map_err(|error| {
      LauncherError::InvalidData(format!("failed to parse launcher_profiles.json: {error}"))
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
    serde_json::to_string_pretty(&root).map_err(|error| {
      LauncherError::InvalidData(format!("failed to serialize launcher_profiles.json: {error}"))
    })?,
  )?;

  Ok(())
}

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

pub async fn open_game(
  app: &tauri::AppHandle,
  state: std::sync::Arc<crate::state::AppState>,
  server_id: &str,
) -> Result<crate::types::OpenLauncherResponse, String> {
  let settings = state.settings.lock().clone();
  let detected = detect_installed_launchers_detailed();
  let public_detected = to_public_candidates(&detected);
  let selected_id = selected_launcher_id(&settings, &public_detected);
  let selected_launcher = selected_id
    .clone()
    .unwrap_or_else(|| "unknown".to_string());
  let effective_server = effective_server_id(state.as_ref(), server_id);
  let (minecraft_root, _) =
    resolve_launcher_minecraft_root(&settings).map_err(|e| format!("{e}"))?;

  let mut pending_bootstrap: Option<LauncherBootstrapResult> = None;

  if selected_id.as_deref() == Some("prism") || selected_id.as_deref() == Some("official") {
    let mut paths = InstancePaths::new(
      &state.config,
      &effective_server,
      &settings.install_mode,
      settings.minecraft_root_override.as_deref(),
    )
    .map_err(|e| format!("{e}"))?;

    let lock = load_local_lock(&paths)
      .map_err(|e| format!("{e}"))?
      .or(crate::profile::fetch_remote_lock(state.as_ref(), &effective_server).await.ok());

    if selected_id.as_deref() == Some("prism") {
      if let Some(ref l) = lock {
        let _ = paths.apply_prism(l);
      }
    }

    ensure_layout(&paths).map_err(|e| format!("{e}"))?;

    if let Some(remote) = lock.as_ref() {
      if remote.loader == "fabric" {
        let _ = crate::runtime::ensure_fabric_runtime(
          state.as_ref(),
          &minecraft_root,
          &remote.minecraft_version,
          &remote.loader_version,
        )
        .await
        .map_err(|e| format!("{e}"))?;
      }
    }

    pending_bootstrap = Some(match (selected_id.as_deref(), lock) {
      (Some("prism"), Some(lock)) => crate::launcher_apps::bootstrap_prism_instance(&state, &lock)
        .await
        .map_err(|e| format!("{e}"))?,
      (Some("official"), Some(lock)) => crate::launcher_apps::bootstrap_official_version(
        &lock,
        &minecraft_root,
        &minecraft_root,
      )
      .map_err(|e| format!("{e}"))?,
      (Some(id), None::<crate::types::ProfileLock>) => LauncherBootstrapResult {
        launcher_id: id.to_string(),
        instance_name: "Not created".to_string(),
        instance_path: None,
        message: "Sync profile first so launcher bootstrap can be generated.".to_string(),
      },
      _ => LauncherBootstrapResult {
        launcher_id: "unknown".to_string(),
        instance_name: "Not created".to_string(),
        instance_path: None,
        message: "Launcher bootstrap skipped.".to_string(),
      },
    });
  }

  let paths = InstancePaths::new(
    &state.config,
    &effective_server,
    &settings.install_mode,
    settings.minecraft_root_override.as_deref(),
  )
  .map_err(|e| format!("{e}"))?;

  let live_mc_dir = if selected_id.as_deref() == Some("prism") {
    let mut modified_paths = paths.clone();
    let lock = load_local_lock(&paths)
      .map_err(|e| format!("{e}"))?
      .or(crate::profile::fetch_remote_lock(state.as_ref(), &effective_server).await.ok());

    if let Some(ref l) = lock {
      let _ = modified_paths.apply_prism(l);
    }
    modified_paths.minecraft_dir
  } else {
    minecraft_root.clone()
  };

  let session = crate::session::start_or_get_session(
    app,
    Arc::clone(&state),
    &effective_server,
    &selected_launcher,
    &live_mc_dir,
  )
  .await
  .map_err(|e| format!("{e}"))?;

  let mut response = match open_from_settings(&settings, &detected) {
    Ok(value) => value,
    Err(error) => {
      let _ = crate::session::restore_active_session(app, Arc::clone(&state)).await;
      return Err(error.to_string());
    }
  };
  response.bootstrap = pending_bootstrap;
  response.session = Some(session.clone());

  if !response.opened {
    let _ = crate::session::restore_active_session(app, Arc::clone(&state)).await;
    response.session = Some(crate::session::get_status(state.as_ref()));
  }

  Ok(response)
}

pub fn managed_version_exists(minecraft_root: &Path, version_id: &str) -> bool {
  minecraft_root
    .join("versions")
    .join(version_id)
    .join(format!("{version_id}.json"))
    .exists()
}

#[cfg(test)]
mod tests {
  use super::*;

  fn candidate(id: &str) -> LauncherCandidate {
    LauncherCandidate {
      id: id.to_string(),
      name: id.to_string(),
      path: format!("{id}-path"),
    }
  }

  #[test]
  fn normalizes_windows_executable_from_uninstall_icon() {
    let normalized = normalize_windows_executable_candidate(
      r#""C:\Users\isaac\AppData\Local\Programs\PrismLauncher\prismlauncher.exe",0"#,
    );

    assert_eq!(
      normalized,
      Some(PathBuf::from(
        r"C:\Users\isaac\AppData\Local\Programs\PrismLauncher\prismlauncher.exe"
      ))
    );
  }

  #[test]
  fn keeps_highest_priority_candidate_per_launcher_id() {
    let mut candidates = Vec::new();
    upsert_detected_launcher(
      &mut candidates,
      DetectedLauncher {
        id: "official".to_string(),
        name: "Minecraft Launcher".to_string(),
        display_path: "program-files".to_string(),
        target: LaunchTarget::Executable(PathBuf::from(r"C:\Program Files\Minecraft Launcher\MinecraftLauncher.exe")),
        priority: DetectionPriority::ProgramFilesExecutable,
      },
    );
    upsert_detected_launcher(
      &mut candidates,
      DetectedLauncher {
        id: "official".to_string(),
        name: "Minecraft Launcher".to_string(),
        display_path: "registry".to_string(),
        target: LaunchTarget::Executable(PathBuf::from(r"C:\Users\isaac\AppData\Local\Microsoft\WindowsApps\MinecraftLauncher.exe")),
        priority: DetectionPriority::RegistryExecutable,
      },
    );

    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0].display_path, "registry");
    assert_eq!(candidates[0].priority, DetectionPriority::RegistryExecutable);
  }

  #[test]
  fn prefers_prism_on_windows_when_saved_selection_is_invalid() {
    let settings = AppSettings {
      selected_launcher_id: Some("lunar".to_string()),
      ..AppSettings::default()
    };
    let detected = vec![candidate("official"), candidate("prism")];

    let selected = selected_launcher_id_with_strategy(&settings, &detected, true);

    assert_eq!(selected.as_deref(), Some("prism"));
  }

  #[test]
  fn keeps_valid_saved_selection_even_when_prism_is_available() {
    let settings = AppSettings {
      selected_launcher_id: Some("official".to_string()),
      ..AppSettings::default()
    };
    let detected = vec![candidate("official"), candidate("prism")];

    let selected = selected_launcher_id_with_strategy(&settings, &detected, true);

    assert_eq!(selected.as_deref(), Some("official"));
  }

  #[test]
  fn parses_start_apps_json_and_extracts_official_app_id() {
    let payload = r#"[{"Name":"Minecraft Launcher","AppID":"Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft"},{"Name":"Notepad","AppID":"Microsoft.WindowsNotepad_8wekyb3d8bbwe!App"}]"#;

    let parsed = parse_start_apps_json(payload);
    let official = official_store_app_id_from_json(payload);

    assert_eq!(parsed.len(), 2);
    assert_eq!(
      official.as_deref(),
      Some("Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft")
    );
  }
}
