// §4.2 TabBar render test.
//
// TabBar reads from the reactive store, so we hydrate the store
// before mounting and assert the rendered output matches the
// store state.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("../ipc", () => ({
  createProviderWebview: () => Promise.resolve(),
  showProviderWebview: () => Promise.resolve(),
  hideAllProviderWebviews: () => Promise.resolve(),
  setProviderWebviewBounds: () => Promise.resolve(),
  reloadProviderWebview: () => Promise.resolve(),
  setLastActiveProvider: () => Promise.resolve(),
  getAppConfig: () => Promise.resolve(null),
  getEnabledProviders: () => Promise.resolve([]),
  getLastActiveProvider: () => Promise.resolve(null),
  copyText: () => Promise.resolve(),
}));

import TabBar from "./TabBar.vue";
import { hydrateStore, useAppStore } from "../stores/appStore";
import type { AppConfig } from "../types";

function sample(): AppConfig {
  return {
    providers: [
      { id: "qwen", name: "Qwen", iconKey: "qwen", url: "https://chat.qwen.ai/", enabled: true },
    ],
    defaultProvider: { fallbackToFirstEnabled: true },
    webview: { lazyLoad: true, keepAlive: true, maxActiveWebviews: 5, reloadOnFail: true },
    ui: {
      tabBar: { position: "top", showIcon: true, showName: true, iconOnly: false },
      draftBox: {
        enabled: true,
        placeholder: "",
        copyOnSwitch: true,
        clearAfterCopy: false,
        maxLines: 6,
      },
      toast: { durationMs: 2500 },
      toolbar: { enabled: false, position: "right" },
    },
    security: { allowUnknownNavigation: false, openExternalInSystemBrowser: true, globalAllowedHosts: [] },
    messages: { loading: "", loadFailed: "", copied: "", copyFailed: "", reload: "" },
    shortcuts: {},
    future: {
      autoFocusInput: false, autoFillInput: false, autoSubmit: false,
      sidebar: false, promptTemplates: false, answerRelay: false,
    },
  };
}

beforeEach(() => {
  const s = useAppStore();
  s.config = null;
  s.enabledProviders = [];
  s.activeProviderId = null;
  s.draft = "";
  s.webviews = {};
  s.ready = false;
});

describe("TabBar.vue", () => {
  it("renders one tab per enabled provider", () => {
    hydrateStore(sample(), null);
    const wrapper = mount(TabBar, {
      props: { config: useAppStore().config!.ui.tabBar },
    });
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs).toHaveLength(1);
    expect(wrapper.text()).toContain("Qwen");
  });

  it("marks the active provider with aria-selected=true", () => {
    hydrateStore(sample(), "qwen");
    const wrapper = mount(TabBar, {
      props: { config: useAppStore().config!.ui.tabBar },
    });
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs[0]?.attributes("aria-selected")).toBe("true");
  });

  it("emits select with the clicked provider id", async () => {
    hydrateStore(sample(), "qwen");
    const wrapper = mount(TabBar, {
      props: { config: useAppStore().config!.ui.tabBar },
    });
    await wrapper.findAll('[role="tab"]')[0]!.trigger("click");
    expect(wrapper.emitted("select")?.[0]).toEqual(["qwen"]);
  });

  it("applies the loading class to webviews in loading state", () => {
    hydrateStore(sample(), "qwen");
    const wv = useAppStore().webviews["qwen"]!;
    wv.loading = true;
    const wrapper = mount(TabBar, {
      props: { config: useAppStore().config!.ui.tabBar },
    });
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs[0]?.classes()).toContain("tab--loading");
  });
});