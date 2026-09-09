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
  const tabBar = document.querySelector<HTMLElement>(".tab-bar") ?? document.querySelector("header");
  const draftBox = document.querySelector<HTMLElement>(".draft-box") ?? document.querySelector("section");
  const bounds = calculateWebViewBounds({
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
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
  <main class="relative flex-1 min-h-0 overflow-hidden bg-surface">
    <template v-if="provider">
      <div v-if="overlayState" class="absolute inset-0">
        <StatusOverlay
          :state="overlayState"
          :provider="provider"
          :messages="messages"
          @reload="emit('reload', provider.id)"
        />
      </div>
      <div v-else class="absolute inset-0 flex items-center justify-center">
        <div class="flex flex-col items-center gap-2 px-8 py-6 rounded-xl border border-line bg-surface-2">
          <img
            v-if="resolveIcon(provider.iconKey)"
            :src="resolveIcon(provider.iconKey)!.src"
            :alt="provider.name"
            class="size-12 rounded-lg"
          />
          <h2 class="m-0 text-lg">{{ provider.name }}</h2>
          <p class="m-0 text-ink-2 text-[13px] break-all">{{ provider.url }}</p>
          <p class="mt-1 mb-0 text-ink-2 text-[11px]">Phase 2: this surface will host a Tauri WebviewWindow.</p>
        </div>
      </div>
    </template>
    <div v-else class="absolute inset-0 flex items-center justify-center text-ink-2">No provider available</div>
  </main>
</template>