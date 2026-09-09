// §12.4 clipboard command.
import { invoke } from "@tauri-apps/api/core";

export function copyText(text: string): Promise<void> {
  return invoke<void>("copy_text", { text });
}