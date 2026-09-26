import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ command }) => ({
  plugins: [react()],
  cacheDir: process.env.BIZTRUST_VITE_CACHE || `.data/vite-${command}`,
  // A restarted server must not retain optimizer artifacts from older dependencies.
  optimizeDeps: { force: true },
  server: { host: "127.0.0.1" },
  build: { outDir: "dist" },
}));
