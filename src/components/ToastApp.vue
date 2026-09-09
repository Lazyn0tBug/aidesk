<script setup lang="ts">
// Toast overlay — mounted in the toast child webview so it draws on top
// of the active provider webview (qwen / chatgpt / claude). Listens
// for `aidesk://toast` events emitted from any sibling webview; the
// main app emits them via `pushToastEvent` (see `src/utils/toast.ts`).

import { onMounted, ref } from "vue";
import { listen } from "@tauri-apps/api/event";

export type ToastVariant = "info" | "success" | "error";

interface ToastPayload {
  message: string;
  variant: ToastVariant;
  durationMs: number;
}

interface DisplayToast extends ToastPayload {
  id: number;
}

const toasts = ref<DisplayToast[]>([]);
let nextId = 1;

onMounted(async () => {
  await listen<ToastPayload>("aidesk://toast", (event) => {
    const p = event.payload;
    const id = nextId++;
    toasts.value.push({ id, ...p });
    window.setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, p.durationMs);
  });
});
</script>

<template>
  <div class="toast-stack" role="status" aria-live="polite">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="toast"
      :class="{
        'toast-success': t.variant === 'success',
        'toast-error': t.variant === 'error',
      }"
    >
      {{ t.message }}
    </div>
  </div>
</template>
