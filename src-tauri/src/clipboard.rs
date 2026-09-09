//! Clipboard write service (design §13.7, §4.5).
//!
//! Phase 3: real implementation via `arboard`. MVP scope is **write-only** —
//! we must never read clipboard contents (design §4.5 #2, §21.5 #3). The
//! `ClipboardService` API exposes only `write`; no `read` method exists.

use arboard::Clipboard;

use crate::error::{AppError, AppResult};

#[derive(Default)]
pub struct ClipboardService;

impl ClipboardService {
    pub fn new() -> Self {
        Self
    }

    /// Write `text` to the system clipboard.
    ///
    /// A fresh `arboard::Clipboard` handle is constructed per call. This is
    /// cheap on macOS/Linux and avoids the Windows lifetime constraint
    /// (a clipboard handle must outlive its writes on that platform; a
    /// fresh handle scoped to this function trivially satisfies that).
    pub fn write(&self, text: &str) -> AppResult<()> {
        let mut clipboard = Clipboard::new().map_err(|e| {
            AppError::ClipboardWriteFailed(format!("init clipboard: {e}"))
        })?;
        clipboard
            .set_text(text.to_owned())
            .map_err(|e| AppError::ClipboardWriteFailed(format!("set_text: {e}")))?;
        // `Clipboard::set_text` returns a `Result<(), Error>` on arboard 3.x
        // — no separate "keep alive" sentinel. Older versions returned
        // a guard; if we ever pin one of those, drop the guard here.
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_messages_are_informative() {
        let err = AppError::ClipboardWriteFailed("nope".into());
        assert_eq!(err.code().as_str(), "CLIPBOARD_WRITE_FAILED");
        assert!(err.to_string().contains("clipboard write failed"));
    }
}