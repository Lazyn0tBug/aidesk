<script setup lang="ts">
// §5.7 Toast surface. Auto-dismiss timing is driven by
// `useToast().bindToastConfig()` + the per-message timer in `utils/toast.ts`.

import { useToast } from "../utils/toast";

const toasts = useToast();
</script>

<template>
  <div class="toast-host" role="status" aria-live="polite">
    <div
      v-for="t in toasts.items"
      :key="t.id"
      class="toast"
      :class="`toast--${t.variant}`"
    >
      {{ t.message }}
    </div>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  background: var(--aidesk-bg-3);
  color: var(--aidesk-fg-1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.toast--success {
  background: var(--aidesk-success-bg);
  color: var(--aidesk-success-fg);
}

.toast--error {
  background: var(--aidesk-danger-bg);
  color: var(--aidesk-danger-fg);
}
</style>