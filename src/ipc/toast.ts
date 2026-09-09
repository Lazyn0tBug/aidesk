// §12.7 toast overlay command. The Rust side mounts the toast webview
// as an embedded child of the main window so it draws on top of the
// active provider webview (qwen / chatgpt / claude).
import { invoke } from "@tauri-apps/api/core";
import type { Bounds } from "../types";

/**
 * Attach the toast overlay child webview, sized to the main window's
 * content area. Idempotent — Rust returns silently if the overlay is
 * already attached.
 */
export function attachToastOverlay(bounds: Bounds): Promise<void> {
  return invoke<void>("attach_toast_overlay", { bounds });
}
