/// Windows-specific launcher detection: registry probing, filesystem fallbacks,
/// Microsoft Store app lookup, caching, and telemetry.
///
/// Pure text-parsing helpers (`parse_start_apps_json`, etc.) are compiled on all
/// platforms so they can be exercised by unit tests on macOS / Linux as well.
#[cfg(target_os = "windows")]
use std::time::Instant;

#[cfg(target_os = "windows")]
use std::{
  path::Path,
  process::Command,
  sync::{Mutex, OnceLock},
  time::Duration as StdDuration,
  os::windows::process::CommandExt,
};

#[cfg(target_os = "windows")]
use winreg::{
  HKEY,
  RegKey,
  enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE},
};

#[cfg(target_os = "windows")]
use serde_json::json;
#[cfg(target_os = "windows")]
use std::time::Instant;

use std::path::PathBuf;

// Only the parsing helpers (parse_start_apps_json etc.) are compiled on all
// platforms — they only need StartApp* types.
#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
use super::types::{RawStartAppEntry, StartAppEntry, StartAppsPayload};

// Detection-side types are only needed on Windows.
#[cfg(target_os = "windows")]
use super::types::{DetectedLauncher, DetectionPriority, LaunchTarget};

#[cfg(target_os = "windows")]
use super::types::WindowsLauncherSpec;

#[cfg(target_os = "windows")]
use super::detection::{push_detected_executable_if_exists, upsert_detected_launcher};

// ─── Constants ───────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
pub(crate) const WINDOWS_DETECTION_CACHE_TTL: StdDuration = StdDuration::from_secs(30);

#[cfg(target_os = "windows")]
pub(crate) const WINDOWS_STORE_APP_CACHE_TTL: StdDuration = StdDuration::from_secs(120);

#[cfg(target_os = "windows")]
const WINDOWS_UNINSTALL_SCAN_BUDGET: StdDuration = StdDuration::from_millis(900);

#[cfg(target_os = "windows")]
const WINDOWS_STORE_LOOKUP_MAX_ELAPSED: StdDuration = StdDuration::from_millis(1200);

#[cfg(target_os = "windows")]
pub(crate) const WINDOWS_DETECTION_SLOW_MS: u64 = 1_500;

#[cfg(target_os = "windows")]
const WINDOWS_DETECTION_TELEMETRY_SAMPLE_WINDOW: usize = 64;

#[cfg(target_os = "windows")]
const WINDOWS_DETECTION_TELEMETRY_EVERY: u64 = 10;

// ─── Cache entries ────────────────────────────────────────────────────────────

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

// ─── Telemetry ────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
#[derive(Debug, Default)]
struct WindowsDetectionTelemetryState {
  total_runs: u64,
  slow_runs: u64,
  timed_out_runs: u64,
  samples_ms: Vec<u64>,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone)]
pub(crate) struct WindowsDetectionTelemetrySnapshot {
  pub(crate) total_runs: u64,
  pub(crate) slow_runs: u64,
  pub(crate) timed_out_runs: u64,
  pub(crate) avg_ms: u64,
  pub(crate) p95_ms: u64,
}

// ─── Singleton caches ─────────────────────────────────────────────────────────

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

#[cfg(target_os = "windows")]
fn windows_detection_telemetry_state() -> &'static Mutex<WindowsDetectionTelemetryState> {
  static STATE: OnceLock<Mutex<WindowsDetectionTelemetryState>> = OnceLock::new();
  STATE.get_or_init(|| Mutex::new(WindowsDetectionTelemetryState::default()))
}

// ─── Telemetry recording ──────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
pub(crate) fn record_windows_detection_sample(
  elapsed_ms: u64,
  timed_out: bool,
) -> WindowsDetectionTelemetrySnapshot {
  let mut state = windows_detection_telemetry_state()
    .lock()
    .unwrap_or_else(|e| e.into_inner());

  state.total_runs = state.total_runs.saturating_add(1);
  if timed_out {
    state.timed_out_runs = state.timed_out_runs.saturating_add(1);
  }
  if elapsed_ms >= WINDOWS_DETECTION_SLOW_MS {
    state.slow_runs = state.slow_runs.saturating_add(1);
  }

  state.samples_ms.push(elapsed_ms);
  if state.samples_ms.len() > WINDOWS_DETECTION_TELEMETRY_SAMPLE_WINDOW {
    let overflow = state.samples_ms.len() - WINDOWS_DETECTION_TELEMETRY_SAMPLE_WINDOW;
    state.samples_ms.drain(..overflow);
  }

  let avg_ms = if state.samples_ms.is_empty() {
    0
  } else {
    state.samples_ms.iter().sum::<u64>() / (state.samples_ms.len() as u64)
  };

  let mut sorted = state.samples_ms.clone();
  sorted.sort_unstable();
  let p95_ms = if sorted.is_empty() {
    0
  } else {
    let idx = (sorted.len() - 1) * 95 / 100;
    sorted[idx]
  };

  WindowsDetectionTelemetrySnapshot {
    total_runs: state.total_runs,
    slow_runs: state.slow_runs,
    timed_out_runs: state.timed_out_runs,
    avg_ms,
    p95_ms,
  }
}

