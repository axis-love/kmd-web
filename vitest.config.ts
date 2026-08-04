import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/src/**/*.test.tsx",
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
    ],
    exclude: ["node_modules", "dist", "tests/visual/**"],
    environment: "node",
    css: false,
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "packages/*/src/**/*.tsx"],
      exclude: ["packages/*/src/**/*.test.ts", "packages/*/src/**/*.test.tsx"],
    },
  },
});
