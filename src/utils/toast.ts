// Toast queue + auto-dismiss timing comes from `ui.toast.durationMs`
// (design §5.7). In the live app, `pushToastEvent` emits a Tauri event
// that the toast overlay webview (`ToastApp.vue`) listens for. The
// local reactive queue remains so the queue behavior is unit-testable
// without booting Tauri.

import { reactive } from "vue";
import { emit } from "@tauri-apps/api/event";
import type { ToastConfig } from "../types";

export type ToastVariant = "info" | "success" | "error";

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastPayload {
  message: string;
  variant: ToastVariant;
  durationMs: number;
}

const state = reactive<{ items: Toast[]; nextId: number; config: ToastConfig | null }>({
  items: [],
  nextId: 1,
  config: null,
});

export function useToast() {
  return state;
}

/** Inject the active toast config so durations follow design §5.7. */
export function bindToastConfig(config: ToastConfig) {
  state.config = config;
}

/** Push a toast to the local queue and schedule its auto-removal. */
export function pushToast(message: string, variant: ToastVariant = "info") {
  const id = state.nextId++;
  state.items.push({ id, message, variant });
  const duration = state.config?.durationMs ?? 2500;
  window.setTimeout(() => dismissToast(id), duration);
}

export function dismissToast(id: number) {
  const i = state.items.findIndex((t) => t.id === id);
  if (i >= 0) state.items.splice(i, 1);
}

/**
 * Emit a toast event that the overlay webview (`ToastApp.vue`) will
 * pick up. Falls back to the local queue when running outside Tauri
 * (e.g. unit tests).
 */
export async function pushToastEvent(message: string, variant: ToastVariant = "info") {
  const durationMs = state.config?.durationMs ?? 2500;
  try {
    await emit("aidesk://toast", { message, variant, durationMs } satisfies ToastPayload);
  } catch {
    // Not in a Tauri context (tests, plain browser) — keep the local
    // queue alive so callers in that mode still get a visible toast.
    pushToast(message, variant);
  }
}
