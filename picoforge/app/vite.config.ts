import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API and WS requests to the Deno server
      "/api": {
        target: "http://127.0.0.1:7317",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:7317",
        ws: true,
        changeOrigin: true,
      },
      "/files": {
        target: "http://127.0.0.1:7317",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../server/public",
    emptyOutDir: true,
  },
});
