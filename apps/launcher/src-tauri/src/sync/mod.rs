use std::{
  collections::{BTreeMap, HashMap},
  path::{Path, PathBuf},
  sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc,
  },
  time::Instant,
};

use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use tauri::AppHandle;
use tokio::{
  fs,
  io::{AsyncReadExt, AsyncWriteExt},
  sync::Semaphore,
  time::{sleep, Duration},
};
use url::Url;
use uuid::Uuid;

use crate::{
  error::{LauncherError, LauncherResult},
  events::{emit_sync_error, emit_sync_progress},
  instance::{
    ensure_default_server, ensure_layout, load_local_lock, resolve_target_path, write_manifest_lock, InstancePaths,
  },
  profile::fetch_remote_lock,
  providers::validate_mod_url,
  state::AppState,
  types::{
    ConfigTemplate, FancyMenuSettings, LockItem, ProfileLock, ResourcePack, ShaderPack, SyncApplyResponse,
    SyncOperation, SyncPlan,
    SyncProgressEvent, UpdateSummary, UpdatesResponse,
  },
};

const FANCYMENU_MANAGED_LAYOUT_FILENAME: &str = "mvl_managed_title_screen_layout.txt";
const FANCYMENU_TITLE_SCREEN_IDENTIFIER: &str = "net.minecraft.class_442";

#[derive(Debug, Clone)]
struct DesiredFile {
  path: String,
  kind: String,
  name: String,
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

  let context = plan_context(state, server_id).await?;
  let settings = state.settings.lock().clone();
  let paths = InstancePaths::new(
    &state.config,
    server_id,
    &settings.install_mode,
    settings.minecraft_root_override.as_deref(),
  )?;
  ensure_layout(&paths)?;

  emit_sync_progress(
    app,
    &SyncProgressEvent {
      phase: "planning".to_string(),
      completed_bytes: 0,
      total_bytes: 0,
      current_file: None,
      speed_bps: 0,
      eta_sec: None,
    },
  );

