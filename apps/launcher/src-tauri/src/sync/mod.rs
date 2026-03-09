use std::{
  collections::{BTreeMap, HashMap, HashSet, VecDeque},
  fs::File,
  io::Write,
  path::{Path, PathBuf},
  sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc,
  },
  time::Instant,
};

use futures_util::{stream::FuturesUnordered, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use sysinfo::System;
use tauri::AppHandle;
use tokio::{
  fs,
  io::{AsyncReadExt, AsyncWriteExt},
  sync::Mutex as TokioMutex,
  time::{sleep, Duration},
};
use url::Url;
use uuid::Uuid;
use zip::ZipArchive;

use crate::{
  error::{LauncherError, LauncherResult},
  events::{emit_sync_error, emit_sync_progress},
  instance::{
    ensure_default_server, ensure_layout, load_local_lock, resolve_target_path, write_manifest_lock, InstancePaths,
  },
  profile::fetch_remote_lock,
  providers::validate_download_url,
  state::AppState,
  types::{
    ConfigTemplate, FancyMenuSettings, LockItem, ProfileLock, ResourcePack, ShaderPack, SyncApplyResponse,
    SyncOperation, SyncPlan,
    SyncProgressEvent, UpdateSummary, UpdatesResponse,
  },
};

pub(crate) const FANCYMENU_MANAGED_LAYOUT_FILENAME: &str = "mvl_managed_title_screen_layout.txt";
const FANCYMENU_TITLE_SCREEN_IDENTIFIER: &str = "net.minecraft.class_442";
const FANCYMENU_CUSTOM_BUNDLE_CONFIG_NAME: &str = "FancyMenu Custom Bundle";
pub(crate) const FANCYMENU_CUSTOM_MANIFEST_FILENAME: &str = ".mvl_custom_bundle_manifest.json";
const FANCYMENU_CUSTOMIZATION_ROOT_LAYOUT_PATH: &str = "config/fancymenu/customization.txt";
const FANCYMENU_CUSTOMIZATION_MAIN_LAYOUT_PATH: &str = "config/fancymenu/customization/main.txt";
const FANCYMENU_SERVER_URL_TOKEN: &str = "{{server_url}}";
const FANCYMENU_JOINSERVER_MARKER: &str = "[action_type:joinserver]";
const FANCYMENU_CUSTOMIZATION_DIR_PREFIX: &str = "config/fancymenu/customization/";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FancyMenuBundleManifest {
  pub(crate) bundle_sha256: String,
  pub(crate) files: Vec<String>,
  #[serde(default)]
  pub(crate) has_server_url_template: bool,
  #[serde(default)]
  pub(crate) last_injected_server_url: Option<String>,
}

#[derive(Debug, Clone)]
struct DesiredFile {
  path: String,
  kind: String,
  name: String,
  provider: String,
  url: String,
  sha256: String,
}

#[derive(Debug, Clone)]
struct LocalFile {
  kind: String,
  name: String,
  sha256: String,
}

#[derive(Debug, Clone)]
struct PlanContext {
  plan: SyncPlan,
  remote_lock: ProfileLock,
  desired: HashMap<String, DesiredFile>,
}

/// A common interface over asset types that share url/name/sha256 fields,
/// allowing a single generic `extend_assets` to replace the three separate
/// `extend_resources` / `extend_shaders` / `extend_configs` functions.
trait SyncableAsset {
  fn asset_url(&self) -> &str;
  fn asset_name(&self) -> &str;
  fn asset_sha256(&self) -> &str;
}

impl SyncableAsset for ResourcePack {
  fn asset_url(&self) -> &str { &self.url }
  fn asset_name(&self) -> &str { &self.name }
  fn asset_sha256(&self) -> &str { &self.sha256 }
}

impl SyncableAsset for ShaderPack {
  fn asset_url(&self) -> &str { &self.url }
  fn asset_name(&self) -> &str { &self.name }
  fn asset_sha256(&self) -> &str { &self.sha256 }
}

impl SyncableAsset for ConfigTemplate {
  fn asset_url(&self) -> &str { &self.url }
  fn asset_name(&self) -> &str { &self.name }
  fn asset_sha256(&self) -> &str { &self.sha256 }
}

pub fn cancel_sync(state: &AppState) {
  state.cancel_sync.store(true, Ordering::SeqCst);
}

pub async fn sync_plan(state: &AppState, server_id: &str) -> LauncherResult<SyncPlan> {
  let context = plan_context(state, server_id).await?;
  Ok(context.plan)
}

pub async fn check_updates(state: &AppState, server_id: &str) -> LauncherResult<UpdatesResponse> {
  let context = plan_context(state, server_id).await?;
  Ok(UpdatesResponse {
    has_updates: context.plan.summary.has_work(),
    from: context.plan.from_version,
    to: context.plan.to_version,
    summary: context.plan.summary,
  })
}

pub async fn sync_apply(app: &AppHandle, state: &AppState, server_id: &str) -> LauncherResult<SyncApplyResponse> {
  state.cancel_sync.store(false, Ordering::SeqCst);

  let mut context = plan_context(state, server_id).await?;
  let settings = state.settings.lock().clone();
  let mut paths = InstancePaths::new(
    &state.config,
    server_id,
    &settings.install_mode,
    settings.minecraft_root_override.as_deref(),
  )?;
  let detected = crate::launcher_apps::detect_installed_launchers();
  let selected = crate::launcher_apps::selected_launcher_id(&settings, &detected);
  if selected.as_deref() == Some("prism") {
    let _ = paths.apply_prism(&context.remote_lock);
  }
  ensure_layout(&paths)?;
  migrate_legacy_encoded_filenames(&paths, &context.remote_lock).await?;
  migrate_underscore_mangled_filenames(&paths, &context.remote_lock).await?;

  // After migrations, verify that files marked "keep" actually exist on disk.
  // The manifest lock may reference files that are physically absent (e.g. the
  // user's instance was recreated, or a previous partial migration left only
  // the old `_`-named file without the new `%`-named one). Re-classify any
  // phantom "keep" entries as "add" so they get downloaded in this pass.
  let phantom_indices: Vec<(usize, String)> = context
    .plan
    .operations
    .iter()
    .enumerate()
    .filter_map(|(i, op)| {
      if op.op != "keep" {
        return None;
      }
      let target = resolve_target_path(&paths, &op.path);
      if target.exists() { None } else { Some((i, op.path.clone())) }
    })
    .collect();

  for (i, path) in &phantom_indices {
    if let Some(desired) = context.desired.get(path.as_str()) {
      context.plan.operations[*i].op = "add".to_string();
      context.plan.operations[*i].url = Some(desired.url.clone());
    }
  }
  let phantom_count = phantom_indices.len() as i64;
  if phantom_count > 0 {
    context.plan.summary.add += phantom_count;
    context.plan.summary.keep -= phantom_count;
  }

  emit_sync_progress(app, &progress_planning());

  if !context.plan.summary.has_work() {
    write_manifest_lock(&paths, &context.remote_lock)?;
    ensure_default_server(&paths, &context.remote_lock.default_server)?;
    ensure_fancymenu_state(&paths, &context.remote_lock).await?;

    emit_sync_progress(
      app,
      &progress_done(0, 0, 0),
    );

    return Ok(SyncApplyResponse {
      applied_version: context.remote_lock.version,
      mod_updates_downloaded: 0,
      server_name: context.remote_lock.branding.server_name.clone(),
    });
  }

  let transaction_id = Uuid::new_v4().to_string();
  let transaction_root = paths.sync_dir.join(transaction_id);
  let staging_root = transaction_root.join("staging");
  let backup_root = transaction_root.join("backup");

  fs::create_dir_all(&staging_root).await?;
  fs::create_dir_all(&backup_root).await?;

  let result = async {
    let mut download_ops = Vec::new();
    for operation in &context.plan.operations {
      if operation.op == "add" || operation.op == "update" {
        if let Some(entry) = context.desired.get(&operation.path) {
          download_ops.push(entry.clone());
        }
      }
    }

    let total_bytes = estimate_total_bytes(state, &download_ops).await;
    let completed_bytes = Arc::new(AtomicU64::new(0));
    let start = Instant::now();

    emit_sync_progress(
      app,
      &progress_downloading_start(total_bytes),
    );

    download_with_concurrency(
      app,
      state,
      &download_ops,
      &staging_root,
      total_bytes,
      Arc::clone(&completed_bytes),
      start,
    )
    .await?;

    emit_sync_progress(
      app,
      &progress_committing(
        completed_bytes.load(Ordering::SeqCst),
        total_bytes,
        compute_speed(start, completed_bytes.load(Ordering::SeqCst)),
      ),
    );

    commit_plan(state, &context, &paths, &staging_root, &backup_root).await?;

    write_manifest_lock(&paths, &context.remote_lock)?;
    ensure_default_server(&paths, &context.remote_lock.default_server)?;
    ensure_fancymenu_state(&paths, &context.remote_lock).await?;

    emit_sync_progress(
      app,
      &progress_done(
        total_bytes,
        total_bytes,
        compute_speed(start, completed_bytes.load(Ordering::SeqCst)),
      ),
    );

    Ok::<(), LauncherError>(())
  }
  .await;

  if let Err(error) = result {
    let action_hint = if matches!(error, LauncherError::Cancelled) {
      "Sync cancelled. No changes were committed."
    } else {
      "Retry update. If it keeps failing, check network and file permissions."
    };

    emit_sync_error(
      app,
      &crate::types::SyncErrorEvent {
        code: "sync_failed".to_string(),
        message: error.to_string(),
        action_hint: Some(action_hint.to_string()),
      },
    );

    let _ = rollback_from_backup(&context, &paths, &backup_root).await;
    let _ = fs::remove_dir_all(&transaction_root).await;
    return Err(error);
  }

  let _ = fs::remove_dir_all(&transaction_root).await;

  let mod_updates_downloaded = context
    .plan
    .operations
    .iter()
    .filter(|operation| {
      operation.kind == "mod" && (operation.op == "add" || operation.op == "update")
    })
    .count();

  crate::notifications::notify_mod_updates(app, &context.remote_lock.branding.server_name, mod_updates_downloaded);

  Ok(SyncApplyResponse {
    applied_version: context.remote_lock.version,
    mod_updates_downloaded,
    server_name: context.remote_lock.branding.server_name,
  })
}

async fn ensure_fancymenu_state(paths: &InstancePaths, lock: &ProfileLock) -> LauncherResult<()> {
  let fancymenu_dir = paths.minecraft_dir.join("config").join("fancymenu");
  let customization_dir = fancymenu_dir.join("customization");
  let customizablemenus_path = fancymenu_dir.join("customizablemenus.txt");
  let managed_layout_path = customization_dir.join(FANCYMENU_MANAGED_LAYOUT_FILENAME);
  let options_path = fancymenu_dir.join("options.txt");
  let manifest_path = fancymenu_dir.join(FANCYMENU_CUSTOM_MANIFEST_FILENAME);

  fs::create_dir_all(&customization_dir).await?;

  if !lock.fancy_menu.enabled {
    cleanup_custom_bundle_files(paths, &manifest_path).await?;
    if managed_layout_path.exists() {
      let _ = fs::remove_file(&managed_layout_path).await;
    }
    return Ok(());
  }

  ensure_fancymenu_options_lockdown(&options_path).await?;
  ensure_title_screen_enabled_for_customization(&customizablemenus_path).await?;

  let mode = if lock.fancy_menu.mode.trim().eq_ignore_ascii_case("custom") {
    "custom"
  } else {
    "simple"
  };

  if mode == "simple" {
    cleanup_custom_bundle_files(paths, &manifest_path).await?;
    let server_address = resolve_fancymenu_server_address(lock);
    let layout = build_managed_title_screen_layout(&lock.fancy_menu, &server_address);
    fs::write(&managed_layout_path, layout).await?;
    return Ok(());
  }

  if managed_layout_path.exists() {
    let _ = fs::remove_file(&managed_layout_path).await;
  }

  let bundle_sha = lock
    .fancy_menu
    .custom_layout_sha256
    .as_ref()
    .map(|value| value.trim().to_lowercase())
    .filter(|value| !value.is_empty())
    .ok_or_else(|| LauncherError::InvalidData("FancyMenu custom mode missing customLayoutSha256".to_string()))?;
  let server_address = resolve_fancymenu_server_address(lock);

  let existing_manifest = load_custom_bundle_manifest(&manifest_path).await?;
  if existing_manifest
    .as_ref()
    .is_some_and(|manifest| manifest.bundle_sha256.eq_ignore_ascii_case(&bundle_sha))
  {
    normalize_customization_entrypoint(paths, &manifest_path).await?;
    let existing_manifest = load_custom_bundle_manifest(&manifest_path).await?;
    if let Some(existing_manifest) = existing_manifest {
      let needs_metadata_bootstrap = existing_manifest.last_injected_server_url.is_none();
      let needs_server_reinject = existing_manifest.has_server_url_template
        && existing_manifest.last_injected_server_url.as_deref() != Some(server_address.as_str());
      if !needs_metadata_bootstrap && !needs_server_reinject {
        return Ok(());
      }
    }
  }

  cleanup_custom_bundle_files(paths, &manifest_path).await?;

  let bundle_zip_path = resolve_custom_bundle_zip_path(paths, lock)?;
  let extracted_files = extract_custom_bundle_entries(paths, &bundle_zip_path).await?;
  let manifest = FancyMenuBundleManifest {
    bundle_sha256: bundle_sha,
    files: extracted_files,
    has_server_url_template: false,
    last_injected_server_url: None,
  };
  save_custom_bundle_manifest(&manifest_path, &manifest).await?;
  normalize_customization_entrypoint(paths, &manifest_path).await?;
  let Some(mut normalized_manifest) = load_custom_bundle_manifest(&manifest_path).await? else {
    return Err(LauncherError::InvalidData(
      "FancyMenu custom bundle manifest missing after extraction".to_string(),
    ));
  };
  let has_server_template =
    inject_server_url_templates(paths, &normalized_manifest.files, &server_address).await?;
  normalized_manifest.has_server_url_template = has_server_template;
  normalized_manifest.last_injected_server_url = Some(server_address);
  save_custom_bundle_manifest(&manifest_path, &normalized_manifest).await?;
  // Custom bundles may include options.txt; enforce lock values after extraction.
  ensure_fancymenu_options_lockdown(&options_path).await?;
  Ok(())
}

async fn ensure_title_screen_enabled_for_customization(path: &Path) -> LauncherResult<()> {
  let existing = match fs::read_to_string(path).await {
    Ok(content) => content,
    Err(_) => String::new(),
  };

  if existing.contains(FANCYMENU_TITLE_SCREEN_IDENTIFIER) {
    return Ok(());
  }

  let normalized = existing.trim();
  let mut next = if normalized.is_empty() {
    "type = customizablemenus\n\n".to_string()
  } else if normalized.starts_with("type = customizablemenus") {
    format!("{normalized}\n\n")
  } else {
    format!("type = customizablemenus\n\n{normalized}\n\n")
  };

  next.push_str(FANCYMENU_TITLE_SCREEN_IDENTIFIER);
  next.push_str(" {\n}\n");
  fs::write(path, next).await?;
  Ok(())
}

fn build_managed_title_screen_layout(fancy_menu: &FancyMenuSettings, server_address: &str) -> String {
  let mut sections = vec![
    "type = fancymenu_layout\n".to_string(),
    "layout-meta {\n  identifier = net.minecraft.class_442\n  is_enabled = true\n  layout_index = 0\n}\n"
      .to_string(),
  ];

  sections.push(format!(
    "element {{\n  element_type = custom_button\n  instance_identifier = mvl_play_button\n  label = {}\n  width = 220\n  height = 20\n  x = 0\n  y = 88\n  anchor_point = top-centered\n  sticky_anchor = true\n  stay_on_screen = false\n  navigatable = true\n  [executable_action_instance:mvl_play_button_join][action_type:joinserver] = {}\n  [executable_block:mvl_play_button_exec][type:generic] = [executables:mvl_play_button_join]\n  button_element_executable_block_identifier = mvl_play_button_exec\n}}\n",
    escape_fancymenu_value(&fancy_menu.play_button_label),
    escape_fancymenu_value(server_address)
  ));

  if fancy_menu.hide_singleplayer {
    sections.push(vanilla_hide_section("mc_titlescreen_singleplayer_button"));
  }
  if fancy_menu.hide_multiplayer {
    sections.push(vanilla_hide_section("mc_titlescreen_multiplayer_button"));
  }
  if fancy_menu.hide_realms {
    sections.push(vanilla_hide_section("mc_titlescreen_realms_button"));
  }

  sections.join("\n")
}

async fn ensure_fancymenu_options_lockdown(path: &Path) -> LauncherResult<()> {
  let mut content = match fs::read_to_string(path).await {
    Ok(raw) => raw,
    Err(_) => String::new(),
  };

  content = upsert_bool_option(&content, "customization", "modpack_mode", true);
  content = upsert_bool_option(
    &content,
    "customization",
    "show_customization_overlay",
    false,
  );
  content = upsert_bool_option(
    &content,
    "customization",
    "advanced_customization_mode",
    false,
  );
  content = upsert_bool_option(&content, "tutorial", "show_welcome_screen", false);
  content = upsert_bool_option(&content, "layout_editor", "enable_buddy", false);

  fs::write(path, content).await?;
  Ok(())
}

fn upsert_bool_option(content: &str, section: &str, key: &str, value: bool) -> String {
  let value_str = if value { "true" } else { "false" };
  let section_header = format!("##[{section}]");
  let line_value = format!("B:{key} = '{value_str}';");

  let lines: Vec<String> = if content.is_empty() {
    Vec::new()
  } else {
    content.lines().map(|line| line.to_string()).collect()
  };

  let mut output = Vec::<String>::new();
  let mut i = 0usize;
  let mut section_found = false;
  let mut key_written = false;

  while i < lines.len() {
    let current = lines[i].trim().to_string();
    if current == section_header {
      section_found = true;
      output.push(lines[i].clone());
      i += 1;

      while i < lines.len() {
        let lookahead = lines[i].trim();
        if lookahead.starts_with("##[") {
          break;
        }

        if lookahead.starts_with(&format!("B:{key} ")) {
          if !key_written {
            output.push(line_value.clone());
            key_written = true;
          }
          i += 1;
          continue;
        }

        output.push(lines[i].clone());
        i += 1;
      }

      if !key_written {
        output.push(line_value.clone());
        key_written = true;
      }
      continue;
    }

    output.push(lines[i].clone());
    i += 1;
  }

  if !section_found {
    if !output.is_empty() && !output.last().is_some_and(|line| line.trim().is_empty()) {
      output.push(String::new());
    }
    output.push(section_header);
    output.push(String::new());
    output.push(line_value);
  }

  let mut rendered = output.join("\n");
  if !rendered.ends_with('\n') {
    rendered.push('\n');
  }
  rendered
}

fn vanilla_hide_section(identifier: &str) -> String {
  format!(
    "vanilla_button {{\n  element_type = vanilla_button\n  instance_identifier = {}\n  is_hidden = true\n  stay_on_screen = false\n}}\n",
    identifier
  )
}

fn escape_fancymenu_value(value: &str) -> String {
  value
    .replace('\\', "\\\\")
    .replace('\n', " ")
    .replace('\r', " ")
}

fn resolve_fancymenu_server_address(lock: &ProfileLock) -> String {
  if lock.default_server.address.trim().is_empty() {
    "localhost:25565".to_string()
  } else {
    lock.default_server.address.trim().to_string()
  }
}

async fn inject_server_url_templates(
  paths: &InstancePaths,
  relative_files: &[String],
  server_address: &str,
) -> LauncherResult<bool> {
  let mut has_server_template = false;
  let injected_server = escape_fancymenu_value(server_address);

  for relative in relative_files {
    if !relative.starts_with(FANCYMENU_CUSTOMIZATION_DIR_PREFIX) {
      continue;
    }
    if !relative.to_lowercase().ends_with(".txt") {
      continue;
    }

    let file_path = resolve_target_path(paths, relative);
    if !file_path.exists() {
      continue;
    }

    let content = fs::read_to_string(&file_path).await?;
    let (next, file_has_template, changed) = replace_server_url_template(&content, &injected_server);
    if file_has_template {
      has_server_template = true;
    }
    if changed {
      fs::write(&file_path, next).await?;
    }
  }

  Ok(has_server_template)
}

fn replace_server_url_template(content: &str, injected_server: &str) -> (String, bool, bool) {
  let mut found_template = false;
  let mut changed = false;
  let mut output = String::with_capacity(content.len());

  for line in content.split_inclusive('\n') {
    if line.contains(FANCYMENU_JOINSERVER_MARKER) && line.contains(FANCYMENU_SERVER_URL_TOKEN) {
      found_template = true;
      let replaced = line.replace(FANCYMENU_SERVER_URL_TOKEN, injected_server);
      if replaced != line {
        changed = true;
      }
      output.push_str(&replaced);
    } else {
      output.push_str(line);
    }
  }

  (output, found_template, changed)
}

async fn load_custom_bundle_manifest(path: &Path) -> LauncherResult<Option<FancyMenuBundleManifest>> {
  let content = match fs::read_to_string(path).await {
    Ok(content) => content,
    Err(_) => return Ok(None),
  };

  let parsed = serde_json::from_str::<FancyMenuBundleManifest>(&content)
    .map_err(|error| LauncherError::InvalidData(format!("invalid FancyMenu custom manifest: {error}")))?;
  Ok(Some(parsed))
}

async fn save_custom_bundle_manifest(path: &Path, manifest: &FancyMenuBundleManifest) -> LauncherResult<()> {
  let content = serde_json::to_string_pretty(manifest)
    .map_err(|error| LauncherError::InvalidData(format!("failed to serialize FancyMenu custom manifest: {error}")))?;
  fs::write(path, content).await?;
  Ok(())
}

async fn normalize_customization_entrypoint(paths: &InstancePaths, manifest_path: &Path) -> LauncherResult<()> {
  let root_layout_path = paths
    .minecraft_dir
    .join(Path::new(FANCYMENU_CUSTOMIZATION_ROOT_LAYOUT_PATH));
  let main_layout_path = paths
    .minecraft_dir
    .join(Path::new(FANCYMENU_CUSTOMIZATION_MAIN_LAYOUT_PATH));

  if root_layout_path.exists() {
    if main_layout_path.exists() {
      return Err(LauncherError::InvalidData(
        "FancyMenu custom bundle contains both customization.txt and customization/main.txt".to_string(),
      ));
    }

    if let Some(parent) = main_layout_path.parent() {
      fs::create_dir_all(parent).await?;
    }
    fs::rename(&root_layout_path, &main_layout_path).await?;
  }

  let Some(mut manifest) = load_custom_bundle_manifest(manifest_path).await? else {
    return Ok(());
  };

  let mut changed = false;
  let mut deduped = Vec::<String>::new();
  let mut seen = HashSet::<String>::new();
  for relative in manifest.files {
    let normalized = if relative == FANCYMENU_CUSTOMIZATION_ROOT_LAYOUT_PATH {
      changed = true;
      FANCYMENU_CUSTOMIZATION_MAIN_LAYOUT_PATH.to_string()
    } else {
      relative
    };

    if seen.insert(normalized.clone()) {
      deduped.push(normalized);
    } else {
      changed = true;
    }
  }

  if changed {
    manifest.files = deduped;
    save_custom_bundle_manifest(manifest_path, &manifest).await?;
  }

  Ok(())
}

async fn cleanup_custom_bundle_files(paths: &InstancePaths, manifest_path: &Path) -> LauncherResult<()> {
  let Some(manifest) = load_custom_bundle_manifest(manifest_path).await? else {
    if manifest_path.exists() {
      let _ = fs::remove_file(manifest_path).await;
    }
    return Ok(());
  };

  for relative in manifest.files {
    let target = resolve_target_path(paths, &relative);
    if target.exists() {
      let _ = fs::remove_file(target).await;
    }
  }

  if manifest_path.exists() {
    let _ = fs::remove_file(manifest_path).await;
  }

  Ok(())
}

fn resolve_custom_bundle_zip_path(paths: &InstancePaths, lock: &ProfileLock) -> LauncherResult<PathBuf> {
  let bundle_url = lock
    .fancy_menu
    .custom_layout_url
    .as_ref()
    .ok_or_else(|| LauncherError::InvalidData("FancyMenu custom mode missing customLayoutUrl".to_string()))?;
  let bundle_sha = lock
    .fancy_menu
    .custom_layout_sha256
    .as_ref()
    .ok_or_else(|| LauncherError::InvalidData("FancyMenu custom mode missing customLayoutSha256".to_string()))?;

  let bundle_filename = extract_filename(bundle_url)?;

  let matching = lock.configs.iter().find(|entry| {
    entry.name == FANCYMENU_CUSTOM_BUNDLE_CONFIG_NAME
      || (entry.url == *bundle_url && entry.sha256.eq_ignore_ascii_case(bundle_sha))
  });

  if matching.is_none() {
    return Err(LauncherError::InvalidData(
      "FancyMenu custom mode is enabled but lock configs has no FancyMenu custom bundle entry".to_string(),
    ));
  }

  let bundle_path = paths.minecraft_dir.join("config").join(bundle_filename);
  if !bundle_path.exists() {
    return Err(LauncherError::Fs(format!(
      "FancyMenu custom bundle ZIP is missing at {}",
      bundle_path.to_string_lossy()
    )));
  }

  Ok(bundle_path)
}

async fn extract_custom_bundle_entries(paths: &InstancePaths, bundle_path: &Path) -> LauncherResult<Vec<String>> {
  let minecraft_dir = paths.minecraft_dir.clone();
  let bundle = bundle_path.to_path_buf();
  tokio::task::spawn_blocking(move || -> LauncherResult<Vec<String>> {
    let file = File::open(&bundle)?;
    let mut archive = ZipArchive::new(file)
      .map_err(|error| LauncherError::InvalidData(format!("invalid FancyMenu custom bundle ZIP: {error}")))?;
    let mut extracted = Vec::<String>::new();
    let mut seen = HashSet::<String>::new();

    let mut has_root_customization_layout = false;
    let mut has_main_customization_layout = false;
    for index in 0..archive.len() {
      let entry = archive
        .by_index(index)
        .map_err(|error| LauncherError::InvalidData(format!("failed to read FancyMenu bundle entry: {error}")))?;
      let raw_name = entry.name().replace('\\', "/");
      if raw_name.trim().is_empty() {
        continue;
      }

      let normalized = normalize_bundle_entry_path(&raw_name)?;
      if !normalized.starts_with("config/fancymenu/") {
        return Err(LauncherError::InvalidData(format!(
          "FancyMenu custom bundle entry is outside config/fancymenu: {raw_name}"
        )));
      }

      if entry.is_dir() {
        continue;
      }

      if normalized == FANCYMENU_CUSTOMIZATION_ROOT_LAYOUT_PATH {
        has_root_customization_layout = true;
      } else if normalized.eq_ignore_ascii_case(FANCYMENU_CUSTOMIZATION_MAIN_LAYOUT_PATH) {
        has_main_customization_layout = true;
      }
    }

    if has_root_customization_layout && has_main_customization_layout {
      return Err(LauncherError::InvalidData(
        "FancyMenu custom bundle must not include both config/fancymenu/customization.txt and config/fancymenu/customization/main.txt"
          .to_string(),
      ));
    }

    let remap_root_customization_layout = has_root_customization_layout && !has_main_customization_layout;

    for index in 0..archive.len() {
      let mut entry = archive
        .by_index(index)
        .map_err(|error| LauncherError::InvalidData(format!("failed to read FancyMenu bundle entry: {error}")))?;
      let raw_name = entry.name().replace('\\', "/");
      if raw_name.trim().is_empty() {
        continue;
      }

      let mut normalized = normalize_bundle_entry_path(&raw_name)?;
      if !normalized.starts_with("config/fancymenu/") {
        return Err(LauncherError::InvalidData(format!(
          "FancyMenu custom bundle entry is outside config/fancymenu: {raw_name}"
        )));
      }

      if entry.is_dir() {
        let dir_target = minecraft_dir.join(Path::new(&normalized));
        std::fs::create_dir_all(&dir_target)?;
        continue;
      }

      if remap_root_customization_layout && normalized == FANCYMENU_CUSTOMIZATION_ROOT_LAYOUT_PATH {
        normalized = FANCYMENU_CUSTOMIZATION_MAIN_LAYOUT_PATH.to_string();
      }

      let target = minecraft_dir.join(Path::new(&normalized));
      if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
      }

      let mut output = File::create(&target)?;
      std::io::copy(&mut entry, &mut output)?;
      output.flush()?;

      if seen.insert(normalized.clone()) {
        extracted.push(normalized);
      }
    }

    Ok(extracted)
  })
  .await
  .map_err(|error| LauncherError::Fs(format!("failed to extract FancyMenu custom bundle: {error}")))?
}

