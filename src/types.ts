// Shared TypeScript types — mirror the Rust `AppConfig` shape (design §11.1).
// Field names are camelCase to match the JSON config; the Rust side uses
// `#[serde(rename_all = "camelCase")]` so deserialization works.

export type ProviderId = string;

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  iconKey: string;
  url: string;
  enabled: boolean;
  shortcut?: string;
  allowedHosts?: string[];
}

export interface WindowConfig {
  title: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  rememberLastProvider: boolean;
}

export interface AppSection {
  name: string;
  version: string;
  window: WindowConfig;
}

export interface DefaultProvider {
  active?: ProviderId;
  fallbackToFirstEnabled: boolean;
}

export interface WebviewConfig {
  lazyLoad: boolean;
  keepAlive: boolean;
  maxActiveWebviews: number;
  reloadOnFail: boolean;
}

export interface TabBarConfig {
  position: "top";
  showIcon: boolean;
  showName: boolean;
  iconOnly: boolean;
}

export interface DraftBoxConfig {
  enabled: boolean;
  placeholder: string;
  copyOnSwitch: boolean;
  clearAfterCopy: boolean;
  maxLines: number;
}

export interface ToastConfig {
  durationMs: number;
}

export interface ToolbarConfig {
  enabled: boolean;
  position: "left" | "right";
}

export interface UiConfig {
  tabBar: TabBarConfig;
  draftBox: DraftBoxConfig;
  toast: ToastConfig;
  toolbar: ToolbarConfig;
}

export interface SecurityConfig {
  allowUnknownNavigation: boolean;
  openExternalInSystemBrowser: boolean;
  globalAllowedHosts: string[];
}

export interface MessagesSection {
  loading: string;
  loadFailed: string;
  copied: string;
  copyFailed: string;
  reload: string;
}

export interface ShortcutsSection {
  focusDraftBox?: string;
  switchProviderPrefix?: string;
}

export interface FutureSection {
  autoFocusInput: boolean;
  autoFillInput: boolean;
  autoSubmit: boolean;
  sidebar: boolean;
  promptTemplates: boolean;
  answerRelay: boolean;
}

export interface AppConfig {
  app?: AppSection;
  providers: ProviderConfig[];
  defaultProvider: DefaultProvider;
  webview: WebviewConfig;
  ui: UiConfig;
  security: SecurityConfig;
  messages?: MessagesSection;
  shortcuts?: ShortcutsSection;
  future?: FutureSection;
}

export type WebViewLifecycle = "idle" | "loading" | "ready" | "error";

export interface WebViewRuntimeState {
  providerId: ProviderId;
  created: boolean;
  visible: boolean;
  loading: boolean;
  error: boolean;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Wire-format error returned by every Tauri command (design §17.2). */
export interface IpcError {
  code: string;
  message: string;
}

export type Result<T> = { ok: T; err?: never } | { ok?: never; err: IpcError };