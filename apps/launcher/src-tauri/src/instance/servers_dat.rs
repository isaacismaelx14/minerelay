use std::{
  fs::{self, File},
  io::{Read, Write},
  path::Path,
};

use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use serde::{Deserialize, Serialize};

use crate::{
  error::{LauncherError, LauncherResult},
  types::DefaultServer,
};

#[derive(Debug, Serialize, Deserialize, Default)]
struct ServersRoot {
  #[serde(default)]
  servers: Vec<ServerEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ServerEntry {
  name: String,
  ip: String,
  #[serde(default)]
  hidden: i8,
  #[serde(rename = "acceptTextures", default)]
  accept_textures: i8,
}

pub fn write_default_server_dat(path: &Path, server: &DefaultServer) -> LauncherResult<()> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)?;
  }

  let mut root = read_existing(path).unwrap_or_default();

  root.servers.retain(|entry| entry.ip != server.address);
  root.servers.insert(
    0,
    ServerEntry {
      name: server.name.clone(),
      ip: server.address.clone(),
      hidden: 0,
      accept_textures: 1,
    },
  );

  write_root(path, &root)
}

fn read_existing(path: &Path) -> LauncherResult<ServersRoot> {
  if !path.exists() {
    return Ok(ServersRoot::default());
  }

  let file = File::open(path)?;
  let mut decoder = GzDecoder::new(file);
  let mut payload = Vec::new();
  decoder.read_to_end(&mut payload)?;

  fastnbt::from_bytes::<ServersRoot>(&payload)
    .map_err(|error| LauncherError::InvalidData(format!("failed to parse servers.dat: {error}")))
}

fn write_root(path: &Path, root: &ServersRoot) -> LauncherResult<()> {
  let file = File::create(path)?;
  let mut encoder = GzEncoder::new(file, Compression::default());

  fastnbt::to_writer(&mut encoder, root)
    .map_err(|error| LauncherError::InvalidData(format!("failed to serialize servers.dat: {error}")))?;

  encoder.flush()?;
  encoder
    .finish()
    .map_err(|error| LauncherError::Fs(format!("failed to finalize servers.dat: {error}")))?;

  Ok(())
}
