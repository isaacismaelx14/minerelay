import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import packageJson from "./package.json";

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    target: "ES2020",
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        dead_code: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "tauri-vendor": ["@tauri-apps/api"],
          "shared-vendor": ["@minerelay/shared"],
        },
      },
    },
    sourcemap: false,
    reportCompressedSize: false,
  },
  server: {
    port: 1420,
    strictPort: true,
  },
});
