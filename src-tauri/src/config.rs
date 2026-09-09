//! Configuration loading, merging, validation.
//!
//! Implements design §6 and §7. The compile-time embedded default config is
//! the authoritative baseline; an optional user config file is deep-merged
//! on top, then validated. On any failure during user-merge or validation
//! we keep the default config running (design §6.3 #7).
//!
//! Public surface:
//!   - [`AppConfig`]      — typed runtime config
//!   - [`load_runtime_config`] — entry point used by `commands.rs`

use std::path::{Path as StdPath, PathBuf};

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::error::{AppError, AppResult};

// -----------------------------------------------------------------------------
// Types — match design §11.1 exactly.
// -----------------------------------------------------------------------------

pub type ProviderId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ProviderConfig {
    pub id: ProviderId,
    pub name: String,
    pub icon_key: String,
    pub url: String,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub shortcut: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub allowed_hosts: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default = "default_app_section")]
    pub app: AppSection,
    pub providers: Vec<ProviderConfig>,
    pub default_provider: DefaultProvider,
    pub webview: WebviewConfig,
    pub ui: UiConfig,
    pub security: SecurityConfig,
    #[serde(default = "default_messages_section")]
    pub messages: MessagesSection,
    #[serde(default = "default_shortcuts_section")]
    pub shortcuts: ShortcutsSection,
    #[serde(default = "default_future_section")]
    pub future: FutureSection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct AppSection {
    pub name: String,
    pub version: String,
    pub window: WindowConfig,
}

impl Default for AppSection {
    fn default() -> Self {
        Self {
            name: "AIDesk".into(),
            version: "0.1.0".into(),
            window: WindowConfig::default(),
        }
    }
}

