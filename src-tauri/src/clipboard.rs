//! Clipboard write service (design §13.7, §4.5).
//!
//! Phase 3 deliverable. MVP scope is **write-only** — we must never read
//! clipboard contents (design §4.5 #2, §21.5 #3).

use crate::error::{AppError, AppResult};

#[derive(Default)]
pub struct ClipboardService;

impl ClipboardService {
    pub fn new() -> Self {
        Self
    }

    /// Write `text` to the system clipboard. Returns `ClipboardWriteFailed`
    /// on platform errors.
    pub fn write(&self, text: &str) -> AppResult<()> {
        // Phase 3 will plug in `tauri-plugin-clipboard-manager` or
        // `arboard`. Until then, fail loudly so the frontend shows a
        // copy-failed toast (design §4.5 #4).
        let _ = text;
        Err(AppError::ClipboardWriteFailed(
            "Phase 3: clipboard write not yet wired".into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_stub_returns_error() {
        let svc = ClipboardService::new();
        assert!(svc.write("hello").is_err());
    }
}