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
import { attachToastOverlay, copyText, getAppConfig, getLastActiveProvider } from "./ipc";
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
    const [config, lastActive] = await Promise.all([
      getAppConfig(),
      getLastActiveProvider(),
    ]);
    hydrateStore(config, lastActive);
    if (store.config?.ui.toast) bindToastConfig(store.config.ui.toast);

    // WebViewArea will emit bounds shortly after mount; when it does,
    // create + show the active provider (design §15.1 steps 12-13).
    // If no resize event fires (unlikely), the user can click any tab
    // to force creation.
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

async function onSelectTab(id: ProviderId) {
  if (!store.config) return;
  const prev = store.activeProviderId;
  await switchProvider(id, boundsForSwitch());
  if (prev === id) return;

  if (
    store.config.ui.draftBox.copyOnSwitch &&
    store.draft.trim().length > 0
  ) {
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