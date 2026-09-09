//! Local state file (`app.state.json`) read/write.
//!
//! Implements design §9. The file lives in the OS app-data dir
//! (`app_handle.path().app_data_dir()` from Tauri, or `dirs::data_dir()`).
//!
//! On read failure the file is reset to empty defaults (design §9 #4).
//! On write failure we propagate the error so the frontend can surface a
//! toast (Phase 4 wiring).

use std::path::{Path as StdPath, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

pub const APP_STATE_FILENAME: &str = "app.state.json";
pub const APP_DATA_DIR_NAME: &str = "AIDesk";

/// Persisted state. Only `last_active_provider_id` is stored — the design
/// forbids drafts, conversations, or cookies (design §9 constraints).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AppStateFile {
    #[serde(
        rename = "lastActiveProviderId",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub last_active_provider_id: Option<String>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none", default)]
    pub updated_at: Option<String>,
}

impl AppStateFile {
    pub fn empty() -> Self {
        Self::default()
    }
}

/// Read the state file. Returns `AppStateFile::empty()` if the file is
/// missing or unreadable (design §9 #4).
pub fn read(path: &StdPath) -> AppStateFile {
    let Ok(raw) = std::fs::read_to_string(path) else {
        return AppStateFile::empty();
    };
    serde_json::from_str::<AppStateFile>(&raw).unwrap_or_else(|e| {
        eprintln!("[aidesk] app.state.json corrupted ({e}); resetting");
        AppStateFile::empty()
    })
}

/// Write the state file atomically (write → rename) so a crash mid-write
/// doesn't leave the file half-written.
pub fn write(path: &StdPath, state: &AppStateFile) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::StateWriteFailed(format!("create {}: {e}", parent.display())))?;
    }

    let json = serde_json::to_string_pretty(state)
        .map_err(|e| AppError::StateWriteFailed(format!("serialize: {e}")))?;

    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, json)
        .map_err(|e| AppError::StateWriteFailed(format!("write {}: {e}", tmp.display())))?;
    std::fs::rename(&tmp, path)
        .map_err(|e| AppError::StateWriteFailed(format!("rename {}: {e}", path.display())))?;
    Ok(())
}

/// Mark a provider as last active. Updates `updatedAt` to the current
/// UTC ISO 8601 timestamp.
pub fn mark_active(path: &StdPath, provider_id: &str) -> AppResult<()> {
    let mut state = read(path);
    state.last_active_provider_id = Some(provider_id.to_string());
    state.updated_at = Some(now_iso8601());
    write(path, &state)
}

fn now_iso8601() -> String {
    // Avoid pulling in chrono; use std::time + a minimal formatter.
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format_iso8601_utc(secs)
}

/// Minimal RFC 3339 / ISO 8601 UTC formatter. Avoids extra deps.
fn format_iso8601_utc(secs: u64) -> String {
    // Days since 1970-01-01 (Thursday).
    let days = (secs / 86_400) as i64;
    let mut year = 1970i64;
    let mut month = 1i64;
    let mut day = 1i64;
    let mut remaining_days = days;

    loop {
        let leap = is_leap(year);
        let days_in_year = if leap { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }

    let mdays = if is_leap(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    for &dm in &mdays {
        if remaining_days < dm {
            day += remaining_days;
            break;
        }
        remaining_days -= dm;
        month += 1;
    }

    let secs_today = secs % 86_400;
    let hour = secs_today / 3600;
    let minute = (secs_today % 3600) / 60;
    let second = secs_today % 60;

    format!(
        "{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z"
    )
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

/// Resolve the canonical state file path under the OS app-data dir.
pub fn resolve_state_path() -> PathBuf {
    if let Some(mut dir) = dirs::data_dir() {
        dir.push(APP_DATA_DIR_NAME);
        dir.push(APP_STATE_FILENAME);
        return dir;
    }
    PathBuf::from(APP_STATE_FILENAME)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_missing_returns_empty() {
        let dir = std::env::temp_dir().join("aidesk-test-missing");
        let path = dir.join(APP_STATE_FILENAME);
        let _ = std::fs::remove_file(&path);
        let s = read(&path);
        assert!(s.last_active_provider_id.is_none());
    }

    #[test]
    fn write_then_read_round_trips() {
        let dir = std::env::temp_dir().join("aidesk-test-roundtrip");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(APP_STATE_FILENAME);
        let _ = std::fs::remove_file(&path);

        let mut s = AppStateFile::empty();
        s.last_active_provider_id = Some("qwen".into());
        s.updated_at = Some("2026-09-09T00:00:00Z".into());
        write(&path, &s).unwrap();

        let r = read(&path);
        assert_eq!(r.last_active_provider_id.as_deref(), Some("qwen"));
    }

    #[test]
    fn read_corrupted_resets() {
        let dir = std::env::temp_dir().join("aidesk-test-corrupt");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(APP_STATE_FILENAME);
        std::fs::write(&path, b"not json").unwrap();
        let r = read(&path);
        assert!(r.last_active_provider_id.is_none());
    }

    #[test]
    fn iso8601_is_well_formed() {
        let s = format_iso8601_utc(0);
        assert_eq!(s, "1970-01-01T00:00:00Z");
        let s2 = format_iso8601_utc(86_400 * 365 + 3600);
        assert!(s2.starts_with("1971-01-01T"));
    }
}