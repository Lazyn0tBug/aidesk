//! Navigation whitelist + external-browser policy (design §13.6, §4.6).
//!
//! Phase 4 deliverable. Stubs return `NotImplemented` until WebView
//! navigation hooks are wired.

use url::Url;

use crate::config::{AppConfig, ProviderConfig};
use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NavigationDecision {
    Allow,
    Block,
    OpenExternal,
}

/// Decide what to do with a navigation request from `provider` to `url`.
pub fn decide(
    config: &AppConfig,
    provider: &ProviderConfig,
    url: &str,
) -> AppResult<NavigationDecision> {
    let parsed = Url::parse(url).map_err(|_| AppError::NavigationBlocked(url.into()))?;
    let host = parsed
        .host_str()
        .ok_or_else(|| AppError::NavigationBlocked(url.into()))?;

    let allowed = crate::providers::provider_allowed_hosts(config, provider);
    if crate::providers::is_host_allowed(&allowed, host) {
        return Ok(NavigationDecision::Allow);
    }

    if config.security.open_external_in_system_browser {
        Ok(NavigationDecision::OpenExternal)
    } else {
        Ok(NavigationDecision::Block)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{
        AppSection, DefaultProvider, ProviderConfig, SecurityConfig, UiConfig, WebviewConfig,
    };

    fn fixture() -> (AppConfig, ProviderConfig) {
        let cfg = AppConfig {
            app: AppSection::default(),
            providers: vec![],
            default_provider: DefaultProvider::default(),
            webview: WebviewConfig::default(),
            ui: UiConfig {
                tab_bar: crate::config::TabBarConfig::default(),
                draft_box: crate::config::DraftBoxConfig::default(),
                toast: crate::config::ToastConfig::default(),
                toolbar: crate::config::ToolbarConfig::default(),
            },
            security: SecurityConfig {
                allow_unknown_navigation: false,
                open_external_in_system_browser: true,
                global_allowed_hosts: vec!["a.example".into()],
            },
            messages: crate::config::MessagesSection::default(),
            shortcuts: crate::config::ShortcutsSection::default(),
            future: crate::config::FutureSection::default(),
        };
        let provider = ProviderConfig {
            id: "p".into(),
            name: "P".into(),
            icon_key: "p".into(),
            url: "https://a.example/".into(),
            enabled: true,
            shortcut: None,
            allowed_hosts: None,
        };
        (cfg, provider)
    }

    #[test]
    fn allows_exact_host() {
        let (cfg, p) = fixture();
        assert_eq!(
            decide(&cfg, &p, "https://a.example/path").unwrap(),
            NavigationDecision::Allow
        );
    }

    #[test]
    fn allows_subdomain_of_whitelisted_host() {
        let (cfg, p) = fixture();
        assert_eq!(
            decide(&cfg, &p, "https://chat.a.example/").unwrap(),
            NavigationDecision::Allow
        );
    }

    #[test]
    fn off_whitelist_open_external() {
        let (cfg, p) = fixture();
        assert_eq!(
            decide(&cfg, &p, "https://evil.example/").unwrap(),
            NavigationDecision::OpenExternal
        );
    }

    #[test]
    fn off_whitelist_block_when_disabled() {
        let (mut cfg, p) = fixture();
        cfg.security.open_external_in_system_browser = false;
        assert_eq!(
            decide(&cfg, &p, "https://evil.example/").unwrap(),
            NavigationDecision::Block
        );
    }
}