import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['events', 'process', 'buffer', 'stream', 'util'],
      globals: {
        Buffer: true, 
        global: true,
        process: true,
      },
    }),
  ],
  define: {
    // global is already handled by nodePolyfills, but retaining for compatibility if needed
  },
  server: {
    port: 3001,
  },
});
