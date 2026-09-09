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
  e.preventDefault();
  emit("submit");
}
</script>

<template>
  <section v-if="config.enabled" class="flex-none px-3 py-2 border-b border-line bg-surface-2" role="group" aria-label="Prompt draft">
    <textarea
      class="w-full resize-y font-sans text-[14px] px-2.5 py-2 rounded-md border bg-surface text-ink outline-none transition-colors focus:border-accent"
      :placeholder="config.placeholder"
      :rows="rows"
      :value="value"
      @input="onInput"
      @keydown="onKeydown"
    />
  </section>
</template>