//! WebView lifecycle manager (design §13.5).
//!
//! Phase 2 deliverable. The current stub defines the public surface and
//! runtime state types so `commands.rs` can wire Tauri commands; bodies
//! return `AppError::Webview*` until implementation lands.

use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::config::{AppConfig, ProviderId};
use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WebviewLifecycle {
    NotCreated,
    Loading,
    Ready,
    Error,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Bounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Default)]
pub struct WebviewState {
    pub lifecycle: HashMap<ProviderId, WebviewLifecycle>,
    pub bounds: HashMap<ProviderId, Bounds>,
    pub visible: Option<ProviderId>,
}

/// Shared Tauri-managed state wrapping the lifecycle map.
#[derive(Default)]
pub struct WebviewManager(pub Mutex<WebviewState>);

impl WebviewManager {
    pub fn from_config(config: &AppConfig) -> Self {
        let mut state = WebviewState::default();
        for p in &config.providers {
            if p.enabled {
                state.lifecycle.insert(p.id.clone(), WebviewLifecycle::NotCreated);
            }
        }
        Self(Mutex::new(state))
    }
}

/// Create the WebView for a provider (Phase 2).
#[tauri::command]
pub async fn create_provider_webview(
    _app: AppHandle,
    state: tauri::State<'_, WebviewManager>,
    provider_id: ProviderId,
    bounds: Bounds,
) -> AppResult<()> {
    let mut s = state.0.lock().map_err(|_| AppError::Internal("lock".into()))?;
    s.bounds.insert(provider_id.clone(), bounds);
    s.lifecycle.insert(provider_id, WebviewLifecycle::Loading);
    Err(AppError::WebviewCreateFailed(
        "Phase 2: not yet implemented".into(),
    ))
}

/// Show a previously created WebView.
#[tauri::command]
pub async fn show_provider_webview(
    _app: AppHandle,
    state: tauri::State<'_, WebviewManager>,
    provider_id: ProviderId,
    bounds: Bounds,
) -> AppResult<()> {
    let mut s = state.0.lock().map_err(|_| AppError::Internal("lock".into()))?;
    s.bounds.insert(provider_id.clone(), bounds);
    s.visible = Some(provider_id.clone());
    s.lifecycle.insert(provider_id, WebviewLifecycle::Ready);
    Err(AppError::WebviewShowFailed(
        "Phase 2: not yet implemented".into(),
    ))
}

#[tauri::command]
pub async fn hide_provider_webview(
    state: tauri::State<'_, WebviewManager>,
    provider_id: ProviderId,
) -> AppResult<()> {
    let mut s = state.0.lock().map_err(|_| AppError::Internal("lock".into()))?;
    if s.visible.as_deref() == Some(provider_id.as_str()) {
        s.visible = None;
    }
    Ok(())
}

#[tauri::command]
pub async fn hide_all_provider_webviews(
    state: tauri::State<'_, WebviewManager>,
) -> AppResult<()> {
    let mut s = state.0.lock().map_err(|_| AppError::Internal("lock".into()))?;
    s.visible = None;
    Ok(())
}

#[tauri::command]
pub async fn set_provider_webview_bounds(
    state: tauri::State<'_, WebviewManager>,
    provider_id: ProviderId,
    bounds: Bounds,
) -> AppResult<()> {
    let mut s = state.0.lock().map_err(|_| AppError::Internal("lock".into()))?;
    s.bounds.insert(provider_id, bounds);
    Ok(())
}

#[tauri::command]
pub async fn reload_provider_webview(
    _app: AppHandle,
    state: tauri::State<'_, WebviewManager>,
    provider_id: ProviderId,
) -> AppResult<()> {
    let mut s = state.0.lock().map_err(|_| AppError::Internal("lock".into()))?;
    s.lifecycle.insert(provider_id, WebviewLifecycle::Loading);
    Err(AppError::WebviewCreateFailed(
        "Phase 2: not yet implemented".into(),
    ))
}

/// Main window label — used as the parent for embedded provider webviews
/// in Phase 2.
pub fn main_window_label() -> &'static str {
    "main"
}