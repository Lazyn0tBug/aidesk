// §5.7 Toast queue.
//
// Uses vitest's fake timers for the auto-dismiss timing so the test
// stays synchronous.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindToastConfig, dismissToast, pushToast, useToast } from "./toast";

describe("toast queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    bindToastConfig({ durationMs: 1000 });
    // drain any leftover items from prior tests
    useToast().items.splice(0);
    useToast().nextId = 1;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pushes a toast with an incrementing id", () => {
    pushToast("one", "info");
    pushToast("two", "success");
    const items = useToast().items;
    expect(items).toHaveLength(2);
    expect(items[0]?.id).toBe(1);
    expect(items[1]?.id).toBe(2);
  });

  it("auto-dismisses after the configured duration", () => {
    pushToast("bye");
    expect(useToast().items).toHaveLength(1);
    vi.advanceTimersByTime(999);
    expect(useToast().items).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToast().items).toHaveLength(0);
  });

  it("falls back to 2500ms when no config is bound", () => {
    useToast().config = null;
    pushToast("hi");
    vi.advanceTimersByTime(2499);
    expect(useToast().items).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToast().items).toHaveLength(0);
  });

  it("dismissToast removes by id", () => {
    pushToast("a");
    pushToast("b");
    const aId = useToast().items[0]!.id;
    dismissToast(aId);
    const remaining = useToast().items.map((t) => t.message);
    expect(remaining).toEqual(["b"]);
  });

  it("variants map to success/error/info classes", () => {
    pushToast("ok", "success");
    pushToast("no", "error");
    pushToast("note", "info");
    const variants = useToast().items.map((t) => t.variant);
    expect(variants).toEqual(["success", "error", "info"]);
  });
});