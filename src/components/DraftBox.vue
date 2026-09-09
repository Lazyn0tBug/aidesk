<script setup lang="ts">
// §4.4 DraftBox. Two-way bound to `store.draft`. Enter triggers a
// copy + switch (per design §4.4 #10 and §15.3).

import { computed } from "vue";
import { useAppStore } from "../stores/appStore";
import type { DraftBoxConfig } from "../types";

const props = defineProps<{
  config: DraftBoxConfig;
}>();

const emit = defineEmits<{
  (e: "submit"): void;
}>();

const value = computed<string>({
  get: () => useAppStore().draft,
  set: (v: string) => useAppStore().draft = v,
});

const rows = computed(() => Math.max(1, props.config.maxLines));

function onInput(e: Event) {
  const t = e.target as HTMLTextAreaElement;
  value.value = t.value;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== "Enter" || e.shiftKey) return;
  // Enter without Shift copies + switches (design §4.4 #10).
  e.preventDefault();
  emit("submit");
}
</script>

<template>
  <section v-if="config.enabled" class="draft-box" role="group" aria-label="Prompt draft">
    <textarea
      class="draft-box__input"
      :placeholder="config.placeholder"
      :rows="rows"
      :value="value"
      @input="onInput"
      @keydown="onKeydown"
    />
  </section>
</template>

<style scoped>
.draft-box {
  flex: 0 0 auto;
  padding: 8px 12px;
  border-bottom: 1px solid var(--aidesk-border);
  background: var(--aidesk-bg-2);
}

.draft-box__input {
  width: 100%;
  resize: vertical;
  font: inherit;
  font-size: 14px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--aidesk-border);
  background: var(--aidesk-bg-1);
  color: var(--aidesk-fg-1);
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s ease;
}

.draft-box__input:focus {
  border-color: var(--aidesk-accent-fg);
}
</style>