import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Integration suites share one database and assert on global queue state;
    // parallel test files would interleave rows and break each other's ordering.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
