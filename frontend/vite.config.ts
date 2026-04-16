/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    define: {
      __READING_LAB_ENABLED__: JSON.stringify(env.READING_LAB_ENABLED === "true"),
      __CLASSROOM_SYSTEM_ENABLED__: JSON.stringify(env.CLASSROOM_SYSTEM_ENABLED === "true"),
      __ATTENTION_CALL_ENABLED__: JSON.stringify(env.ATTENTION_CALL_ENABLED === "true"),
    },
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
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test-setup.ts",
    },
  };
});