fn normalize_bundle_entry_path(raw: &str) -> LauncherResult<String> {
  let cleaned = raw.trim().trim_start_matches('/').replace('\\', "/");
  if cleaned.is_empty() || cleaned.contains('\0') {
    return Err(LauncherError::InvalidData(format!(
      "unsafe FancyMenu bundle path: {raw}"
    )));
  }

  let path = Path::new(&cleaned);
  let mut parts = Vec::<String>::new();
  for component in path.components() {
    match component {
      std::path::Component::Normal(value) => {
        let segment = value.to_string_lossy();
        if segment.chars().any(|ch| ch.is_control()) {
          return Err(LauncherError::InvalidData(format!(
            "unsafe FancyMenu bundle path: {raw}"
          )));
        }
        parts.push(segment.to_string());
      }
      std::path::Component::CurDir => {}
      std::path::Component::ParentDir
      | std::path::Component::RootDir
      | std::path::Component::Prefix(_) => {
        return Err(LauncherError::InvalidData(format!(
          "unsafe FancyMenu bundle path: {raw}"
        )));
      }
    }
  }

  if parts.is_empty() {
    return Err(LauncherError::InvalidData(format!(
      "unsafe FancyMenu bundle path: {raw}"
    )));
  }

  let normalized = parts.join("/");
  if normalized.starts_with("config/fancymenu/") {
    return Ok(normalized);
  }

  if normalized == "config/fancymenu" {
    return Ok("config/fancymenu".to_string());
  }

  if normalized.starts_with("fancymenu/") {
    return Ok(format!(
      "config/fancymenu/{}",
      &normalized["fancymenu/".len()..]
    ));
  }

  if normalized == "fancymenu" {
    return Ok("config/fancymenu".to_string());
  }

  Ok(format!("config/fancymenu/{normalized}"))
}

