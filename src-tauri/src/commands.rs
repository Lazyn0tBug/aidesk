//! Tauri command surface (design §12).
//!
//! Phase 1 commands (`get_app_config`, `get_enabled_providers`,
//! `get_last_active_provider`, `set_last_active_provider`, `copy_text`)
//! are wired here. Phase 2 webview commands are defined in
//! `webview_manager.rs` and re-registered in `lib.rs`.

use std::sync::Arc;

use tauri::State;

use crate::clipboard::ClipboardService;
use crate::config::{self, AppConfig, ProviderConfig};
use crate::error::{AppError, AppResult};
use crate::providers;
use crate::state;

/// Bundle of services passed into Tauri as managed state.
pub struct AppServices {
    pub clipboard: Arc<ClipboardService>,
}

impl Default for AppServices {
    fn default() -> Self {
        Self {
            clipboard: Arc::new(ClipboardService::new()),
        }
    }
}

// -----------------------------------------------------------------------------
// §12.2 config commands
// -----------------------------------------------------------------------------

/// Return the fully-resolved runtime config (design §12.2).
#[tauri::command]
pub fn get_app_config() -> AppResult<AppConfig> {
    let path = config::resolve_user_config_path();
    config::load_runtime_config(&path)
}

/// Return only the enabled providers (design §12.2).
#[tauri::command]
pub fn get_enabled_providers() -> AppResult<Vec<ProviderConfig>> {
    let cfg = get_app_config()?;
    Ok(providers::enabled_providers(&cfg))
}

// -----------------------------------------------------------------------------
// §12.5 state commands
// -----------------------------------------------------------------------------

#[tauri::command]
pub fn get_last_active_provider() -> AppResult<Option<String>> {
    let path = state::resolve_state_path();
    let s = state::read(&path);
    Ok(s.last_active_provider_id)
}

#[tauri::command]
pub fn set_last_active_provider(provider_id: String) -> AppResult<()> {
    if provider_id.is_empty() {
        return Err(AppError::Internal("provider_id is empty".into()));
    }
    let path = state::resolve_state_path();
    state::mark_active(&path, &provider_id)
}

// -----------------------------------------------------------------------------
// §12.4 clipboard
// -----------------------------------------------------------------------------

#[tauri::command]
pub fn copy_text(services: State<'_, AppServices>, text: String) -> AppResult<()> {
    services.clipboard.write(&text)
}