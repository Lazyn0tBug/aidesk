// Toast overlay entry point.
//
// Mounted in its own embedded webview (`toast.html`) attached as the
// last child of the main window. The native webview sits on top of any
// provider webview (qwen, chatgpt, claude) in the z-order — drawing
// HTML here is the only way to escape the "HTML behind native child
// view" trap.
//
// The overlay listens for `aidesk://toast` events emitted from the
// main window (or any future action site) and renders them with the
// `ui.toast.durationMs` auto-dismiss timer.

import { createApp } from "vue";
import ToastApp from "./components/ToastApp.vue";
import "./styles/toast-overlay.css";

createApp(ToastApp).mount("#app");
