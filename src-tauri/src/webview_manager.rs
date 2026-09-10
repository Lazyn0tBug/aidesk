//! WebView lifecycle manager (design §13.5).
//!
//! Phase 2: real Tauri v2 webview management. Each enabled provider gets
//! one embedded webview attached to the main window via
//! `Window::add_child(WebviewBuilder, position, size)`. This is the only
//! path in Tauri v2 that renders the provider's content INSIDE the main
//! window's frame — the alternative `WebviewWindowBuilder::parent()`
//! creates a separate child OS window, not an embedded view. The
//! `add_child` API is gated on the `unstable` feature flag, which we
//! enable in `Cargo.toml` (the only place this flag is needed).
//!
//! Navigation is gated by an `on_navigation` hook that consults the
//! per-provider whitelist from `providers::provider_allowed_hosts`
//! (design §4.6, §16).
//!
//! Concurrency: a single `Mutex<WebviewState>` guards the in-memory map.
//! Locks are held only long enough to read or update an entry; no Tauri
//! API call is made while holding the guard.

use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::webview::WebviewBuilder;
use tauri::window::Color;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, Runtime, WebviewUrl};

use crate::config::{AppConfig, ProviderId};
use crate::error::{AppError, AppResult};
use crate::navigation;
use crate::providers;

/// Wire type matching design §12.6 (`Bounds`).
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Bounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Default)]
pub struct WebviewState {
    /// Maps `provider_id -> entry meta`. The actual `WebviewWindow<R>`
    /// is accessed via `app.get_webview_window(&label)` rather than stored
    /// here so the struct stays runtime-agnostic.
    pub entries: HashMap<ProviderId, WebviewEntry>,
    /// Currently visible provider, if any. At most one per design §3.1 #4.
    pub visible: Option<ProviderId>,
    /// True once the toast overlay child webview has been attached.
    /// Used to make `attach_toast_overlay` idempotent (re-calling it on
    /// every bounds emission then just resizes the overlay).
    pub toast_attached: bool,
}

#[derive(Debug, Clone)]
pub struct WebviewEntry {
    pub label: String,
    pub bounds: Bounds,
    pub visible: bool,
}

/// Managed Tauri state wrapping the lifecycle map plus the runtime
/// `AppConfig` (so command handlers can resolve providers and compute
/// per-provider whitelists without re-reading from disk).
pub struct WebviewManager {
    pub state: Mutex<WebviewState>,
    pub config: AppConfig,
}

impl WebviewManager {
    pub fn from_config(config: &AppConfig) -> Self {
        Self {
            state: Mutex::new(WebviewState::default()),
            config: config.clone(),
        }
    }

    /// Convenience for tests / debug commands.
    #[allow(dead_code)]
    pub fn snapshot(&self) -> WebviewState {
        self.state
            .lock()
            .map(|s| WebviewState {
                entries: s.entries.clone(),
                visible: s.visible.clone(),
                toast_attached: s.toast_attached,
            })
            .unwrap_or_default()
    }
}

fn webview_label(provider_id: &str) -> String {
    format!("provider-{provider_id}")
}

/// Reserved label for the toast overlay child webview.
fn toast_label() -> &'static str {
    "toast"
}

/// Look up an embedded child webview by label.
fn get_child_webview<R: Runtime>(
    app: &AppHandle<R>,
    label: &str,
) -> AppResult<tauri::Webview<R>> {
    app.get_webview(label)
        .ok_or_else(|| AppError::WebviewCreateFailed(format!("webview {label} not found")))
}

/// Look up the main `Window` — needed so we can call `add_child` to
/// attach embedded provider webviews to it. We use `get_window` (not
/// `get_webview_window`) because `add_child` is defined on `Window<R>`,
/// not `WebviewWindow<R>`.
fn get_main_window<R: Runtime>(app: &AppHandle<R>) -> AppResult<tauri::Window<R>> {
    app.get_window(main_window_label())
        .ok_or_else(|| AppError::WebviewCreateFailed(format!("main window not found")))
}

// -----------------------------------------------------------------------------
// Tauri commands
// -----------------------------------------------------------------------------

