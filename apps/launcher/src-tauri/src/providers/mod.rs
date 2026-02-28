use url::Url;

use crate::error::{LauncherError, LauncherResult};

pub trait ProviderClient {
  fn validate_url(&self, url: &str) -> LauncherResult<()>;
}

pub struct ModrinthProvider;

impl ProviderClient for ModrinthProvider {
  fn validate_url(&self, url: &str) -> LauncherResult<()> {
    let parsed = Url::parse(url).map_err(|error| LauncherError::InvalidData(error.to_string()))?;
    let host = parsed.host_str().unwrap_or_default();

    if host == "cdn.modrinth.com" || host.ends_with(".cdn.modrinth.com") {
      return Ok(());
    }

    Err(LauncherError::InvalidData(format!(
      "unsupported mod provider host '{host}'"
    )))
  }
}

pub struct CurseForgeProvider;

impl ProviderClient for CurseForgeProvider {
  fn validate_url(&self, _url: &str) -> LauncherResult<()> {
    Err(LauncherError::InvalidData(
      "CurseForge provider is not enabled in MVP".to_string(),
    ))
  }
}

pub struct DirectProvider;

impl ProviderClient for DirectProvider {
  fn validate_url(&self, url: &str) -> LauncherResult<()> {
    let parsed = Url::parse(url).map_err(|error| LauncherError::InvalidData(error.to_string()))?;
    let scheme = parsed.scheme();
    let host = parsed.host_str().unwrap_or_default();

    if scheme == "https" {
      return Ok(());
    }

    if scheme == "http" && (host == "localhost" || host == "127.0.0.1") {
      return Ok(());
    }

    Err(LauncherError::InvalidData(
      "direct provider only allows https URLs (or localhost http for development)".to_string(),
    ))
  }
}

pub fn validate_mod_url(provider: &str, url: &str) -> LauncherResult<()> {
  match provider {
    "modrinth" => ModrinthProvider.validate_url(url),
    "curseforge" => CurseForgeProvider.validate_url(url),
    "direct" => DirectProvider.validate_url(url),
    _ => Err(LauncherError::InvalidData(format!(
      "unsupported provider '{provider}'"
    ))),
  }
}
