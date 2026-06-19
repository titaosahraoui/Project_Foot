import { defineConfig } from "vitest/config";

// Default test run: unit tests only. Integration tests (which need a live
// Postgres + Redis) are excluded here and run via `pnpm test:integration`.
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts"],
  },
});