async fn plan_context(state: &AppState, server_id: &str) -> LauncherResult<PlanContext> {
  let mut remote_lock = fetch_remote_lock(state, server_id).await?;
  strip_server_lock_items(&mut remote_lock);

  let settings = state.settings.lock().clone();
  let mut paths = InstancePaths::new(
    &state.config,
    server_id,
    &settings.install_mode,
    settings.minecraft_root_override.as_deref(),
  )?;

  let detected = crate::launcher_apps::detect_installed_launchers();
  let selected = crate::launcher_apps::selected_launcher_id(&settings, &detected);
  if selected.as_deref() == Some("prism") {
    let _ = paths.apply_prism(&remote_lock);
  }

  ensure_layout(&paths)?;

  let local_lock = load_local_lock(&paths)?;
  let (plan, desired) = compute_plan(server_id, local_lock.as_ref(), &remote_lock)?;

  Ok(PlanContext {
    plan,
    remote_lock,
    desired,
  })
}

fn is_server_lock_item(item: &LockItem) -> bool {
  item.name.to_lowercase().contains("server lock")
    || item.url.contains("server-lock-")
    || item.url.contains("/v1/artifacts/server-lock")
}

fn strip_server_lock_items(lock: &mut ProfileLock) {
  lock.items.retain(|item| !is_server_lock_item(item));
}

