// Standalone build for the Curious Reader offline APK bundle.
// Uses base: './' so every asset resolves relatively from file:// with no server.
// Build with: pnpm --filter @workspace/word-smash run build:standalone
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/standalone"),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    // Module preload links cannot be resolved from file:// — drop the polyfill
    // so no fetch() appears in the shipped bundle (TC-NFR-01).
    modulePreload: { polyfill: false },
  },
});
