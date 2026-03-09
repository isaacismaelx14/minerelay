/// Cross-platform launcher detection orchestration.
///
/// Provides:
/// - [`detect_installed_launchers`] — sync, returns public `LauncherCandidate` list
/// - [`detect_with_timeout`] — async with configurable timeout + telemetry
/// - Internal helpers: [`upsert_detected_launcher`], [`push_detected_executable_if_exists`],
///   [`to_public_candidates`]
use std::{
  path::Path,
  time::Instant,
};

#[cfg(target_os = "windows")]
use serde_json::json;

use tokio::time::{Duration as TokioDuration, timeout};

use crate::{
  error::{LauncherError, LauncherResult},
  types::{LauncherCandidate, LauncherDetectionResult},
};

use super::types::{DetectedLauncher, DetectionPriority, LaunchTarget};

// ─── Candidate list helpers ───────────────────────────────────────────────────

/// Insert `candidate` into `candidates`, keeping the entry with the highest
/// `DetectionPriority` when the same `id` already exists.
pub(crate) fn upsert_detected_launcher(
  candidates: &mut Vec<DetectedLauncher>,
  candidate: DetectedLauncher,
) {
  if let Some(existing) = candidates.iter_mut().find(|c| c.id == candidate.id) {
    if candidate.priority > existing.priority {
      *existing = candidate;
    }
    return;
  }
  candidates.push(candidate);
}

/// Append a candidate only when the given path exists on disk.
pub(crate) fn push_detected_executable_if_exists(
  candidates: &mut Vec<DetectedLauncher>,
  id: &str,
  name: &str,
  path: &Path,
  priority: DetectionPriority,
) {
  if !path.exists() {
    return;
  }
  upsert_detected_launcher(
    candidates,
    DetectedLauncher {
      id: id.to_string(),
      name: name.to_string(),
      display_path: path.to_string_lossy().to_string(),
      target: LaunchTarget::Executable(path.to_path_buf()),
      priority,
    },
  );
}

/// Convert the internal representation to the public `LauncherCandidate` type.
pub(crate) fn to_public_candidates(candidates: &[DetectedLauncher]) -> Vec<LauncherCandidate> {
  candidates
    .iter()
    .map(|c| LauncherCandidate {
      id: c.id.clone(),
      name: c.name.clone(),
      path: c.display_path.clone(),
    })
    .collect()
}

// ─── Platform detection ───────────────────────────────────────────────────────

pub(crate) fn detect_installed_launchers_detailed() -> Vec<DetectedLauncher> {
  #[cfg(target_os = "windows")]
  {
    return super::windows::detect_windows_launchers();
  }

  #[cfg(target_os = "macos")]
  {
    let mut candidates = Vec::new();
    let known: &[(&str, &str, &str)] = &[
      ("official", "Minecraft Launcher", "/Applications/Minecraft.app"),
      ("official", "Minecraft Launcher", "/Applications/Minecraft Launcher.app"),
      ("prism", "Prism Launcher", "/Applications/Prism Launcher.app"),
      ("tlauncher", "TLauncher", "/Applications/TLauncher.app"),
      ("lunar", "Lunar Client", "/Applications/Lunar Client.app"),
      ("multimc", "MultiMC", "/Applications/MultiMC.app"),
    ];
    for (id, name, path) in known {
      push_detected_executable_if_exists(
        &mut candidates,
        id,
        name,
        Path::new(path),
        DetectionPriority::ProgramFilesExecutable,
      );
    }
    return candidates;
  }

  #[cfg(not(any(target_os = "windows", target_os = "macos")))]
  {
    Vec::new()
  }
}

/// Sync detection returning the public `LauncherCandidate` type.
pub fn detect_installed_launchers() -> Vec<LauncherCandidate> {
  to_public_candidates(&detect_installed_launchers_detailed())
}

// ─── Async detection with timeout + telemetry ─────────────────────────────────

