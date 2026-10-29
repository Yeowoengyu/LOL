import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { host: "0.0.0.0" },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.endsWith("/data/champions.json")) return "champion-data";
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
