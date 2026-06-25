// Cross-Report Synthesis — the genuine multi-signal reasoning step.
//
// A synthesis cluster is a set of individually-trivial reports, often in DIFFERENT
// categories, that together reveal one hidden cause no single reporter could see
// (e.g. low water pressure + a road depression + brown water + a persistent wet
// patch = a trunk water main failing underground, before it ruptures). This agent
// hands those raw reports to Gemini Flash and asks it to REASON to the latent
// cause and explain the signal chain — the "no human spotted this" beat.
//
// It runs only on synthesis-type issues and fills issue.synthesis. A golden
// fallback (built from the same reports) keeps it complete offline.
import { Type } from "@google/genai";
import type { Schema } from "@google/genai";
import type { SynthesisInsight } from "@shared/types.ts";
import { z } from "zod";
import { generateStructured } from "../gemini.ts";
import { stableHash } from "./stable.ts";
import type { AgentContext } from "./types.ts";
import { AgentOffline } from "./types.ts";

const PROMPT_VERSION = "synthesis.v1";

const ModelOut = z.object({
  latentCause: z.string().min(10),
  signalChain: z.array(z.string().min(5)).min(2).max(6),
  whyMissed: z.string().min(10),
});
type ModelOut = z.infer<typeof ModelOut>;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    latentCause: { type: Type.STRING },
    signalChain: { type: Type.ARRAY, items: { type: Type.STRING } },
    whyMissed: { type: Type.STRING },
  },
  required: ["latentCause", "signalChain", "whyMissed"],
};

function golden(ctx: AgentContext): SynthesisInsight {
  return {
    latentCause: ctx.issue.title,
    signalChain: ctx.members.map((r) => `${r.reportId} (${r.category}): ${r.text}`),
    whyMissed:
      "Each report is minor on its own and they span different categories, so no single reporter — and no volume-ranked dashboard — could connect them into one failure.",
  };
}

// Returns the synthesis insight for a synthesis-type issue (and whether a live
// model call was made, for the trace), or null for non-synthesis issues.
export async function synthesizeIssue(
  ctx: AgentContext,
): Promise<{ synthesis: SynthesisInsight; callCount: number } | null> {
  const { issue, members } = ctx;
  if (issue.type !== "synthesis") return null;

  const reportLines = members.map((r) => `- ${r.reportId} [${r.category}]: "${r.text}"`).join("\n");
  const inputHash = stableHash({
    v: PROMPT_VERSION,
    issue: issue.issueId,
    reports: members.map((r) => `${r.reportId}:${r.text}`),
  });

  const prompt =
    `These citizen reports are each individually minor and span different civic ` +
    `categories, but they cluster in the same location. Reason across them to the ONE ` +
    `latent underlying cause they jointly point to. Return: latentCause (the hidden ` +
    `connecting cause); signalChain (one line per report explaining how it points to ` +
    `that cause); whyMissed (why no single report or volume-ranked view would reveal ` +
    `it). Be concrete and physical. Do not invent reports.\n\nReports:\n${reportLines}`;

  try {
    const r = await generateStructured<ModelOut>({
      agent: "synthesis",
      tier: "flash",
      prompt,
      responseSchema: RESPONSE_SCHEMA,
      validate: ModelOut,
      inputHash,
    });
    return { synthesis: r.value, callCount: r.callCount };
  } catch (err) {
    if (!(err instanceof AgentOffline)) throw err;
    return { synthesis: golden(ctx), callCount: 0 };
  }
}
