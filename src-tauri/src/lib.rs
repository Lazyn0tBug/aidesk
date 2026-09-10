//! AIDesk backend entry point.
//!
//! Wires Tauri v2 + the per-design modules in §13. The `setup` hook
//! eagerly loads the runtime config so `WebviewManager` can be sized
//! against the provider list (Phase 2 will consume this).

pub mod clipboard;
pub mod commands;
pub mod config;
pub mod error;
pub mod navigation;
pub mod providers;
pub mod state;
pub mod webview_manager;

use tauri::Manager;

use crate::commands::AppServices;
use crate::webview_manager::WebviewManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Eagerly load the runtime config; if it fails the helpers
            // already fall back to defaults (design §6.3 #7).
            let user_path = crate::config::resolve_user_config_path();
            let cfg = crate::config::load_runtime_config(&user_path)
                .unwrap_or_else(|e| {
                    eprintln!("[aidesk] startup config error: {e}");
                    crate::config::AppConfig {
                        app: crate::config::AppSection::default(),
                        providers: vec![],
                        default_provider: crate::config::DefaultProvider::default(),
                        webview: crate::config::WebviewConfig::default(),
                        ui: crate::config::UiConfig {
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
                });

            app.manage(WebviewManager::from_config(&cfg));
            app.manage(AppServices::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_config,
            commands::get_enabled_providers,
            commands::get_last_active_provider,
            commands::set_last_active_provider,
            commands::copy_text,
            webview_manager::create_provider_webview,
            webview_manager::show_provider_webview,
            webview_manager::hide_provider_webview,
            webview_manager::hide_all_provider_webviews,
            webview_manager::set_provider_webview_bounds,
            webview_manager::reload_provider_webview,
            webview_manager::attach_toast_overlay,
            webview_manager::eval_provider_webview,
            webview_manager::webview_url,
            webview_manager::exit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AIDesk application");
}