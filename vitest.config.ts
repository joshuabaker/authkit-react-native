import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    root: ".",
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/store.ts"],
      thresholds: {
        branches: 80,
        lines: 80,
      },
    },
  },
});
