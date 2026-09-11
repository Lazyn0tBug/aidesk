<script setup lang="ts">
// App root — orchestrates TabBar, DraftBox, WebViewArea, and the
// toast overlay (which lives in its own embedded child webview — see
// `ToastApp.vue`). Implements the startup flow from design §15.1,
// switching §15.2, enter §15.3, and resize §15.4.

import { computed, onMounted, ref } from "vue";
import TabBar from "./components/TabBar.vue";
import DraftBox from "./components/DraftBox.vue";
import WebViewArea from "./components/WebViewArea.vue";
import {
  activeProvider,
  hydrateStore,
  reloadActive,
  switchProvider,
  updateActiveBounds,
  useAppStore,
} from "./stores/appStore";
import { bindToastConfig, pushToast } from "./utils/toast";
import { calculateWebViewBounds } from "./utils/bounds";
import { matchesProviderHost, providerHost } from "./utils/provider";
import {
  attachToastOverlay,
  copyText,
  getAppConfig,
  getLastActiveProvider,
  webviewBack,
  webviewEval,
  webviewUrl,
} from "./ipc";
import type { Bounds, ProviderId } from "./types";

const store = useAppStore();
const ready = ref(false);
const loadError = ref<string | null>(null);

// Last computed bounds for the WebViewArea; used both to drive
// `set_provider_webview_bounds` on resize and to supply the initial
// bounds when the user clicks a tab.
const lastBounds = ref<Bounds | null>(null);

onMounted(async () => {
  try {
    const [config, lastActive] = await Promise.all([getAppConfig(), getLastActiveProvider()]);
    hydrateStore(config, lastActive);
    if (store.config?.ui.toast) bindToastConfig(store.config.ui.toast);

    // Per design §4.3 #1/#2 and §15.1 #1: webviews are NOT created at
    // startup. The active provider's webview is created lazily on the
    // first `onBounds` emission from WebViewArea (which measures the
    // real tab-bar / draft-box heights), and other providers are
    // created when the user clicks their tab. `switchProvider` handles
    // both cases via the `!wv.created` branch.
  } catch (err) {
    loadError.value = (err as { message?: string })?.message ?? String(err);
  } finally {
    ready.value = true;
  }
});

const messages = computed(() => {
  return (
    store.config?.messages ?? {
      loading: "正在打开 {provider}...",
      loadFailed: "页面加载失败",
      copied: "已复制，粘贴即可发送",
      copyFailed: "复制失败，请手动复制",
      reload: "重新加载",
    }
  );
});

function boundsForSwitch(): Bounds {
  // Use the last measured bounds if available; fall back to a full-window
  // rectangle sized to the current window so the first show still has
  // something sensible. Routes through `calculateWebViewBounds` so the
  // integer-pixel rounding (matches the Rust `Bounds` wire type) lives
  // in one place.
  if (lastBounds.value) return lastBounds.value;
  return calculateWebViewBounds({
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
  });
}

/**
 * Walk the active provider's webview back to its home URL when the
 * user clicks the already-active tab. The "double-click home" pattern:
 *
 *   1. If the current URL host matches the provider's host, we're
 *      already there — do nothing.
 *   2. Otherwise call `history.back()` once and re-check. Many providers
 *      redirect away (login, OAuth callback, sign-out) and the back
 *      stack often still contains the provider's home URL.
 *   3. If `history.back()` didn't reach the provider — either there's
 *      no history at all (fresh load that got redirected), or the back
 *      stack never contained the provider — force a reload via
 *      `location.replace(provider.url)`. `replace` (vs `assign`) so the
 *      current page doesn't end up in the history stack, which would
 *      make the next back() go to it instead of further back.
 *
 * We don't touch the active webview's bounds or visibility — this is
 * pure in-webview navigation, not a `show_provider_webview` cycle.
 */