/// Create the WebView for a provider (design §12.3, §4.3).
///
/// Idempotent in the strict sense: re-creating a provider that already has
/// a webview is a no-op success. Per design §4.3 #2 ("首次点击 Provider 时
/// 创建对应 WebView") the frontend only calls this once per provider; the
/// defensive check guards against double-invocation during a tab race.
#[tauri::command]
pub async fn create_provider_webview<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, WebviewManager>,
    provider_id: ProviderId,
    bounds: Bounds,
) -> AppResult<()> {
    let cfg = state.config.clone();
    let provider = providers::find_enabled(&cfg, &provider_id)?;

    {
        let s = state.state.lock().map_err(|_| AppError::Internal(String::from("lock")))?;
        if s.entries.contains_key(&provider_id) {
            return Ok(());
        }
    }

    let url = WebviewUrl::External(
        provider
            .url
            .parse()
            .map_err(|e| AppError::WebviewCreateFailed(format!("parse url: {e}")))?,
    );

    let label = webview_label(&provider_id);
    let open_external = cfg.security.open_external_in_system_browser;
    let provider_for_decide = provider.clone();
    let cfg_for_decide = cfg.clone();
    let app_for_decide = app.clone();

    let parent_window = get_main_window(&app)?;
    parent_window
        .add_child(
            WebviewBuilder::new(&label, url).on_navigation(move |nav_url: &url::Url| {
                let decision =
                    navigation::decide(&cfg_for_decide, &provider_for_decide, nav_url.as_str());
                match decision {
                    Ok(navigation::NavigationDecision::Allow) => true,
                    Ok(navigation::NavigationDecision::Block) => false,
                    Ok(navigation::NavigationDecision::OpenExternal) => {
                        if open_external {
                            // Spawn an external-browser open from the
                            // navigation hook. The hook itself returns
                            // false so the in-webview navigation is blocked.
                            let app = app_for_decide.clone();
                            let url = nav_url.to_string();
                            tauri::async_runtime::spawn(async move {
                                use tauri_plugin_opener::OpenerExt;
                                if let Err(e) = app.opener().open_url(url, None::<&str>) {
                                    eprintln!("[aidesk] open_url failed: {e}");
                                }
                            });
                        }
                        false
                    }
                    Err(_) => false,
                }
            }),
            // Embedded children take coordinates in the parent's content
            // area, in logical pixels. No title-bar offset or scale-factor
            // math needed (compare to the `WebviewWindowBuilder::parent`
            // path which produces a separate OS window at screen-absolute
            // coords).
            LogicalPosition::new(bounds.x as f64, bounds.y as f64),
            LogicalSize::new(bounds.width as f64, bounds.height as f64),
        )
        .map_err(|e| AppError::WebviewCreateFailed(format!("add_child: {e}")))?;

    let mut s = state.state.lock().map_err(|_| AppError::Internal(String::from("lock")))?;
    s.entries.insert(
        provider_id.clone(),
        WebviewEntry {
            label,
            bounds,
            visible: false,
        },
    );
    Ok(())
}

/// Show a previously created WebView (design §12.3).
///
/// Implementation detail: hides the previously visible provider in the same
/// call so the invariant "at most one visible WebView" (design §3.1 #4,
/// §4.3 #6) holds without a separate `hide_all` round-trip.
#[tauri::command]
pub async fn show_provider_webview<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, WebviewManager>,
    provider_id: ProviderId,
    bounds: Bounds,
) -> AppResult<()> {
    // Snapshot the entries we need while holding the lock.
    let (label, to_hide) = {
        let s = state.state.lock().map_err(|_| AppError::Internal(String::from("lock")))?;
        let entry = s
            .entries
            .get(&provider_id)
            .ok_or_else(|| AppError::ProviderNotFound(provider_id.clone()))?;
        let label = entry.label.clone();
        let to_hide = match &s.visible {
            Some(prev) if prev != &provider_id => s.entries.get(prev).map(|e| e.label.clone()),
            _ => None,
        };
        (label, to_hide)
    };

    if let Some(prev_label) = to_hide {
        if let Ok(prev) = get_child_webview(&app, &prev_label) {
            let _ = prev.hide();
        }
    }

    let child = get_child_webview(&app, &label)?;
    child
        .set_position(LogicalPosition::new(bounds.x as f64, bounds.y as f64))
        .map_err(|e| AppError::WebviewBoundsFailed(format!("set_position: {e}")))?;
    child
        .set_size(LogicalSize::new(bounds.width as f64, bounds.height as f64))
        .map_err(|e| AppError::WebviewBoundsFailed(format!("set_size: {e}")))?;
    child
        .show()
        .map_err(|e| AppError::WebviewShowFailed(format!("show: {e}")))?;

    let mut s = state.state.lock().map_err(|_| AppError::Internal(String::from("lock")))?;
    if let Some(prev) = s.visible.take() {
        if let Some(prev_entry) = s.entries.get_mut(&prev) {
            prev_entry.visible = false;
        }
    }
    if let Some(entry) = s.entries.get_mut(&provider_id) {
        entry.bounds = bounds;
        entry.visible = true;
    }
    s.visible = Some(provider_id);
    Ok(())
}

