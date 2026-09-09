<script setup lang="ts">
// §5.7 Toast surface. Auto-dismiss timing is driven by
// `useToast().bindToastConfig()` + the per-message timer in `utils/toast.ts`.

import { useToast } from "../utils/toast";

const toasts = useToast();
</script>

<template>
  <div
    class="fixed right-4 bottom-4 z-50 flex flex-col gap-2 pointer-events-none"
    role="status"
    aria-live="polite"
  >
    <div
      v-for="t in toasts.items"
      :key="t.id"
      class="pointer-events-auto px-3.5 py-2 rounded-md text-[13px] shadow-lg/15 bg-surface-3 text-ink"
      :class="{
        'bg-success-soft text-success': t.variant === 'success',
        'bg-danger-soft text-danger': t.variant === 'error',
      }"
    >
      {{ t.message }}
    </div>
  </div>
</template>