async function returnToProviderHome(id: ProviderId): Promise<void> {
  const provider = store.enabledProviders.find((p) => p.id === id);
  if (!provider) return;

  const targetHost = providerHost(provider.url);
  if (!targetHost) return;

  const currentHost = await webviewUrl(id)
    .then((u) => providerHost(u))
    .catch(() => null);

  // Already on the provider — nothing to do.
  if (matchesProviderHost(currentHost, provider.url)) return;

  // Try history.back() once. We don't loop because each back() can
  // cross an off-provider redirect (e.g. OAuth bounce), and one step
  // is enough for the common case.
  await webviewBack(id).catch(() => {});
  // Give the navigation a beat to settle before re-querying the URL.
  // 300ms is enough on every platform we've measured — the
  // history.back() promise resolves on the navigation *start*, not
  // completion, so we need a small delay to let the new URL commit.
  await new Promise((r) => setTimeout(r, 300));
  const afterBackHost = await webviewUrl(id)
    .then((u) => providerHost(u))
    .catch(() => null);

  if (matchesProviderHost(afterBackHost, provider.url)) return;

  // History exhausted or didn't bring us home — force-replace with
  // the provider's URL. JSON.stringify escapes the URL safely for
  // interpolation into a JS string literal.
  const js = `location.replace(${JSON.stringify(provider.url)})`;
  await webviewEval(id, js).catch(() => {});
}

async function onSelectTab(id: ProviderId) {
  if (!store.config) return;
  const prev = store.activeProviderId;

  // Clicking the already-active tab is the "return to home" gesture:
  // see `returnToProviderHome` for the back-history + reload logic.
  if (prev === id) {
    await returnToProviderHome(id);
    return;
  }

  await switchProvider(id, boundsForSwitch());

  if (store.config.ui.draftBox.copyOnSwitch && store.draft.trim().length > 0) {
    await performCopyAndMaybeClear();
  }
}

async function performCopyAndMaybeClear() {
  const cfg = store.config;
  if (!cfg) return;
  const draft = store.draft;
  if (!draft.trim()) return;
  try {
    await copyText(draft);
    pushToast(messages.value.copied, "success");
    if (cfg.ui.draftBox.clearAfterCopy) {
      store.draft = "";
    }
  } catch {
    pushToast(messages.value.copyFailed, "error");
  }
}

function onSubmitDraft() {
  void onSubmitFromDraft();
}

async function onSubmitFromDraft() {
  // Design §15.3: Enter on the draft box copies the draft and "switches"
  // to the currently active provider. Switching to the active provider
  // is a no-op at the IPC level (the same webview is shown), but the
  // call also re-asserts bounds and gives the user a fresh focus on
  // the active webview (added in Phase 4 if needed).
  await performCopyAndMaybeClear();
  const id = store.activeProviderId;
  if (id) {
    await switchProvider(id, boundsForSwitch());
  }
}

async function onReload(id: string) {
  await reloadActive(id);
}

async function onBounds(b: Bounds) {
  lastBounds.value = b;

  // Lazily attach the toast overlay child webview. Idempotent in Rust,
  // so this is cheap to call on every bounds change. Attached AFTER
  // any provider webview (it's the most recent `add_child` call), so
  // the native z-order puts it on top — the only way HTML toasts can
  // draw above an embedded provider webview.
  void attachToastOverlay(b).catch(() => {});

  // First-time case: when bounds first arrive, eagerly create + show
  // the active provider (design §15.1 step 13). Subsequent emissions
  // only need to update the active webview's bounds.
  const id = store.activeProviderId;
  if (id && store.webviews[id] && !store.webviews[id].created) {
    await switchProvider(id, b);
    return;
  }

  await updateActiveBounds(b);
}
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">
    <template v-if="!ready">
      <div class="flex-1 flex items-center justify-center text-ink-2">Loading AIDesk…</div>
    </template>
    <template v-else-if="loadError">
      <div class="flex-1 flex flex-col items-center justify-center gap-3 text-ink-2">
        <p>Startup error:</p>
        <pre class="whitespace-pre-wrap bg-surface-2 px-3 py-3 rounded-md">{{ loadError }}</pre>
      </div>
    </template>
    <template v-else-if="store.config">
      <TabBar
        v-if="store.config.ui.tabBar"
        :config="store.config.ui.tabBar"
        @select="onSelectTab"
      />
      <DraftBox
        v-if="store.config.ui.draftBox.enabled"
        :config="store.config.ui.draftBox"
        @submit="onSubmitDraft"
      />
      <WebViewArea
        :provider="activeProvider"
        :messages="messages"
        @reload="onReload"
        @bounds="onBounds"
      />
    </template>
  </div>
</template>
