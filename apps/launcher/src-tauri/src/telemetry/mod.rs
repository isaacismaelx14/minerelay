use std::{
  fs::{self, OpenOptions},
  io::Write,
  path::{Path, PathBuf},
  sync::OnceLock,
  time::{SystemTime, UNIX_EPOCH},
};

static LOG_FILE_PATH: OnceLock<PathBuf> = OnceLock::new();

pub fn init(data_root: &Path) {
  let logs_dir = data_root.join("logs");
  let _ = fs::create_dir_all(&logs_dir);

  let log_file_path = logs_dir.join("exceptions.log");
  let _ = LOG_FILE_PATH.set(log_file_path.clone());

  append_line(
    &log_file_path,
    "backend",
    "telemetry initialized",
    Some("{}"),
    true,
  );

  std::panic::set_hook(Box::new(move |panic_info| {
    let location = panic_info
      .location()
      .map(|entry| format!("{}:{}", entry.file(), entry.line()))
      .unwrap_or_else(|| "unknown".to_string());

    let payload = if let Some(value) = panic_info.payload().downcast_ref::<&str>() {
      (*value).to_string()
    } else if let Some(value) = panic_info.payload().downcast_ref::<String>() {
      value.clone()
    } else {
      "panic with non-string payload".to_string()
    };

    append_line(
      &log_file_path,
      "panic",
      &payload,
      Some(&format!("{{\"location\":\"{}\"}}", escape_json_string(&location))),
      true,
    );
  }));
}

pub fn record_exception_event(source: &str, message: &str, details: Option<&str>) {
  let path = LOG_FILE_PATH
    .get()
    .cloned()
    .unwrap_or_else(|| std::env::temp_dir().join("minerelay-exceptions.log"));
  append_line(&path, source, message, details, false);
}

pub fn record_structured_event(source: &str, message: &str, details_json: Option<&str>) {
  let path = LOG_FILE_PATH
    .get()
    .cloned()
    .unwrap_or_else(|| std::env::temp_dir().join("minerelay-exceptions.log"));
  append_line(&path, source, message, details_json, true);
}

fn append_line(
  path: &Path,
  source: &str,
  message: &str,
  details: Option<&str>,
  details_is_json: bool,
) {
  let timestamp_ms = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|value| value.as_millis())
    .unwrap_or(0);

  let serialized_details = match details {
    Some(value) if details_is_json => value.to_string(),
    Some(value) => format!("\"{}\"", escape_json_string(value)),
    None => "null".to_string(),
  };

  let payload = format!(
    "{{\"ts\":{},\"source\":\"{}\",\"message\":\"{}\",\"details\":{}}}\n",
    timestamp_ms,
    escape_json_string(source),
    escape_json_string(message),
    serialized_details
  );

  if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
    let _ = file.write_all(payload.as_bytes());
  }
}

fn escape_json_string(raw: &str) -> String {
  raw.replace('\\', "\\\\")
    .replace('"', "\\\"")
    .replace('\n', "\\n")
    .replace('\r', "\\r")
    .replace('\t', "\\t")
}
