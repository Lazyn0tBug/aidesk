// §14.2 / §11.1 appStore.
//
// Module-scope reactive state plus a composable. We avoid Pinia to keep
// the dependency surface minimal; the store has only one shape and one
// owner (the App root) so a singleton `reactive()` is appropriate.

import { computed, reactive } from "vue";
import type {
  AppConfig,
  ProviderConfig,
  ProviderId,
  WebViewRuntimeState,
} from "../types";
import { normalizeAppConfig } from "../config/normalize";

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

/** Hydrate the store from Rust. Called once on app start. */
export function hydrateStore(config: AppConfig, lastActiveProviderId: ProviderId | null) {
  const normalized = normalizeAppConfig(config);
  state.config = normalized;
  state.enabledProviders = normalized.providers.filter((p) => p.enabled);

  // Reset webview runtime state for the enabled set.
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

  // Resolve active provider per design §4.7.
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

export function setActiveProvider(id: ProviderId) {
  if (state.activeProviderId === id) return;
  state.activeProviderId = id;
  // Mark only this provider as visible. Phase 2 will call show/hide
  // commands; here we just track intent.
  for (const pid of Object.keys(state.webviews)) {
    const wv = state.webviews[pid];
    wv.visible = pid === id;
  }
}

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