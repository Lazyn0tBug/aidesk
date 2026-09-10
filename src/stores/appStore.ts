// §14.2 / §11.1 appStore.
//
// Module-scope reactive state plus a composable. We avoid Pinia to keep
// the dependency surface minimal; the store has only one shape and one
// owner (the App root) so a singleton `reactive()` is appropriate.
//
// Phase 2: stores IPC actions alongside state so components only call
// `store.switchProvider(id)` etc. — IPC details stay inside the store.

import { computed, reactive } from "vue";
import type { AppConfig, Bounds, ProviderConfig, ProviderId, WebViewRuntimeState } from "../types";
import { normalizeAppConfig } from "../config/normalize";
import {
  createProviderWebview,
  reloadProviderWebview,
  setLastActiveProvider,
  setProviderWebviewBounds,
  showProviderWebview,
} from "../ipc";

interface StoreState {
  config: AppConfig | null;
  enabledProviders: ProviderConfig[];
  activeProviderId: ProviderId | null;
  draft: string;
  webviews: Record<ProviderId, WebViewRuntimeState>;
  ready: boolean;
}

const state = reactive<StoreState>({
  config: null,
  enabledProviders: [],
  activeProviderId: null,
  draft: "",
  webviews: {},
  ready: false,
});

export function useAppStore() {
  return state;
}

export const activeProvider = computed<ProviderConfig | null>(() => {
  if (!state.activeProviderId) return null;
  return state.enabledProviders.find((p) => p.id === state.activeProviderId) ?? null;
});

export const activeWebview = computed<WebViewRuntimeState | null>(() => {
  if (!state.activeProviderId) return null;
  return state.webviews[state.activeProviderId] ?? null;
});

// -----------------------------------------------------------------------------
// Hydration (called once on app start, §15.1)
// -----------------------------------------------------------------------------

/** Hydrate the store from Rust. Called once on app start. */
export function hydrateStore(config: AppConfig, lastActiveProviderId: ProviderId | null) {
  const normalized = normalizeAppConfig(config);
  state.config = normalized;
  state.enabledProviders = normalized.providers.filter((p) => p.enabled);

  state.webviews = {};
  for (const p of state.enabledProviders) {
    state.webviews[p.id] = {
      providerId: p.id,
      created: false,
      visible: false,
      loading: false,
      error: false,
    };
  }

  state.activeProviderId = resolveActiveProvider(normalized, lastActiveProviderId);
  state.ready = true;
}

/**
 * Pick the active provider per §7.4 + §4.7:
 *   1. last-active if `rememberLastProvider` and still enabled
 *   2. `defaultProvider.active` if set and enabled
 *   3. First enabled provider if `fallbackToFirstEnabled`
 *   4. `null` for the empty state
 */
export function resolveActiveProvider(
  config: AppConfig,
  lastActiveProviderId: ProviderId | null,
): ProviderId | null {
  const enabled = config.providers.filter((p) => p.enabled);
  if (enabled.length === 0) return null;

  const remember = config.app?.window.rememberLastProvider ?? true;
  if (remember && lastActiveProviderId) {
    if (enabled.some((p) => p.id === lastActiveProviderId)) {
      return lastActiveProviderId;
    }
  }

  if (config.defaultProvider?.active) {
    const target = config.defaultProvider.active;
    if (enabled.some((p) => p.id === target)) {
      return target;
    }
  }

  if (config.defaultProvider?.fallbackToFirstEnabled ?? true) {
    return enabled[0].id;
  }

  return null;
}

// -----------------------------------------------------------------------------
// State mutators (pure local state changes)
// -----------------------------------------------------------------------------

export function setDraft(value: string) {
  state.draft = value;
}

export function markProviderLoading(id: ProviderId) {
  const wv = state.webviews[id];
  if (!wv) return;
  wv.loading = true;
  wv.error = false;
}

export function markProviderReady(id: ProviderId) {
  const wv = state.webviews[id];
  if (!wv) return;
  wv.created = true;
  wv.loading = false;
  wv.error = false;
}

export function markProviderError(id: ProviderId) {
  const wv = state.webviews[id];
  if (!wv) return;
  wv.loading = false;
  wv.error = true;
}

function setVisibleFlag(id: ProviderId | null) {
  for (const pid of Object.keys(state.webviews)) {
    state.webviews[pid].visible = pid === id;
  }
}

/**
 * Synchronous state setter for the active provider. Used by
 * `switchProvider` (which adds IPC on top) and by tests.
 *
 * No-ops if `id` is not in `state.webviews` (i.e. unknown or
 * disabled provider) so callers can't desync Vue state from the
 * Rust webview map by passing an unvalidated id.
 */
export function setActiveProvider(id: ProviderId) {
  if (!state.webviews[id]) return;
  if (state.activeProviderId === id) return;
  state.activeProviderId = id;
  setVisibleFlag(id);
}

// -----------------------------------------------------------------------------
// Actions (call IPC; orchestrate Phase 2 lifecycle, §15.2)
// -----------------------------------------------------------------------------

/**
 * Lazy-create the webview for `id` and show it. Per design §4.3 #2 the
 * first click is what triggers creation; subsequent switches just show.
 *
 * Returns silently on success. Errors land on `state.webviews[id].error`.
 */
export async function switchProvider(id: ProviderId, bounds: Bounds): Promise<void> {
  if (!state.config) return;

  setActiveProvider(id);
  setLastActiveProvider(id).catch(() => {});

  const wv = state.webviews[id];
  if (!wv) return;

  try {
    if (!wv.created) {
      markProviderLoading(id);
      await createProviderWebview(id, bounds);
      wv.created = true;
    }
    // show_provider_webview hides the previously-visible provider in
    // the same Rust call (webview_manager.rs::show_provider_webview),
    // so no separate hide_all round-trip is needed.
    await showProviderWebview(id, bounds);
    markProviderReady(id);
  } catch (err) {
    console.error(`[aidesk] switchProvider(${id}) failed`, err);
    markProviderError(id);
  }
}

/** Update only the bounds of the currently-visible webview (design §15.4). */
export async function updateActiveBounds(bounds: Bounds): Promise<void> {
  const id = state.activeProviderId;
  if (!id) return;
  const wv = state.webviews[id];
  if (!wv?.created) return;
  try {
    await setProviderWebviewBounds(id, bounds);
  } catch (err) {
    console.error(`[aidesk] updateActiveBounds failed`, err);
  }
}

/** Reload a provider's webview (design §15.5). */
export async function reloadActive(id: ProviderId): Promise<void> {
  markProviderLoading(id);
  try {
    await reloadProviderWebview(id);
    markProviderReady(id);
  } catch (err) {
    console.error(`[aidesk] reloadProvider(${id}) failed`, err);
    markProviderError(id);
  }
}
