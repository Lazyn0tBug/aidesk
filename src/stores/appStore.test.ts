// Store actions for the Phase 2 lifecycle.
//
// `invoke` from @tauri-apps/api/core is mocked so we can assert the
// call shape without launching Tauri. Real Tauri interaction is
// covered by the e2e specs.

import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

const defaultInvoke = async (cmd: string) => {
  if (cmd === "get_app_config") {
    return sampleConfig();
  }
  if (cmd === "get_last_active_provider") {
    return null;
  }
  return null;
};

// Install the default implementation once at module load.
invokeMock.mockImplementation(defaultInvoke);

vi.mock("../ipc", () => ({
  createProviderWebview: (_id: string, _bounds: unknown) => invokeMock("create_provider_webview"),
  showProviderWebview: (_id: string, _bounds: unknown) => invokeMock("show_provider_webview"),
  hideAllProviderWebviews: () => invokeMock("hide_all_provider_webviews"),
  setProviderWebviewBounds: (_id: string, _bounds: unknown) =>
    invokeMock("set_provider_webview_bounds"),
  reloadProviderWebview: (_id: string) => invokeMock("reload_provider_webview"),
  setLastActiveProvider: (_providerId: string) => invokeMock("set_last_active_provider"),
  getAppConfig: () => invokeMock("get_app_config"),
  getEnabledProviders: () => invokeMock("get_enabled_providers"),
  getLastActiveProvider: () => invokeMock("get_last_active_provider"),
  copyText: (_text: string) => invokeMock("copy_text"),
}));

import {
  activeProvider,
  activeWebview,
  hydrateStore,
  markProviderError,
  markProviderLoading,
  markProviderReady,
  reloadActive,
  resolveActiveProvider,
  setActiveProvider,
  switchProvider,
  updateActiveBounds,
  useAppStore,
} from "./appStore";
import { sampleConfig } from "../__test__/sampleConfig";

beforeEach(() => {
  // mockReset (not mockClear) so that any per-test `mockImplementation`
  // override from a previous test (e.g. the "create fails" case) does
  // not leak forward.
  invokeMock.mockReset();
  invokeMock.mockImplementation(defaultInvoke);
  const s = useAppStore();
  // reset singleton state between tests
  s.config = null;
  s.enabledProviders = [];
  s.activeProviderId = null;
  s.draft = "";
  s.webviews = {};
  s.ready = false;
});

describe("hydrateStore", () => {
  it("filters out disabled providers and seeds webview state", () => {
    hydrateStore(sampleConfig(), null);
    const s = useAppStore();
    expect(s.enabledProviders.map((p) => p.id)).toEqual(["qwen"]);
    expect(s.activeProviderId).toBe("qwen");
    expect(Object.keys(s.webviews)).toEqual(["qwen"]);
    for (const id of Object.keys(s.webviews)) {
      const wv = s.webviews[id]!;
      expect(wv.created).toBe(false);
      expect(wv.visible).toBe(false);
    }
  });

  it("respects lastActiveProviderId when enabled", () => {
    hydrateStore(sampleConfig(), "qwen");
    expect(useAppStore().activeProviderId).toBe("qwen");
  });

  it("falls back to defaultProvider.active when last is disabled", () => {
    hydrateStore(sampleConfig(), "ghost");
    expect(useAppStore().activeProviderId).toBe("qwen");
  });
});

describe("resolveActiveProvider", () => {
  it("respects lastActive when rememberLastProvider=true", () => {
    const cfg = sampleConfig();
    expect(resolveActiveProvider(cfg, "qwen")).toBe("qwen");
  });

  it("returns null when no providers are enabled", () => {
    const cfg = sampleConfig();
    cfg.providers = cfg.providers.map((p) => ({ ...p, enabled: false }));
    expect(resolveActiveProvider(cfg, null)).toBeNull();
  });
});

describe("setActiveProvider", () => {
  beforeEach(() => {
    hydrateStore(sampleConfig(), null);
  });

  it("is a no-op when called with the already-active id", () => {
    // qwen is already active after hydrate. The setter should early-return
    // without throwing or mutating state.
    const before = useAppStore().activeProviderId;
    expect(() => setActiveProvider("qwen")).not.toThrow();
    expect(useAppStore().activeProviderId).toBe(before);
  });

  it("starts every webview with visible=false after hydrate", () => {
    // hydrateStore does not call setActiveProvider; visible flips to
    // true only when the user actually switches. The WebViewArea's
    // initial-bounds emission triggers switchProvider, which sets it.
    expect(useAppStore().webviews["qwen"]!.visible).toBe(false);
  });
});

