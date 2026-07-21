import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json" assert { type: "json" };

export default defineConfig({
  plugins: [react(), crx({ manifest: manifest as never })],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: "src/popup/index.html",
      },
    },
  },
  server: {
    port: 5175,
    strictPort: true,
    hmr: { port: 5175 },
  },
});