// ─── Launcher specs ───────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
pub(crate) fn windows_launcher_specs() -> &'static [WindowsLauncherSpec] {
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

// ─── Main Windows detection entry-point ──────────────────────────────────────

#[cfg(target_os = "windows")]
pub(crate) fn detect_windows_launchers() -> Vec<DetectedLauncher> {
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

  let app_paths_started = Instant::now();
  probe_registry_app_paths(&mut candidates);
  let app_paths_ms = app_paths_started.elapsed().as_millis() as u64;

  let uninstall_started = Instant::now();
  probe_registry_uninstall_entries(&mut candidates, WINDOWS_UNINSTALL_SCAN_BUDGET);
  let uninstall_ms = uninstall_started.elapsed().as_millis() as u64;

  let fallback_started = Instant::now();
  probe_windows_filesystem_fallbacks(&mut candidates);
  let fallback_ms = fallback_started.elapsed().as_millis() as u64;

  let mut store_lookup_ms: Option<u64> = None;
  let mut store_lookup_skipped = false;

  if !candidates.iter().any(|c| c.id == "official")
    && detection_start.elapsed() < WINDOWS_STORE_LOOKUP_MAX_ELAPSED
  {
    let store_lookup_started = Instant::now();
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
    store_lookup_ms = Some(store_lookup_started.elapsed().as_millis() as u64);
  } else if !candidates.iter().any(|c| c.id == "official") {
    store_lookup_skipped = true;
  }

  candidates.sort_by_key(|c| windows_launcher_sort_key(&c.id));

  let total_ms = detection_start.elapsed().as_millis() as u64;
  let details = json!({
    "cacheHit": false,
    "totalMs": total_ms,
    "appPathsMs": app_paths_ms,
    "uninstallMs": uninstall_ms,
    "fallbackMs": fallback_ms,
    "storeLookupMs": store_lookup_ms,
    "storeLookupSkipped": store_lookup_skipped,
    "candidateCount": candidates.len()
  });
  let details_payload = details.to_string();
  crate::telemetry::record_structured_event(
    "launcher.detect.windows",
    "windows launcher detection stages",
    Some(details_payload.as_str()),
  );

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

// ─── Registry: App Paths ──────────────────────────────────────────────────────

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

// ─── Registry: Uninstall entries ─────────────────────────────────────────────

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
    .map(|v| v.trim().trim_matches('"'))
    .filter(|v| !v.is_empty())?;
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
  let Some(file_name) = path.file_name().and_then(|v| v.to_str()) else {
    return false;
  };

  spec
    .executable_names
    .iter()
    .any(|exe| file_name.eq_ignore_ascii_case(exe))
}

