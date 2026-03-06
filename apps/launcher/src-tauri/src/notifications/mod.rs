use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

pub fn notify_mod_updates(app: &AppHandle, server_name: &str, mod_count: usize) {
  if mod_count == 0 {
    return;
  }

  let body = format!("{server_name}: {mod_count} mod updates downloaded");
  let _ = app
    .notification()
    .builder()
    .title("MineRelay")
    .body(&body)
    .show();
}
