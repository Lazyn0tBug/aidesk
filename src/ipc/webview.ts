// §12.3 webview commands. Bodies in `webview_manager.rs` are stubs that
// error with "Phase 2 not yet implemented" until Phase 2 lands; calling
// these will reject the returned promise.
import { invoke } from "@tauri-apps/api/core";
import type { Bounds, ProviderId } from "../types";

export function createProviderWebview(providerId: ProviderId, bounds: Bounds): Promise<void> {
  return invoke<void>("create_provider_webview", { providerId, bounds });
}

export function showProviderWebview(providerId: ProviderId, bounds: Bounds): Promise<void> {
  return invoke<void>("show_provider_webview", { providerId, bounds });
}

export function hideProviderWebview(providerId: ProviderId): Promise<void> {
  return invoke<void>("hide_provider_webview", { providerId });
}

export function hideAllProviderWebviews(): Promise<void> {
  return invoke<void>("hide_all_provider_webviews");
}

export function setProviderWebviewBounds(providerId: ProviderId, bounds: Bounds): Promise<void> {
  return invoke<void>("set_provider_webview_bounds", { providerId, bounds });
}

export function reloadProviderWebview(providerId: ProviderId): Promise<void> {
  return invoke<void>("reload_provider_webview", { providerId });
}

// Browser-history controls. The Rust side runs these as `eval` on the
// provider webview, so they use the webview's own history stack — no
// state to keep in sync on the Tauri side.
export function webviewBack(providerId: ProviderId): Promise<void> {
  return invoke<void>("eval_provider_webview", {
    providerId,
    js: "history.back()",
  });
}

export function webviewForward(providerId: ProviderId): Promise<void> {
  return invoke<void>("eval_provider_webview", {
    providerId,
    js: "history.forward()",
  });
}

export function webviewRefresh(providerId: ProviderId): Promise<void> {
  return invoke<void>("eval_provider_webview", {
    providerId,
    js: "location.reload()",
  });
}

/**
 * Current URL of the provider's webview. Returns "" if the webview
 * hasn't loaded yet — callers should treat empty as "unknown" and
 * fall through to a safe default rather than passing it to `new URL`.
 */
export function webviewUrl(providerId: ProviderId): Promise<string> {
  return invoke<string>("webview_url", { providerId });
}

/**
 * Quit the application. The Rust side calls `app.exit(0)` which is
 * the same thing as closing the main window — the OS kills the
 * process. Synchronous from the user's perspective (window goes
 * away); the IPC promise resolves after the exit has been initiated.
 */
export function exitApp(): Promise<void> {
  return invoke<void>("exit_app");
}

/**
 * Run an arbitrary JS expression in the active provider's webview.
 * Used by App.vue's return-to-home flow to call `location.replace(...)`
 * after `history.back()` doesn't reach the provider's host.
 *
 * The only callers are internal (return-toProviderHome). We don't
 * expose this to arbitrary user input — IPC eval is a wide attack
 * surface (any JS runs in the webview's context with full origin
 * cookies). Add new callers carefully and validate the `js` string.
 */
export function webviewEval(providerId: ProviderId, js: string): Promise<void> {
  return invoke<void>("eval_provider_webview", { providerId, js });
}
