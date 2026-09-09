// AIDesk end-to-end smoke tests.
//
// We only run against the qwen provider — chatgpt/claude require
// network access the test runner doesn't have. The boot / UI /
// config tests below stay inside the local Tauri window and
// deliberately avoid exercising the actual provider webview.
//
// Note: running these requires `tauri-driver` installed
// (`cargo install tauri-driver --locked`) and a desktop session
// (Tauri can't run on a headless CI box without workarounds).

import { expect, test } from "@playwright/test";

test.describe("AIDesk boot", () => {
  test("the main window mounts with the configured title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("AIDesk");
  });

  test("renders the Qwen tab as the active default", async ({ page }) => {
    await page.goto("/");
    const tab = page.locator('[role="tab"]', { hasText: "Qwen" });
    await expect(tab).toBeVisible();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  });

  test("the draft box placeholder is non-empty", async ({ page }) => {
    await page.goto("/");
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    const placeholder = await textarea.getAttribute("placeholder");
    expect(placeholder?.length ?? 0).toBeGreaterThan(0);
  });
});