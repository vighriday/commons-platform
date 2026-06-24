// Server-side Gemini client. The API key lives only here, read from validated
// config, and is never sent to the browser. This module is the single chokepoint
// for every model call so routing, structured-output validation, caching, and
// quota accounting all happen in one place.
import { GoogleGenAI } from "@google/genai";
import type { Schema } from "@google/genai";
import type { ZodType } from "zod";
import type { AgentName, ModelTier } from "../shared/types.ts";
import { readCache, writeCache } from "./agents/cache.ts";
import { AgentOffline } from "./agents/types.ts";
import { config } from "./config.ts";
import { logger } from "./lib/logger.ts";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!config.gemini.isConfigured) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }
  return client;
}

// ── RPD accounting ───────────────────────────────────────────────────────────────
// A live counter so the demo can prove it spends ~0 RPD off the frozen cache.
const usage = { flash: 0, flashLite: 0, cacheHits: 0 };
export function geminiUsage(): {
  flash: number;
  flashLite: number;
  cacheHits: number;
  total: number;
} {
  return { ...usage, total: usage.flash + usage.flashLite };
}

function modelFor(tier: ModelTier): string {
  return tier === "flash" ? config.gemini.models.flash : config.gemini.models.flashLite;
}

/**
 * A minimal text round-trip used by the health/ping route to prove the key works
 * end-to-end. Returns the model's text, or throws with a logged reason.
 */
export async function geminiPing(prompt = "Reply with the single word: OK"): Promise<string> {
  const ai = getClient();
  const model = config.gemini.models.flashLite;
  try {
    const response = await ai.models.generateContent({ model, contents: prompt });
    const text = response.text ?? "";
    logger.info({ model, chars: text.length }, "gemini_ping_ok");
    return text.trim();
  } catch (err) {
    logger.error({ err, model }, "gemini_ping_failed");
    throw err;
  }
}

// ── Structured, routed, cached generation ────────────────────────────────────────
export interface StructuredCall<T> {
  agent: AgentName;
  tier: ModelTier;
  prompt: string;
  // Native @google/genai responseSchema (built from the Type enum — NOT
  // z.toJSONSchema, which does not exist on zod 3). Constrains the model output.
  responseSchema: Schema;
  // Zod schema used ONLY to validate/parse the returned JSON (defence in depth).
  validate: ZodType<T>;
  // Deterministic cache key for this call (see stableHash of the agent inputs).
  inputHash: string;
  // Optional extra content parts (e.g. an image) appended after the prompt.
  parts?: unknown[];
}

export interface StructuredResult<T> {
  value: T;
  cached: boolean;
  callCount: number; // 0 on cache hit, 1 (or 2 with repair) on a live call
}

/**
 * Run one structured model call with cache-first behaviour. On a cache hit
 * returns the frozen value with 0 RPD. On a miss, calls the routed model with a
 * JSON responseSchema, validates with zod, and retries ONCE on a parse failure
 * (the Gemini-3 structured-output guard). Throws AgentOffline when the key is
 * absent so the calling agent's deterministic fallback can take over.
 */
export async function generateStructured<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
  // 1) Cache-first — the 0-RPD path the demo runs on.
  const hit = readCache<T>(call.inputHash);
  if (hit !== null) {
    const parsed = call.validate.safeParse(hit);
    if (parsed.success) {
      usage.cacheHits++;
      return { value: parsed.data, cached: true, callCount: 0 };
    }
    // A cached value that no longer matches the schema is stale → fall through
    // and regenerate (or go offline).
    logger.warn({ agent: call.agent, inputHash: call.inputHash }, "agent_cache_stale");
  }

  // 2) No live key → offline; the agent supplies its golden fallback.
  if (!config.gemini.isConfigured) {
    throw new AgentOffline(call.agent);
  }

  const ai = getClient();
  const contents = call.parts?.length ? [call.prompt, ...call.parts] : call.prompt;

  // Model attempt order: the routed tier first; if it's Flash and Flash is
  // overloaded (the 503 "high demand" the GA Flash model intermittently throws),
  // fall back to Flash-Lite — a real model answer beats the golden fallback. Each
  // model gets one parse-repair retry.
  const attempts: ModelTier[] =
    call.tier === "flash" ? ["flash", "flash", "flash-lite"] : ["flash-lite", "flash-lite"];

  // 3) Live calls with model + repair fallback.
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts.length; attempt++) {
    const tier = attempts[attempt];
    const model = modelFor(tier);
    try {
      const response = await ai.models.generateContent({
        model,
        contents: contents as never,
        config: { responseMimeType: "application/json", responseSchema: call.responseSchema },
      });
      if (tier === "flash") usage.flash++;
      else usage.flashLite++;

      const text = response.text ?? "";
      const json = JSON.parse(text) as unknown;
      const parsed = call.validate.safeParse(json);
      if (!parsed.success) {
        lastErr = parsed.error;
        logger.warn(
          { agent: call.agent, attempt, issues: parsed.error.issues.length },
          "agent_validate_failed",
        );
        continue; // try next attempt
      }
      writeCache(call.inputHash, parsed.data);
      logger.info({ agent: call.agent, model, tier, attempt }, "agent_generated");
      return { value: parsed.data, cached: false, callCount: attempt + 1 };
    } catch (err) {
      lastErr = err;
      logger.warn({ agent: call.agent, attempt, err }, "agent_call_error");
    }
  }
  // Both attempts failed → offline path (golden fallback) with the cause logged.
  logger.error({ agent: call.agent, err: lastErr }, "agent_offline_after_retry");
  throw new AgentOffline(call.agent, lastErr);
}

export { getClient as getGeminiClient };
