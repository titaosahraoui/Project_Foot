import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { env } from "../src/config/env";

const apiDir = resolve(__dirname, "..");

console.log("Applying Prisma migrations to Supabase database...");

try {
  execSync("npx prisma migrate deploy", {
    cwd: apiDir,
    env: {
      ...process.env,
      DATABASE_URL: env.DATABASE_URL,
      DIRECT_URL: env.DIRECT_URL,
    },
    stdio: "inherit",
  });
  console.log("Prisma migrations applied successfully.");
} catch (error) {
  console.error("Failed to apply Prisma migrations:", error);
  process.exit(1);
}
