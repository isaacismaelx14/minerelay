use thiserror::Error;

#[derive(Debug, Error)]
pub enum LauncherError {
  #[error("configuration error: {0}")]
  Config(String),

  #[error("network error: {0}")]
  Network(String),

  #[error("filesystem error: {0}")]
  Fs(String),

  #[error("hash mismatch for {path}: expected {expected}, got {actual}")]
  HashMismatch {
    path: String,
    expected: String,
    actual: String,
  },

  #[error("cancelled")]
  Cancelled,

  #[error("invalid data: {0}")]
  InvalidData(String),
}

impl From<std::io::Error> for LauncherError {
  fn from(value: std::io::Error) -> Self {
    Self::Fs(value.to_string())
  }
}

impl From<reqwest::Error> for LauncherError {
  fn from(value: reqwest::Error) -> Self {
    Self::Network(value.to_string())
  }
}

impl From<serde_json::Error> for LauncherError {
  fn from(value: serde_json::Error) -> Self {
    Self::InvalidData(value.to_string())
  }
}

pub type LauncherResult<T> = Result<T, LauncherError>;
