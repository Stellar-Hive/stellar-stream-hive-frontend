import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: [
      "app/**/*.test.{ts,tsx}",
      "lib/**/*.test.ts",
      "hooks/**/*.test.{ts,tsx}",
      "components/**/*.test.tsx",
    ],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["lib/**/*.ts", "hooks/**/*.ts", "components/**/*.tsx", "app/**"],
      exclude: [
        "lib/**/*.test.ts",
        "hooks/**/*.test.{ts,tsx}",
        "components/**/*.test.tsx",
        "app/**/*.test.{ts,tsx}",
        "lib/testing/**",
      ],
    },
  },
});
