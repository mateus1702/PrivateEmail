import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/dev-paymaster-api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dev-paymaster-api/, ""),
      },
      "/dev-bundler": {
        target: "http://127.0.0.1:4337",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dev-bundler/, ""),
      },
    },
  },
});