describe("switchProvider (Phase 2 lifecycle)", () => {
  beforeEach(() => {
    hydrateStore(sampleConfig(), "qwen");
  });

  it("calls create on first switch and show on every switch", async () => {
    await switchProvider("qwen", { x: 0, y: 0, width: 100, height: 100 });
    const cmds = invokeMock.mock.calls.map((c) => c[0]);
    expect(cmds).toContain("create_provider_webview");
    expect(cmds).toContain("show_provider_webview");
    expect(cmds).toContain("set_last_active_provider");

    const s = useAppStore();
    expect(s.activeProviderId).toBe("qwen");
    expect(s.webviews["qwen"]!.created).toBe(true);
  });

  it("skips create on a second switch to the same provider", async () => {
    await switchProvider("qwen", { x: 0, y: 0, width: 100, height: 100 });
    invokeMock.mockClear();
    await switchProvider("qwen", { x: 0, y: 0, width: 100, height: 100 });
    const cmds = invokeMock.mock.calls.map((c) => c[0]);
    expect(cmds).not.toContain("create_provider_webview");
  });

  it("marks the provider as error if create fails", async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "create_provider_webview") {
        throw new Error("boom");
      }
      return null;
    });
    await switchProvider("qwen", { x: 0, y: 0, width: 100, height: 100 });
    expect(useAppStore().webviews["qwen"]!.error).toBe(true);
  });
});

describe("updateActiveBounds", () => {
  beforeEach(() => hydrateStore(sampleConfig(), "qwen"));

  it("is a no-op when the active webview is not created yet", async () => {
    await updateActiveBounds({ x: 0, y: 0, width: 100, height: 100 });
    const cmds = invokeMock.mock.calls.map((c) => c[0]);
    expect(cmds).not.toContain("set_provider_webview_bounds");
  });

  it("calls set_provider_webview_bounds after the active webview is created", async () => {
    // Mark qwen as created without going through switchProvider (which
    // would also call set_provider_webview_bounds as part of its flow).
    useAppStore().webviews["qwen"]!.created = true;
    await updateActiveBounds({ x: 0, y: 0, width: 200, height: 200 });
    expect(invokeMock.mock.calls.map((c) => c[0])).toContain("set_provider_webview_bounds");
  });
});

describe("reloadActive", () => {
  beforeEach(() => hydrateStore(sampleConfig(), "qwen"));

  it("flips loading -> ready on success", async () => {
    markProviderReady("qwen");
    await reloadActive("qwen");
    const wv = useAppStore().webviews["qwen"]!;
    expect(wv.loading).toBe(false);
    expect(wv.error).toBe(false);
    expect(wv.created).toBe(true);
  });

  it("flips to error on failure", async () => {
    invokeMock.mockImplementationOnce(async (cmd: string) => {
      if (cmd === "reload_provider_webview") throw new Error("nope");
      return null;
    });
    markProviderReady("qwen");
    await reloadActive("qwen");
    expect(useAppStore().webviews["qwen"]!.error).toBe(true);
  });
});

describe("state markers", () => {
  beforeEach(() => hydrateStore(sampleConfig(), "qwen"));

  it("markProviderLoading clears error and sets loading", () => {
    markProviderError("qwen");
    markProviderLoading("qwen");
    const wv = useAppStore().webviews["qwen"]!;
    expect(wv.loading).toBe(true);
    expect(wv.error).toBe(false);
  });

  it("markProviderReady clears loading and error", () => {
    markProviderError("qwen");
    markProviderReady("qwen");
    const wv = useAppStore().webviews["qwen"]!;
    expect(wv.created).toBe(true);
    expect(wv.loading).toBe(false);
    expect(wv.error).toBe(false);
  });
});

describe("derived computeds", () => {
  beforeEach(() => hydrateStore(sampleConfig(), "qwen"));

  it("activeProvider returns the matching provider", () => {
    expect(activeProvider.value?.id).toBe("qwen");
  });

  it("activeWebview returns the matching webview", () => {
    expect(activeWebview.value?.providerId).toBe("qwen");
  });
});
