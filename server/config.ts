// Typed, validated configuration. Reads from the environment once at boot and
// fails fast with a clear message if something required is missing. Every other
// module imports `config` from here instead of touching process.env directly.
import { z } from "zod";

const rawSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  // Server-side secret. Present in real runs; optional here so the server can
  // still boot for a pure static/health check without a key (the /api/gemini
  // route reports its own "not configured" state rather than crashing boot).
  GEMINI_API_KEY: z.string().optional(),

  // Model IDs — GA strings verified available on the project's account.
  GEMINI_MODEL_FLASH_LITE: z.string().default("gemini-3.1-flash-lite"),
  GEMINI_MODEL_FLASH: z.string().default("gemini-3.5-flash"),
  GEMINI_MODEL_EMBED: z.string().default("gemini-embedding-001"),
});

const parsed = rawSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast, loudly, with the exact fields that are wrong.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error(`\n[config] Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  port: env.PORT,
  gemini: {
    apiKey: env.GEMINI_API_KEY ?? "",
    isConfigured: Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 8),
    models: {
      flashLite: env.GEMINI_MODEL_FLASH_LITE,
      flash: env.GEMINI_MODEL_FLASH,
      embed: env.GEMINI_MODEL_EMBED,
    },
  },
} as const;

export type Config = typeof config;
