# AIDesk end-to-end tests

Playwright specs that drive the real Tauri window via `tauri-driver`.

## Setup

One-time, on the machine that runs the suite:

```bash
# 1. Install the Tauri WebDriver bridge (Rust).
cargo install tauri-driver --locked

# 2. Make sure a desktop session is available — Tauri can't render
#    without one. On macOS / Linux that means an interactive login;
#    on CI, use xvfb-run or a similar virtual display.
```

## Run

From the project root:

```bash
bun run test:e2e
```

The Playwright config (`playwright.config.ts`) boots:

1. `tauri-driver` on port 4444 (WebDriver endpoint).
2. `bun run tauri dev` (which serves the app on http://127.0.0.1:1420).

If either is already up, `reuseExistingServer` keeps the existing
process.

## What we cover

`boot.spec.ts` exercises:

- The main window mounts with the `AIDesk` title.
- The Qwen tab renders as the active default.
- The DraftBox placeholder is non-empty.
- The main content area is present.

We deliberately do **not** navigate to chatgpt / claude providers —
the test runner does not have network access for those domains.
qwen is the only provider whose webview the suite touches.

## Debugging

- HTML report: `playwright-report/index.html` (opened on failure).
- Traces on failure: `test-results/*/trace.zip` — view with
  `bunx playwright show-trace test-results/.../trace.zip`.
- Console output from the Tauri app: tail the `bun run tauri dev`
  process; Playwright captures stderr via the `webServer` entry.