  if !context.plan.summary.has_work() {
    write_manifest_lock(&paths, &context.remote_lock)?;
    ensure_default_server(&paths, &context.remote_lock.default_server)?;
    ensure_managed_fancymenu_layout(&paths, &context.remote_lock).await?;

    emit_sync_progress(
      app,
      &SyncProgressEvent {
        phase: "done".to_string(),
        completed_bytes: 0,
        total_bytes: 0,
        current_file: None,
        speed_bps: 0,
        eta_sec: Some(0),
      },
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
      &SyncProgressEvent {
        phase: "downloading".to_string(),
        completed_bytes: 0,
        total_bytes,
        current_file: None,
        speed_bps: 0,
        eta_sec: None,
      },
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
      &SyncProgressEvent {
        phase: "committing".to_string(),
        completed_bytes: completed_bytes.load(Ordering::SeqCst),
        total_bytes,
        current_file: None,
        speed_bps: compute_speed(start, completed_bytes.load(Ordering::SeqCst)),
        eta_sec: Some(0),
      },
    );

    commit_plan(state, &context, &paths, &staging_root, &backup_root).await?;

    write_manifest_lock(&paths, &context.remote_lock)?;
    ensure_default_server(&paths, &context.remote_lock.default_server)?;
    ensure_managed_fancymenu_layout(&paths, &context.remote_lock).await?;

    emit_sync_progress(
      app,
      &SyncProgressEvent {
        phase: "done".to_string(),
        completed_bytes: total_bytes,
        total_bytes,
        current_file: None,
        speed_bps: compute_speed(start, completed_bytes.load(Ordering::SeqCst)),
        eta_sec: Some(0),
      },
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

async fn ensure_managed_fancymenu_layout(paths: &InstancePaths, lock: &ProfileLock) -> LauncherResult<()> {
  let fancymenu_dir = paths.minecraft_dir.join("config").join("fancymenu");
  let customization_dir = fancymenu_dir.join("customization");
  let customizablemenus_path = fancymenu_dir.join("customizablemenus.txt");
  let managed_layout_path = customization_dir.join(FANCYMENU_MANAGED_LAYOUT_FILENAME);
  let options_path = fancymenu_dir.join("options.txt");

  if !lock.fancy_menu.enabled {
    if managed_layout_path.exists() {
      let _ = fs::remove_file(managed_layout_path).await;
    }
    return Ok(());
  }

  fs::create_dir_all(&customization_dir).await?;
  ensure_fancymenu_options_lockdown(&options_path).await?;
  ensure_title_screen_enabled_for_customization(&customizablemenus_path).await?;

  let server_address = if lock.default_server.address.trim().is_empty() {
    "localhost:25565".to_string()
  } else {
    lock.default_server.address.trim().to_string()
  };
  let layout = build_managed_title_screen_layout(&lock.fancy_menu, &server_address);
  fs::write(&managed_layout_path, layout).await?;
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

  if let Some(title_text) = fancy_menu.title_text.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
    sections.push(format!(
      "element {{\n  element_type = text_v2\n  instance_identifier = mvl_title_text\n  source_mode = direct\n  source = {}\n  width = 520\n  height = 54\n  x = 0\n  y = 28\n  anchor_point = top-centered\n  sticky_anchor = true\n  stay_on_screen = false\n  interactable = false\n  scale = 1.7\n  line_spacing = 1\n  base_color = #FFFFFF\n  shadow = true\n}}\n",
      escape_fancymenu_value(title_text)
    ));
  }

  if let Some(subtitle_text) = fancy_menu
    .subtitle_text
    .as_ref()
    .map(|value| value.trim())
    .filter(|value| !value.is_empty())
  {
    sections.push(format!(
      "element {{\n  element_type = text_v2\n  instance_identifier = mvl_subtitle_text\n  source_mode = direct\n  source = {}\n  width = 560\n  height = 26\n  x = 0\n  y = 58\n  anchor_point = top-centered\n  sticky_anchor = true\n  stay_on_screen = false\n  interactable = false\n  scale = 1.0\n  line_spacing = 1\n  base_color = #D8E5E8\n  shadow = false\n}}\n",
      escape_fancymenu_value(subtitle_text)
    ));
  }

  if let Some(logo_url) = fancy_menu.logo_url.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
    sections.push(format!(
      "element {{\n  element_type = image\n  instance_identifier = mvl_logo_image\n  source = [source:web]{}\n  width = 72\n  height = 72\n  x = -220\n  y = 20\n  anchor_point = top-centered\n  sticky_anchor = true\n  stay_on_screen = false\n  repeat_texture = false\n  nine_slice_texture = false\n}}\n",
      escape_fancymenu_value(logo_url)
    ));
  }

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

async fn plan_context(state: &AppState, server_id: &str) -> LauncherResult<PlanContext> {
  let mut remote_lock = fetch_remote_lock(state, server_id).await?;
  strip_server_lock_items(&mut remote_lock);

  let settings = state.settings.lock().clone();
  let paths = InstancePaths::new(
    &state.config,
    server_id,
    &settings.install_mode,
    settings.minecraft_root_override.as_deref(),
  )?;
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
    validate_mod_url(&item.provider, &item.url)?;

    let filename = extract_filename(&item.url)?;
    let path = format!("mods/{filename}");

    map.insert(
      path.clone(),
      DesiredFile {
        path,
        kind: "mod".to_string(),
        name: item.name.clone(),
        url: item.url.clone(),
        sha256: item.sha256.clone(),
      },
    );
  }

  extend_resources(&mut map, "resourcepack", &lock.resources, "resourcepacks")?;
  extend_shaders(&mut map, &lock.shaders)?;
  extend_configs(&mut map, &lock.configs)?;

  Ok(map)
}

fn extend_resources(
  map: &mut HashMap<String, DesiredFile>,
  kind: &str,
  resources: &[ResourcePack],
  target_dir: &str,
) -> LauncherResult<()> {
  for entry in resources {
    let filename = extract_filename(&entry.url)?;
    let path = format!("{target_dir}/{filename}");

    map.insert(
      path.clone(),
      DesiredFile {
        path,
        kind: kind.to_string(),
        name: entry.name.clone(),
        url: entry.url.clone(),
        sha256: entry.sha256.clone(),
      },
    );
  }

  Ok(())
}

fn extend_shaders(map: &mut HashMap<String, DesiredFile>, shaders: &[ShaderPack]) -> LauncherResult<()> {
  for entry in shaders {
    let filename = extract_filename(&entry.url)?;
    let path = format!("shaderpacks/{filename}");

    map.insert(
      path.clone(),
      DesiredFile {
        path,
        kind: "shaderpack".to_string(),
        name: entry.name.clone(),
        url: entry.url.clone(),
        sha256: entry.sha256.clone(),
      },
    );
  }

  Ok(())
}

fn extend_configs(map: &mut HashMap<String, DesiredFile>, configs: &[ConfigTemplate]) -> LauncherResult<()> {
  for entry in configs {
    let filename = extract_filename(&entry.url)?;
    let path = format!("config/{filename}");

    map.insert(
      path.clone(),
      DesiredFile {
        path,
        kind: "config".to_string(),
        name: entry.name.clone(),
        url: entry.url.clone(),
        sha256: entry.sha256.clone(),
      },
    );
  }

  Ok(())
}

fn flatten_local(lock: &ProfileLock) -> LauncherResult<HashMap<String, LocalFile>> {
  let mut map = HashMap::new();

  for item in &lock.items {
    let filename = extract_filename(&item.url)?;
    map.insert(
      format!("mods/{filename}"),
      LocalFile {
        kind: "mod".to_string(),
        name: item.name.clone(),
        sha256: item.sha256.clone(),
      },
    );
  }

  for entry in &lock.resources {
    let filename = extract_filename(&entry.url)?;
    map.insert(
      format!("resourcepacks/{filename}"),
      LocalFile {
        kind: "resourcepack".to_string(),
        name: entry.name.clone(),
        sha256: entry.sha256.clone(),
      },
    );
  }

  for entry in &lock.shaders {
    let filename = extract_filename(&entry.url)?;
    map.insert(
      format!("shaderpacks/{filename}"),
      LocalFile {
        kind: "shaderpack".to_string(),
        name: entry.name.clone(),
        sha256: entry.sha256.clone(),
      },
    );
  }

  for entry in &lock.configs {
    let filename = extract_filename(&entry.url)?;
    map.insert(
      format!("config/{filename}"),
      LocalFile {
        kind: "config".to_string(),
        name: entry.name.clone(),
        sha256: entry.sha256.clone(),
      },
    );
  }

  Ok(map)
}

fn extract_filename(url: &str) -> LauncherResult<String> {
  let parsed = Url::parse(url).map_err(|error| LauncherError::InvalidData(error.to_string()))?;
  let path = parsed.path();
  let last = path.rsplit('/').next().unwrap_or_default();

  if last.is_empty() {
    return Err(LauncherError::InvalidData(format!("url does not contain filename: {url}")));
  }

  Ok(last.to_string())
}

async fn estimate_total_bytes(state: &AppState, files: &[DesiredFile]) -> u64 {
  let mut total = 0;

  for file in files {
    if let Ok(response) = state.http.head(&file.url).send().await {
      if let Some(length) = response.content_length() {
        total += length;
      }
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
  let semaphore = Arc::new(Semaphore::new(4));
  let mut tasks = Vec::new();

  for file in files.iter().cloned() {
    let permit = Arc::clone(&semaphore)
      .acquire_owned()
      .await
      .map_err(|error| LauncherError::Fs(format!("failed to acquire semaphore permit: {error}")))?;

    let client = state.http.clone();
    let cancel = Arc::clone(&state.cancel_sync);
    let app_handle = app.clone();
    let completed = Arc::clone(&completed_bytes);
    let stage = staging_root.join(&file.path);

    tasks.push(tokio::spawn(async move {
      let _permit = permit;

      if let Some(parent) = stage.parent() {
        fs::create_dir_all(parent).await?;
      }

      download_with_retry(&client, &file.url, &stage, &cancel, |delta| {
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
            current_file: Some(file.name.clone()),
            speed_bps: speed,
            eta_sec: eta,
          },
        );
      })
      .await?;

      verify_sha256(&stage, &file.sha256).await?;
      Ok::<(), LauncherError>(())
    }));
  }

  for task in tasks {
    let result = task
      .await
      .map_err(|error| LauncherError::Fs(format!("download task failed: {error}")))?;
    result?;
  }

  Ok(())
}

async fn download_with_retry<F>(
  client: &reqwest::Client,
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