fn compute_plan(
  server_id: &str,
  local_lock: Option<&ProfileLock>,
  remote_lock: &ProfileLock,
) -> LauncherResult<(SyncPlan, HashMap<String, DesiredFile>)> {
  let desired = flatten_remote(remote_lock)?;
  let local = local_lock.map(flatten_local).transpose()?.unwrap_or_default();

  let mut operations = Vec::new();

  for (path, remote) in &desired {
    if let Some(existing) = local.get(path) {
      if existing.sha256.eq_ignore_ascii_case(&remote.sha256) {
        operations.push(SyncOperation {
          op: "keep".to_string(),
          path: path.clone(),
          name: remote.name.clone(),
          kind: remote.kind.clone(),
          sha256: Some(remote.sha256.clone()),
          from_sha256: Some(existing.sha256.clone()),
          to_sha256: Some(remote.sha256.clone()),
          url: None,
        });
      } else {
        operations.push(SyncOperation {
          op: "update".to_string(),
          path: path.clone(),
          name: remote.name.clone(),
          kind: remote.kind.clone(),
          sha256: None,
          from_sha256: Some(existing.sha256.clone()),
          to_sha256: Some(remote.sha256.clone()),
          url: Some(remote.url.clone()),
        });
      }
    } else {
      operations.push(SyncOperation {
        op: "add".to_string(),
        path: path.clone(),
        name: remote.name.clone(),
        kind: remote.kind.clone(),
        sha256: Some(remote.sha256.clone()),
        from_sha256: None,
        to_sha256: Some(remote.sha256.clone()),
        url: Some(remote.url.clone()),
      });
    }
  }

  for (path, existing) in &local {
    if !desired.contains_key(path) {
      operations.push(SyncOperation {
        op: "remove".to_string(),
        path: path.clone(),
        name: existing.name.clone(),
        kind: existing.kind.clone(),
        sha256: Some(existing.sha256.clone()),
        from_sha256: Some(existing.sha256.clone()),
        to_sha256: None,
        url: None,
      });
    }
  }

  operations.sort_by(|left, right| left.path.cmp(&right.path));

  let summary = UpdateSummary {
    add: operations.iter().filter(|op| op.op == "add").count() as i64,
    remove: operations.iter().filter(|op| op.op == "remove").count() as i64,
    update: operations.iter().filter(|op| op.op == "update").count() as i64,
    keep: operations.iter().filter(|op| op.op == "keep").count() as i64,
  };

  Ok((
    SyncPlan {
      server_id: server_id.to_string(),
      from_version: local_lock.map(|lock| lock.version),
      to_version: remote_lock.version,
      summary,
      operations,
    },
    desired,
  ))
}

