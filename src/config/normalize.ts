// Frontend normalization of the `AppConfig` returned by Rust.
//
// We don't mutate Rust output; we apply small client-side guarantees so
// components don't have to defend against missing fields. The defaults
// match design §7.

import type {
  AppConfig,
  DraftBoxConfig,
  FutureSection,
  MessagesSection,
  ShortcutsSection,
  TabBarConfig,
  ToastConfig,
} from "../types";

const DEFAULT_TAB_BAR: TabBarConfig = {
  position: "top",
  showIcon: true,
  showName: true,
  iconOnly: false,
};

const DEFAULT_DRAFT_BOX: DraftBoxConfig = {
  enabled: true,
  placeholder: "输入你想问的问题",
  copyOnSwitch: true,
  clearAfterCopy: false,
  maxLines: 6,
};

const DEFAULT_TOAST: ToastConfig = { durationMs: 2500 };

const DEFAULT_MESSAGES: MessagesSection = {
  loading: "正在打开 {provider}...",
  loadFailed: "页面加载失败",
  copied: "已复制，粘贴即可发送",
  copyFailed: "复制失败，请手动复制",
  reload: "重新加载",
};

const DEFAULT_SHORTCUTS: ShortcutsSection = {
  focusDraftBox: "CmdOrCtrl+K",
  switchProviderPrefix: "CmdOrCtrl",
};

const DEFAULT_FUTURE: FutureSection = {
  autoFocusInput: false,
  autoFillInput: false,
  autoSubmit: false,
  sidebar: false,
  promptTemplates: false,
  answerRelay: false,
};

/**
 * Apply `ui.tabBar` invariants (design §7.6):
 *   - If `iconOnly = true`, ignore `showName`.
 *   - If both `showIcon` and `showName` are false, force `showName = true`.
 */
export function normalizeTabBar(tabBar: Partial<TabBarConfig> | undefined): TabBarConfig {
  const merged: TabBarConfig = { ...DEFAULT_TAB_BAR, ...(tabBar ?? {}) };
  if (merged.iconOnly) {
    merged.showName = false;
  }
  if (!merged.showIcon && !merged.showName) {
    merged.showName = true;
  }
  return merged;
}

export function normalizeDraftBox(draftBox: Partial<DraftBoxConfig> | undefined): DraftBoxConfig {
  return { ...DEFAULT_DRAFT_BOX, ...(draftBox ?? {}) };
}

export function normalizeToast(toast: Partial<ToastConfig> | undefined): ToastConfig {
  return { ...DEFAULT_TOAST, ...(toast ?? {}) };
}

export function normalizeMessages(messages: Partial<MessagesSection> | undefined): MessagesSection {
  return { ...DEFAULT_MESSAGES, ...(messages ?? {}) };
}

export function normalizeShortcuts(
  shortcuts: Partial<ShortcutsSection> | undefined,
): ShortcutsSection {
  return { ...DEFAULT_SHORTCUTS, ...(shortcuts ?? {}) };
}

export function normalizeFuture(future: Partial<FutureSection> | undefined): FutureSection {
  return { ...DEFAULT_FUTURE, ...(future ?? {}) };
}

/** Apply all normalizations to a full AppConfig. */
export function normalizeAppConfig(config: AppConfig): AppConfig {
  return {
    ...config,
    ui: {
      ...config.ui,
      tabBar: normalizeTabBar(config.ui?.tabBar),
      draftBox: normalizeDraftBox(config.ui?.draftBox),
      toast: normalizeToast(config.ui?.toast),
    },
    messages: normalizeMessages(config.messages),
    shortcuts: normalizeShortcuts(config.shortcuts),
    future: normalizeFuture(config.future),
  };
}