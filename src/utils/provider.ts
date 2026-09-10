// Helpers for the "click the active tab to return to provider home"
// flow (App.vue::returnToProviderHome). Extracted from inline logic so
// they can be unit-tested without spinning up the IPC layer.

/**
 * Extract the host from a URL string. Returns null if the input is
 * empty, unparseable, or uses a non-hierarchical scheme (e.g.
 * `data:`, `mailto:`). The `URL` constructor throws on bad input
 * rather than returning a sentinel, so we wrap it.
 */
export function providerHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

/**
 * True iff `currentUrl`'s host matches `providerUrl`'s host. Used by
 * App.vue's active-tab return-to-home flow to decide whether the
 * webview is still on the provider's domain (no action) or has been
 * redirected away (walk history back, then force-reload).
 *
 * Returns false when either URL is missing or unparseable — the caller
 * falls through to the reload branch in that case, which is the safer
 * default.
 */
export function matchesProviderHost(
  currentUrl: string | null | undefined,
  providerUrl: string,
): boolean {
  const current = providerHost(currentUrl);
  const target = providerHost(providerUrl);
  if (!current || !target) return false;
  return current === target;
}