fn flatten_remote(lock: &ProfileLock) -> LauncherResult<HashMap<String, DesiredFile>> {
  let mut map = HashMap::new();

  for item in &lock.items {
    if !should_sync_mod_to_client(item) {
      continue;
    }

    validate_download_url(&item.provider, &item.url)?;

    let filename = extract_filename(&item.url)?;
    let path = format!("mods/{filename}");

    map.insert(
      path.clone(),
      DesiredFile {
        path,
        kind: "mod".to_string(),
        name: item.name.clone(),
        provider: item.provider.clone(),
        url: item.url.clone(),
        sha256: item.sha256.clone(),
      },
    );
  }

  extend_assets(&mut map, "resourcepack", &lock.resources, "resourcepacks")?;
  extend_assets(&mut map, "shaderpack", &lock.shaders, "shaderpacks")?;
  extend_assets(&mut map, "config", &lock.configs, "config")?;

  Ok(map)
}

fn should_sync_mod_to_client(item: &LockItem) -> bool {
  item.side.as_deref() != Some("server")
}

fn extend_assets<T: SyncableAsset>(
  map: &mut HashMap<String, DesiredFile>,
  kind: &str,
  assets: &[T],
  target_dir: &str,
) -> LauncherResult<()> {
  for entry in assets {
    validate_download_url("direct", entry.asset_url())?;
    let filename = extract_filename(entry.asset_url())?;
    let path = format!("{target_dir}/{filename}");

    map.insert(
      path.clone(),
      DesiredFile {
        path,
        kind: kind.to_string(),
        name: entry.asset_name().to_string(),
        provider: "direct".to_string(),
        url: entry.asset_url().to_string(),
        sha256: entry.asset_sha256().to_string(),
      },
    );
  }

  Ok(())
}