pub async fn detect_with_timeout(timeout_ms: u64) -> LauncherResult<LauncherDetectionResult> {
  let start = Instant::now();
  let timeout_ms = timeout_ms.clamp(500, 5_000);

  let task = tokio::task::spawn_blocking(detect_installed_launchers);
  let result = timeout(TokioDuration::from_millis(timeout_ms), task).await;

  let (candidates, timed_out) = match result {
    Ok(joined) => {
      let candidates = joined.map_err(|e| {
        LauncherError::Fs(format!("launcher detection task failed to join: {e}"))
      })?;
      (candidates, false)
    }
    Err(_) => (Vec::new(), true),
  };

  let elapsed_ms = start.elapsed().as_millis() as u64;

  #[cfg(target_os = "windows")]
  let official_maybe_uwp = !candidates.iter().any(|c| c.id == "official");

  #[cfg(not(target_os = "windows"))]
  let official_maybe_uwp = false;

  #[cfg(target_os = "windows")]
  {
    use super::windows::{WINDOWS_DETECTION_SLOW_MS, record_windows_detection_sample};
    let snapshot = record_windows_detection_sample(elapsed_ms, timed_out);
    if timed_out
      || elapsed_ms >= WINDOWS_DETECTION_SLOW_MS
      || snapshot.total_runs % 10 == 0
    {
      let details = json!({
        "timeoutMs": timeout_ms,
        "elapsedMs": elapsed_ms,
        "timedOut": timed_out,
        "candidateCount": candidates.len(),
        "officialMaybeUwp": official_maybe_uwp,
        "stats": {
          "totalRuns": snapshot.total_runs,
          "slowRuns": snapshot.slow_runs,
          "timedOutRuns": snapshot.timed_out_runs,
          "avgMs": snapshot.avg_ms,
          "p95Ms": snapshot.p95_ms
        }
      });
      let details_payload = details.to_string();
      crate::telemetry::record_structured_event(
        "launcher.detect",
        "launcher detection sample",
        Some(details_payload.as_str()),
      );
    }
  }

  Ok(LauncherDetectionResult {
    candidates,
    timed_out,
    elapsed_ms,
    official_maybe_uwp,
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
  use super::*;
  use std::path::PathBuf;

  fn make_launcher(id: &str, path: &str, priority: DetectionPriority) -> DetectedLauncher {
    DetectedLauncher {
      id: id.to_string(),
      name: id.to_string(),
      display_path: path.to_string(),
      target: LaunchTarget::Executable(PathBuf::from(path)),
      priority,
    }
  }

  // ── upsert_detected_launcher ────────────────────────────────────────────

  #[test]
  fn upsert_adds_first_candidate() {
    let mut candidates = Vec::new();
    upsert_detected_launcher(
      &mut candidates,
      make_launcher("prism", "/Applications/Prism.app", DetectionPriority::ProgramFilesExecutable),
    );
    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0].id, "prism");
  }

  #[test]
  fn upsert_keeps_higher_priority_entry() {
    let mut candidates = Vec::new();
    upsert_detected_launcher(
      &mut candidates,
      make_launcher("official", "program-files", DetectionPriority::ProgramFilesExecutable),
    );
    upsert_detected_launcher(
      &mut candidates,
      make_launcher("official", "registry", DetectionPriority::RegistryExecutable),
    );
    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0].display_path, "registry");
    assert_eq!(candidates[0].priority, DetectionPriority::RegistryExecutable);
  }

  #[test]
  fn upsert_does_not_downgrade_priority() {
    let mut candidates = Vec::new();
    upsert_detected_launcher(
      &mut candidates,
      make_launcher("official", "registry", DetectionPriority::RegistryExecutable),
    );
    upsert_detected_launcher(
      &mut candidates,
      make_launcher("official", "program-files", DetectionPriority::ProgramFilesExecutable),
    );
    // RegistryExecutable > ProgramFilesExecutable, so registry should be kept
    assert_eq!(candidates[0].display_path, "registry");
  }

  #[test]
  fn upsert_adds_different_launchers_separately() {
    let mut candidates = Vec::new();
    upsert_detected_launcher(
      &mut candidates,
      make_launcher("official", "path-a", DetectionPriority::ProgramFilesExecutable),
    );
    upsert_detected_launcher(
      &mut candidates,
      make_launcher("prism", "path-b", DetectionPriority::ProgramFilesExecutable),
    );
    assert_eq!(candidates.len(), 2);
  }

  // ── to_public_candidates ────────────────────────────────────────────────

  #[test]
  fn to_public_candidates_maps_all_fields() {
    let internal = vec![make_launcher(
      "prism",
      "/Applications/Prism.app",
      DetectionPriority::ProgramFilesExecutable,
    )];
    let public = to_public_candidates(&internal);
    assert_eq!(public.len(), 1);
    assert_eq!(public[0].id, "prism");
    assert_eq!(public[0].name, "prism");
    assert_eq!(public[0].path, "/Applications/Prism.app");
  }
}
