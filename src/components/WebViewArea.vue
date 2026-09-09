<script setup lang="ts">
// §3.4 / §5 WebViewArea.
//
// Phase 2: hosts the active provider's WebViewWindow (managed by Rust).
// The Rust side creates a child window per provider and we measure the
// available rectangle here so the parent can place it correctly. We do
// not render any iframe or webview DOM directly — the actual content is
// a native window from `WebviewWindowBuilder::parent("main")`.

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
  const tabBar = document.querySelector<HTMLElement>("[data-tabbar]");
  const draftBox = document.querySelector<HTMLElement>("[data-draftbox]");
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
  // Force one emission so the parent gets the initial bounds even if
  // ResizeObserver's first tick is delayed.
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
          <p class="mt-1 mb-0 text-ink-2 text-[11px]">Provider window active — content renders in a child of the main window.</p>
        </div>
      </div>
    </template>
    <div v-else class="absolute inset-0 flex items-center justify-center text-ink-2">No provider available</div>
  </main>
</template>