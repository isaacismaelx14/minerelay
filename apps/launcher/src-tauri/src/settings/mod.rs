use std::{fs, path::Path};

use crate::{
  error::{LauncherError, LauncherResult},
  types::AppSettings,
};

pub fn load(path: &Path) -> LauncherResult<AppSettings> {
  if !path.exists() {
    return Ok(AppSettings::default());
  }

  let content = fs::read_to_string(path)?;
  let settings = serde_json::from_str::<AppSettings>(&content)
    .map_err(|error| LauncherError::InvalidData(format!("invalid settings.json: {error}")))?;

  Ok(settings)
}

pub fn load_with_fallback(path: &Path, legacy_path: &Path) -> LauncherResult<AppSettings> {
  if path.exists() {
    return load(path);
  }

  if legacy_path.exists() {
    return load(legacy_path);
  }

  Ok(AppSettings::default())
}

pub fn save(path: &Path, settings: &AppSettings) -> LauncherResult<()> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)?;
  }

  fs::write(path, serde_json::to_string_pretty(settings)?)?;
  Ok(())
}
