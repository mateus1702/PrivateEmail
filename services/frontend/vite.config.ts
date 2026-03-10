import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/dev-paymaster-api": {
        target: "http://169.40.135.206:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dev-paymaster-api/, ""),
      },
      "/dev-bundler": {
        target: "http://169.40.135.206:4337",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dev-bundler/, ""),
        timeout: 180_000, // 3 min - eth_getUserOperationReceipt polling can be slow
      },
    },
  },
});
