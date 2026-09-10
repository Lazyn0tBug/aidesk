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
import { sampleConfig } from "../__test__/sampleConfig";

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
    hydrateStore(sampleConfig(), null);
    const wrapper = mount(TabBar, {
      props: { config: useAppStore().config!.ui.tabBar },
    });
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs).toHaveLength(1);
    expect(wrapper.text()).toContain("Qwen");
  });

  it("marks the active provider with aria-selected=true", () => {
    hydrateStore(sampleConfig(), "qwen");
    const wrapper = mount(TabBar, {
      props: { config: useAppStore().config!.ui.tabBar },
    });
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs[0]?.attributes("aria-selected")).toBe("true");
  });

  it("emits select with the clicked provider id", async () => {
    hydrateStore(sampleConfig(), "qwen");
    const wrapper = mount(TabBar, {
      props: { config: useAppStore().config!.ui.tabBar },
    });
    await wrapper.findAll('[role="tab"]')[0]!.trigger("click");
    expect(wrapper.emitted("select")?.[0]).toEqual(["qwen"]);
  });

  it("applies the loading class to webviews in loading state", () => {
    hydrateStore(sampleConfig(), "qwen");
    const wv = useAppStore().webviews["qwen"]!;
    wv.loading = true;
    const wrapper = mount(TabBar, {
      props: { config: useAppStore().config!.ui.tabBar },
    });
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs[0]?.classes()).toContain("tab--loading");
  });

  it("renders the fallback badge with the per-provider label", () => {
    // public/icons/ has only README.md, so the badge is always what
    // the user sees. The 2-char label is what makes tabs distinct
    // when no real icon has shipped — see icons.ts BADGE_TEXT.
    hydrateStore(sampleConfig(), "qwen");
    const wrapper = mount(TabBar, {
      props: { config: useAppStore().config!.ui.tabBar },
    });
    const tab = wrapper.findAll('[role="tab"]')[0];
    expect(tab?.text()).toContain("Qw");
  });

  it("applies the per-provider brand color to the badge", () => {
    // The badge background is brand-specific (Alibaba orange for
    // qwen). The inline :style binding reads from iconBrandBg.
    hydrateStore(sampleConfig(), "qwen");
    const wrapper = mount(TabBar, {
      props: { config: useAppStore().config!.ui.tabBar },
    });
    const badge = wrapper.findAll('[role="tab"] [aria-hidden="true"]')[0];
    // The style attribute serializes RGB — match the rgb form.
    expect(badge?.attributes("style")).toContain("background-color: rgb(255, 106, 0)");
  });
});
