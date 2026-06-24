// Typed, validated configuration. Reads from the environment once at boot.
//
// Design note: in a managed container (Cloud Run via AI Studio) the process must
// ALWAYS reach `listen()` quickly, or the health check fails. So this never
// calls process.exit on a config problem — it logs a warning and falls back to
// safe defaults. A bad env degrades a feature; it never prevents the server from
// starting and answering /api/health.
import { z } from "zod";

const rawSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  // Server-side secret. Optional so the server boots even without a key (the
  // /api/gemini route reports its own "not configured" state rather than
  // crashing boot). On AI Studio this is injected at runtime.
  GEMINI_API_KEY: z.string().optional(),

  // Model IDs — GA strings verified available on the project's account.
  GEMINI_MODEL_FLASH_LITE: z.string().default("gemini-3.1-flash-lite"),
  GEMINI_MODEL_FLASH: z.string().default("gemini-3.5-flash"),
  GEMINI_MODEL_EMBED: z.string().default("gemini-embedding-001"),
});

const parsed = rawSchema.safeParse(process.env);

if (!parsed.success) {
  // Log, but do NOT exit — always proceed to listen() with defaults.
  // eslint-disable-next-line no-console
  console.warn("[config] Some env values were invalid; using safe defaults.");
}

// Use parsed data when valid, otherwise parse an empty object to get pure defaults.
const env = parsed.success ? parsed.data : rawSchema.parse({});

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
