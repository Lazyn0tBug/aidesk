// §12.5 local state commands.
import { invoke } from "@tauri-apps/api/core";
import type { ProviderId } from "../types";

export function getLastActiveProvider(): Promise<ProviderId | null> {
  return invoke<ProviderId | null>("get_last_active_provider");
}

export function setLastActiveProvider(providerId: ProviderId): Promise<void> {
  return invoke<void>("set_last_active_provider", { providerId });
}
