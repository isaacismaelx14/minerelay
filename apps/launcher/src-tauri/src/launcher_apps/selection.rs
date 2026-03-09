/// Launcher selection strategy.
///
/// Given detected candidates and user settings, resolves which launcher should
/// be used — respecting the saved preference while falling back to a sensible
/// default (Prism → official → first detected).
use crate::types::{AppSettings, LauncherCandidate};

// ─── Public API ───────────────────────────────────────────────────────────────

/// Return the preferred launcher ID from a list of detected candidates.
///
/// Prefers Prism Launcher when present, then falls back to the official launcher,
/// then the first item in the list.  Custom entries are excluded.
pub fn preferred_detected_launcher_id(candidates: &[LauncherCandidate]) -> Option<String> {
  preferred_detected_launcher_id_with_strategy(candidates, true)
}

/// Resolve the launcher that should be opened given the current settings and
/// the list of launchers detected on this machine.
///
/// Order of precedence:
/// 1. Custom path — if `selected_launcher_id` is `"custom"` and a non-empty
///    `custom_launcher_path` is set.
/// 2. Saved selection — if the saved `selected_launcher_id` is present in
///    `detected`.
/// 3. Preferred default via [`preferred_detected_launcher_id`].
pub fn selected_launcher_id(
  settings: &AppSettings,
  detected: &[LauncherCandidate],
) -> Option<String> {
  selected_launcher_id_with_strategy(settings, detected, true)
}

// ─── Internal strategy helpers ────────────────────────────────────────────────

pub(crate) fn preferred_detected_launcher_id_with_strategy(
  candidates: &[LauncherCandidate],
  prefer_prism: bool,
) -> Option<String> {
  let detected: Vec<&LauncherCandidate> =
    candidates.iter().filter(|c| c.id != "custom").collect();

  if prefer_prism && detected.iter().any(|c| c.id == "prism") {
    return Some("prism".to_string());
  }

  if detected.iter().any(|c| c.id == "official") {
    return Some("official".to_string());
  }

  detected.first().map(|c| c.id.clone())
}

pub(crate) fn selected_launcher_id_with_strategy(
  settings: &AppSettings,
  detected: &[LauncherCandidate],
  prefer_prism: bool,
) -> Option<String> {
  // 1. Custom path takes precedence when fully configured.
  if settings
    .selected_launcher_id
    .as_deref()
    .is_some_and(|id| id == "custom")
  {
    let custom = settings.custom_launcher_path.as_deref()?.trim();
    if !custom.is_empty() {
      return Some("custom".to_string());
    }
  }

  // 2. Honour the saved selection if the launcher is still detected.
  if let Some(id) = settings.selected_launcher_id.as_deref() {
    if detected.iter().any(|c| c.id == id) {
      return Some(id.to_string());
    }
  }

  // 3. Fall back to the strategy default.
  preferred_detected_launcher_id_with_strategy(detected, prefer_prism)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
  use super::*;

  fn candidate(id: &str) -> LauncherCandidate {
    LauncherCandidate {
      id: id.to_string(),
      name: id.to_string(),
      path: format!("{id}-path"),
    }
  }

  fn settings_with_selection(id: &str) -> AppSettings {
    AppSettings {
      selected_launcher_id: Some(id.to_string()),
      ..AppSettings::default()
    }
  }

  // ── preferred_detected_launcher_id ─────────────────────────────────────

  #[test]
  fn preferred_prefers_prism_over_official() {
    let candidates = vec![candidate("official"), candidate("prism")];
    assert_eq!(
      preferred_detected_launcher_id(&candidates).as_deref(),
      Some("prism")
    );
  }

  #[test]
  fn preferred_falls_back_to_official_when_no_prism() {
    let candidates = vec![candidate("lunar"), candidate("official")];
    assert_eq!(
      preferred_detected_launcher_id(&candidates).as_deref(),
      Some("official")
    );
  }

  #[test]
  fn preferred_returns_first_when_neither_prism_nor_official() {
    let candidates = vec![candidate("lunar"), candidate("tlauncher")];
    assert_eq!(
      preferred_detected_launcher_id(&candidates).as_deref(),
      Some("lunar")
    );
  }

  #[test]
  fn preferred_returns_none_for_empty_list() {
    assert_eq!(preferred_detected_launcher_id(&[]), None);
  }

  #[test]
  fn preferred_excludes_custom_entries() {
    let candidates = vec![candidate("custom")];
    assert_eq!(preferred_detected_launcher_id(&candidates), None);
  }

  #[test]
  fn no_prefer_prism_strategy_picks_official_over_prism() {
    let candidates = vec![candidate("official"), candidate("prism")];
    assert_eq!(
      preferred_detected_launcher_id_with_strategy(&candidates, false).as_deref(),
      Some("official")
    );
  }

  // ── selected_launcher_id ────────────────────────────────────────────────

  #[test]
  fn keeps_valid_saved_selection_even_when_prism_is_available() {
    let settings = settings_with_selection("official");
    let detected = vec![candidate("official"), candidate("prism")];
    let selected = selected_launcher_id_with_strategy(&settings, &detected, true);
    assert_eq!(selected.as_deref(), Some("official"));
  }

  #[test]
  fn prefers_prism_when_saved_selection_is_not_detected() {
    let settings = settings_with_selection("lunar");
    let detected = vec![candidate("official"), candidate("prism")];
    let selected = selected_launcher_id_with_strategy(&settings, &detected, true);
    assert_eq!(selected.as_deref(), Some("prism"));
  }

  #[test]
  fn returns_custom_when_set_with_non_empty_path() {
    let settings = AppSettings {
      selected_launcher_id: Some("custom".to_string()),
      custom_launcher_path: Some("/Applications/SomeLauncher.app".to_string()),
      ..AppSettings::default()
    };
    let detected = vec![candidate("official")];
    let selected = selected_launcher_id(&settings, &detected);
    assert_eq!(selected.as_deref(), Some("custom"));
  }

  #[test]
  fn ignores_custom_when_path_is_empty() {
    let settings = AppSettings {
      selected_launcher_id: Some("custom".to_string()),
      custom_launcher_path: Some("   ".to_string()),
      ..AppSettings::default()
    };
    let detected = vec![candidate("official"), candidate("prism")];
    let selected = selected_launcher_id(&settings, &detected);
    // Should fall through to preferred default
    assert_eq!(selected.as_deref(), Some("prism"));
  }

  #[test]
  fn ignores_custom_when_path_is_none() {
    let settings = AppSettings {
      selected_launcher_id: Some("custom".to_string()),
      custom_launcher_path: None,
      ..AppSettings::default()
    };
    let detected = vec![candidate("official")];
    // When the "custom" launcher has no path, the `?` in the impl returns None
    // rather than falling through, preserving original behaviour.
    let selected = selected_launcher_id(&settings, &detected);
    assert_eq!(selected, None);
  }

  #[test]
  fn returns_none_when_no_candidates_and_no_settings() {
    let settings = AppSettings::default();
    assert_eq!(selected_launcher_id(&settings, &[]), None);
  }
}
