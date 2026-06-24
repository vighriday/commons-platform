// Server-side Gemini client. The API key lives only here, read from validated
// config, and is never sent to the browser. This module is the single chokepoint
// for every model call so routing, safety settings, and quota accounting can be
// added in one place as the agent pipeline grows.
import { GoogleGenAI } from "@google/genai";
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

/**
 * A minimal text round-trip used by the health/ping route to prove the key works
 * end-to-end. Returns the model's text, or throws with a logged reason.
 */
export async function geminiPing(prompt = "Reply with the single word: OK"): Promise<string> {
  const ai = getClient();
  const model = config.gemini.models.flashLite;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    const text = response.text ?? "";
    logger.info({ model, chars: text.length }, "gemini_ping_ok");
    return text.trim();
  } catch (err) {
    logger.error({ err, model }, "gemini_ping_failed");
    throw err;
  }
}

export { getClient as getGeminiClient };
