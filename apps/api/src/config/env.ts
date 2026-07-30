import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

// Load the monorepo-root .env (cwd is the api package dir when run via pnpm/turbo),
// then fall back to any local .env / process environment.
config({ path: resolve(process.cwd(), "../../.env") });
config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .default("postgresql://footconnect:footconnect@localhost:5432/footconnect?schema=public"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Auth. Defaults let dev/test run out of the box; OVERRIDE these in production.
  JWT_ACCESS_SECRET: z.string().default("dev-access-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret-change-me"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // CORS / cookies.
  // Comma-separated list of allowed origins (Next dev :3000, Expo web :8081).
  CORS_ORIGIN: z.string().default("http://localhost:3000,http://localhost:8081"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
