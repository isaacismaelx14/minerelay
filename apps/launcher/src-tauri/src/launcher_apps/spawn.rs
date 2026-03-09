/// Launcher spawning and executable path validation.
///
/// Dispatches to the right launch strategy based on the [`LaunchTarget`] variant:
/// - `Executable` — direct process spawn (with `.app` bundle handling on macOS)
/// - `AppUserModelId` — Microsoft Store app via `explorer shell:AppsFolder\…`
use std::{
  path::{Path, PathBuf},
  process::Command,
};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use crate::error::{LauncherError, LauncherResult};
use super::types::LaunchTarget;

// ─── Public entry-point ───────────────────────────────────────────────────────

pub(crate) fn spawn_launcher(target: &LaunchTarget) -> LauncherResult<()> {
  match target {
    LaunchTarget::Executable(path) => spawn_executable_launcher(path),
    LaunchTarget::AppUserModelId(app_id) => spawn_store_app_launcher(app_id),
  }
}

// ─── Executable launcher ──────────────────────────────────────────────────────

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
        .map_err(|e| LauncherError::Fs(format!("failed to open launcher app: {e}")))?;
      return Ok(());
    }
  }

  Command::new(&launcher_path)
    .spawn()
    .map_err(|e| LauncherError::Fs(format!("failed to open launcher executable: {e}")))?;

  Ok(())
}

// ─── Microsoft Store app launcher ─────────────────────────────────────────────

fn spawn_store_app_launcher(app_id: &str) -> LauncherResult<()> {
  #[cfg(target_os = "windows")]
  {
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    Command::new("explorer.exe")
      .creation_flags(CREATE_NO_WINDOW)
      .arg(format!(r"shell:AppsFolder\{app_id}"))
      .spawn()
      .map_err(|e| LauncherError::Fs(format!("failed to open Microsoft Store launcher: {e}")))?;
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

// ─── Path validation ─────────────────────────────────────────────────────────

/// Validate a raw path string provided by the user (e.g. from settings).
pub(crate) fn validate_launcher_path(path: &str) -> LauncherResult<PathBuf> {
  let trimmed = path.trim();
  if trimmed.is_empty() {
    return Err(LauncherError::Config("launcher path is empty".to_string()));
  }
  validate_launcher_path_buf(Path::new(trimmed))
}

/// Validate an already-constructed path.
pub(crate) fn validate_launcher_path_buf(path: &Path) -> LauncherResult<PathBuf> {
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

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn validate_launcher_path_rejects_empty_string() {
    assert!(validate_launcher_path("").is_err());
    assert!(validate_launcher_path("   ").is_err());
  }

  #[test]
  fn validate_launcher_path_rejects_relative_path() {
    let err = validate_launcher_path("relative/path/launcher.exe").unwrap_err();
    assert!(err.to_string().contains("absolute"));
  }

  #[test]
  fn validate_launcher_path_rejects_nonexistent_absolute_path() {
    let err =
      validate_launcher_path("/this/path/definitely/does/not/exist/launcher.exe").unwrap_err();
    assert!(err.to_string().contains("does not exist"));
  }

  #[test]
  fn validate_launcher_path_accepts_existing_path() {
    // Use a file we know exists on the CI machine.
    #[cfg(target_os = "macos")]
    let known = "/bin/sh";
    #[cfg(target_os = "linux")]
    let known = "/bin/sh";
    #[cfg(target_os = "windows")]
    let known = r"C:\Windows\System32\cmd.exe";

    assert!(validate_launcher_path(known).is_ok());
  }
}
