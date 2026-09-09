<script setup lang="ts">
// App root — orchestrates TabBar, DraftBox, WebViewArea, Toast.
// Implements the startup flow from design §15.1.

import { computed, onMounted, ref } from "vue";
import TabBar from "./components/TabBar.vue";
import DraftBox from "./components/DraftBox.vue";
import WebViewArea from "./components/WebViewArea.vue";
import Toast from "./components/Toast.vue";
import {
  activeProvider,
  hydrateStore,
  markProviderError,
  markProviderLoading,
  markProviderReady,
  setActiveProvider,
  useAppStore,
} from "./stores/appStore";
import { bindToastConfig, pushToast } from "./utils/toast";
import { getAppConfig, getLastActiveProvider } from "./ipc";
import { setLastActiveProvider } from "./ipc/state";
import { copyText } from "./ipc/clipboard";
import type { Bounds, ProviderId } from "./types";

const store = useAppStore();
const ready = ref(false);
const loadError = ref<string | null>(null);

onMounted(async () => {
  try {
    const [config, lastActive] = await Promise.all([
      getAppConfig(),
      getLastActiveProvider(),
    ]);
    hydrateStore(config, lastActive);
    if (store.config?.ui.toast) bindToastConfig(store.config.ui.toast);

    if (store.activeProviderId) {
      markProviderLoading(store.activeProviderId);
      window.setTimeout(() => {
        if (store.activeProviderId) markProviderReady(store.activeProviderId);
      }, 800);
    }
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

async function onSelectTab(id: ProviderId) {
  if (!store.config) return;
  const prev = store.activeProviderId;
  setActiveProvider(id);
  await setLastActiveProvider(id).catch(() => {});
  if (prev === id) return;
  markProviderLoading(id);
  window.setTimeout(() => markProviderReady(id), 400);

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
  void performCopyAndMaybeClear();
}

function onReload(id: string) {
  markProviderLoading(id);
  window.setTimeout(() => markProviderError(id), 600);
}

const lastBounds = ref<Bounds | null>(null);
function onBounds(b: Bounds) {
  lastBounds.value = b;
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
    <Toast />
  </div>
</template>