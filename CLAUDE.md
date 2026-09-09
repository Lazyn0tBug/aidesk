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
| CSS | Tailwind v4 (`@tailwindcss/vite`) | CSS-first config in `src/styles/global.css`; no `tailwind.config.js` |
| Color space | OKLCH | declared in `@theme` block; light + `prefers-color-scheme: dark` override |
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
| `webview_manager.rs` | per-provider WebView lifecycle; creates child `WebviewWindow`s via `WebviewWindowBuilder::parent("main")`, gates navigation through `on_navigation` whitelist | §13.5, §4.3, §4.6 |
| `navigation.rs` | navigation whitelist check + external browser | §13.6, §4.6 |
| `clipboard.rs` | write system clipboard (Phase 3 stub) | §13.7, §4.5 |
| `commands.rs` | Tauri command handlers + unified error format | §13.8, §12, §17 |

Frontend (`src/`):

| File | Responsibility | Design ref |
|---|---|---|
| `App.vue` | layout root, mounts TabBar + DraftBox + WebViewArea + Toast | §3.2, §5, §15 |
| `stores/appStore.ts` | reactive store + actions: `hydrateStore`, `switchProvider`, `updateActiveBounds`, `reloadActive` (Phase 2 lifecycle, §15) | §14.2, §11.1 |
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
- **Styling uses Tailwind v4 utilities, not scoped CSS.** Component
  scoped styles are kept only for `@keyframes` and other things
  utilities can't express. All tokens (color, font, ring width) live in
  `src/styles/global.css` under `@theme`; the matching utilities
  (`bg-surface`, `text-ink`, `border-line`, etc.) are auto-generated.
  Don't introduce a `tailwind.config.js` — v4 is CSS-first by design.
- **Colors are OKLCH.** Light values in `:root`; dark values override
  inside `@media (prefers-color-scheme: dark)`. Never hand-pick hex or
  RGB — OKLCH keeps light/dark pairs perceptually balanced.

### Config

- `config/app.config.default.json` is the fallback; the app must start even if
  it's the only file present.
- `config/app.config.json` is the user override (may not exist; create it to
  override).
- `app.state.json` lives in the OS app-data dir; never put secrets there.
- `providers` array is replaced wholesale by the user config (no per-id merge).

## Best practices

### Vue 3 (`<script setup lang="ts">`)

- Always declare props/emits with the `defineProps<{...}>()` and
  `defineEmits<{...}>()` type-only macros (not the runtime `defineProps({})`
  form) so TS sees the types.
- Prefer `ref()` for primitives and single values; use `reactive()` only when
  grouping belongs together. Reach for `computed()` for any derived value;
  do not maintain derived state with `watch()` + assignment.
- Never mutate a prop. Emit an event or route through the store.
- Keep SFCs shallow. Extract a child component when a file passes ~200 lines
  or owns its own local state worth naming.
- Composables (`useXxx`) for shared reactive logic; colocate with the store
  if it owns global state.
- No side effects inside `computed()` — use `watch()` / `watchEffect()` or
  move it into an event handler.
- No `any`. Use `unknown` + narrowing, or a precise type.
- Use `v-model` shorthand only when you don't also need other listeners on
  the same element. Otherwise bind `:value` + `@input` explicitly.
- Reach for `nextTick()` only when a DOM measurement depends on a pending
  reactive update.

### Rust

- Return `Result<T, AppError>` for anything that can fail at runtime.
  `unwrap()` is fine in tests and `expect("invariant")` is fine at startup,
  but never in a code path the frontend can hit.
- `thiserror` for typed errors (`#[derive(Error)]` + `#[from]` for source
  chaining). Don't use `anyhow` in library code.
- `&str` over `String`, `&[T]` over `Vec<T>` for read-only parameters.
- Iterator chains over imperative loops when they read clearly.
- Public types and functions get a one-line doc comment that names the
  design-doc section they implement, e.g. `/// §16.1 host whitelist`.
- `#[serde(rename_all = "camelCase")]` + `deny_unknown_fields` on every wire
  type — catches typos in the JSON config and stale fields after refactors.
- Atomic file writes (write to `*.tmp`, then `rename`) for any persisted
  state. Pair with a "corrupted → reset to empty defaults" read path.
- No `panic!` in code paths that the frontend invokes; log and return
  `AppError` instead.
- Prefer flat module layout (`src/*.rs`, no nested folders) until a module
  grows past ~500 lines.

### Code quality

- Comments explain WHY, not WHAT. The code already shows what.
- Match the surrounding file's comment density, naming, and idiom. Don't
  introduce a new style mid-file.
- Small, testable, pure functions where possible. Push I/O to the edges.
- One responsibility per module. If a file's top doc comment needs "and",
  split it.
- Naming is precise: `activeProvider`, not `currentProv`; `resolveActive`
  not `doActive`. Don't abbreviate beyond the common ones (`id`, `ui`,
  `ipc`, `cfg`).
- Remove dead code. A `#[allow(dead_code)]` needs a comment explaining why
  it stays.
