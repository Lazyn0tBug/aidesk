// Playwright config for the AIDesk Tauri e2e suite.
//
// Tauri 2 uses `tauri-driver` (a Rust WebDriver server) as the bridge
// between Playwright and the native window. The driver must be
// installed once with:
//
//     cargo install tauri-driver --locked
//
// Then `bun run test:e2e` will start `tauri-driver` and launch the
// app via `cargo tauri dev` (via `webServer`). The setup is local-only
// (no network for the providers themselves) so the only network we
// rely on is whatever the operator's machine already has.

import { defineConfig } from "@playwright/test";

const TAURI_DRIVER_URL = "http://127.0.0.1:4444";
const APP_URL = "http://127.0.0.1:1420";

export default defineConfig({
  testDir: "./e2e",
  // Single worker — the Tauri window is a singleton resource.
  workers: 1,
  // One retry so a flaky `tauri dev` boot doesn't fail the run.
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      // tauri-driver acts as a WebDriver server. We don't actually use
      // it from Playwright over WebDriver (we connect to the Vite dev
      // server directly) but having the process live lets us hit the
      // CDP-attached window if we ever want to.
      command: "tauri-driver --port 4444",
      url: TAURI_DRIVER_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // The Tauri dev server (Vite + Tauri). We open this in the
      // browser-like context Playwright drives; it's the same URL the
      // production WebView loads.
      command: "bun run tauri dev --no-watch",
      url: APP_URL,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
  projects: [
    {
      name: "tauri",
      use: {
        // tauri-driver exposes its WebDriver endpoint on 4444 by
        // default. The Tauri app process itself serves Vite at 1420.
        baseURL: APP_URL,
        // The Tauri WebView is not a regular browser, so some browser
        // features (clipboard, geolocation, etc.) behave differently.
        ignoreHTTPSErrors: true,
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});