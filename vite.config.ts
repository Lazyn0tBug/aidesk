import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { minifySync } from "oxc-minify";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [vue(), tailwindcss()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    rollupOptions: {
      input: {
        // Main window (TabBar + WebViewArea)
        main: "index.html",
        // Toast overlay — embedded child webview attached last so it
        // draws on top of the active provider webview. See
        // `webview_manager.rs::attach_toast_overlay` and
        // `components/ToastApp.vue`.
        toast: "toast.html",
      },
    },
    // oxc-minify is ~5-10x faster than esbuild/Terser and produces
    // slightly smaller output on our bundles. Vite's `build.minify`
    // accepts a function that receives each chunk's source; we hand
    // it off to oxc-minify's synchronous minifier. Errors fall back
    // to the original code so a transient oxc failure can't brick
    // the production build.
    minify: (code: string) => {
      try {
        return minifySync("bundle.js", code, {
          module: true,
          compress: { target: "es2022", dropDebugger: true },
          mangle: { toplevel: true },
          codegen: { removeWhitespace: true },
        }).code;
      } catch {
        return code;
      }
    },
  },
}));
