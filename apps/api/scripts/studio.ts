import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { env } from "../src/config/env";

const apiDir = resolve(__dirname, "..");

try {
  execSync("npx prisma studio", {
    cwd: apiDir,
    env: {
      ...process.env,
      DATABASE_URL: env.DATABASE_URL,
      DIRECT_URL: env.DIRECT_URL,
    },
    stdio: "inherit",
  });
} catch (error) {
  console.error("Prisma studio exited:", error);
}
