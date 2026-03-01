use std::{
  collections::BTreeSet,
  fs,
  path::{Path, PathBuf},
  process::Command,
  sync::Arc,
  time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::{Deserialize, Serialize};
use sysinfo::System;
use tauri::AppHandle;
use tokio::time::sleep;
use url::Url;
use uuid::Uuid;

use crate::{
  error::{LauncherError, LauncherResult},
  events::emit_session_status,
  instance::{ensure_layout, load_local_lock, InstancePaths},
  state::AppState,
  types::{AppSettings, GameSessionPhase, GameSessionStatus, ProfileLock},
};

const SESSION_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const RESTORE_GRACE: Duration = Duration::from_secs(10);
const POLL_INTERVAL: Duration = Duration::from_secs(2);
const FANCYMENU_MANAGED_LAYOUT_FILENAME: &str = "mvl_managed_title_screen_layout.txt";
const FANCYMENU_CUSTOM_MANIFEST_FILENAME: &str = ".mvl_custom_bundle_manifest.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct FancyMenuBundleManifest {
  bundle_sha256: String,
  files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SessionEntry {
  relative_path: String,
  managed_path: String,
  live_path: String,
  backup_path: Option<String>,
  backup_taken: bool,
  promoted: bool,
  restored_to_managed: bool,
  backup_restored: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ActiveSessionJournal {
  session_id: String,
  server_id: String,
  launcher_id: String,
  live_minecraft_dir: String,
  started_at: i64,
  entries: Vec<SessionEntry>,
}

pub fn get_status(state: &AppState) -> GameSessionStatus {
  state.session_status.lock().clone()
}

pub fn sync_allowed(state: &AppState) -> LauncherResult<()> {
  if state.session_status.lock().is_active() || active_journal_path(state).exists() {
    return Err(LauncherError::Config(
      "cannot sync during active play session".to_string(),
    ));
  }

  Ok(())
}

pub fn probe_game_running(live_minecraft_dir: &Path, launcher_id: &str) -> bool {
  let mut sys = System::new_all();
  sys.refresh_processes();
  game_running(&sys, &live_minecraft_dir.to_string_lossy(), launcher_id)
}

pub async fn recover_on_startup(app: &AppHandle, state: Arc<AppState>) -> LauncherResult<()> {
  if active_journal_path(state.as_ref()).exists() {
    restore_internal(app, state, None, false).await?;
  } else {
    set_status(app, state.as_ref(), GameSessionStatus::default());
  }

  Ok(())
}

pub async fn start_or_get_session(
  app: &AppHandle,
  state: Arc<AppState>,
  server_id: &str,
  launcher_id: &str,
  live_minecraft_dir: &Path,
) -> LauncherResult<GameSessionStatus> {
  let current = get_status(state.as_ref());
  if current.is_active() {
    return Ok(current);
  }

  if active_journal_path(state.as_ref()).exists() {
    restore_internal(app, Arc::clone(&state), None, false).await?;
  }

  let settings = state.settings.lock().clone();
  let paths = managed_instance_paths(state.as_ref(), server_id, &settings)?;
  let Some(local_lock) = load_local_lock(&paths)? else {
    let idle = GameSessionStatus::default();
    set_status(app, state.as_ref(), idle.clone());
    return Ok(idle);
  };

  let session_id = Uuid::new_v4().to_string();
  let started_at = now_unix_ms();

  let relative_paths = collect_session_paths(&paths, &local_lock)?;
  if relative_paths.is_empty() {
    let idle = GameSessionStatus::default();
    set_status(app, state.as_ref(), idle.clone());
    return Ok(idle);
  }

  let mut entries = Vec::with_capacity(relative_paths.len());
  for relative in relative_paths {
    let managed = paths.minecraft_dir.join(&relative);
    let live = live_minecraft_dir.join(&relative);

    entries.push(SessionEntry {
      relative_path: relative,
      managed_path: managed.to_string_lossy().to_string(),
      live_path: live.to_string_lossy().to_string(),
      backup_path: None,
      backup_taken: false,
      promoted: false,
      restored_to_managed: false,
      backup_restored: false,
    });
  }

  let mut journal = ActiveSessionJournal {
    session_id: session_id.clone(),
    server_id: server_id.to_string(),
    launcher_id: launcher_id.to_string(),
    live_minecraft_dir: live_minecraft_dir.to_string_lossy().to_string(),
    started_at,
    entries,
  };

  persist_journal(state.as_ref(), &journal)?;

  for idx in 0..journal.entries.len() {
    let (managed, live);
    {
      let entry = &journal.entries[idx];
      managed = PathBuf::from(&entry.managed_path);
      live = PathBuf::from(&entry.live_path);
    }

    if !managed.exists() {
      continue;
    }

    if let Some(parent) = live.parent() {
      fs::create_dir_all(parent)?;
    }

    if live.exists() {
      let backup = backup_path_for_live(&live, &session_id)?;
      if let Some(parent) = backup.parent() {
        fs::create_dir_all(parent)?;
      }
      move_file(&live, &backup)?;
      {
        let entry = &mut journal.entries[idx];
        entry.backup_path = Some(backup.to_string_lossy().to_string());
        entry.backup_taken = true;
      }
      persist_journal(state.as_ref(), &journal)?;
    }

    move_file(&managed, &live)?;
    journal.entries[idx].promoted = true;
    persist_journal(state.as_ref(), &journal)?;
  }

  let status = GameSessionStatus {
    phase: GameSessionPhase::AwaitingGameStart,
    live_minecraft_dir: Some(journal.live_minecraft_dir.clone()),
    launcher_id: Some(journal.launcher_id.clone()),
    session_id: Some(journal.session_id.clone()),
    started_at: Some(journal.started_at),
  };
  set_status(app, state.as_ref(), status.clone());

  spawn_monitor(app, state, journal.session_id, journal.live_minecraft_dir, journal.launcher_id);

  Ok(status)
}

pub async fn restore_active_session(app: &AppHandle, state: Arc<AppState>) -> LauncherResult<GameSessionStatus> {
  restore_internal(app, state, None, true).await
}

fn spawn_monitor(
  app: &AppHandle,
  state: Arc<AppState>,
  session_id: String,
  live_minecraft_dir: String,
  launcher_id: String,
) {
  stop_monitor(state.as_ref());

  let app_handle = app.clone();
  let state_for_task = Arc::clone(&state);
  let task = tokio::spawn(async move {
    let mut sys = System::new_all();
    let started = Instant::now();
    let mut seen_running = false;
    let mut missing_since: Option<Instant> = None;

    loop {
      if !session_matches(state_for_task.as_ref(), &session_id) {
        break;
      }

      sys.refresh_processes();
      let running = game_running(&sys, &live_minecraft_dir, &launcher_id);

      if running {
        missing_since = None;
        if !seen_running {
          seen_running = true;
          let next = GameSessionStatus {
            phase: GameSessionPhase::Playing,
            live_minecraft_dir: Some(live_minecraft_dir.clone()),
            launcher_id: Some(launcher_id.clone()),
            session_id: Some(session_id.clone()),
            started_at: Some(now_unix_ms()),
          };
          set_status(&app_handle, state_for_task.as_ref(), next);
        }
      } else if seen_running {
        let since = missing_since.get_or_insert_with(Instant::now);
        if since.elapsed() >= RESTORE_GRACE {
          let _ = restore_internal(
            &app_handle,
            Arc::clone(&state_for_task),
            Some(session_id.as_str()),
            false,
          )
          .await;
          break;
        }
      } else if started.elapsed() >= SESSION_TIMEOUT {
        let _ = restore_internal(
          &app_handle,
          Arc::clone(&state_for_task),
          Some(session_id.as_str()),
          false,
        )
        .await;
        break;
      }

      sleep(POLL_INTERVAL).await;
    }
  });

  *state.session_monitor.lock() = Some(task);
}

async fn restore_internal(
  app: &AppHandle,
  state: Arc<AppState>,
  expected_session: Option<&str>,
  stop_running_monitor: bool,
) -> LauncherResult<GameSessionStatus> {
  if stop_running_monitor {
    stop_monitor(state.as_ref());
  }

  let journal_path = active_journal_path(state.as_ref());
  if !journal_path.exists() {
    let idle = GameSessionStatus::default();
    set_status(app, state.as_ref(), idle.clone());
    return Ok(idle);
  }

  let mut journal = load_journal(&journal_path)?;
  if let Some(expected) = expected_session {
    if journal.session_id != expected {
      return Ok(get_status(state.as_ref()));
    }
  }

  let restoring = GameSessionStatus {
    phase: GameSessionPhase::Restoring,
    live_minecraft_dir: Some(journal.live_minecraft_dir.clone()),
    launcher_id: Some(journal.launcher_id.clone()),
    session_id: Some(journal.session_id.clone()),
    started_at: Some(journal.started_at),
  };
  set_status(app, state.as_ref(), restoring);

  for idx in 0..journal.entries.len() {
    let (managed, live, promoted, backup_taken, backup_path);
    {
      let entry = &journal.entries[idx];
      managed = PathBuf::from(&entry.managed_path);
      live = PathBuf::from(&entry.live_path);
      promoted = entry.promoted;
      backup_taken = entry.backup_taken;
      backup_path = entry.backup_path.clone();
    }

    if promoted {
      if live.exists() {
        if let Some(parent) = managed.parent() {
          fs::create_dir_all(parent)?;
        }
        move_file(&live, &managed)?;
      }
      journal.entries[idx].restored_to_managed = true;
      persist_journal(state.as_ref(), &journal)?;
    }

    if backup_taken {
      if let Some(backup) = backup_path.as_ref().map(PathBuf::from) {
        if backup.exists() {
          if live.exists() {
            let _ = fs::remove_file(&live);
          }
          if let Some(parent) = live.parent() {
            fs::create_dir_all(parent)?;
          }
          move_file(&backup, &live)?;
        }
      }

      journal.entries[idx].backup_restored = true;
      persist_journal(state.as_ref(), &journal)?;
    }
  }

  cleanup_backup_dirs(&journal);
  let _ = fs::remove_file(&journal_path);

  let idle = GameSessionStatus::default();
  set_status(app, state.as_ref(), idle.clone());

  Ok(idle)
}

fn cleanup_backup_dirs(journal: &ActiveSessionJournal) {
  let mut dirs = BTreeSet::<PathBuf>::new();
  for entry in &journal.entries {
    if let Some(path) = entry.backup_path.as_ref() {
      if let Some(parent) = Path::new(path).parent() {
        dirs.insert(parent.to_path_buf());
      }
    }
  }

  for dir in dirs {
    if is_empty_dir(&dir) {
      let _ = fs::remove_dir_all(dir);
    }
  }
}

fn game_running(sys: &System, live_minecraft_dir: &str, launcher_id: &str) -> bool {
  if game_running_sysinfo(sys, live_minecraft_dir, launcher_id) {
    return true;
  }

  #[cfg(target_os = "macos")]
  {
    if game_running_macos_fallback(live_minecraft_dir, launcher_id) {
      return true;
    }
  }

  #[cfg(target_os = "windows")]
  {
    if game_running_windows_fallback(live_minecraft_dir, launcher_id) {
      return true;
    }
  }

  false
}

fn game_running_sysinfo(sys: &System, live_minecraft_dir: &str, launcher_id: &str) -> bool {
  let live_lower = live_minecraft_dir.replace('\\', "/").to_lowercase();

  for process in sys.processes().values() {
    let name = process.name().to_string().to_lowercase();
    let cmd = process
      .cmd()
      .iter()
      .map(std::string::ToString::to_string)
      .collect::<Vec<_>>()
      .join(" ")
      .to_lowercase();
    let exe = process
      .exe()
      .map(|value| value.to_string_lossy().to_string().to_lowercase())
      .unwrap_or_default();
    let cwd = process
      .cwd()
      .map(|value| value.to_string_lossy().to_string().to_lowercase())
      .unwrap_or_default();

    let looks_like_launcher = name.contains("launcher")
      || cmd.contains("minecraftlauncher")
      || cmd.contains(" minecraft launcher");
    let java_like = name.contains("java");
    let cmd_has_main = cmd.contains("net.minecraft.client.main.main");
    let cmd_has_fabric_client =
      cmd.contains("net.fabricmc.loader.impl.launch.knot.knotclient")
        || cmd.contains("knotclient");
    let cmd_has_game_args = cmd.contains("--gamedir")
      || cmd.contains("--assetsdir")
      || cmd.contains("--assetindex")
      || cmd.contains("--accesstoken")
      || cmd.contains("--version");
    let cmd_has_live_dir = !live_lower.is_empty() && cmd.contains(&live_lower);
    let minecraft_process = name.contains("minecraft") && !looks_like_launcher;
    let java_looks_minecraft_runtime = exe.contains("/minecraft/")
      || cwd.contains("/minecraft/")
      || cmd.contains("/minecraft/runtime/")
      || cmd.contains("fabric-loader");
    let minecraft_parent = has_minecraft_parent(sys, process);

    if java_like
      && (cmd_has_main
        || cmd_has_fabric_client
        || cmd_has_live_dir
        || cmd_has_game_args
        || java_looks_minecraft_runtime
        || minecraft_parent)
    {
      return true;
    }

    if minecraft_process && (cmd_has_live_dir || cmd_has_game_args || cmd.contains("fabric")) {
      return true;
    }

    if launcher_id == "lunar"
      && (name.contains("lunar") || cmd.contains("lunar"))
      && (cmd.contains("minecraft") || cmd_has_main || cmd_has_live_dir)
    {
      return true;
    }

    if launcher_id == "tlauncher"
      && (name.contains("tlauncher") || cmd.contains("tlauncher"))
      && (cmd.contains("minecraft") || cmd_has_main || cmd_has_live_dir)
    {
      return true;
    }
  }

  false
}

fn has_minecraft_parent(sys: &System, process: &sysinfo::Process) -> bool {
  let mut parent = process.parent();

  for _ in 0..6 {
    let Some(pid) = parent else {
      break;
    };

    let Some(proc) = sys.process(pid) else {
      break;
    };

    let name = proc.name().to_string().to_lowercase();
    let cmd = proc
      .cmd()
      .iter()
      .map(std::string::ToString::to_string)
      .collect::<Vec<_>>()
      .join(" ")
      .to_lowercase();

    if name.contains("minecraft")
      || cmd.contains("/minecraft/launcher")
      || cmd.contains("minecraftlauncher")
      || cmd.contains("launcherui")
    {
      return true;
    }

    parent = proc.parent();
  }

  false
}

#[cfg(target_os = "macos")]
fn game_running_macos_fallback(live_minecraft_dir: &str, launcher_id: &str) -> bool {
  let output = Command::new("ps")
    .args(["ax", "-o", "comm=,args="])
    .output();

  let Ok(output) = output else {
    return false;
  };

  if !output.status.success() {
    return false;
  }

  let live = live_minecraft_dir.to_lowercase();
  let text = String::from_utf8_lossy(&output.stdout).to_lowercase();

  for line in text.lines() {
    let line = line.trim();
    if line.is_empty() {
      continue;
    }

    let launcher_only = line.contains("launcher-helper") || line.contains("--launcherui");
    let game_markers = line.contains("net.minecraft.client.main.main")
      || line.contains("knotclient")
      || line.contains("--gamedir")
      || line.contains("fabric-loader")
      || line.contains("/minecraft/runtime/");

    if game_markers && (!launcher_only || line.contains("knotclient")) {
      return true;
    }

    if !live.is_empty() && line.contains(&live) && line.contains("java") {
      return true;
    }

    if launcher_id == "lunar" && line.contains("lunar") && line.contains("minecraft") {
      return true;
    }

    if launcher_id == "tlauncher" && line.contains("tlauncher") && line.contains("minecraft") {
      return true;
    }
  }

  false
}

#[cfg(target_os = "windows")]
fn game_running_windows_fallback(live_minecraft_dir: &str, launcher_id: &str) -> bool {
  let command = "Get-CimInstance Win32_Process | Select-Object -ExpandProperty CommandLine";
  const CREATE_NO_WINDOW: u32 = 0x08000000;

  let output = Command::new("powershell")
    .creation_flags(CREATE_NO_WINDOW)
    .args(["-NoProfile", "-Command", command])
    .output();

  let Ok(output) = output else {
    return false;
  };

  if !output.status.success() {
    return false;
  }

  let live = live_minecraft_dir.replace('\\', "/").to_lowercase();
  let text = String::from_utf8_lossy(&output.stdout).to_lowercase();

  for line in text.lines() {
    let line = line.trim();
    if line.is_empty() {
      continue;
    }

    let game_markers = line.contains("net.minecraft.client.main.main")
      || line.contains("knotclient")
      || line.contains("--gamedir")
      || line.contains("fabric-loader")
      || line.contains("\\minecraft\\runtime\\")
      || line.contains("/minecraft/runtime/");

    if game_markers {
      return true;
    }

    if !live.is_empty() && line.contains(&live) && (line.contains("java") || line.contains("javaw")) {
      return true;
    }

    if launcher_id == "lunar" && line.contains("lunar") && line.contains("minecraft") {
      return true;
    }

    if launcher_id == "tlauncher" && line.contains("tlauncher") && line.contains("minecraft") {
      return true;
    }
  }

  false
}

fn stop_monitor(state: &AppState) {
  if let Some(task) = state.session_monitor.lock().take() {
    task.abort();
  }
}

fn session_matches(state: &AppState, session_id: &str) -> bool {
  state
    .session_status
    .lock()
    .session_id
    .as_deref()
    .is_some_and(|value| value == session_id)
}

fn set_status(app: &AppHandle, state: &AppState, status: GameSessionStatus) {
  *state.session_status.lock() = status.clone();
  emit_session_status(app, &status);
}

fn managed_instance_paths(state: &AppState, server_id: &str, settings: &AppSettings) -> LauncherResult<InstancePaths> {
  let paths = InstancePaths::new(
    &state.config,
    server_id,
    &settings.install_mode,
    settings.minecraft_root_override.as_deref(),
  )?;
  ensure_layout(&paths)?;
  Ok(paths)
}

fn collect_session_paths(paths: &InstancePaths, lock: &ProfileLock) -> LauncherResult<Vec<String>> {
  let mut entries = BTreeSet::new();

  for item in &lock.items {
    if let Some(filename) = filename_from_url(&item.url)? {
      entries.insert(format!("mods/{filename}"));
    }
  }

  for resource in &lock.resources {
    if let Some(filename) = filename_from_url(&resource.url)? {
      entries.insert(format!("resourcepacks/{filename}"));
    }
  }

  for shader in &lock.shaders {
    if let Some(filename) = filename_from_url(&shader.url)? {
      entries.insert(format!("shaderpacks/{filename}"));
    }
  }

  for config in &lock.configs {
    if let Some(filename) = filename_from_url(&config.url)? {
      entries.insert(format!("config/{filename}"));
    }
  }

  entries.insert("config/fancymenu/options.txt".to_string());
  entries.insert("config/fancymenu/customizablemenus.txt".to_string());
  entries.insert(format!(
    "config/fancymenu/customization/{FANCYMENU_MANAGED_LAYOUT_FILENAME}"
  ));
  entries.insert(format!("config/fancymenu/{FANCYMENU_CUSTOM_MANIFEST_FILENAME}"));
  let custom_manifest = paths
    .minecraft_dir
    .join("config")
    .join("fancymenu")
    .join(FANCYMENU_CUSTOM_MANIFEST_FILENAME);
  if custom_manifest.exists() {
    if let Ok(content) = fs::read_to_string(&custom_manifest) {
      if let Ok(manifest) = serde_json::from_str::<FancyMenuBundleManifest>(&content) {
        for relative in manifest.files {
          entries.insert(relative);
        }
      }
    }
  }
  entries.insert("servers.dat".to_string());

  let filtered = entries
    .into_iter()
    .filter(|relative| paths.minecraft_dir.join(relative).exists())
    .collect();

  Ok(filtered)
}

fn filename_from_url(url: &str) -> LauncherResult<Option<String>> {
  let parsed = Url::parse(url).map_err(|error| LauncherError::InvalidData(error.to_string()))?;
  let last = parsed
    .path_segments()
    .and_then(|mut segments| segments.next_back())
    .unwrap_or_default()
    .trim();

  if last.is_empty() {
    return Ok(None);
  }

  if !is_safe_filename_segment(last) {
    return Err(LauncherError::InvalidData(format!(
      "unsafe filename segment in URL: {url}"
    )));
  }

  Ok(Some(last.to_string()))
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

fn backup_path_for_live(live: &Path, session_id: &str) -> LauncherResult<PathBuf> {
  let parent = live.parent().ok_or_else(|| {
    LauncherError::Fs(format!(
      "unable to resolve parent directory for {}",
      live.to_string_lossy()
    ))
  })?;

  let file_name = live.file_name().ok_or_else(|| {
    LauncherError::Fs(format!(
      "unable to resolve file name for {}",
      live.to_string_lossy()
    ))
  })?;

  Ok(parent
    .join(format!(".mvl-session-{session_id}"))
    .join(file_name))
}

fn move_file(from: &Path, to: &Path) -> LauncherResult<()> {
  if let Some(parent) = to.parent() {
    fs::create_dir_all(parent)?;
  }

  if to.exists() {
    let _ = fs::remove_file(to);
  }

  match fs::rename(from, to) {
    Ok(()) => Ok(()),
    Err(_) => {
      fs::copy(from, to)?;
      fs::remove_file(from)?;
      Ok(())
    }
  }
}

fn sessions_dir(state: &AppState) -> PathBuf {
  state.config.data_root.join("sessions")
}

fn active_journal_path(state: &AppState) -> PathBuf {
  sessions_dir(state).join("active.json")
}

fn load_journal(path: &Path) -> LauncherResult<ActiveSessionJournal> {
  let content = fs::read_to_string(path)?;
  serde_json::from_str::<ActiveSessionJournal>(&content)
    .map_err(|error| LauncherError::InvalidData(format!("invalid session journal: {error}")))
}

fn persist_journal(state: &AppState, journal: &ActiveSessionJournal) -> LauncherResult<()> {
  let path = active_journal_path(state);
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)?;
  }

  let temp = path.with_extension("tmp");
  fs::write(&temp, serde_json::to_string_pretty(journal)?)?;
  fs::rename(temp, path)?;

  Ok(())
}

fn now_unix_ms() -> i64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|value| value.as_millis() as i64)
    .unwrap_or_default()
}

fn is_empty_dir(path: &Path) -> bool {
  match fs::read_dir(path) {
    Ok(mut entries) => entries.next().is_none(),
    Err(_) => false,
  }
}
