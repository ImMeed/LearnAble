/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    nodePolyfills({
      include: ["events", "process", "buffer", "stream", "util"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  server: {
    port: 3001,
    proxy: {
      "/auth": "http://127.0.0.1:8000",
      "/users": "http://127.0.0.1:8000",
      "/study": "http://127.0.0.1:8000",
      "/quiz": "http://127.0.0.1:8000",
      "/gamification": "http://127.0.0.1:8000",
      "/forum": "http://127.0.0.1:8000",
      "/library": "http://127.0.0.1:8000",
      "/notifications": "http://127.0.0.1:8000",
      "/ai": "http://127.0.0.1:8000",
      "/teacher": "http://127.0.0.1:8000",
      "/tutor": "http://127.0.0.1:8000",
      "/psychologist": "http://127.0.0.1:8000",
      "/call": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test-setup.ts",
  },
});
