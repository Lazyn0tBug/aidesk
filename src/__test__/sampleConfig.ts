// Shared AppConfig fixture for unit tests.
//
// Three places previously hand-rolled this object: appStore.test.ts,
// TabBar.test.ts, normalize.test.ts. This file owns the canonical shape
// so that schema additions (new section, new field) only need to be
// added in one place.
//
// The fixture intentionally uses the qwen provider only — chatgpt and
// claude need network access the test runner doesn't have, and a
// disabled "ghost" provider is enough to exercise the filter / lookup
// logic without it.

import type { AppConfig } from "../types";

export function sampleConfig(): AppConfig {
  return {
    providers: [
      {
        id: "qwen",
        name: "Qwen",
        iconKey: "qwen",
        url: "https://chat.qwen.ai/",
        enabled: true,
      },
      {
        id: "ghost",
        name: "Ghost",
        iconKey: "ghost",
        url: "https://ghost.example/",
        enabled: false,
      },
    ],
    defaultProvider: { active: "qwen", fallbackToFirstEnabled: true },
    webview: {
      lazyLoad: true,
      keepAlive: true,
      maxActiveWebviews: 5,
      reloadOnFail: true,
    },
    ui: {
      tabBar: { position: "top", showIcon: true, showName: true, iconOnly: false },
      draftBox: {
        enabled: true,
        placeholder: "...",
        copyOnSwitch: true,
        clearAfterCopy: false,
        maxLines: 6,
      },
      toast: { durationMs: 2500 },
      toolbar: { enabled: false, position: "right" },
    },
    security: {
      allowUnknownNavigation: false,
      openExternalInSystemBrowser: true,
      globalAllowedHosts: [],
    },
    messages: {
      loading: "正在打开 {provider}...",
      loadFailed: "页面加载失败",
      copied: "已复制，粘贴即可发送",
      copyFailed: "复制失败，请手动复制",
      reload: "重新加载",
    },
    shortcuts: {},
    future: {
      autoFocusInput: false,
      autoFillInput: false,
      autoSubmit: false,
      sidebar: false,
      promptTemplates: false,
      answerRelay: false,
    },
  };
}