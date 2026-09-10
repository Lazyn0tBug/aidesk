// § provider URL helpers — used by App.vue's return-to-home flow.

import { describe, expect, it } from "vitest";
import { matchesProviderHost, providerHost } from "./provider";

describe("providerHost", () => {
  it("extracts the host from a standard https URL", () => {
    expect(providerHost("https://chat.qwen.ai/some/path")).toBe("chat.qwen.ai");
    expect(providerHost("https://claude.ai")).toBe("claude.ai");
  });

  it("lower-cases the host (URL.host is always lowercase per WHATWG)", () => {
    expect(providerHost("https://CHAT.QWEN.AI/")).toBe("chat.qwen.ai");
  });

  it("includes the port when present (URL.host behavior)", () => {
    // URL.host includes :port when one is set. We compare the full
    // host string so a self-hosted instance on :8443 matches itself
    // even after a redirect that drops the port — both URLs keep the
    // same port, so equality works.
    expect(providerHost("https://chat.qwen.ai:8443/")).toBe("chat.qwen.ai:8443");
  });

  it("returns null for empty / null / undefined input", () => {
    expect(providerHost("")).toBeNull();
    expect(providerHost(null)).toBeNull();
    expect(providerHost(undefined)).toBeNull();
  });

  it("returns null for malformed URLs", () => {
    expect(providerHost("not-a-url")).toBeNull();
    expect(providerHost("://no-scheme")).toBeNull();
    expect(providerHost("http://")).toBeNull();
  });
});

describe("matchesProviderHost", () => {
  const provider = "https://chat.qwen.ai/";

  it("matches when the current URL is exactly the provider URL", () => {
    expect(matchesProviderHost("https://chat.qwen.ai/", provider)).toBe(true);
  });

  it("matches when the current URL is a sub-path of the provider", () => {
    expect(matchesProviderHost("https://chat.qwen.ai/chat/abc", provider)).toBe(
      true,
    );
  });

  it("matches across schemes (http -> https is the same host)", () => {
    expect(matchesProviderHost("http://chat.qwen.ai/", provider)).toBe(true);
  });

  it("does not match when the current URL is on a different host", () => {
    // OAuth bounce to accounts.google.com — the common case that
    // triggered the active-tab "return home" feature in the first place.
    expect(matchesProviderHost("https://accounts.google.com/", provider)).toBe(
      false,
    );
  });

  it("does not match a host that only shares a suffix", () => {
    // Defense against `evil-qwen.ai` matching `qwen.ai` — the
    // is_host_allowed function in providers.rs has the same prefix-dot
    // check; this helper matches exact hosts only.
    expect(matchesProviderHost("https://evil-qwen.ai/", provider)).toBe(false);
  });

  it("returns false when either URL is missing or unparseable", () => {
    expect(matchesProviderHost("", provider)).toBe(false);
    expect(matchesProviderHost(null, provider)).toBe(false);
    expect(matchesProviderHost("https://chat.qwen.ai/", "")).toBe(false);
    expect(matchesProviderHost("https://chat.qwen.ai/", "not-a-url")).toBe(false);
  });
});
