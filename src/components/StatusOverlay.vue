<script setup lang="ts">
// §5.5 / §5.6 Status overlay shown in the WebView area while a provider
// is loading or has failed.

import { computed } from "vue";
import type { MessagesSection, ProviderConfig } from "../types";

const props = defineProps<{
  state: "loading" | "error";
  provider: ProviderConfig | null;
  messages: MessagesSection;
}>();

const emit = defineEmits<{
  (e: "reload"): void;
}>();

const loadingText = computed(() => {
  if (!props.provider) return props.messages.loading;
  return props.messages.loading.replace("{provider}", props.provider.name);
});
</script>

<template>
  <div class="status-overlay" :class="`status-overlay--${state}`">
    <template v-if="state === 'loading'">
      <div class="status-overlay__spinner" aria-hidden="true" />
      <p class="status-overlay__msg">{{ loadingText }}</p>
    </template>
    <template v-else>
      <p class="status-overlay__msg">{{ messages.loadFailed }}</p>
      <button type="button" class="status-overlay__btn" @click="emit('reload')">
        {{ messages.reload }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.status-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--aidesk-fg-2);
  background: var(--aidesk-bg-1);
}

.status-overlay__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--aidesk-bg-3);
  border-top-color: var(--aidesk-accent-fg);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.status-overlay__msg {
  margin: 0;
  font-size: 14px;
}

.status-overlay__btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--aidesk-border);
  background: var(--aidesk-bg-2);
  color: var(--aidesk-fg-1);
  cursor: pointer;
  font: inherit;
}

.status-overlay__btn:hover {
  border-color: var(--aidesk-accent-fg);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>