fn flatten_local(lock: &ProfileLock) -> LauncherResult<HashMap<String, LocalFile>> {
  let mut map = HashMap::new();

  // Collect (dir_prefix, kind, url, name, sha256) tuples for all asset types to
  // avoid repeating the same insert pattern four times (DRY).
  let mut raw: Vec<(&str, &str, &str, &str, &str)> = Vec::new();
  for item in &lock.items {
    raw.push(("mods", "mod", &item.url, &item.name, &item.sha256));
  }
  for entry in &lock.resources {
    raw.push(("resourcepacks", "resourcepack", &entry.url, &entry.name, &entry.sha256));
  }
  for entry in &lock.shaders {
    raw.push(("shaderpacks", "shaderpack", &entry.url, &entry.name, &entry.sha256));
  }
  for entry in &lock.configs {
    raw.push(("config", "config", &entry.url, &entry.name, &entry.sha256));
  }

  for (dir, kind, url, name, sha256) in raw {
    let filename = extract_filename(url)?;
    map.insert(
      format!("{dir}/{filename}"),
      LocalFile { kind: kind.to_string(), name: name.to_string(), sha256: sha256.to_string() },
    );
  }

  Ok(map)
}

fn extract_raw_filename(url: &str) -> LauncherResult<String> {
  let parsed = Url::parse(url).map_err(|error| LauncherError::InvalidData(error.to_string()))?;
  let last = parsed
    .path_segments()
    .and_then(|mut segments| segments.next_back())
    .unwrap_or_default()
    .trim();

  if last.is_empty() {
    return Err(LauncherError::InvalidData(format!("url does not contain filename: {url}")));
  }

  if !is_safe_filename_segment(last) {
    return Err(LauncherError::InvalidData(format!(
      "unsafe filename segment in URL: {url}"
    )));
  }

  Ok(last.to_string())
}

pub fn extract_filename(url: &str) -> LauncherResult<String> {
  let raw = extract_raw_filename(url)?;
  let decoded = decode_percent_segment(&raw);
  let normalized = normalize_filename_segment(&decoded);

  if normalized.is_empty() {
    return Err(LauncherError::InvalidData(format!(
      "url does not contain a valid filename: {url}"
    )));
  }

  Ok(normalized)
}

fn is_safe_filename_segment(value: &str) -> bool {
  if value == "." || value == ".." {
    return false;
  }

  if value.contains('/') || value.contains('\\') {
    return false;
  }

  !value.chars().any(|ch| ch.is_control())
}

fn decode_percent_segment(value: &str) -> String {
  fn hex_nibble(byte: u8) -> Option<u8> {
    match byte {
      b'0'..=b'9' => Some(byte - b'0'),
      b'a'..=b'f' => Some(10 + (byte - b'a')),
      b'A'..=b'F' => Some(10 + (byte - b'A')),
      _ => None,
    }
  }

  let bytes = value.as_bytes();
  let mut decoded = Vec::with_capacity(bytes.len());
  let mut index = 0;

  while index < bytes.len() {
    let current = bytes[index];
    if current == b'%' && index + 2 < bytes.len() {
      let hi = bytes[index + 1];
      let lo = bytes[index + 2];
      if let (Some(hi), Some(lo)) = (hex_nibble(hi), hex_nibble(lo)) {
        decoded.push((hi << 4) | lo);
        index += 3;
        continue;
      }
    }

    decoded.push(current);
    index += 1;
  }

  String::from_utf8_lossy(&decoded).into_owned()
}

fn normalize_filename_segment(value: &str) -> String {
  let mut normalized = String::with_capacity(value.len());
  for ch in value.chars() {
    if ch.is_control() {
      continue;
    }

    match ch {
      '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => normalized.push('_'),
      _ => normalized.push(ch),
    }
  }

  let trimmed = normalized.trim_matches(|ch| ch == ' ' || ch == '.');
  let mut normalized = trimmed.to_string();
  if normalized.is_empty() || normalized == "." || normalized == ".." {
    normalized = "download".to_string();
  }

  let stem = normalized.split('.').next().unwrap_or_default();
  if is_reserved_windows_name(stem) {
    normalized.insert(0, '_');
  }

  normalized
}

fn is_reserved_windows_name(value: &str) -> bool {
  let upper = value.to_ascii_uppercase();
  matches!(
    upper.as_str(),
    "CON"
      | "PRN"
      | "AUX"
      | "NUL"
      | "COM1"
      | "COM2"
      | "COM3"
      | "COM4"
      | "COM5"
      | "COM6"
      | "COM7"
      | "COM8"
      | "COM9"
      | "LPT1"
      | "LPT2"
      | "LPT3"
      | "LPT4"
      | "LPT5"
      | "LPT6"
      | "LPT7"
      | "LPT8"
      | "LPT9"
  )
}

/// Returns `(directory, url)` pairs for every asset in the lock, in the order
/// mods → resourcepacks → shaderpacks → configs. Used by migration helpers to
/// avoid repeating the same four-collection iteration pattern.
fn lock_asset_dirs_and_urls<'a>(paths: &'a InstancePaths, lock: &'a ProfileLock) -> Vec<(&'a Path, &'a str)> {
  let mut pairs: Vec<(&'a Path, &'a str)> = Vec::new();
  for item in &lock.items { pairs.push((paths.mods.as_path(), item.url.as_str())); }
  for entry in &lock.resources { pairs.push((paths.resourcepacks.as_path(), entry.url.as_str())); }
  for entry in &lock.shaders { pairs.push((paths.shaderpacks.as_path(), entry.url.as_str())); }
  for entry in &lock.configs { pairs.push((paths.config.as_path(), entry.url.as_str())); }
  pairs
}

async fn migrate_legacy_encoded_filenames(paths: &InstancePaths, lock: &ProfileLock) -> LauncherResult<()> {
  for (dir, url) in lock_asset_dirs_and_urls(paths, lock) {
    migrate_legacy_encoded_filename(dir, url).await?;
  }
  Ok(())
}

/// Normalizes a decoded filename segment using the old behavior that replaced
/// `%` with `_`. Used only for migration — to find files that were created
/// before the `%`-preservation fix and rename them to the correct form.
fn normalize_filename_segment_legacy(value: &str) -> String {
  let mut normalized = String::with_capacity(value.len());
  for ch in value.chars() {
    if ch.is_control() {
      continue;
    }

    match ch {
      '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' | '%' => normalized.push('_'),
      _ => normalized.push(ch),
    }
  }

  let trimmed = normalized.trim_matches(|ch| ch == ' ' || ch == '.');
  let mut normalized = trimmed.to_string();
  if normalized.is_empty() || normalized == "." || normalized == ".." {
    normalized = "download".to_string();
  }

  let stem = normalized.split('.').next().unwrap_or_default();
  if is_reserved_windows_name(stem) {
    normalized.insert(0, '_');
  }

  normalized
}

fn extract_filename_legacy(url: &str) -> LauncherResult<String> {
  let raw = extract_raw_filename(url)?;
  let decoded = decode_percent_segment(&raw);
  let normalized = normalize_filename_segment_legacy(&decoded);
  if normalized.is_empty() {
    return Err(LauncherError::InvalidData(format!(
      "url does not contain a valid filename: {url}"
    )));
  }
  Ok(normalized)
}

async fn migrate_underscore_mangled_filename(directory: &Path, url: &str) -> LauncherResult<()> {
  let legacy = extract_filename_legacy(url)?;
  let normalized = extract_filename(url)?;

  if legacy == normalized {
    return Ok(());
  }

  let legacy_path = directory.join(&legacy);
  let normalized_path = directory.join(&normalized);

  if !legacy_path.exists() || normalized_path.exists() {
    return Ok(());
  }

  fs::rename(legacy_path, normalized_path).await?;
  Ok(())
}

