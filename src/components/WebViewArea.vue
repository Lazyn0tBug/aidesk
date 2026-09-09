<script setup lang="ts">
// §3.4 / §5 WebViewArea.
//
// Phase 1 scaffold: renders a status card with the active provider's URL
// so the layout is verifiable without a Tauri runtime. Phase 2 will
// replace the placeholder body with a Tauri WebviewWindow embedded at
// the computed bounds; status (loading/error) will be driven by the
// Rust commands in `src/ipc/webview.ts`.

import { computed, onMounted, onUnmounted } from "vue";
import { activeWebview } from "../stores/appStore";
import { resolveIcon } from "../utils/icons";
import { calculateWebViewBounds } from "../utils/bounds";
import type { Bounds, MessagesSection, ProviderConfig } from "../types";
import StatusOverlay from "./StatusOverlay.vue";

const props = defineProps<{
  provider: ProviderConfig | null;
  messages: MessagesSection;
}>();

const emit = defineEmits<{
  (e: "reload", providerId: string): void;
  (e: "bounds", b: Bounds): void;
}>();

const webview = computed(() => activeWebview.value);

const overlayState = computed<"loading" | "error" | null>(() => {
  const wv = webview.value;
  if (!wv) return null;
  if (wv.error) return "error";
  if (wv.loading) return "loading";
  return null;
});

let resizeObserver: ResizeObserver | null = null;
const onResize = () => {
  const tabBar = document.querySelector<HTMLElement>(".tab-bar");
  const draftBox = document.querySelector<HTMLElement>(".draft-box");
  const w = window.innerWidth;
  const h = window.innerHeight;
  const bounds = calculateWebViewBounds({
    windowWidth: w,
    windowHeight: h,
    tabBarHeight: tabBar?.getBoundingClientRect().height ?? 0,
    draftBoxHeight: draftBox?.getBoundingClientRect().height ?? 0,
  });
  emit("bounds", bounds);
};

onMounted(() => {
  window.addEventListener("resize", onResize);
  resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(document.body);
  onResize();
});

onUnmounted(() => {
  window.removeEventListener("resize", onResize);
  resizeObserver?.disconnect();
});
</script>

<template>
  <main class="webview-area">
    <template v-if="provider">
      <div v-if="overlayState" class="webview-area__overlay-wrap">
        <StatusOverlay
          :state="overlayState"
          :provider="provider"
          :messages="messages"
          @reload="emit('reload', provider.id)"
        />
      </div>
      <div v-else class="webview-area__placeholder">
        <div class="webview-area__card">
          <img
            v-if="resolveIcon(provider.iconKey)"
            class="webview-area__icon"
            :src="resolveIcon(provider.iconKey)!.src"
            :alt="provider.name"
          />
          <h2 class="webview-area__title">{{ provider.name }}</h2>
          <p class="webview-area__url">{{ provider.url }}</p>
          <p class="webview-area__hint">
            Phase 2: this surface will host a Tauri WebviewWindow.
          </p>
        </div>
      </div>
    </template>
    <div v-else class="webview-area__empty">No provider available</div>
  </main>
</template>

<style scoped>
.webview-area {
  position: relative;
  flex: 1 1 auto;
  background: var(--aidesk-bg-1);
  overflow: hidden;
  min-height: 0;
}

.webview-area__overlay-wrap {
  position: absolute;
  inset: 0;
}

.webview-area__placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.webview-area__card {
  text-align: center;
  padding: 24px 32px;
  border-radius: 12px;
  background: var(--aidesk-bg-2);
  border: 1px solid var(--aidesk-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.webview-area__icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
}

.webview-area__title {
  margin: 0;
  font-size: 18px;
}

.webview-area__url {
  margin: 0;
  color: var(--aidesk-fg-2);
  font-size: 13px;
  word-break: break-all;
}

.webview-area__hint {
  margin: 4px 0 0;
  color: var(--aidesk-fg-2);
  font-size: 11px;
}

.webview-area__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--aidesk-fg-2);
}
</style>