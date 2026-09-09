// Toast queue + auto-dismiss timing comes from `ui.toast.durationMs`
// (design §5.7). The component (`Toast.vue`) consumes this queue.

import { reactive } from "vue";
import type { ToastConfig } from "../types";

export type ToastVariant = "info" | "success" | "error";

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
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

/** Push a toast and schedule its auto-removal per the bound duration. */
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