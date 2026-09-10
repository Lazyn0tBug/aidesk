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
  <div
    class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface text-ink-2"
    :class="`status-overlay--${state}`"
  >
    <template v-if="state === 'loading'">
      <div class="status-overlay__spinner size-7" aria-hidden="true" />
      <p class="m-0 text-[14px]">{{ loadingText }}</p>
    </template>
    <template v-else>
      <p class="m-0 text-[14px]">{{ messages.loadFailed }}</p>
      <button
        type="button"
        class="px-3.5 py-1.5 rounded-md border border-line bg-surface-2 text-ink hover:border-accent cursor-pointer font-sans"
        @click="emit('reload')"
      >
        {{ messages.reload }}
      </button>
    </template>
  </div>
</template>

<style scoped>
@keyframes status-spin {
  to {
    transform: rotate(360deg);
  }
}
.status-overlay__spinner {
  border-radius: 9999px;
  border: 3px solid var(--color-surface-3);
  border-top-color: var(--color-accent);
  animation: status-spin 0.8s linear infinite;
}
</style>
