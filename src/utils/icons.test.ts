// §14.4 icon resolution + fallback label helper.

import { describe, expect, it } from "vitest";
import { iconFallbackLabel, resolveIcon } from "./icons";

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
  it("returns the first letter uppercased for Latin names", () => {
    expect(iconFallbackLabel("Qwen")).toBe("Q");
    expect(iconFallbackLabel("chatgpt")).toBe("C");
  });

  it("returns the first character for CJK names", () => {
    expect(iconFallbackLabel("通义千问")).toBe("通");
    expect(iconFallbackLabel("克劳德")).toBe("克");
  });

  it("returns ? for empty input", () => {
    expect(iconFallbackLabel("")).toBe("?");
    expect(iconFallbackLabel("   ")).toBe("?");
  });
});