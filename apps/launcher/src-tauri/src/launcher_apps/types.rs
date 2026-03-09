/// Internal types used only within the `launcher_apps` module tree.
/// Nothing here is part of the public crate API.
use std::path::PathBuf;

use serde::Deserialize;

// ─── Launch target ───────────────────────────────────────────────────────────

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum LaunchTarget {
  Executable(PathBuf),
  AppUserModelId(String),
}

// ─── Detected launcher ───────────────────────────────────────────────────────

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
#[derive(Debug, Clone)]
pub(crate) struct DetectedLauncher {
  pub(crate) id: String,
  pub(crate) name: String,
  pub(crate) display_path: String,
  pub(crate) target: LaunchTarget,
  pub(crate) priority: DetectionPriority,
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) enum DetectionPriority {
  StoreAppUserModelId,
  ProgramFilesExecutable,
  UserLocalExecutable,
  RegistryExecutable,
}

// ─── Windows launcher spec ───────────────────────────────────────────────────

#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Copy)]
pub(crate) struct WindowsLauncherSpec {
  pub(crate) id: &'static str,
  pub(crate) name: &'static str,
  pub(crate) executable_names: &'static [&'static str],
  pub(crate) match_terms: &'static [&'static str],
}

// ─── Windows Store app entries (also used in tests on non-Windows) ───────────

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct StartAppEntry {
  pub(crate) name: String,
  pub(crate) app_id: String,
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub(crate) enum StartAppsPayload {
  One(RawStartAppEntry),
  Many(Vec<RawStartAppEntry>),
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
#[derive(Debug, Deserialize)]
pub(crate) struct RawStartAppEntry {
  #[serde(rename = "Name")]
  pub(crate) name: Option<String>,
  #[serde(rename = "AppID")]
  pub(crate) app_id: Option<String>,
}