- No re-export to paper over a name; rename instead.

### Security

- Tauri capabilities (`src-tauri/capabilities/*.json`) are the security
  boundary. Grant the minimum permission set the feature needs; prefer
  `core:webview:allow-<specific>` over `core:webview:default` once we know
  what we use.
- Default-deny on outbound navigation. `navigation::decide` already
  enforces the whitelist (§16); never add a blanket `Allow` path.
- HTTPS-only URLs are validated in `config.rs` — keep it that way.
- Frontend input is untrusted. Validate again in Rust for anything that
  hits disk, IPC, or navigation policy.
- No `eval`, `new Function()`, or dynamically injected `<script>` in the
  frontend bundle. No third-party CDN imports either.
- CSP stays restrictive. Currently `null` for dev; tighten (or set
  `strict-dynamic`) before any release build.
- Secrets never appear in the frontend bundle, IPC payloads, or persisted
  state. `app.state.json` is intentionally tiny.
- No `tokio::spawn` without a bounded channel / cancellation path.

## Refactoring

A refactor that touches a name, type, or shape must update **every** place
that depends on it. Use this checklist before opening the PR:

| Change | Must update |
|---|---|
| Rename a Rust function / type / module | `lib.rs` `mod` + `pub use`, every `use` site, tests, `// §X.Y` comments that name it, this file's Module map |
| Rename a Tauri command string | Rust handler in `commands.rs` (or its module), `lib.rs` `generate_handler!` list, every `src/ipc/*.ts` wrapper, every caller in `src/` |
| Change an IPC type signature (Rust struct fields, `Bounds`, etc.) | Rust struct + `#[derive]` set, `src/types.ts` mirror, every `src/ipc/*.ts` wrapper that types its parameters, tests |
| Add / remove / rename a config field | `config/app.config.default.json`, `schemas/app.config.schema.json`, Rust struct (`config.rs`), `src/types.ts`, `src/config/normalize.ts` if a default or invariant changes |
| Rename a TS function / type / component | the file itself, every `import` site, any `defineProps` / `defineEmits` referencing it, the Module map in this file |
| Move a file (Rust) | `mod xxx;` in `lib.rs` (or parent), every `use` site, this file's Module map |
| Move a file (TS) | every `import` site; check `tsconfig.json` paths if it crosses `src/` subtrees |
| Rename a design-doc section number | `// §X.Y` comments that referenced the old number; the Module map if it cites a section |
| Add a new Tauri command | `commands.rs` (or its module), `lib.rs` handler list, `src/ipc/*.ts` wrapper, TS type in `src/types.ts` |
| Add a new module | `pub mod` in `lib.rs`, the Module map in this file, the `Layout` block |
| Delete a feature | tests, design-doc `// §X.Y` comments, `app.config.default.json`, `schemas/app.config.schema.json`, the Phase status list |
| Add / rename / remove a Tailwind theme token | `src/styles/global.css` `@theme` block (light + dark override), every `bg-*` / `text-*` / `border-*` utility usage in components |
| Change a component's visual treatment | the SFC template (`class="..."`); if the change is a one-off, no scope impact; if a recurring pattern, promote to a `@theme` token |

Always end a refactor commit with `cargo check` + `cargo test` from
`src-tauri/` and `bun run build` from the repo root. Both must succeed
before the change is considered complete.

Always end a refactor commit with `cargo check` + `cargo test` from
`src-tauri/` and `bun run build` from the repo root. Both must succeed
before the change is considered complete.

Always end a refactor commit with `cargo check` + `cargo test` from
`src-tauri/` and `bun run build` from the repo root. Both must succeed
before the change is considered complete.

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
- [x] Phase 2: Tab + WebView lifecycle
- [ ] Phase 3: DraftBox + clipboard
- [ ] Phase 4: State + error overlay + retry
- [ ] Phase 5: Acceptance

Each phase ships behind a single commit and verifies against the matching
§21 acceptance list before moving on.

### Phase 2 notes

- Provider webviews are mounted as **child windows of the main window**
  via `WebviewWindowBuilder::parent(main_window)`. This is the supported
  (non-`unstable`) path in Tauri v2. `tauri::WebviewBuilder` is the
  alternative but lives behind the `unstable` feature flag, which we
  avoid.
- Navigation whitelist (design §4.6) is enforced at the `on_navigation`
  hook installed at creation time, not on the frontend. Off-whitelist
  URLs are blocked. Phase 4 may add a fallback that opens the URL in
  the system browser when `security.openExternalInSystemBrowser` is
  true; for now block-only matches §4.6 #6 when that flag is false.
- The frontend lazily creates webviews on first switch (design §4.3
  #2). The active provider is created eagerly on startup once
  `WebViewArea` emits its first bounds.
- "At most one visible WebView" (design §3.1 #4, §4.3 #6) is enforced
  inside `show_provider_webview`: it hides the previously-visible
  provider in the same call rather than requiring a separate
  `hide_all` round-trip.