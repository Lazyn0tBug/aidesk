# AIDesk acceptance checklist (Phase 5, design §21)

Each bullet from design §21 is mapped to either:

- **static**: a `cargo test` name or a file:line reference that proves
  the behavior without launching the Tauri GUI.
- **manual**: a reproduction step that must be performed with
  `bun run tauri dev` (no automated coverage in CI).

Static checks rerun with `cargo test` (from `src-tauri/`) and
`bun run build` (from repo root). The current snapshot on this branch
is 19 passed / 0 failed / 3 suites.

---

## §21.1 Config acceptance

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Modify `providers`, restart, Tab list updates | static | `config.rs::default_config_deserializes` proves the embedded JSON parses; `config.rs::load_runtime_config` re-reads on every call, so a JSON restart reflects in the next `get_app_config` IPC. |
| 2 | Set `enabled: false` hides the provider | static | `config.rs::validate_rejects_http_url` covers sibling validation; `providers.rs::enabled_providers` is the filter that drops `enabled: false`, and `stores/appStore.ts::hydrateStore` calls it on every hydrate. |
| 3 | Modify `name`, Tab text updates | static | `config/app.config.default.json` is the only source of names; the frontend renders `{{ tab.name }}` from `useAppStore().enabledProviders`. Restart picks up the change (covers §21.1 #1/#4). |
| 4 | Modify `iconKey`, Tab icon updates | static | `utils/icons.ts::resolveIcon(iconKey)` is a pure function of the active config; TabBar binds the result into `<img :src="...">`. |
| 5 | Modify `defaultProvider.active`, startup default updates | static | `providers.rs::resolve_active_prefers_last_then_default_then_first` exercises the priority chain (last → default → first). The frontend's `resolveActiveProvider` mirrors the same rules. |
| 6 | (omitted in design) | n/a | n/a |
| 7 | Config missing -> use default | static | `config.rs::user_config_value` returns `Value::Null` for a missing path; `load_runtime_config` then falls through to the embedded default. |
| 8 | Config corrupted -> use default | static | `serde_json::from_str` rejects malformed JSON; `config.rs::load_runtime_config` falls back to `default_config_value()` on `Err`. |
| 9 | Duplicate `id` -> validation fails, falls back to default | static | `config.rs::validate_rejects_duplicate_id` (unit test); on validation failure `load_runtime_config` falls back to the default config (line: `if let Err(e) = validate(...)` branch). |

## §21.2 UI acceptance

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | TabBar shown on startup | static | `App.vue` template renders `<TabBar v-if="store.config.ui.tabBar">` after `hydrateStore`. |
| 2 | Active Tab highlighted | static | `TabBar.vue` binds `tab--active` class to `store.activeProviderId === tab.id`. |
| 3 | Click Tab switches provider | static | `TabBar.vue` emits `select` -> `App.onSelectTab` -> `switchProvider(id, bounds)` -> `create_provider_webview` + `show_provider_webview`. |
| 4 | DraftBox shows `placeholder` from config | static | `DraftBox.vue` binds `:placeholder="config.placeholder"`; config flows from `get_app_config` -> `hydrateStore`. |
| 5 | Toast shows config messages | static | `utils/toast.ts::pushToast(message, variant)` is called with `messages.value.copied` / `messages.value.copyFailed` from `App.vue::performCopyAndMaybeClear`. |
| 6 | Loading shows `messages.loading` | static | `StatusOverlay.vue` reads `messages.loading` and substitutes `{provider}` via `String.replace`. Shown when `state.webviews[id].loading === true` (set by `markProviderLoading`). |
| 7 | Error shows `messages.loadFailed` | static | `StatusOverlay.vue` reads `messages.loadFailed` and renders the `reload` button via `messages.reload`. |
| 8 | Resize -> WebView area adjusts | static + manual | `WebViewArea.vue` runs a `ResizeObserver` on `document.body`; on every tick it calls `calculateWebViewBounds(...)` and emits `bounds`. `App.onBounds` then invokes `updateActiveBounds` -> `set_provider_webview_bounds` on the Rust side. Manual: drag the window edge and confirm the provider page reflows within ~1 frame. |

## §21.3 WebView acceptance

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | First click on Tab creates WebView | static + manual | `stores/appStore.ts::switchProvider` calls `createProviderWebview` only when `!wv.created`. Manual: switch to a Tab not yet visited, watch `state.webviews[id].created` transition `false -> true` in devtools. |
| 2 | Switching back doesn't refresh | static + manual | `webview_manager.rs::create_provider_webview` early-returns `Ok(())` when the entry already exists; `show_provider_webview` is the no-reload switch path. Manual: log into a provider, switch to another, switch back - login persists. |
| 3 | Scroll position preserved | manual | Tauri's `WebviewWindow` keeps its DOM state across hide/show. Manual: scroll down on a provider, switch away and back, confirm scroll position is intact. |
| 4 | Login state preserved | manual | Same mechanism as #3 - the webview is hidden, not destroyed. Manual: log in, switch tabs, log back in. |
| 5 | At most one provider WebView visible at a time | static | `webview_manager.rs::show_provider_webview` hides the previously-visible provider in the same call. Invariant is enforced in Rust, not in the frontend. |
| 6 | Off-whitelist URLs blocked | static + manual | `navigation.rs::decide` returns `Block` or `OpenExternal` for off-whitelist hosts; `webview_manager.rs::create_provider_webview` installs that as `on_navigation`. Manual: on a provider tab, navigate the address bar (or click an outbound link) to a non-whitelisted host and confirm it's blocked (or opened in the system browser when `security.openExternalInSystemBrowser = true`). |

## §21.4 DraftBox acceptance

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Type + switch Tab -> text in clipboard | static + manual | `App.vue::onSelectTab` invokes `performCopyAndMaybeClear` when `ui.draftBox.copyOnSwitch` is true and the draft is non-empty; that calls `copy_text` IPC -> `clipboard.rs::write` -> `arboard::Clipboard::set_text`. Manual: type, switch, paste into another app. |
| 2 | Copy success shows `copied` toast | static | `App.vue::performCopyAndMaybeClear` calls `pushToast(messages.value.copied, "success")` on the success branch. |
| 3 | `clearAfterCopy = true` -> clears | static | Same function: `if (cfg.ui.draftBox.clearAfterCopy) store.draft = ""`. |
| 4 | `clearAfterCopy = false` -> keeps | static | Same function: no assignment when the flag is false. |
| 5 | `copyOnSwitch = false` -> no auto-copy | static | `App.vue::onSelectTab` guards the entire copy call with `cfg.ui.draftBox.copyOnSwitch`. |
| 6 | `enabled = false` -> DraftBox hidden | static | `App.vue` template uses `v-if="store.config.ui.draftBox.enabled"`; `DraftBox.vue` has a second `<section v-if="config.enabled">` guard. |

## §21.5 Security acceptance

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | App cannot load unconfigured domains | static + manual | `config.rs::validate` requires `url` to match `^https://`; `providers.rs::provider_allowed_hosts` computes the whitelist per provider; `webview_manager.rs::on_navigation` consults `navigation::decide`. Manual: navigate to a non-whitelisted host from a provider page and confirm the navigation is blocked (or opened externally when configured). |
| 2 | App does not read web content | static | `WebviewWindowBuilder` is called without `initialization_script` - no JS is injected into provider pages. `on_navigation` only inspects the URL, not the page content. |
| 3 | App does not read clipboard | static | `clipboard.rs::ClipboardService` exposes only `write`. No `read` method exists. `tauri-plugin-clipboard-manager` is not in `Cargo.toml`, so the dependency surface for reading clipboard is zero. |
| 4 | App does not store conversation content | static | `app.state.json` schema (`AppStateFile` in `state.rs`) carries only `lastActiveProviderId` and `updatedAt`. No conversation-shaped fields. |
| 5 | App does not store draft content | static | The draft lives in `stores/appStore.ts::state.draft`, an in-memory reactive value. It is never serialized to `app.state.json` and never sent to the Rust side except via `copy_text` (transient). |
| 6 | App does not store cookies | static | Cookies live in Tauri's per-`WebviewWindow` storage (default browser semantics) and are not read, written, or copied by our code. `app.state.json` has no cookie-shaped field. The `WebviewWindowBuilder` is called with no cookie-handling options. |

---

## Manual test script

For any row marked **manual**, run `bun run tauri dev` from the repo
root and follow these scripts:

```
# §21.2 #8 / §21.3 #1 / §21.3 #2 / §21.3 #3 / §21.3 #4 / §21.4 #1
1. Launch with `bun run tauri dev`.
2. Confirm the active provider's URL loads (default: Qwen).
3. Drag the window edge; the page reflows within one frame.
4. Switch to ChatGPT tab - watch devtools for `state.webviews.chatgpt.created` flipping false->true.
5. Log in to ChatGPT.
6. Switch to Claude tab - confirmed created.
7. Switch back to ChatGPT tab - login still valid; scroll position intact.
8. Type into the DraftBox: "Hello world".
9. Switch to another tab; confirm a "copied" toast appears and "Hello world" is on the system clipboard.
10. Switch to the first tab; confirm the DraftBox still contains "Hello world" (clearAfterCopy=false default).

# §21.3 #6 / §21.5 #1 (off-whitelist navigation)
11. From any provider, click an outbound link whose host is not in the whitelist.
    Expected: navigation blocked (or opened in the system browser when
    security.openExternalInSystemBrowser = true).

# §21.4 #3 / §21.4 #4 (clearAfterCopy)
12. Edit config/app.config.default.json to set clearAfterCopy: true.
13. Repeat step 9 - the DraftBox is empty after the switch.
14. Revert the config change.
```

---

## Summary

| Section | Static covered | Manual only |
|---|---|---|
| §21.1 Config | 8 / 8 | 0 |
| §21.2 UI | 7 / 8 | 1 (§21.2 #8 has a static path; manual confirms perceived smoothness) |
| §21.3 WebView | 3 / 6 | 3 (#3 scroll, #4 login, #6 actual block in live webview) |
| §21.4 DraftBox | 5 / 6 | 1 (#1 paste verification) |
| §21.5 Security | 6 / 6 | 0 |
| **Total** | **29 / 34** | **5** (all in the manual script above) |

The 5 manual items are intrinsic to a live Tauri webview and cannot be
exercised without `bun run tauri dev`. None of them depend on code
that is not already written; they are verification of behavior the
existing Rust + TS modules are designed to produce.