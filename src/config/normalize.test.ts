// Frontend normalization rules from design §7.6, §7.11, §7.12.

import { describe, expect, it } from "vitest";
import {
  normalizeAppConfig,
  normalizeDraftBox,
  normalizeFuture,
  normalizeMessages,
  normalizeShortcuts,
  normalizeTabBar,
  normalizeToast,
} from "./normalize";
import type { AppConfig } from "../types";

describe("normalizeTabBar (design §7.6)", () => {
  it("applies defaults when input is undefined", () => {
    const r = normalizeTabBar(undefined);
    expect(r.position).toBe("top");
    expect(r.showIcon).toBe(true);
    expect(r.showName).toBe(true);
    expect(r.iconOnly).toBe(false);
  });

  it("iconOnly forces showName=false", () => {
    const r = normalizeTabBar({ iconOnly: true, showName: true, showIcon: true, position: "top" });
    expect(r.showName).toBe(false);
  });

  it("disables both icon and name -> forces showName=true", () => {
    const r = normalizeTabBar({ iconOnly: false, showIcon: false, showName: false, position: "top" });
    expect(r.showName).toBe(true);
  });
});

describe("normalizeDraftBox", () => {
  it("applies expected defaults", () => {
    const r = normalizeDraftBox(undefined);
    // DraftBox is hidden by default — per design, the unified prompt
    // box is opt-in via `ui.draftBox.enabled = true`.
    expect(r.enabled).toBe(false);
    expect(r.copyOnSwitch).toBe(true);
    expect(r.clearAfterCopy).toBe(false);
    expect(r.maxLines).toBe(6);
    expect(r.placeholder.length).toBeGreaterThan(0);
  });
});

describe("normalizeToast", () => {
  it("defaults durationMs to 2500", () => {
    expect(normalizeToast(undefined).durationMs).toBe(2500);
  });
});

describe("normalizeMessages", () => {
  it("fills in the loading template placeholder", () => {
    const r = normalizeMessages(undefined);
    expect(r.loading).toContain("{provider}");
  });
});

describe("normalizeShortcuts", () => {
  it("default CmdOrCtrl+K and CmdOrCtrl", () => {
    const r = normalizeShortcuts(undefined);
    expect(r.focusDraftBox).toBe("CmdOrCtrl+K");
    expect(r.switchProviderPrefix).toBe("CmdOrCtrl");
  });
});

describe("normalizeFuture", () => {
  it("all flags default to false", () => {
    const r = normalizeFuture(undefined);
    expect(r).toEqual({
      autoFocusInput: false,
      autoFillInput: false,
      autoSubmit: false,
      sidebar: false,
      promptTemplates: false,
      answerRelay: false,
    });
  });
});

describe("normalizeAppConfig", () => {
  it("applies per-section normalizations in one pass", () => {
    const cfg: AppConfig = {
      providers: [
        {
          id: "qwen",
          name: "Qwen",
          iconKey: "qwen",
          url: "https://chat.qwen.ai/",
          enabled: true,
        },
      ],
      defaultProvider: { fallbackToFirstEnabled: true },
      webview: { lazyLoad: true, keepAlive: true, maxActiveWebviews: 5, reloadOnFail: true },
      ui: {
        tabBar: { position: "top", showIcon: false, showName: false, iconOnly: false },
        draftBox: {
          enabled: true,
          placeholder: "x",
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
    };
    const n = normalizeAppConfig(cfg);
    expect(n.ui.tabBar.showName).toBe(true);
    expect(n.messages?.loading).toContain("{provider}");
    expect(n.future?.autoSubmit).toBe(false);
  });
});