#[tauri::command]
pub async fn hide_provider_webview(
    state: tauri::State<'_, WebviewManager>,
    provider_id: ProviderId,
) -> AppResult<()> {
    let mut s = state.state.lock().map_err(|_| AppError::Internal(String::from("lock")))?;
    if s.visible.as_deref() == Some(provider_id.as_str()) {
        s.visible = None;
    }
    if let Some(entry) = s.entries.get_mut(&provider_id) {
        entry.visible = false;
    }
    Ok(())
}

#[tauri::command]
pub async fn hide_all_provider_webviews<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, WebviewManager>,
) -> AppResult<()> {
    let labels: Vec<String> = {
        let s = state.state.lock().map_err(|_| AppError::Internal(String::from("lock")))?;
        s.entries.values().map(|e| e.label.clone()).collect()
    };
    for label in labels {
        if let Ok(wv) = get_child_webview(&app, &label) {
            let _ = wv.hide();
        }
    }
    let mut s = state.state.lock().map_err(|_| AppError::Internal(String::from("lock")))?;
    for entry in s.entries.values_mut() {
        entry.visible = false;
    }
    s.visible = None;
    Ok(())
}

#[tauri::command]
pub async fn set_provider_webview_bounds<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, WebviewManager>,
    provider_id: ProviderId,
    bounds: Bounds,
) -> AppResult<()> {
    let label = {
        let s = state.state.lock().map_err(|_| AppError::Internal(String::from("lock")))?;
        s.entries
            .get(&provider_id)
            .ok_or_else(|| AppError::ProviderNotFound(provider_id.clone()))?
            .label
            .clone()
    };

    let child = get_child_webview(&app, &label)?;
    child
        .set_position(LogicalPosition::new(bounds.x as f64, bounds.y as f64))
        .map_err(|e| AppError::WebviewBoundsFailed(format!("set_position: {e}")))?;
    child
        .set_size(LogicalSize::new(bounds.width as f64, bounds.height as f64))
        .map_err(|e| AppError::WebviewBoundsFailed(format!("set_size: {e}")))?;

    let mut s = state.state.lock().map_err(|_| AppError::Internal(String::from("lock")))?;
    if let Some(entry) = s.entries.get_mut(&provider_id) {
        entry.bounds = bounds;
    }
    Ok(())
}

#[tauri::command]
pub async fn reload_provider_webview<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, WebviewManager>,
    provider_id: ProviderId,
) -> AppResult<()> {
    let label = {
        let s = state.state.lock().map_err(|_| AppError::Internal(String::from("lock")))?;
        s.entries
            .get(&provider_id)
            .ok_or_else(|| AppError::ProviderNotFound(provider_id.clone()))?
            .label
            .clone()
    };

    let child = get_child_webview(&app, &label)?;
    child
        .reload()
        .map_err(|e| AppError::WebviewCreateFailed(format!("reload: {e}")))?;
    Ok(())
}

/// Attach (or resize) the toast overlay child webview.
///
/// The toast overlay covers the entire main-window content area with a
/// transparent background, so it can be positioned at `(0, 0)` with
/// the full content size. The toast `<div>` is `position: fixed` inside
/// the overlay HTML, anchored to bottom-right — the overlay itself
/// doesn't need to know the toast's position.
///
/// `add_child` is called on the first invocation; subsequent calls
/// just resize the existing overlay. This makes the command safe to
/// invoke on every bounds emission from the frontend.
///
/// The toast overlay must be attached **after** any provider webview
/// for the native z-order to put it on top — `Window::add_child` adds
/// children in z-order top-most last. The frontend guarantees this by
/// calling `attach_toast_overlay` from `App.vue::onBounds`, which
/// fires after the active provider has been created/shown.
#[tauri::command]
pub async fn attach_toast_overlay<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, WebviewManager>,
    bounds: Bounds,
) -> AppResult<()> {
    let already_attached = {
        let s = state.state.lock().map_err(|_| AppError::Internal(String::from("lock")))?;
        s.toast_attached
    };

    if already_attached {
        // Just resize the existing overlay.
        let child = get_child_webview(&app, toast_label())?;
        child
            .set_size(LogicalSize::new(bounds.width as f64, bounds.height as f64))
            .map_err(|e| AppError::WebviewBoundsFailed(format!("toast set_size: {e}")))?;
        return Ok(());
    }

    let parent_window = get_main_window(&app)?;
    parent_window
        .add_child(
            // `Color(0,0,0,0)` makes the OS-level webview background
            // transparent — without this, the overlay covers the TabBar
            // and any other HTML behind it with the platform's default
            // (usually white). The HTML body is also `background:
            // transparent` for belt-and-suspenders, but the OS layer is
            // the one that paints first.
            WebviewBuilder::new(toast_label(), WebviewUrl::App("toast.html".into()))
                .background_color(Color(0, 0, 0, 0)),
            LogicalPosition::new(0.0, 0.0),
            LogicalSize::new(bounds.width as f64, bounds.height as f64),
        )
        .map_err(|e| AppError::WebviewCreateFailed(format!("toast add_child: {e}")))?;

    let mut s = state.state.lock().map_err(|_| AppError::Internal(String::from("lock")))?;
    s.toast_attached = true;
    Ok(())
}

