// Community-Memory agent — fills issue.memory (the "has this happened before"
// field). Most meaningful for the recurrence issue, which names a systemic
// failure rather than a one-off complaint.
//
// The factual spine — occurrenceTimeline, firstSeen, seasonalPattern — is DERIVED
// deterministically from the member reports' createdAt + plusCellId (sorted). The
// model (Flash-Lite) writes only the priorTitles (how the same problem was
// previously described) and the narrative prose; a golden fallback covers offline.
import { z } from "zod";
import { Type } from "@google/genai";
import type { Schema } from "@google/genai";
import type { Memory } from "@shared/types.ts";
import type { Agent, AgentContext, AgentResult } from "./types.ts";
import { generateStructured } from "../gemini.ts";
import { stableHash } from "./stable.ts";
import { AgentOffline } from "./types.ts";

const PROMPT_VERSION = "memory.v1";

const ModelOut = z.object({
  priorTitles: z.array(z.string().min(3)).min(1).max(5),
  narrative: z.string().min(40),
});
type ModelOut = z.infer<typeof ModelOut>;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    priorTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
    narrative: { type: Type.STRING },
  },
  required: ["priorTitles", "narrative"],
};

// Derive the seasonal pattern from the member months — the monsoon (Jun–Oct)
// concentration is the real signal for drainage/water recurrence.
function seasonalPattern(months: number[]): string {
  const monsoon = months.filter((m) => m >= 5 && m <= 9).length; // Jun..Oct (0-indexed)
  if (months.length === 0) return "No temporal pattern (single report).";
  const frac = monsoon / months.length;
  if (frac >= 0.6) return `Monsoon-concentrated — ${monsoon}/${months.length} reports fall in Jun–Oct.`;
  if (frac === 0) return "Non-seasonal — reports fall outside the monsoon window.";
  return `Mixed seasonality — ${monsoon}/${months.length} reports in the monsoon window.`;
}

function goldenMemory(ctx: AgentContext): ModelOut {
  const { issue, members } = ctx;
  if (issue.type === "recurrence") {
    return {
      priorTitles: ["Drainage complaint", "Water-logging report", "Blocked drain"],
      narrative:
        `The same drainage failure at ${issue.plusCellId} has been reported ${members.length} times across ` +
        `multiple monsoons. Each was logged and closed as an isolated complaint; together they are a recurring ` +
        `infrastructure failure that routine patching has not resolved.`,
    };
  }
  return {
    priorTitles: [issue.title],
    narrative: `First substantiated record of "${issue.title}" at ${issue.plusCellId}; no prior matching reports in the corpus.`,
  };
}

export const memoryAgent: Agent = async (ctx: AgentContext): Promise<AgentResult> => {
  const { issue, members } = ctx;

  // Deterministic timeline (chronological by createdAt).
  const sorted = [...members].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const occurrenceTimeline = sorted.map((r) => ({
    reportId: r.reportId,
    date: r.createdAt,
    plusCellId: r.location.plusCellId,
  }));
  const firstSeen = sorted[0]?.createdAt ?? issue.createdAt;
  const months = sorted.map((r) => new Date(r.createdAt).getMonth());
  const season = seasonalPattern(months);

  const inputHash = stableHash({ v: PROMPT_VERSION, issue: issue.issueId, type: issue.type, n: members.length });

  const prompt =
    `You are a civic memory analyst. For this issue, give (a) priorTitles — 1-5 ways the SAME underlying ` +
    `problem may have been described in earlier complaints — and (b) a short narrative (<80 words) explaining ` +
    `whether this is a recurring pattern or a first occurrence.\n\n` +
    `Issue: ${issue.title}\nType: ${issue.type}\nReports: ${members.length} over ${firstSeen.slice(0, 10)} … ` +
    `${sorted[sorted.length - 1]?.createdAt.slice(0, 10)}\nSeasonality: ${season}.`;

  let model: ModelOut;
  let callCount = 0;
  let offline = false;
  try {
    const r = await generateStructured<ModelOut>({
      agent: "memory",
      tier: "flash-lite",
      prompt,
      responseSchema: RESPONSE_SCHEMA,
      validate: ModelOut,
      inputHash,
    });
    model = r.value;
    callCount = r.callCount;
  } catch (err) {
    if (!(err instanceof AgentOffline)) throw err;
    model = goldenMemory(ctx);
    offline = true;
  }

  const memory: Memory = {
    priorTitles: model.priorTitles,
    occurrenceTimeline,
    seasonalPattern: season,
    firstSeen,
    narrative: model.narrative,
  };

  return {
    handoff: {
      claim: `${issue.type === "recurrence" ? "Recurring" : "First-seen"} pattern for ${issue.title}; first seen ${firstSeen.slice(0, 10)}.`,
      evidence: occurrenceTimeline.map((o) => ({ reportId: o.reportId, field: "occurrence", value: `${o.date.slice(0, 10)} @ ${o.plusCellId}` })),
      confidence: issue.handoff.confidence,
      uncertainty: offline ? "Narrative from the deterministic golden fallback (model offline)." : "Timeline is derived; narrative drafted by Flash-Lite.",
    },
    patch: { memory },
    step: {
      agent: "memory",
      status: "ok",
      parallelGroup: null,
      in: { type: issue.type, firstSeen, season },
      out: null,
      model: "flash-lite",
      callCount,
    },
  };
};
