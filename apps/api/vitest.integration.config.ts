import { defineConfig } from "vitest/config";

// Integration tests: require a running Postgres + Redis (pnpm docker:up) and an
// applied migration. Run with `pnpm --filter @footconnect/api test:integration`.
export default defineConfig({
  test: {
    include: ["**/*.integration.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