async fn migrate_underscore_mangled_filenames(paths: &InstancePaths, lock: &ProfileLock) -> LauncherResult<()> {
  for (dir, url) in lock_asset_dirs_and_urls(paths, lock) {
    migrate_underscore_mangled_filename(dir, url).await?;
  }
  Ok(())
}

async fn migrate_legacy_encoded_filename(directory: &Path, url: &str) -> LauncherResult<()> {
  let legacy = extract_raw_filename(url)?;
  let normalized = extract_filename(url)?;

  if legacy == normalized {
    return Ok(());
  }

  let legacy_path = directory.join(&legacy);
  let normalized_path = directory.join(&normalized);

  if !legacy_path.exists() || normalized_path.exists() {
    return Ok(());
  }

  fs::rename(legacy_path, normalized_path).await?;
  Ok(())
}

async fn estimate_total_bytes(state: &AppState, files: &[DesiredFile]) -> u64 {
  use std::{future::Future, pin::Pin};

  type SizeFut = Pin<Box<dyn Future<Output = u64> + Send>>;
  const MAX_CONCURRENT: usize = 8;

  // Use Range GET (bytes=0-0) instead of HEAD — CDNs like Modrinth/CurseForge
  // often omit Content-Length on HEAD but include total size in Content-Range on
  // partial GETs. We never read the response body so no real data is transferred.
  let make_fut = |client: reqwest::Client, url: String, provider: String| -> SizeFut {
    Box::pin(async move {
      let Ok(resp) = client
        .get(&url)
        .header(reqwest::header::RANGE, "bytes=0-0")
        .send()
        .await
      else {
        return 0u64;
      };

      if validate_download_url(&provider, resp.url().as_str()).is_err() {
        return 0;
      }

      // 206 Partial Content: extract total from Content-Range: bytes 0-0/TOTAL
      if resp.status() == reqwest::StatusCode::PARTIAL_CONTENT {
        if let Some(cr) = resp.headers().get(reqwest::header::CONTENT_RANGE) {
          if let Ok(s) = cr.to_str() {
            if let Some(total_str) = s.split('/').nth(1) {
              if let Ok(total) = total_str.trim().parse::<u64>() {
                return total;
              }
            }
          }
        }
      }

      // 200 OK: server ignored the Range header — fall back to Content-Length.
      resp.content_length().unwrap_or(0)
    })
  };

  let mut futs: FuturesUnordered<SizeFut> = FuturesUnordered::new();
  let mut total = 0u64;
  let mut iter = files.iter();

  for file in iter.by_ref().take(MAX_CONCURRENT) {
    futs.push(make_fut(state.http.clone(), file.url.clone(), file.provider.clone()));
  }

  while let Some(size) = futs.next().await {
    total += size;
    if let Some(file) = iter.next() {
      futs.push(make_fut(state.http.clone(), file.url.clone(), file.provider.clone()));
    }
  }

  total
}

async fn download_with_concurrency(
  app: &AppHandle,
  state: &AppState,
  files: &[DesiredFile],
  staging_root: &Path,
  total_bytes: u64,
  completed_bytes: Arc<AtomicU64>,
  start: Instant,
) -> LauncherResult<()> {
  if files.is_empty() {
    return Ok(());
  }

  let worker_count = recommended_download_workers().min(files.len()).max(1);
  let details = json!({
    "workerCount": worker_count,
    "fileCount": files.len(),
    "totalBytes": total_bytes,
  });
  let details_payload = details.to_string();
  crate::telemetry::record_structured_event(
    "launcher.sync",
    "download worker queue started",
    Some(details_payload.as_str()),
  );

  let queue = Arc::new(TokioMutex::new(VecDeque::from(files.to_vec())));
  let mut workers = Vec::new();

  for _ in 0..worker_count {
    let client = state.http.clone();
    let cancel = Arc::clone(&state.cancel_sync);
    let app_handle = app.clone();
    let completed = Arc::clone(&completed_bytes);
    let queue = Arc::clone(&queue);
    let staging_root = staging_root.to_path_buf();

    workers.push(tokio::spawn(async move {
      loop {
        let next_file = {
          let mut queue_guard = queue.lock().await;
          queue_guard.pop_front()
        };

        let Some(file) = next_file else {
          break;
        };

        let stage = staging_root.join(&file.path);
        if let Some(parent) = stage.parent() {
          fs::create_dir_all(parent).await?;
        }

        let current_file_name = file.name.clone();
        download_with_retry(&client, &file.provider, &file.url, &stage, &cancel, |delta| {
          let new_total = completed.fetch_add(delta, Ordering::SeqCst) + delta;
          let speed = compute_speed(start, new_total);
          let eta = if total_bytes > 0 && speed > 0 {
            Some((total_bytes.saturating_sub(new_total)) / speed)
          } else {
            None
          };

          emit_sync_progress(
            &app_handle,
            &SyncProgressEvent {
              phase: "downloading".to_string(),
              completed_bytes: new_total,
              total_bytes,
              current_file: Some(current_file_name.clone()),
              speed_bps: speed,
              eta_sec: eta,
            },
          );
        })
        .await?;

        verify_sha256(&stage, &file.sha256).await?;
      }

      Ok::<(), LauncherError>(())
    }));
  }

  for worker in workers {
    let result = worker
      .await
      .map_err(|error| LauncherError::Fs(format!("download worker failed: {error}")))?;
    result?;
  }

  Ok(())
}

fn recommended_download_workers() -> usize {
  let cpu_cores = std::thread::available_parallelism()
    .map(|value| value.get())
    .unwrap_or(4);

  let mut system = System::new();
  system.refresh_memory();
  let total_memory_mb = system.total_memory() / (1024 * 1024);

  if cpu_cores <= 4 || (total_memory_mb > 0 && total_memory_mb <= 8_192) {
    2
  } else if cpu_cores <= 8 || total_memory_mb < 16_384 {
    4
  } else {
    6
  }
}

async fn download_with_retry<F>(
  client: &reqwest::Client,
  provider: &str,
  url: &str,
  destination: &Path,
  cancel: &AtomicBool,
  mut on_chunk: F,
) -> LauncherResult<()>
where
  F: FnMut(u64),
{
  let part_file = destination.with_extension("part");

  for attempt in 1..=3 {
    if cancel.load(Ordering::SeqCst) {
      return Err(LauncherError::Cancelled);
    }

    let resume_from = match fs::metadata(&part_file).await {
      Ok(meta) => meta.len(),
      Err(_) => 0,
    };

    let mut request = client.get(url);
    if resume_from > 0 {
      request = request.header(reqwest::header::RANGE, format!("bytes={resume_from}-"));
    }

    let response = request.send().await;

    match response {
      Ok(response) if response.status().is_success() || response.status() == reqwest::StatusCode::PARTIAL_CONTENT => {
        validate_download_url(provider, response.url().as_str())?;

        let append = response.status() == reqwest::StatusCode::PARTIAL_CONTENT && resume_from > 0;
        let mut file = if append {
          fs::OpenOptions::new().append(true).open(&part_file).await?
        } else {
          fs::File::create(&part_file).await?
        };

        let mut stream = response.bytes_stream();

        while let Some(chunk) = stream.next().await {
          if cancel.load(Ordering::SeqCst) {
            return Err(LauncherError::Cancelled);
          }

          let bytes = chunk.map_err(LauncherError::from)?;
          file.write_all(&bytes).await?;
          on_chunk(bytes.len() as u64);
        }

        file.flush().await?;
        fs::rename(&part_file, destination).await?;
        return Ok(());
      }
      Ok(response) => {
        if attempt >= 3 {
          return Err(LauncherError::Network(
            response.text().await.unwrap_or_else(|_| "download failed".to_string()),
          ));
        }
      }
      Err(error) => {
        if attempt >= 3 {
          return Err(LauncherError::Network(error.to_string()));
        }
      }
    }

    sleep(Duration::from_millis((attempt * 400) as u64)).await;
  }

  Err(LauncherError::Network("download failed after retries".to_string()))
}

