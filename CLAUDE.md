# AIDesk — Claude Instructions

Lightweight desktop LLM browser shell. Wraps multiple AI provider web UIs in
tabs, with a shared prompt draft box that copies to clipboard on switch.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Shell | Tauri v2 | single window, multi-webview per provider |
| Backend | Rust 2021 | modules under `src-tauri/src/` |
| Frontend | Vue 3 (`<script setup lang="ts">`) | design doc was written for React; component names + IPC contracts carry over, only file extension differs |
| Bundler | Vite | port 1420 fixed for Tauri dev |
| Package manager | Bun | `bun.lock` is intentionally **not** tracked (see Lockfile policy below) |
| Test runner | Rust `cargo test` | frontend has no test setup yet |

Single source of truth for product behavior: `docs/design.md`.

## Source of truth

- **`docs/design.md` is the spec.** When in doubt, match it. If the spec is
  silent on a corner, prefer the simplest behavior that matches its spirit.
- The design doc was written assuming React (`.tsx`); we use Vue 3 SFCs.
  Component names and IPC contracts are identical; only file extensions differ
  (e.g. `App.tsx` → `App.vue`, `<script setup lang="ts">` SFCs).

## Lockfile policy

**Neither `bun.lock` nor `Cargo.lock` is committed.** Both are listed in
`.gitignore` (root and `src-tauri/.gitignore`). Reproducible from
`package.json` + `Cargo.toml` plus the toolchain notes below.

- Bun: pinned majors via `package.json` ranges; `bun install` resolves
  the exact versions per machine.
- Cargo: `Cargo.toml` pins crate-level versions; the binary needs a stable
  toolchain — Rust 1.74+ is fine for the `tauri = "2"` and `url = "2"`
  versions we use.

If a change needs a specific transitive version to build, encode it in
`Cargo.toml` / `package.json` (e.g. via a `[patch.crates-io]` section or a
  more precise semver range), not by committing the lockfile.

## Layout

```
config/                          Config files (default + user override)
schemas/                          JSON Schema for AppConfig
public/icons/                     Provider icons ({iconKey}.png)
src/                              Frontend (Vue 3 + TS)
  components/                     TabBar, DraftBox, StatusOverlay, Toast, WebViewArea
  stores/                         appStore (reactive singleton, no Pinia dep)
  ipc/                            Typed wrappers around Tauri invoke()
  config/                         Frontend normalize helpers
  utils/                          bounds, icons, toast helpers
  styles/                         global.css
  types.ts                        Mirror of Rust AppConfig
src-tauri/                        Rust core
  src/                            modules per design §13 + lib.rs / main.rs
  capabilities/                   Tauri v2 permissions
  tauri.conf.json
```

## Module map

Rust (`src-tauri/src/`):

| File | Responsibility | Design ref |
|---|---|---|
| `error.rs` | `AppError` enum + `IpcError` wire shape | §17 |
| `config.rs` | load default + user config, deep merge, validate, expose `AppConfig` | §13.2, §6 |
| `state.rs` | read/write `app.state.json`, `lastActiveProviderId` | §13.3, §9 |
| `providers.rs` | filter enabled, lookup, whitelist computation | §13.4, §16 |
| `webview_manager.rs` | per-provider WebView lifecycle (Phase 2 stub) | §13.5, §4.3 |
| `navigation.rs` | navigation whitelist check + external browser | §13.6, §4.6 |
| `clipboard.rs` | write system clipboard (Phase 3 stub) | §13.7, §4.5 |
| `commands.rs` | Tauri command handlers + unified error format | §13.8, §12, §17 |

Frontend (`src/`):

| File | Responsibility | Design ref |
|---|---|---|
| `App.vue` | layout root, mounts TabBar + DraftBox + WebViewArea + Toast | §3.2, §5, §15 |
| `stores/appStore.ts` | reactive store: config, providers, active, draft, webviews | §14.2, §11.1 |
| `ipc/*` | typed `invoke()` wrappers | §12 |
| `utils/bounds.ts` | `calculateWebViewBounds()` | §14.3, §5.3 |
| `utils/icons.ts` | `resolveIcon(iconKey)` | §14.4 |
| `config/normalize.ts` | apply §7.6 invariants on the frontend | §7.6 |

## Commands

```bash
# Frontend
bun install
bun run dev                  # vite only (no Tauri)
bun run build                # vue-tsc + vite build
bun run tauri dev            # full app (Tauri + Vite)
bun run tauri build          # production bundle

# Backend
cd src-tauri
cargo test                   # 17 unit tests across config / state / providers / navigation
cargo check                  # type-check without building
```

`bun` is the only JS package manager we expect. `tauri.conf.json`
references `bun run` for `beforeDevCommand` / `beforeBuildCommand`.

## Conventions

### Rust

- Snake case everywhere (modules, functions, command names).
- All Tauri commands return `Result<T, AppError>`; `AppError` carries the
  `code` + `message` shape from design §17.2.
- Use `serde` derives; `AppConfig` is deserialized from JSON. Every
  config-related struct uses `#[serde(rename_all = "camelCase")]`.
- Provider URLs must be `https://`; reject non-https at config-validation time.
- Lockfile is not tracked; pin transitive versions in `Cargo.toml` directly.

### Frontend

- TypeScript strict. Components are SFCs with `<script setup lang="ts">`.
- One reactive store (`stores/appStore.ts`) per the design. We don't use
  Pinia to keep deps minimal — a module-scope `reactive()` is sufficient
  for a single-owner shape.
- IPC calls go through `src/ipc/*` wrappers — never `invoke()` ad hoc.
- Config normalization happens in `src/config/normalize.ts`; never mutate
  the config object received from Rust.
- Icons resolve to `/icons/{iconKey}.png` (fallback to a placeholder badge if
  absent).

### Config

- `config/app.config.default.json` is the fallback; the app must start even if
  it's the only file present.
- `config/app.config.json` is the user override (may not exist; create it to
  override).
- `app.state.json` lives in the OS app-data dir; never put secrets there.
- `providers` array is replaced wholesale by the user config (no per-id merge).

## Do

- Match design doc section numbers in comments when implementing a feature
  (e.g. `// §4.4 draft box copy-on-switch`).
- Add a new Tauri command by adding it to BOTH `commands.rs` AND the matching
  `src/ipc/*.ts` wrapper.
- Update both `app.config.default.json` and `schemas/app.config.schema.json`
  when adding a config field.
- Pin a transitive Rust dep by editing `Cargo.toml` (e.g. semver range or
  `[patch.crates-io]`), not by committing `Cargo.lock`.

## Don't

- Don't read clipboard contents from Rust. The design is write-only.
- Don't auto-submit or auto-fill forms on remote provider pages. MVP scope
  (§1.2) forbids it.
- Don't add features outside §1.1 (MVP scope).
- Don't reorder the `providers` array — order = display order.
- Don't introduce new top-level dependencies without checking whether
  Tauri v2 or the existing `package.json` already covers the use case.
- Don't commit lockfiles (`bun.lock`, `Cargo.lock`, `package-lock.json`,
  `yarn.lock`, `pnpm-lock.yaml`).
- Don't write em-dashes or emojis in source files or messages.

## Phase status

- [x] Phase 1: Config system (this scaffold)
- [ ] Phase 2: Tab + WebView lifecycle
- [ ] Phase 3: DraftBox + clipboard
- [ ] Phase 4: State + error overlay + retry
- [ ] Phase 5: Acceptance

Each phase ships behind a single commit and verifies against the matching
§21 acceptance list before moving on.