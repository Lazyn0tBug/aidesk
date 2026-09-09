//! Provider-related queries and whitelist computation.
//!
//! Implements design §13.4 and §16.

use std::collections::BTreeSet;

use url::Url;

use crate::config::{AppConfig, ProviderConfig, ProviderId};
use crate::error::{AppError, AppResult};

/// Return the providers that should be visible in the UI (design §4.1 #2).
pub fn enabled_providers(config: &AppConfig) -> Vec<ProviderConfig> {
    config
        .providers
        .iter()
        .filter(|p| p.enabled)
        .cloned()
        .collect()
}

/// Look up a provider by id. Returns `ProviderNotFound` if the id is
/// unknown, `ProviderDisabled` if the provider exists but `enabled: false`.
pub fn find_enabled<'a>(
    config: &'a AppConfig,
    id: &str,
) -> AppResult<&'a ProviderConfig> {
    let provider = config
        .providers
        .iter()
        .find(|p| p.id == id)
        .ok_or_else(|| AppError::ProviderNotFound(id.to_string()))?;
    if !provider.enabled {
        return Err(AppError::ProviderDisabled(id.to_string()));
    }
    Ok(provider)
}

/// Compute the active provider id at startup per design §7.4 + §4.7:
///   1. If `app.window.rememberLastProvider` and `last_active_provider_id`
///      is set and still enabled, use it.
///   2. Else, if `defaultProvider.active` is set and references an enabled
///      provider, use it.
///   3. Else, if `fallbackToFirstEnabled`, use the first enabled provider.
///   4. Else, return `Ok(None)` — frontend should show empty state.
pub fn resolve_active_provider(
    config: &AppConfig,
    last_active: Option<&str>,
) -> Option<ProviderId> {
    let enabled: Vec<&ProviderConfig> = config.providers.iter().filter(|p| p.enabled).collect();
    if enabled.is_empty() {
        return None;
    }

    if config.app.window.remember_last_provider {
        if let Some(id) = last_active {
            if enabled.iter().any(|p| p.id == id) {
                return Some(id.to_string());
            }
        }
    }

    if let Some(active) = &config.default_provider.active {
        if enabled.iter().any(|p| &p.id == active) {
            return Some(active.clone());
        }
    }

    if config.default_provider.fallback_to_first_enabled {
        return Some(enabled[0].id.clone());
    }

    None
}

/// Compute the effective navigation whitelist for a provider
/// (design §16.1):
///   1. Start with `security.globalAllowedHosts`.
///   2. Add the provider's `allowedHosts`.
///   3. Add the host of the provider's `url`.
///   4. Dedupe (case-insensitive).
pub fn provider_allowed_hosts(config: &AppConfig, provider: &ProviderConfig) -> Vec<String> {
    let mut set: BTreeSet<String> = BTreeSet::new();

    for host in &config.security.global_allowed_hosts {
        set.insert(host.to_ascii_lowercase());
    }

    if let Some(hosts) = &provider.allowed_hosts {
        for host in hosts {
            set.insert(host.to_ascii_lowercase());
        }
    }

    if let Ok(url) = Url::parse(&provider.url) {
        if let Some(host) = url.host_str() {
            set.insert(host.to_ascii_lowercase());
        }
    }

    set.into_iter().collect()
}

/// Test whether a URL's host is allowed by the provider's whitelist.
/// Matches the host itself and all of its subdomains (design §16.3 #2).
pub fn is_host_allowed(allowed_hosts: &[String], url_host: &str) -> bool {
    let url_host = url_host.to_ascii_lowercase();
    allowed_hosts.iter().any(|allowed| {
        let allowed = allowed.to_ascii_lowercase();
        url_host == allowed || url_host.ends_with(&format!(".{allowed}"))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{AppConfig, AppSection, DefaultProvider, SecurityConfig, WebviewConfig};

    fn minimal_config() -> AppConfig {
        AppConfig {
            app: AppSection::default(),
            providers: vec![],
            default_provider: DefaultProvider::default(),
            webview: WebviewConfig::default(),
            ui: crate::config::UiConfig {
                tab_bar: crate::config::TabBarConfig::default(),
                draft_box: crate::config::DraftBoxConfig::default(),
                toast: crate::config::ToastConfig::default(),
                toolbar: crate::config::ToolbarConfig::default(),
            },
            security: SecurityConfig {
                allow_unknown_navigation: false,
                open_external_in_system_browser: true,
                global_allowed_hosts: vec!["global.example".into()],
            },
            messages: crate::config::MessagesSection::default(),
            shortcuts: crate::config::ShortcutsSection::default(),
            future: crate::config::FutureSection::default(),
        }
    }

    #[test]
    fn whitelist_includes_global_provider_and_url_host() {
        let mut cfg = minimal_config();
        cfg.providers.push(ProviderConfig {
            id: "x".into(),
            name: "X".into(),
            icon_key: "x".into(),
            url: "https://app.example.com/".into(),
            enabled: true,
            shortcut: None,
            allowed_hosts: Some(vec!["extra.example".into()]),
        });
        let hosts = provider_allowed_hosts(&cfg, &cfg.providers[0]);
        assert!(hosts.iter().any(|h| h == "global.example"));
        assert!(hosts.iter().any(|h| h == "extra.example"));
        assert!(hosts.iter().any(|h| h == "app.example.com"));
    }

    #[test]
    fn whitelist_dedupes_case_insensitively() {
        let mut cfg = minimal_config();
        cfg.providers.push(ProviderConfig {
            id: "x".into(),
            name: "X".into(),
            icon_key: "x".into(),
            url: "https://APP.example.com/".into(),
            enabled: true,
            shortcut: None,
            allowed_hosts: Some(vec!["app.example.com".into()]),
        });
        let hosts = provider_allowed_hosts(&cfg, &cfg.providers[0]);
        assert_eq!(
            hosts.iter().filter(|h| *h == "app.example.com").count(),
            1
        );
    }

    #[test]
    fn subdomain_match_works() {
        assert!(is_host_allowed(&["example.com".into()], "sub.example.com"));
        assert!(is_host_allowed(&["example.com".into()], "EXAMPLE.com"));
        assert!(!is_host_allowed(&["example.com".into()], "evil.com"));
        assert!(!is_host_allowed(&["example.com".into()], "notexample.com"));
    }

    #[test]
    fn resolve_active_prefers_last_then_default_then_first() {
        let mut cfg = minimal_config();
        cfg.providers = vec![
            ProviderConfig {
                id: "a".into(),
                name: "A".into(),
                icon_key: "a".into(),
                url: "https://a.example/".into(),
                enabled: true,
                shortcut: None,
                allowed_hosts: None,
            },
            ProviderConfig {
                id: "b".into(),
                name: "B".into(),
                icon_key: "b".into(),
                url: "https://b.example/".into(),
                enabled: true,
                shortcut: None,
                allowed_hosts: None,
            },
        ];
        cfg.default_provider.active = Some("b".into());

        // Last active takes precedence.
        assert_eq!(
            resolve_active_provider(&cfg, Some("a")),
            Some("a".into())
        );

        // Falls back to defaultProvider.active.
        assert_eq!(
            resolve_active_provider(&cfg, None),
            Some("b".into())
        );

        // Falls back to first enabled when default missing.
        cfg.default_provider.active = None;
        assert_eq!(
            resolve_active_provider(&cfg, None),
            Some("a".into())
        );

        // Skips last active if disabled.
        cfg.providers[0].enabled = false;
        assert_eq!(
            resolve_active_provider(&cfg, Some("a")),
            Some("b".into())
        );
    }
}