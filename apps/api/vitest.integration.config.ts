import { defineConfig } from "vitest/config";

// Integration tests: require cloud Postgres (Supabase) + Redis (Upstash) and applied
// migrations. Run with `pnpm --filter @footconnect/api test:integration`.
export default defineConfig({
  test: {
    include: ["**/*.integration.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
