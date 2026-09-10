<script setup lang="ts">
// §4.2 TabBar. Renders one tab per enabled provider with active /
// loading / error styling (design §5.4). Emits `select` on click.

import { computed } from "vue";
import { useAppStore } from "../stores/appStore";
import type { ProviderConfig, ProviderId, TabBarConfig } from "../types";
import { resolveIcon, iconBrandBg, iconBrandFg, iconFallbackLabel } from "../utils/icons";

const props = defineProps<{
  config: TabBarConfig;
}>();

const emit = defineEmits<{
  (e: "select", providerId: ProviderId): void;
}>();

const store = useAppStore();

const tabs = computed<ProviderConfig[]>(() => store.enabledProviders);

const showIconFor = (_tab: ProviderConfig) => {
  if (props.config.iconOnly) return true;
  return props.config.showIcon;
};

const showNameFor = (_tab: ProviderConfig) => {
  if (props.config.iconOnly) return false;
  return props.config.showName;
};

const onClick = (id: ProviderId) => {
  emit("select", id);
};
</script>

<template>
  <header
    class="flex flex-none h-11 px-2 gap-1 items-stretch border-b border-line bg-surface-2"
    role="tablist"
    aria-label="Provider tabs"
    data-tabbar
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="store.activeProviderId === tab.id"
      :class="[
        'group inline-flex items-center gap-1.5 px-3 rounded-md text-[13px] transition-colors cursor-pointer',
        'bg-transparent text-ink-2 hover:bg-surface-3 hover:text-ink',
        store.activeProviderId === tab.id && 'bg-accent-soft text-accent',
        store.webviews[tab.id]?.loading && 'tab--loading',
        store.webviews[tab.id]?.error && 'text-danger',
      ]"
      @click="onClick(tab.id)"
    >
      <span
        v-if="showIconFor(tab)"
        class="relative size-5 inline-flex items-center justify-center rounded overflow-hidden text-[11px] font-semibold leading-none"
        :style="{ backgroundColor: iconBrandBg(tab.iconKey), color: iconBrandFg(tab.iconKey) }"
        aria-hidden="true"
      >
        <!--
          Real icon (PNG dropped into public/icons/{iconKey}.png)
          layered on top. If the file 404s the @error handler hides it
          and the badge text below shows through. This is more robust
          than the previous v-if/v-else setup, which never took the
          fallback path because resolveIcon() always returned non-null.
        -->
        <img
          v-if="resolveIcon(tab.iconKey)"
          :src="resolveIcon(tab.iconKey)!.src"
          :alt="''"
          class="absolute inset-0 size-full object-contain"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
        <span>{{ iconFallbackLabel(tab.iconKey) }}</span>
      </span>
      <span v-if="showNameFor(tab)">{{ tab.name }}</span>
    </button>
  </header>
</template>

<style scoped>
@keyframes tab-pulse {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}
.tab--loading::after {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: currentColor;
  margin-left: auto;
  animation: tab-pulse 1s ease-in-out infinite;
}
</style>
