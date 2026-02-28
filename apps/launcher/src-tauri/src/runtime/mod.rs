use std::path::Path;

use serde_json::{json, Value};
use tokio::fs;

use crate::{
  error::{LauncherError, LauncherResult},
  state::AppState,
  types::FabricRuntimeStatus,
};

pub fn fabric_version_id(minecraft_version: &str, loader_version: &str) -> String {
  format!("fabric-loader-{}-{}", loader_version, minecraft_version)
}

pub async fn ensure_fabric_runtime(
  state: &AppState,
  minecraft_root: &Path,
  minecraft_version: &str,
  loader_version: &str,
) -> LauncherResult<FabricRuntimeStatus> {
  let version_id = fabric_version_id(minecraft_version, loader_version);
  let versions_dir = minecraft_root.join("versions");
  let version_dir = versions_dir.join(&version_id);
  let version_json_path = version_dir.join(format!("{version_id}.json"));

  if version_json_path.exists() {
    return Ok(FabricRuntimeStatus {
      minecraft_version: minecraft_version.to_string(),
      loader_version: loader_version.to_string(),
      version_id,
      minecraft_root: minecraft_root.to_string_lossy().to_string(),
      present_before: true,
      installed_now: false,
      managed_version_id: String::new(),
      managed_message: String::new(),
    });
  }

  fs::create_dir_all(&version_dir).await?;

  let url = format!(
    "https://meta.fabricmc.net/v2/versions/loader/{minecraft_version}/{loader_version}/profile/json"
  );
  let response = state.http.get(&url).send().await?;

  if !response.status().is_success() {
    return Err(LauncherError::Network(
      response
        .text()
        .await
        .unwrap_or_else(|_| "Failed to fetch Fabric launcher profile JSON".to_string()),
    ));
  }

  let mut profile_json = response
    .json::<Value>()
    .await
    .map_err(|error| LauncherError::InvalidData(format!("invalid Fabric launcher profile payload: {error}")))?;

  if !profile_json.is_object() {
    profile_json = json!({});
  }

  if let Some(root) = profile_json.as_object_mut() {
    root.insert("id".to_string(), Value::String(version_id.clone()));
    root.insert("type".to_string(), Value::String("release".to_string()));
  }

  let payload = serde_json::to_string_pretty(&profile_json)
    .map_err(|error| LauncherError::InvalidData(format!("failed to serialize Fabric profile: {error}")))?;
  fs::write(&version_json_path, payload).await?;

  Ok(FabricRuntimeStatus {
    minecraft_version: minecraft_version.to_string(),
    loader_version: loader_version.to_string(),
    version_id,
    minecraft_root: minecraft_root.to_string_lossy().to_string(),
    present_before: false,
    installed_now: true,
    managed_version_id: String::new(),
    managed_message: String::new(),
  })
}