async fn verify_sha256(path: &Path, expected: &str) -> LauncherResult<()> {
  let mut file = fs::File::open(path).await?;
  let mut hasher = Sha256::new();
  let mut buffer = vec![0_u8; 16 * 1024];

  loop {
    let read = file.read(&mut buffer).await?;
    if read == 0 {
      break;
    }
    hasher.update(&buffer[..read]);
  }

  let actual = hex::encode(hasher.finalize());

  if !actual.eq_ignore_ascii_case(expected) {
    return Err(LauncherError::HashMismatch {
      path: path.to_string_lossy().to_string(),
      expected: expected.to_string(),
      actual,
    });
  }

  Ok(())
}

async fn commit_plan(
  state: &AppState,
  context: &PlanContext,
  paths: &InstancePaths,
  staging_root: &Path,
  backup_root: &Path,
) -> LauncherResult<()> {
  let mut backed_up = BTreeMap::<PathBuf, PathBuf>::new();
  let mut installed = Vec::<PathBuf>::new();

  for operation in &context.plan.operations {
    if state.cancel_sync.load(Ordering::SeqCst) {
      rollback_commit(&backed_up, &installed).await?;
      return Err(LauncherError::Cancelled);
    }

    let target = resolve_target_path(paths, &operation.path);

    if operation.op == "remove" || operation.op == "update" {
      if target.exists() {
        let backup = backup_root.join(&operation.path);
        if let Some(parent) = backup.parent() {
          fs::create_dir_all(parent).await?;
        }

        fs::rename(&target, &backup).await?;
        backed_up.insert(backup, target.clone());
      }
    }

    if operation.op == "add" || operation.op == "update" {
      let staged = staging_root.join(&operation.path);
      if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).await?;
      }

      fs::rename(staged, &target).await?;
      installed.push(target);
    }
  }

  prune_stale_server_lock_mods(paths).await?;

  Ok(())
}

async fn prune_stale_server_lock_mods(paths: &InstancePaths) -> LauncherResult<()> {
  let mut entries = match fs::read_dir(&paths.mods).await {
    Ok(entries) => entries,
    Err(_) => return Ok(()),
  };

  while let Some(entry) = entries.next_entry().await? {
    let path = entry.path();
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
      continue;
    };

    if name.starts_with("server-lock-") && name.ends_with(".jar") {
      let _ = fs::remove_file(path).await;
    }
  }

  Ok(())
}

async fn rollback_commit(backed_up: &BTreeMap<PathBuf, PathBuf>, installed: &[PathBuf]) -> LauncherResult<()> {
  for path in installed {
    if path.exists() {
      let _ = fs::remove_file(path).await;
    }
  }

  for (backup, target) in backed_up {
    if let Some(parent) = target.parent() {
      let _ = fs::create_dir_all(parent).await;
    }

    if backup.exists() {
      let _ = fs::rename(backup, target).await;
    }
  }

  Ok(())
}

async fn rollback_from_backup(context: &PlanContext, paths: &InstancePaths, backup_root: &Path) -> LauncherResult<()> {
  for operation in &context.plan.operations {
    let target = resolve_target_path(paths, &operation.path);

    if operation.op == "add" {
      if target.exists() {
        let _ = fs::remove_file(&target).await;
      }
      continue;
    }

    if operation.op == "remove" || operation.op == "update" {
      let backup = backup_root.join(&operation.path);

      if backup.exists() {
        if target.exists() {
          let _ = fs::remove_file(&target).await;
        }

        if let Some(parent) = target.parent() {
          let _ = fs::create_dir_all(parent).await;
        }

        let _ = fs::rename(backup, target).await;
      }
    }
  }

  Ok(())
}

fn compute_speed(start: Instant, completed: u64) -> u64 {
  let elapsed = start.elapsed().as_secs();
  if elapsed == 0 {
    return 0;
  }

  completed / elapsed
}

// ── SyncProgressEvent builders ────────────────────────────────────────────────
// Centralised constructors so that sync_apply does not repeat the same struct
// literal with five different field combinations (DRY).

fn progress_planning() -> SyncProgressEvent {
  SyncProgressEvent {
    phase: "planning".to_string(),
    completed_bytes: 0,
    total_bytes: 0,
    current_file: None,
    speed_bps: 0,
    eta_sec: None,
  }
}

fn progress_downloading_start(total_bytes: u64) -> SyncProgressEvent {
  SyncProgressEvent {
    phase: "downloading".to_string(),
    completed_bytes: 0,
    total_bytes,
    current_file: None,
    speed_bps: 0,
    eta_sec: None,
  }
}

fn progress_committing(completed_bytes: u64, total_bytes: u64, speed_bps: u64) -> SyncProgressEvent {
  SyncProgressEvent {
    phase: "committing".to_string(),
    completed_bytes,
    total_bytes,
    current_file: None,
    speed_bps,
    eta_sec: Some(0),
  }
}

fn progress_done(completed_bytes: u64, total_bytes: u64, speed_bps: u64) -> SyncProgressEvent {
  SyncProgressEvent {
    phase: "done".to_string(),
    completed_bytes,
    total_bytes,
    current_file: None,
    speed_bps,
    eta_sec: Some(0),
  }
}

#[cfg(test)]
mod tests {
  use super::{extract_filename, normalize_filename_segment};

  #[test]
  fn extract_filename_decodes_percent_encoding() {
    let url = "https://cdn.modrinth.com/data/YL57xq9U/versions/TSXvi2yD/iris-fabric-1.10.6%2Bmc1.21.11.jar";
    let filename = extract_filename(url).expect("filename should decode");
    assert_eq!(filename, "iris-fabric-1.10.6+mc1.21.11.jar");
  }

  #[test]
  fn extract_filename_sanitizes_windows_unsafe_characters() {
    // %20 → space, %2B → +, %3F → ?; only '?' is unsafe so it becomes '_'
    let url = "https://example.com/files/Connected-Paths%201.21.9%2B%20v2.1.1%3F.zip";
    let filename = extract_filename(url).expect("filename should sanitize");
    assert_eq!(filename, "Connected-Paths 1.21.9+ v2.1.1_.zip");
  }

  #[test]
  fn extract_filename_preserves_literal_percent() {
    // %25 decodes to literal '%'; the character is valid on all major filesystems
    // and must be preserved rather than replaced with '_'.
    let url = "https://example.com/files/some-mod-100%25-boost.jar";
    let filename = extract_filename(url).expect("filename should preserve percent");
    assert_eq!(filename, "some-mod-100%-boost.jar");
  }

  #[test]
  fn normalize_filename_prefixes_reserved_windows_names() {
    let normalized = normalize_filename_segment("CON.zip");
    assert_eq!(normalized, "_CON.zip");
  }
}
