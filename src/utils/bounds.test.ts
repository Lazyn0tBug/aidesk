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
});