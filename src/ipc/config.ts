// §12.2 config commands.
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, ProviderConfig } from "../types";

/** Fetch the fully-resolved runtime config. */
export function getAppConfig(): Promise<AppConfig> {
  return invoke<AppConfig>("get_app_config");
}

/** Fetch the list of enabled providers only. */
export function getEnabledProviders(): Promise<ProviderConfig[]> {
  return invoke<ProviderConfig[]>("get_enabled_providers");
}