// ─── Filesystem fallbacks ─────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn probe_windows_filesystem_fallbacks(candidates: &mut Vec<DetectedLauncher>) {
  let program_files: &[(&str, &str, &str, DetectionPriority)] = &[
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
    push_detected_executable_if_exists(candidates, id, name, Path::new(path), *priority);
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

// ─── Microsoft Store app lookup ───────────────────────────────────────────────

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
pub(crate) fn resolve_official_store_app_id_cached() -> Option<String> {
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

// ─── Pure JSON parsing (compiled everywhere for tests) ───────────────────────

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
pub(crate) fn official_store_app_id_from_json(payload: &str) -> Option<String> {
  parse_start_apps_json(payload)
    .into_iter()
    .find(|entry| is_official_store_app(entry))
    .map(|entry| entry.app_id)
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
pub(crate) fn parse_start_apps_json(payload: &str) -> Vec<StartAppEntry> {
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
pub(crate) fn is_official_store_app(entry: &StartAppEntry) -> bool {
  let name = entry.name.to_ascii_lowercase();
  let app_id = entry.app_id.to_ascii_lowercase();
  name.contains("minecraft launcher")
    || name == "minecraft"
    || app_id.contains("minecraftlauncher")
    || app_id.contains("minecraft")
}

// ─── Executable path normalization ───────────────────────────────────────────

/// Strips trailing `,<index>` suffixes and surrounding quotes from a raw
/// `DisplayIcon` registry value, returning the path up to and including `.exe`.
#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
pub(crate) fn normalize_windows_executable_candidate(raw: &str) -> Option<PathBuf> {
  let trimmed = raw.trim().trim_matches('"');
  if trimmed.is_empty() {
    return None;
  }
  let lower = trimmed.to_ascii_lowercase();
  let index = lower.find(".exe")?;
  Some(PathBuf::from(trimmed[..index + 4].trim_matches('"').trim()))
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
  use super::*;

  // ── normalize_windows_executable_candidate ──────────────────────────────

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
  fn normalize_returns_none_for_empty_string() {
    assert_eq!(normalize_windows_executable_candidate(""), None);
    assert_eq!(normalize_windows_executable_candidate("   "), None);
  }

  #[test]
  fn normalize_returns_none_when_no_exe_extension() {
    assert_eq!(
      normalize_windows_executable_candidate(r"C:\foo\bar.dll"),
      None
    );
  }

  #[test]
  fn normalize_handles_path_without_suffix() {
    let result =
      normalize_windows_executable_candidate(r"C:\Program Files\Minecraft Launcher\MinecraftLauncher.exe");
    assert_eq!(
      result,
      Some(PathBuf::from(
        r"C:\Program Files\Minecraft Launcher\MinecraftLauncher.exe"
      ))
    );
  }

  // ── parse_start_apps_json ───────────────────────────────────────────────

  #[test]
  fn parses_start_apps_json_array() {
    let payload = r#"[{"Name":"Minecraft Launcher","AppID":"Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft"},{"Name":"Notepad","AppID":"Microsoft.WindowsNotepad_8wekyb3d8bbwe!App"}]"#;
    let parsed = parse_start_apps_json(payload);
    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0].name, "Minecraft Launcher");
    assert_eq!(
      parsed[0].app_id,
      "Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft"
    );
  }

  #[test]
  fn parses_start_apps_json_single_object() {
    let payload = r#"{"Name":"Minecraft Launcher","AppID":"Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft"}"#;
    let parsed = parse_start_apps_json(payload);
    assert_eq!(parsed.len(), 1);
    assert_eq!(parsed[0].name, "Minecraft Launcher");
  }

  #[test]
  fn parse_start_apps_json_returns_empty_for_empty_input() {
    assert!(parse_start_apps_json("").is_empty());
    assert!(parse_start_apps_json("   ").is_empty());
  }

  #[test]
  fn parse_start_apps_json_returns_empty_for_invalid_json() {
    assert!(parse_start_apps_json("not json").is_empty());
  }

  #[test]
  fn parse_start_apps_json_skips_entries_with_missing_fields() {
    let payload = r#"[{"Name":"Minecraft Launcher"},{"Name":"Other","AppID":"Other!App"}]"#;
    let parsed = parse_start_apps_json(payload);
    // First entry has no AppID so it should be skipped
    assert_eq!(parsed.len(), 1);
    assert_eq!(parsed[0].name, "Other");
  }

  // ── official_store_app_id_from_json + is_official_store_app ────────────

  #[test]
  fn extracts_official_app_id_from_json() {
    let payload = r#"[{"Name":"Minecraft Launcher","AppID":"Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft"},{"Name":"Notepad","AppID":"Microsoft.WindowsNotepad_8wekyb3d8bbwe!App"}]"#;
    let id = official_store_app_id_from_json(payload);
    assert_eq!(
      id.as_deref(),
      Some("Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft")
    );
  }

  #[test]
  fn official_store_app_id_returns_none_when_no_match() {
    let payload = r#"[{"Name":"Notepad","AppID":"Microsoft.WindowsNotepad_8wekyb3d8bbwe!App"}]"#;
    assert_eq!(official_store_app_id_from_json(payload), None);
  }

  #[test]
  fn is_official_store_app_matches_minecraft_launcher_name() {
    let entry = StartAppEntry {
      name: "Minecraft Launcher".to_string(),
      app_id: "SomeApp!App".to_string(),
    };
    assert!(is_official_store_app(&entry));
  }

  #[test]
  fn is_official_store_app_matches_by_app_id() {
    let entry = StartAppEntry {
      name: "Game".to_string(),
      app_id: "Microsoft.MinecraftLauncher_8wekyb3d8bbwe!Minecraft".to_string(),
    };
    assert!(is_official_store_app(&entry));
  }

  #[test]
  fn is_official_store_app_rejects_unrelated_app() {
    let entry = StartAppEntry {
      name: "Notepad".to_string(),
      app_id: "Microsoft.WindowsNotepad!App".to_string(),
    };
    assert!(!is_official_store_app(&entry));
  }
}
