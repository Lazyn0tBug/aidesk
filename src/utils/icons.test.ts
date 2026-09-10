// §14.4 icon resolution + per-provider brand palette + fallback label.

import { describe, expect, it } from "vitest";
import {
  BADGE_BG,
  BADGE_TEXT,
  iconBrandBg,
  iconBrandFg,
  iconFallbackLabel,
  resolveIcon,
} from "./icons";

describe("resolveIcon", () => {
  it("resolves a valid iconKey to a public path", () => {
    const r = resolveIcon("qwen");
    expect(r).not.toBeNull();
    expect(r?.src).toBe("/icons/qwen.png");
    expect(r?.format).toBe("png");
  });

  it("rejects uppercase keys", () => {
    expect(resolveIcon("QWEN")).toBeNull();
  });

  it("accepts keys starting with a digit (matches the §7.3 regex)", () => {
    // Design §7.3 allows [a-z0-9] at position 0. We mirror the rule
    // rather than tightening it; if you tighten it server-side, mirror
    // it here.
    const r = resolveIcon("1qwen");
    expect(r?.src).toBe("/icons/1qwen.png");
  });

  it("rejects empty strings", () => {
    expect(resolveIcon("")).toBeNull();
  });

  it("accepts keys with dashes and underscores", () => {
    expect(resolveIcon("foo-bar")?.src).toBe("/icons/foo-bar.png");
    expect(resolveIcon("foo_bar")?.src).toBe("/icons/foo_bar.png");
  });
});

describe("iconFallbackLabel", () => {
  it("returns the per-provider 2-char label when known", () => {
    expect(iconFallbackLabel("qwen")).toBe("Qw");
    expect(iconFallbackLabel("chatgpt")).toBe("GP");
    expect(iconFallbackLabel("claude")).toBe("Cl");
    expect(iconFallbackLabel("gemini")).toBe("Gm");
    expect(iconFallbackLabel("grok")).toBe("Gk");
  });

  it("returns no duplicate first-letters across shipped providers", () => {
    const labels = Object.keys(BADGE_TEXT).map((k) => iconFallbackLabel(k));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("falls back to first 2 chars of iconKey for unknown providers", () => {
    expect(iconFallbackLabel("my-provider")).toBe("MY");
    expect(iconFallbackLabel("custom_ai")).toBe("CU");
  });

  it("handles unknown single-char keys without crashing", () => {
    // slice(0,2) returns the whole string for length-1 inputs.
    expect(iconFallbackLabel("a")).toBe("A");
  });
});

describe("iconBrandBg / iconBrandFg", () => {
  it("returns the per-provider brand color", () => {
    expect(iconBrandBg("qwen")).toBe(BADGE_BG.qwen);
    expect(iconBrandBg("claude")).toBe(BADGE_BG.claude);
  });

  it("falls back to a neutral CSS variable for unknown providers", () => {
    expect(iconBrandBg("never-seen")).toContain("--color-surface-3");
    expect(iconBrandFg("never-seen")).toContain("--color-ink");
  });
});