/// Run an arbitrary `JS` expression in the active provider webview. Used
/// for browser-history controls (`history.back()` / `history.forward()`
/// / `location.reload()`). Returns silently on JS errors so a single
/// stuck webview doesn't surface a toast — the browser-control UI
/// shows the failure as a disabled-button state.
#[tauri::command]
pub async fn eval_provider_webview<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, WebviewManager>,
    provider_id: ProviderId,
    js: String,
) -> AppResult<()> {
    let label = {
        let s = state.state.lock().map_err(|_| AppError::Internal(String::from("lock")))?;
        s.entries
            .get(&provider_id)
            .ok_or_else(|| AppError::ProviderNotFound(provider_id.clone()))?
            .label
            .clone()
    };
    let child = get_child_webview(&app, &label)?;
    // Eval errors (e.g. running `history.back()` with no history) are
    // swallowed — Tauri returns Result<()> from eval and we'd rather
    // stay silent than surface a "no previous page" error to the
    // user, since the toolbar button itself is the UI affordance.
    let _ = child.eval(js);
    Ok(())
}

/// Main window label — used as the parent for embedded provider webviews.
pub fn main_window_label() -> &'static str {
    "main"
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ProviderConfig;
    use crate::config::{
        AppConfig, AppSection, DefaultProvider, UiConfig, WebviewConfig,
    };

    fn fixture_config() -> AppConfig {
        AppConfig {
            app: AppSection::default(),
            providers: vec![ProviderConfig {
                id: "qwen".into(),
                name: "Qwen".into(),
                icon_key: "qwen".into(),
                url: "https://chat.qwen.ai/".into(),
                enabled: true,
                shortcut: None,
                allowed_hosts: None,
            }],
            default_provider: DefaultProvider::default(),
            webview: WebviewConfig::default(),
            ui: UiConfig {
                tab_bar: crate::config::TabBarConfig::default(),
                draft_box: crate::config::DraftBoxConfig::default(),
                toast: crate::config::ToastConfig::default(),
                toolbar: crate::config::ToolbarConfig::default(),
            },
            security: crate::config::SecurityConfig::default(),
            messages: crate::config::MessagesSection::default(),
            shortcuts: crate::config::ShortcutsSection::default(),
            future: crate::config::FutureSection::default(),
        }
    }

    #[test]
    fn manager_starts_empty() {
        let m = WebviewManager::from_config(&fixture_config());
        let snap = m.snapshot();
        assert!(snap.entries.is_empty());
        assert!(snap.visible.is_none());
    }

    #[test]
    fn webview_label_format() {
        assert_eq!(webview_label("qwen"), "provider-qwen");
    }

    #[test]
    fn webview_label_includes_provider_id_only() {
        // Sanity check: only alphanumeric + dash/underscore, which is
        // what Tauri's label validation accepts and matches the
        // config.rs regex `^[a-z0-9][a-z0-9-_]{1,63}$` that permits
        // `_` from position 1 onwards.
        let label = webview_label("foo_bar");
        assert!(label.starts_with("provider-"));
        assert!(label
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_'));
    }

    #[test]
    fn snapshot_is_empty_after_construction() {
        let m = WebviewManager::from_config(&fixture_config());
        let snap = m.snapshot();
        assert!(snap.entries.is_empty());
        assert!(snap.visible.is_none());
    }
}