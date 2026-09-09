//! Unified error type for all Tauri commands.
//!
//! Maps to the `IpcError` shape defined in design §17.2:
//! ```ts
//! type IpcError = { code: string; message: string };
//! ```
//!
//! Every `#[tauri::command]` handler returns `Result<T, AppError>` so the
//! frontend can rely on `{ code, message }` for all failures.

use serde::Serialize;
use thiserror::Error;

/// Error codes — must match design §17.1 verbatim.
#[derive(Debug, Clone, Copy)]
pub enum ErrorCode {
    ConfigLoadFailed,
    ConfigValidationFailed,
    ProviderNotFound,
    ProviderDisabled,
    WebviewCreateFailed,
    WebviewShowFailed,
    WebviewBoundsFailed,
    NavigationBlocked,
    ClipboardWriteFailed,
    StateReadFailed,
    StateWriteFailed,
    Internal,
}

impl ErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            ErrorCode::ConfigLoadFailed => "CONFIG_LOAD_FAILED",
            ErrorCode::ConfigValidationFailed => "CONFIG_VALIDATION_FAILED",
            ErrorCode::ProviderNotFound => "PROVIDER_NOT_FOUND",
            ErrorCode::ProviderDisabled => "PROVIDER_DISABLED",
            ErrorCode::WebviewCreateFailed => "WEBVIEW_CREATE_FAILED",
            ErrorCode::WebviewShowFailed => "WEBVIEW_SHOW_FAILED",
            ErrorCode::WebviewBoundsFailed => "WEBVIEW_BOUNDS_FAILED",
            ErrorCode::NavigationBlocked => "NAVIGATION_BLOCKED",
            ErrorCode::ClipboardWriteFailed => "CLIPBOARD_WRITE_FAILED",
            ErrorCode::StateReadFailed => "STATE_READ_FAILED",
            ErrorCode::StateWriteFailed => "STATE_WRITE_FAILED",
            ErrorCode::Internal => "INTERNAL",
        }
    }
}

#[derive(Debug, Error)]
pub enum AppError {
    #[error("config load failed: {0}")]
    ConfigLoadFailed(String),

    #[error("config validation failed: {0}")]
    ConfigValidationFailed(String),

    #[error("provider not found: {0}")]
    ProviderNotFound(String),

    #[error("provider disabled: {0}")]
    ProviderDisabled(String),

    #[error("webview create failed: {0}")]
    WebviewCreateFailed(String),

    #[error("webview show failed: {0}")]
    WebviewShowFailed(String),

    #[error("webview bounds failed: {0}")]
    WebviewBoundsFailed(String),

    #[error("navigation blocked: {0}")]
    NavigationBlocked(String),

    #[error("clipboard write failed: {0}")]
    ClipboardWriteFailed(String),

    #[error("state read failed: {0}")]
    StateReadFailed(String),

    #[error("state write failed: {0}")]
    StateWriteFailed(String),

    #[error("internal error: {0}")]
    Internal(String),
}

impl AppError {
    pub fn code(&self) -> ErrorCode {
        match self {
            AppError::ConfigLoadFailed(_) => ErrorCode::ConfigLoadFailed,
            AppError::ConfigValidationFailed(_) => ErrorCode::ConfigValidationFailed,
            AppError::ProviderNotFound(_) => ErrorCode::ProviderNotFound,
            AppError::ProviderDisabled(_) => ErrorCode::ProviderDisabled,
            AppError::WebviewCreateFailed(_) => ErrorCode::WebviewCreateFailed,
            AppError::WebviewShowFailed(_) => ErrorCode::WebviewShowFailed,
            AppError::WebviewBoundsFailed(_) => ErrorCode::WebviewBoundsFailed,
            AppError::NavigationBlocked(_) => ErrorCode::NavigationBlocked,
            AppError::ClipboardWriteFailed(_) => ErrorCode::ClipboardWriteFailed,
            AppError::StateReadFailed(_) => ErrorCode::StateReadFailed,
            AppError::StateWriteFailed(_) => ErrorCode::StateWriteFailed,
            AppError::Internal(_) => ErrorCode::Internal,
        }
    }
}

/// Wire format sent to the frontend. Matches `IpcError` (design §17.2).
#[derive(Debug, Serialize)]
pub struct IpcError {
    pub code: &'static str,
    pub message: String,
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        IpcError {
            code: self.code().as_str(),
            message: self.to_string(),
        }
        .serialize(serializer)
    }
}

pub type AppResult<T> = std::result::Result<T, AppError>;