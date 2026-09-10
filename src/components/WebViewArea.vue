<script setup lang="ts">
// §3.4 / §5 WebViewArea.
//
// Phase 2: hosts the active provider's WebViewWindow (managed by Rust).
// The Rust side creates a child window per provider and we measure the
// available rectangle here so the parent can place it correctly. We do
// not render any iframe or webview DOM directly — the actual content is
// a native window from `WebviewWindowBuilder::parent("main")`.
//
// The thin toolbar at the top of the area holds the browser-history
// controls (back / forward / refresh). It's an HTML overlay on top of
// the embedded webview, not a separate row that would shrink the
// webview's content area.

import { computed, onMounted, onUnmounted } from "vue";
import { activeProvider, activeWebview } from "../stores/appStore";
import { resolveIcon } from "../utils/icons";
import { calculateWebViewBounds } from "../utils/bounds";
import { webviewBack, webviewForward, webviewRefresh, exitApp } from "../ipc";
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

// Toolbar handlers — eval JS in the active provider's webview. We don't
// disable the buttons when history is empty: there's no way to know
// without inspecting `webview.history()` (which Tauri 2 doesn't expose),
// and a no-op `history.back()` is a small UX cost compared to querying
// the browser for history length on every render.
function onBack() {
  const id = activeProvider.value?.id;
  if (id) webviewBack(id).catch(() => {});
}

function onForward() {
  const id = activeProvider.value?.id;
  if (id) webviewForward(id).catch(() => {});
}

function onRefresh() {
  const id = activeProvider.value?.id;
  if (id) webviewRefresh(id).catch(() => {});
}

function onExit() {
  // No confirmation dialog — browser-style immediate exit. The
  // exit button is styled with danger colors on hover so the
  // destructive nature is visually obvious before the user clicks.
  exitApp().catch(() => {});
}

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
  // Also watch the tab bar itself — if the parent's size doesn't
  // change but the tab bar's height changes (e.g. CSS finishes
  // applying after the synchronous layout pass), we still want to
  // re-measure. Without this, the first `getBoundingClientRect()`
  // can read the buttons' natural height (~4-8px) before `h-11` is
  // applied, leaving the qwen webview anchored too high and covering
  // most of the header.
  const tabBarEl = document.querySelector<HTMLElement>("[data-tabbar]");
  if (tabBarEl) resizeObserver.observe(tabBarEl);
  // Defer the first emission to the next animation frame so the
  // browser has finished layout + style application. `getBoundingClientRect`
  // forces sync layout, but if it's called before the tab bar's
  // styles have been computed (rare on a hot reload, common on first
  // mount), it returns the unstyled natural height.
  requestAnimationFrame(onResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", onResize);
  resizeObserver?.disconnect();
});
</script>

<template>
  <main class="relative flex-1 min-h-0 overflow-hidden bg-surface">
    <!--
      Browser-history toolbar. Rendered as a top overlay on the
      webview (absolute, ~36px tall) so it doesn't shrink the
      webview's content area. Uses pointer-events: auto only on the
      buttons themselves; the rest is pass-through so clicks reach
      the underlying webview's chrome (e.g. the provider's own nav).
    -->
    <div
      v-if="provider"
      class="absolute top-0 left-0 right-0 z-10 flex items-center gap-1 px-2 py-1.5 bg-surface-2/85 backdrop-blur-sm border-b border-line pointer-events-none"
      role="toolbar"
      aria-label="Browser history"
    >
      <button
        type="button"
        class="size-7 inline-flex items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink cursor-pointer transition-colors pointer-events-auto"
        title="Back"
        aria-label="Go back"
        @click="onBack"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M10 3 L4.5 8 L10 13"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        class="size-7 inline-flex items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink cursor-pointer transition-colors pointer-events-auto"
        title="Forward"
        aria-label="Go forward"
        @click="onForward"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M6 3 L11.5 8 L6 13"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        class="size-7 inline-flex items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink cursor-pointer transition-colors pointer-events-auto"
        title="Reload"
        aria-label="Reload page"
        @click="onRefresh"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M13 8 a5 5 0 1 1 -1.5 -3.5 M13 2 V5 H10"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <div class="mx-1 h-5 w-px bg-line pointer-events-none" aria-hidden="true" />
      <button
        type="button"
        class="size-7 inline-flex items-center justify-center rounded-md text-ink-2 hover:bg-danger-soft hover:text-danger cursor-pointer transition-colors pointer-events-auto"
        title="Exit AIDesk"
        aria-label="Exit AIDesk"
        @click="onExit"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M4 4 L12 12 M12 4 L4 12"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

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
        <div
          class="flex flex-col items-center gap-2 px-8 py-6 rounded-xl border border-line bg-surface-2"
        >
          <img
            v-if="resolveIcon(provider.iconKey)"
            :src="resolveIcon(provider.iconKey)!.src"
            :alt="provider.name"
            class="size-12 rounded-lg"
          />
          <h2 class="m-0 text-lg">{{ provider.name }}</h2>
          <p class="m-0 text-ink-2 text-[13px] break-all">{{ provider.url }}</p>
          <p class="mt-1 mb-0 text-ink-2 text-[11px]">
            Provider window active — content renders in a child of the main window.
          </p>
        </div>
      </div>
    </template>
    <div v-else class="absolute inset-0 flex items-center justify-center text-ink-2">
      No provider available
    </div>
  </main>
</template>