fn default_app_section() -> AppSection {
    AppSection::default()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct WindowConfig {
    pub title: String,
    pub width: u32,
    pub height: u32,
    pub min_width: u32,
    pub min_height: u32,
    pub remember_last_provider: bool,
}

impl Default for WindowConfig {
    fn default() -> Self {
        Self {
            title: "AIDesk".into(),
            width: 1280,
            height: 800,
            min_width: 900,
            min_height: 600,
            remember_last_provider: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct DefaultProvider {
    #[serde(default)]
    pub active: Option<ProviderId>,
    pub fallback_to_first_enabled: bool,
}

impl Default for DefaultProvider {
    fn default() -> Self {
        Self {
            active: None,
            fallback_to_first_enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct WebviewConfig {
    pub lazy_load: bool,
    pub keep_alive: bool,
    pub max_active_webviews: u32,
    pub reload_on_fail: bool,
}

impl Default for WebviewConfig {
    fn default() -> Self {
        Self {
            lazy_load: true,
            keep_alive: true,
            max_active_webviews: 5,
            reload_on_fail: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct UiConfig {
    pub tab_bar: TabBarConfig,
    pub draft_box: DraftBoxConfig,
    #[serde(default = "default_toast_section")]
    pub toast: ToastConfig,
    #[serde(default = "default_toolbar_section")]
    pub toolbar: ToolbarConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct TabBarConfig {
    pub position: String,
    pub show_icon: bool,
    pub show_name: bool,
    pub icon_only: bool,
}

impl Default for TabBarConfig {
    fn default() -> Self {
        Self {
            position: "top".into(),
            show_icon: true,
            show_name: true,
            icon_only: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct DraftBoxConfig {
    pub enabled: bool,
    pub placeholder: String,
    pub copy_on_switch: bool,
    pub clear_after_copy: bool,
    pub max_lines: u32,
}

impl Default for DraftBoxConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            placeholder: "输入你想问的问题".into(),
            copy_on_switch: true,
            clear_after_copy: false,
            max_lines: 6,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ToastConfig {
    pub duration_ms: u32,
}

impl Default for ToastConfig {
    fn default() -> Self {
        Self { duration_ms: 2500 }
    }
}

fn default_toast_section() -> ToastConfig {
    ToastConfig::default()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ToolbarConfig {
    pub enabled: bool,
    pub position: String,
}

impl Default for ToolbarConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            position: "right".into(),
        }
    }
}

fn default_toolbar_section() -> ToolbarConfig {
    ToolbarConfig::default()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct SecurityConfig {
    pub allow_unknown_navigation: bool,
    pub open_external_in_system_browser: bool,
    pub global_allowed_hosts: Vec<String>,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            allow_unknown_navigation: false,
            open_external_in_system_browser: true,
            global_allowed_hosts: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MessagesSection {
    #[serde(default = "default_loading_msg")]
    pub loading: String,
    #[serde(default = "default_load_failed_msg")]
    pub load_failed: String,
    #[serde(default = "default_copied_msg")]
    pub copied: String,
    #[serde(default = "default_copy_failed_msg")]
    pub copy_failed: String,
    #[serde(default = "default_reload_msg")]
    pub reload: String,
}

impl Default for MessagesSection {
    fn default() -> Self {
        Self {
            loading: default_loading_msg(),
            load_failed: default_load_failed_msg(),
            copied: default_copied_msg(),
            copy_failed: default_copy_failed_msg(),
            reload: default_reload_msg(),
        }
    }
}

fn default_messages_section() -> MessagesSection {
    MessagesSection::default()
}

fn default_loading_msg() -> String {
    "正在打开 {provider}...".into()
}
fn default_load_failed_msg() -> String {
    "页面加载失败".into()
}
fn default_copied_msg() -> String {
    "已复制，粘贴即可发送".into()
}
fn default_copy_failed_msg() -> String {
    "复制失败，请手动复制".into()
}
fn default_reload_msg() -> String {
    "重新加载".into()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ShortcutsSection {
    #[serde(default)]
    pub focus_draft_box: Option<String>,
    #[serde(default)]
    pub switch_provider_prefix: Option<String>,
}

fn default_shortcuts_section() -> ShortcutsSection {
    ShortcutsSection::default()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct FutureSection {
    pub auto_focus_input: bool,
    pub auto_fill_input: bool,
    pub auto_submit: bool,
    pub sidebar: bool,
    pub prompt_templates: bool,
    pub answer_relay: bool,
}

impl Default for FutureSection {
    fn default() -> Self {
        Self {
            auto_focus_input: false,
            auto_fill_input: false,
            auto_submit: false,
            sidebar: false,
            prompt_templates: false,
            answer_relay: false,
        }
    }
}

fn default_future_section() -> FutureSection {
    FutureSection::default()
}

// -----------------------------------------------------------------------------
// Loading & merging
// -----------------------------------------------------------------------------

/// Default config baked into the binary at compile time.
const DEFAULT_CONFIG_JSON: &str = include_str!("../../config/app.config.default.json");

/// Read the default config as a JSON `Value`. Always succeeds because the
/// embedded JSON is part of the build.
pub fn default_config_value() -> AppResult<Value> {
    serde_json::from_str(DEFAULT_CONFIG_JSON)
        .map_err(|e| AppError::ConfigLoadFailed(format!("embedded default config invalid: {e}")))
}

/// Read the user override config from disk. Returns `Value::Null` when the
/// file does not exist (treated as empty override).
pub fn user_config_value(path: &StdPath) -> AppResult<Value> {
    if !path.exists() {
        return Ok(Value::Null);
    }
    let raw = std::fs::read_to_string(path).map_err(|e| {
        AppError::ConfigLoadFailed(format!("read {}: {e}", path.display()))
    })?;
    if raw.trim().is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str(&raw)
        .map_err(|e| AppError::ConfigLoadFailed(format!("parse {}: {e}", path.display())))
}

/// Deep-merge `user` into `base` per design §6.3:
///   1. Top-level objects are deep-merged.
///   2. The `providers` array is replaced wholesale (no per-id merge).
///   3. Other arrays follow standard deep-merge semantics.
pub fn deep_merge(base: Value, user: Value) -> Value {
    match (base, user) {
        (Value::Object(mut base_map), Value::Object(user_map)) => {
            for (key, user_val) in user_map {
                if key == "providers" {
                    // Design §6.3 #2: providers array replaced wholesale.
                    base_map.insert(key, user_val);
                    continue;
                }
                let merged = match base_map.remove(&key) {
                    Some(base_val) => deep_merge(base_val, user_val),
                    None => user_val,
                };
                base_map.insert(key, merged);
            }
            Value::Object(base_map)
        }
        (base, Value::Object(_)) => base,
        (_, user) => user,
    }
}

/// Validate a merged config JSON value against design §7 constraints.
pub fn validate(value: &Value) -> AppResult<()> {
    let id_re = Regex::new(r"^[a-z0-9][a-z0-9-_]{1,63}$")
        .expect("id regex compiles");
    let host_re = Regex::new(r"^[a-z0-9.-]+(:[0-9]+)?$")
        .expect("host regex compiles");

    let providers = value
        .get("providers")
        .and_then(Value::as_array)
        .ok_or_else(|| AppError::ConfigValidationFailed("providers missing".into()))?;

    if providers.is_empty() {
        return Err(AppError::ConfigValidationFailed(
            "providers must be non-empty".into(),
        ));
    }

    let mut seen_ids = std::collections::HashSet::new();
    let mut seen_shortcuts = std::collections::HashSet::new();

    for (i, p) in providers.iter().enumerate() {
        let id = p
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| AppError::ConfigValidationFailed(format!("providers[{i}].id missing")))?;
        if !id_re.is_match(id) {
            return Err(AppError::ConfigValidationFailed(format!(
                "providers[{i}].id '{id}' violates id pattern"
            )));
        }
        if !seen_ids.insert(id.to_string()) {
            return Err(AppError::ConfigValidationFailed(format!(
                "providers[{i}].id '{id}' is duplicated"
            )));
        }

        let icon_key = p
            .get("iconKey")
            .and_then(Value::as_str)
            .ok_or_else(|| {
                AppError::ConfigValidationFailed(format!("providers[{i}].iconKey missing"))
            })?;
        if !id_re.is_match(icon_key) {
            return Err(AppError::ConfigValidationFailed(format!(
                "providers[{i}].iconKey '{icon_key}' violates pattern"
            )));
        }

        let url = p
            .get("url")
            .and_then(Value::as_str)
            .ok_or_else(|| AppError::ConfigValidationFailed(format!("providers[{i}].url missing")))?;
        if !url.starts_with("https://") {
            return Err(AppError::ConfigValidationFailed(format!(
                "providers[{i}].url must be https://"
            )));
        }

        if let Some(shortcut) = p.get("shortcut").and_then(Value::as_str) {
            if !seen_shortcuts.insert(shortcut.to_string()) {
                return Err(AppError::ConfigValidationFailed(format!(
                    "providers[{i}].shortcut '{shortcut}' is duplicated"
                )));
            }
        }

        if let Some(hosts) = p.get("allowedHosts").and_then(Value::as_array) {
            for h in hosts {
                let host = h.as_str().ok_or_else(|| {
                    AppError::ConfigValidationFailed(format!(
                        "providers[{i}].allowedHosts must be strings"
                    ))
                })?;
                if !host_re.is_match(host) {
                    return Err(AppError::ConfigValidationFailed(format!(
                        "providers[{i}].allowedHosts entry '{host}' violates host pattern"
                    )));
                }
            }
        }
    }

    // maxActiveWebviews range check.
    if let Some(max) = value
        .get("webview")
        .and_then(|w| w.get("maxActiveWebviews"))
        .and_then(Value::as_u64)
    {
        if !(1..=10).contains(&max) {
            return Err(AppError::ConfigValidationFailed(format!(
                "webview.maxActiveWebviews {max} out of range [1, 10]"
            )));
        }
    }

    // durationMs range check.
    if let Some(d) = value
        .get("ui")
        .and_then(|u| u.get("toast"))
        .and_then(|t| t.get("durationMs"))
        .and_then(Value::as_u64)
    {
        if !(1000..=10000).contains(&d) {
            return Err(AppError::ConfigValidationFailed(format!(
                "ui.toast.durationMs {d} out of range [1000, 10000]"
            )));
        }
    }

    Ok(())
}

/// End-to-end loader: read default → read user (if present) → merge →
/// validate → deserialize into [`AppConfig`].
///
/// On user-merge or validation failure, falls back to the default config
/// (design §6.3 #7).
pub fn load_runtime_config(user_config_path: &StdPath) -> AppResult<AppConfig> {
    let default_value = default_config_value()?;

    let merged = match user_config_value(user_config_path) {
        Ok(Value::Null) => default_value.clone(),
        Ok(user_value) => deep_merge(default_value.clone(), user_value),
        Err(_) => default_value.clone(),
    };

    if let Err(e) = validate(&merged) {
        eprintln!("[aidesk] config validation failed: {e}; falling back to defaults");
        let value = default_config_value()?;
        return deserialize_app_config(value);
    }

    deserialize_app_config(merged)
}

fn deserialize_app_config(value: Value) -> AppResult<AppConfig> {
    serde_json::from_value(value).map_err(|e| {
        AppError::ConfigValidationFailed(format!("deserialize AppConfig: {e}"))
    })
}

/// Default file name used when looking up the user override config.
pub const USER_CONFIG_FILENAME: &str = "app.config.json";

/// Default directory name under the OS config dir for AIDesk files.
pub const APP_CONFIG_DIR_NAME: &str = "AIDesk";

/// Resolve the user config file path. Caller must ensure the directory
/// exists if writing; for read-only flows this returns a non-existing path
/// which is handled gracefully by [`user_config_value`].
pub fn resolve_user_config_path() -> PathBuf {
    if let Some(mut dir) = dirs::config_dir() {
        dir.push(APP_CONFIG_DIR_NAME);
        dir.push(USER_CONFIG_FILENAME);
        return dir;
    }
    PathBuf::from(USER_CONFIG_FILENAME)
}

// Re-export for the json! macro in helpers.
#[allow(dead_code)]
fn _json_helper() -> Value {
    json!({})
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_deserializes() {
        let cfg = load_runtime_config(StdPath::new("/nonexistent/app.config.json"))
            .expect("default loads");
        assert!(!cfg.providers.is_empty());
        assert!(cfg.providers.iter().any(|p| p.enabled));
    }

    #[test]
    fn deep_merge_replaces_providers_whole() {
        let base = serde_json::json!({
            "providers": [{"id": "a", "enabled": true}],
            "ui": {"draftBox": {"enabled": true}},
        });
        let user = serde_json::json!({
            "providers": [{"id": "b", "enabled": true}],
            "ui": {"draftBox": {"enabled": false}},
        });
        let merged = deep_merge(base, user);
        let providers = merged.get("providers").unwrap().as_array().unwrap();
        assert_eq!(providers.len(), 1);
        assert_eq!(providers[0]["id"], "b");
        assert_eq!(
            merged["ui"]["draftBox"]["enabled"],
            serde_json::json!(false)
        );
    }

    #[test]
    fn validate_rejects_duplicate_id() {
        let v = serde_json::json!({
            "providers": [
                {"id": "dup", "name": "A", "iconKey": "a", "url": "https://a/", "enabled": true},
                {"id": "dup", "name": "B", "iconKey": "b", "url": "https://b/", "enabled": true},
            ]
        });
        assert!(validate(&v).is_err());
    }

    #[test]
    fn validate_rejects_http_url() {
        let v = serde_json::json!({
            "providers": [
                {"id": "x", "name": "X", "iconKey": "x", "url": "http://insecure/", "enabled": true},
            ]
        });
        assert!(validate(&v).is_err());
    }
}