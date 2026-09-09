<script setup lang="ts">
// §4.2 TabBar.
// Renders one tab per enabled provider, with active/loading/error styling
// (design §5.4). Emits `select` when a tab is clicked.

import { computed } from "vue";
import { useAppStore } from "../stores/appStore";
import type { ProviderConfig, ProviderId, TabBarConfig } from "../types";
import { resolveIcon, iconFallbackLabel } from "../utils/icons";

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
  <header class="tab-bar" role="tablist" aria-label="Provider tabs">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="store.activeProviderId === tab.id"
      :class="[
        'tab',
        { 'tab--active': store.activeProviderId === tab.id },
        { 'tab--loading': store.webviews[tab.id]?.loading },
        { 'tab--error': store.webviews[tab.id]?.error },
      ]"
      @click="onClick(tab.id)"
    >
      <span v-if="showIconFor(tab)" class="tab__icon" aria-hidden="true">
        <img
          v-if="resolveIcon(tab.iconKey)"
          :src="resolveIcon(tab.iconKey)!.src"
          :alt="''"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
        <span v-else class="tab__icon-fallback">{{ iconFallbackLabel(tab.name) }}</span>
      </span>
      <span v-if="showNameFor(tab)" class="tab__name">{{ tab.name }}</span>
    </button>
  </header>
</template>

<style scoped>
.tab-bar {
  display: flex;
  flex: 0 0 auto;
  height: 44px;
  padding: 0 8px;
  gap: 4px;
  align-items: stretch;
  border-bottom: 1px solid var(--aidesk-border);
  background: var(--aidesk-bg-2);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: none;
  background: transparent;
  color: var(--aidesk-fg-2);
  cursor: pointer;
  border-radius: 6px;
  font: inherit;
  font-size: 13px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.tab:hover {
  background: var(--aidesk-bg-3);
  color: var(--aidesk-fg-1);
}

.tab--active {
  background: var(--aidesk-accent-bg);
  color: var(--aidesk-accent-fg);
}

.tab__icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tab__icon img {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  object-fit: contain;
}

.tab__icon-fallback {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--aidesk-bg-3);
  color: var(--aidesk-fg-2);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.tab--loading::after {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1s ease-in-out infinite;
}

.tab--error {
  color: var(--aidesk-danger-fg);
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
</style>