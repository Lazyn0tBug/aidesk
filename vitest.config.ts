/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

// Vitest config for the frontend unit suite.
//
// Lives next to vite.config.ts so Vite + Vue plugin are reused
// verbatim. Tests run in jsdom (no real DOM measurements, no
// IPC, no Tailwind CSS evaluation). Components that touch the
// outside world mock those boundaries in the spec file.

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.vue"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/main.ts"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});