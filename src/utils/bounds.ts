// §5.3 WebView area computation.
//
// The webview occupies everything below the tab bar + draft box and the
// full width of the window. The values are pixel offsets in the window's
// inner coordinate space.
//
// The TabBar / DraftBox heights are measured in `App.vue` from the DOM
// after layout. Pass them in fresh on every resize.

import type { Bounds } from "../types";

export interface WebViewAreaInputs {
  windowWidth: number;
  windowHeight: number;
  tabBarHeight: number;
  draftBoxHeight: number;
}

/**
 * Compute the (x, y, width, height) rectangle for the active WebView.
 *
 * Defaults to `{ x: 0, y: 0, width: windowWidth, height: windowHeight }`
 * when the header regions are not yet measured.
 *
 * All four fields are rounded to integer pixels. The Rust wire type
 * (`Bounds` in `webview_manager.rs`) declares `width`/`height` as `u32`,
 * and serde_json rejects fractional values with "expected u32". DOM
 * measurements (`getBoundingClientRect`) routinely return subpixel
 * floats on HiDPI displays, so rounding must happen at the producer.
 */
export function calculateWebViewBounds(
  input: Partial<WebViewAreaInputs> & { windowWidth: number; windowHeight: number },
): Bounds {
  const { windowWidth, windowHeight } = input;
  const tabBarHeight = input.tabBarHeight ?? 0;
  const draftBoxHeight = input.draftBoxHeight ?? 0;

  const y = tabBarHeight + draftBoxHeight;
  return {
    x: 0,
    y: Math.round(y),
    width: Math.max(0, Math.round(windowWidth)),
    height: Math.max(0, Math.round(windowHeight - y)),
  };
}