// Server-side Gemini client. The API key lives only here, read from validated
// config, and is never sent to the browser. This module is the single chokepoint
// for every model call so routing, structured-output validation, caching, and
// quota accounting all happen in one place.
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";
import type { SafetySetting, Schema } from "@google/genai";
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
// Gemma is tracked separately — it draws on a different free-tier quota pool, so
// it does not count against the Gemini RPD soft cap.
const usage = { flash: 0, flashLite: 0, gemma: 0, cacheHits: 0 };

// C9 · the circuit-breaker has two thresholds:
//   soft cap  → stop spending Gemini, route to Gemma's separate free-tier pool.
//   hard cap  → open the breaker: stop ALL live model calls, degrade to the
//               seed/golden read path (AgentOffline → each agent's golden value).
// The hard cap also bounds total Gemma spend (Gemma counts toward it). This is the
// "trap-survival" behaviour as real code: near the quota wall the app stops paying
// and serves the frozen data, so a quota exhaustion can never brick the demo.
const HARD_CAP_MULTIPLIER = 2;
function hardCap(): number {
  return config.gemini.rpdSoftCap * HARD_CAP_MULTIPLIER;
}
function circuitOpen(): boolean {
  return usage.flash + usage.flashLite + usage.gemma >= hardCap();
}

export function geminiUsage(): {
  flash: number;
  flashLite: number;
  gemma: number;
  cacheHits: number;
  total: number;
  geminiTotal: number;
  rpdSoftCap: number;
  rpdHardCap: number;
  circuitOpen: boolean;
} {
  const geminiTotal = usage.flash + usage.flashLite;
  return {
    ...usage,
    total: geminiTotal + usage.gemma,
    geminiTotal,
    rpdSoftCap: config.gemini.rpdSoftCap,
    rpdHardCap: hardCap(),
    circuitOpen: circuitOpen(),
  };
}

// True once this turn's live Gemini calls (Flash + Flash-Lite, NOT Gemma) reach
// the soft cap — the signal to route remaining work to Gemma's separate pool.
function geminiBudgetSpent(): boolean {
  return usage.flash + usage.flashLite >= config.gemini.rpdSoftCap;
}

function modelFor(tier: ModelTier): string {
  if (tier === "gemma") return config.gemini.models.gemma;
  return tier === "flash" ? config.gemini.models.flash : config.gemini.models.flashLite;
}

// ── C5 · Gemini safety settings ──────────────────────────────────────────────────
// Safety filtering defaults to OFF on Gemini 2.5/3 (a real change from earlier
// generations) — so we set thresholds EXPLICITLY. The agents that draft prose an
// official will read (the escalation brief, the resolution plan, the recurrence
// narrative) block medium-and-above harassment / hate / sexual content, so a slur
// in a citizen report can never flow into an authority-facing document. Ingestion
// agents stay permissive: civic complaints legitimately describe violence, floods,
// and danger, and over-blocking there would drop real evidence.
const BRIEF_SAFETY: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// The prose-drafting agents whose output reaches an official document.
const BRIEF_AGENTS = new Set<AgentName>(["accountability", "resolution", "memory"]);

function safetyFor(agent: AgentName): SafetySetting[] | undefined {
  return BRIEF_AGENTS.has(agent) ? BRIEF_SAFETY : undefined;
}

// Gemma (no JSON mode) often wraps output in a ```json … ``` fence. Strip it so
// JSON.parse succeeds. A no-op on the clean JSON the Gemini models return.
function stripJsonFence(text: string): string {
  const t = text.trim();
  if (!t.startsWith("```")) return t;
  return t
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
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

  // C9 · circuit-breaker open → stop spending entirely, degrade to the seed/golden
  // path. The agent's AgentOffline handler serves its frozen value (0 RPD).
  if (circuitOpen()) {
    logger.warn({ agent: call.agent, hardCap: hardCap() }, "quota_circuit_open");
    throw new AgentOffline(call.agent);
  }

  const ai = getClient();
  const contents = call.parts?.length ? [call.prompt, ...call.parts] : call.prompt;

  // Model attempt order: the routed tier first; if it's Flash and Flash is
  // overloaded (the 503 "high demand" the GA Flash model intermittently throws),
  // fall back to Flash-Lite — a real model answer beats the golden fallback. Each
  // model gets one parse-repair retry.
  //
  // RPD-wall gate: once this turn's live Gemini calls hit the soft cap, route to
  // Gemma instead (a separate free-tier pool). In the cached demo the cap is
  // never reached, so this is a graceful-degradation path, not the default.
  const attempts: ModelTier[] = geminiBudgetSpent()
    ? ["gemma", "gemma"]
    : call.tier === "flash"
      ? ["flash", "flash", "flash-lite", "gemma"]
      : ["flash-lite", "flash-lite", "gemma"];

  // 3) Live calls with model + repair fallback.
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts.length; attempt++) {
    const tier = attempts[attempt];
    const model = modelFor(tier);
    try {
      // Gemma on the Gemini API does not accept a responseSchema/JSON mime config
      // — ask for JSON in the prompt and lean on the zod parse below instead.
      // Safety settings (C5) are applied to the brief/summary agents on both the
      // Gemini and Gemma paths; the JSON-mode config is Gemini-only.
      const safetySettings = safetyFor(call.agent);
      const genConfig =
        tier === "gemma"
          ? safetySettings
            ? { safetySettings }
            : undefined
          : {
              responseMimeType: "application/json",
              responseSchema: call.responseSchema,
              ...(safetySettings ? { safetySettings } : {}),
            };
      const response = await ai.models.generateContent({
        model,
        contents: contents as never,
        ...(genConfig ? { config: genConfig } : {}),
      });
      if (tier === "flash") usage.flash++;
      else if (tier === "gemma") usage.gemma++;
      else usage.flashLite++;

      // Audit the safety verdict (C5/C19) — proves filtering is ON and inspectable.
      const safetyRatings = response.candidates?.[0]?.safetyRatings;
      if (safetyRatings?.length) {
        logger.info({ agent: call.agent, model, safetyRatings }, "agent_safety_ratings");
      }

      const text = stripJsonFence(response.text ?? "");
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
