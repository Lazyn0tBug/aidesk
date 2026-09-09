// §5.3 WebView area bounds computation.
//
// Pure function, no Vue, no DOM. Covers the math + edge cases
// (zero / negative inputs after a header isn't measured yet).

import { describe, expect, it } from "vitest";
import { calculateWebViewBounds } from "./bounds";

describe("calculateWebViewBounds", () => {
  it("lays out below the headers and matches window width", () => {
    const b = calculateWebViewBounds({
      windowWidth: 1280,
      windowHeight: 800,
      tabBarHeight: 44,
      draftBoxHeight: 60,
    });
    expect(b).toEqual({ x: 0, y: 104, width: 1280, height: 696 });
  });

  it("treats missing header heights as 0", () => {
    const b = calculateWebViewBounds({
      windowWidth: 1000,
      windowHeight: 500,
    });
    expect(b).toEqual({ x: 0, y: 0, width: 1000, height: 500 });
  });

  it("clamps negative heights to 0 when headers exceed window", () => {
    const b = calculateWebViewBounds({
      windowWidth: 800,
      windowHeight: 100,
      tabBarHeight: 44,
      draftBoxHeight: 60,
    });
    expect(b.height).toBe(0);
  });

  it("clamps negative widths to 0", () => {
    const b = calculateWebViewBounds({
      windowWidth: 0,
      windowHeight: 0,
    });
    expect(b.width).toBe(0);
    expect(b.height).toBe(0);
  });

  it("rounds fractional inputs to integer pixels", () => {
    // HiDPI `getBoundingClientRect()` routinely returns subpixel floats
    // (e.g. 590.3333282470703). The Rust wire type declares
    // `Bounds { width: u32, height: u32 }`, so non-integer values are
    // rejected by serde_json. Pin the rounding here.
    const b = calculateWebViewBounds({
      windowWidth: 1280.5,
      windowHeight: 800.25,
      tabBarHeight: 44.4,
      draftBoxHeight: 60.6,
    });
    expect(b).toEqual({ x: 0, y: 105, width: 1281, height: 695 });
    for (const v of Object.values(b)) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});