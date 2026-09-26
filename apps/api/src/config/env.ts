import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

// Load the monorepo-root .env (cwd is the api package dir when run via pnpm/turbo),
// then fall back to any local .env / process environment.
config({ path: resolve(process.cwd(), "../../.env") });
config();

const SUPABASE_DEFAULT_URL =
  "postgresql://postgres.apiswjgjohijnbrqkows:YPsu-ej9a5Dd8AS@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require";

function normalizeDatabaseUrl(rawUrl?: string): string {
  if (!rawUrl || rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1")) {
    return SUPABASE_DEFAULT_URL;
  }
  // If the direct Supabase IPv6-only hostname is used, rewrite to the IPv4-compatible Supabase pooler
  if (rawUrl.includes("db.apiswjgjohijnbrqkows.supabase.co")) {
    try {
      const parsed = new URL(rawUrl);
      parsed.hostname = "aws-1-eu-west-1.pooler.supabase.com";
      parsed.port = "5432";
      if (parsed.username && !parsed.username.includes(".")) {
        parsed.username = `${parsed.username}.apiswjgjohijnbrqkows`;
      }
      if (!parsed.searchParams.has("sslmode")) {
        parsed.searchParams.set("sslmode", "require");
      }
      return parsed.toString();
    } catch {
      return rawUrl
        .replace(
          /postgres(:[^@]+)?@db\.apiswjgjohijnbrqkows\.supabase\.co(:5432)?/,
          "postgres.apiswjgjohijnbrqkows$1@aws-1-eu-west-1.pooler.supabase.com:5432",
        )
        .concat(
          rawUrl.includes("sslmode=")
            ? ""
            : rawUrl.includes("?")
              ? "&sslmode=require"
              : "?sslmode=require",
        );
    }
  }
  return rawUrl;
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .default(
      "postgresql://postgres:YPsu-ej9a5Dd8AS@db.apiswjgjohijnbrqkows.supabase.co:5432/postgres?schema=public",
    )
    .transform(normalizeDatabaseUrl),
  DIRECT_URL: z
    .string()
    .default(
      "postgresql://postgres:YPsu-ej9a5Dd8AS@db.apiswjgjohijnbrqkows.supabase.co:5432/postgres?schema=public",
    )
    .transform(normalizeDatabaseUrl),
  SUPABASE_URL: z
    .string()
    .default("https://apiswjgjohijnbrqkows.supabase.co"),
  SUPABASE_ANON_KEY: z
    .string()
    .default("sb_publishable_7feHVYSEMewvkRaYTCwsLw_MbOk0PV4"),
  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .default("sb_publishable_7feHVYSEMewvkRaYTCwsLw_MbOk0PV4"),
  UPSTASH_REDIS_REST_URL: z
    .string()
    .default("https://loyal-herring-44337.upstash.io"),
  UPSTASH_REDIS_REST_TOKEN: z
    .string()
    .default("Aa0xAAIgcDFjMzA5OTQ0NDc4ZDU0ZmY4YmE2MmFhYzc1ZDlmYzhkMg"),
  REDIS_URL: z.string().optional(),

  // Auth. Defaults let dev/test run out of the box; OVERRIDE these in production.
  JWT_ACCESS_SECRET: z.string().default("dev-access-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret-change-me"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // CORS / cookies.
  // Comma-separated list of allowed origins (Next dev :3000, Expo web :8081).
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:3000,http://localhost:8081"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export const env = envSchema.parse(process.env);
process.env.DATABASE_URL = env.DATABASE_URL;
process.env.DIRECT_URL = env.DIRECT_URL;
process.env.SUPABASE_URL = env.SUPABASE_URL;
process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
process.env.SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_PUBLISHABLE_KEY;
process.env.NODE_ENV = env.NODE_ENV;
export type Env = z.infer<typeof envSchema>;
