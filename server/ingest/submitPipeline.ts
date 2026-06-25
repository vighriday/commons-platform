import { readFileSync } from "node:fs";
// The LIVE pipeline — runs the real COMMONS reasoning on a citizen submission.
//
// Unlike the frozen demo (served from cache, 0 RPD), this makes real Gemini calls
// on the spot: Vision reads the photo, a classifier picks the severity row, the
// factors are looked up from the (design-locked) exposure/vulnerability grids, the
// scores are computed by the SAME auditable formulas, the cluster is matched
// against the existing issues, and the Resolution + Accountability agents draft
// the plan + brief. Every step is recorded as a live-trace entry the UI streams.
// Any failed/offline call degrades to a deterministic value, so a submission
// always produces a complete issue (never a half-built one).
import path from "node:path";
import { Type } from "@google/genai";
import type { Schema } from "@google/genai";
import { computeAttention, computeImpact, computeQuadrant } from "@shared/scoring.ts";
import type { ExposureGridCell, Issue } from "@shared/types.ts";
import { z } from "zod";
import { authorityFor } from "../../seed/authorityMap.ts";
import { cellId } from "../../seed/plusCodes.ts";
import { SEVERITY_TABLE, severityLabel, severityNorm } from "../../seed/severityTable.ts";
import { generateLive } from "../gemini.ts";
import { logger } from "../lib/logger.ts";
import type { SubmitInput } from "../schemas/submit.ts";
import type { ProcessedImage } from "./upload.ts";

const SEED = path.resolve(process.cwd(), "seed");
const exposureGrid = JSON.parse(
  readFileSync(path.join(SEED, "exposureGrid.json"), "utf8"),
) as (ExposureGridCell & { densityNorm: number; heightNorm: number })[];
const vulnerabilityGrid = JSON.parse(
  readFileSync(path.join(SEED, "vulnerabilityGrid.json"), "utf8"),
) as { plusCellId: string; value: number; deprivationNorm: number; floodProneFlag: number }[];

// One streamed step of the live run, shown in the UI as it happens.
export interface LiveStep {
  agent: string;
  label: string;
  detail: string;
  live: boolean; // true = a real model call was made
}

export interface LiveResult {
  issue: Issue;
  trace: LiveStep[];
  anyLive: boolean;
}

// ── Vision: read the uploaded photo (real Gemini Vision) ─────────────────────────
const VisionOut = z.object({
  observedFeatures: z.array(z.string()).min(1).max(5),
  severitySignal: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
});
const VISION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    observedFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
    severitySignal: { type: Type.INTEGER },
    confidence: { type: Type.NUMBER },
  },
  required: ["observedFeatures", "severitySignal", "confidence"],
};

// ── Severity classifier: map the report to ONE row of the fixed table ────────────
const SevOut = z.object({ row: z.number().int().min(1).max(5) });
const SEV_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: { row: { type: Type.INTEGER } },
  required: ["row"],
};

// ── Resolution: real action plan ─────────────────────────────────────────────────
const ResOut = z.object({ recommendedActions: z.array(z.string().min(3)).min(2).max(5) });
const RES_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: { recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING } } },
  required: ["recommendedActions"],
};

function gridFor(plusCellId: string) {
  const exp = exposureGrid.find((c) => c.plusCellId === plusCellId);
  const vul = vulnerabilityGrid.find((c) => c.plusCellId === plusCellId);
  // Off-grid point (inside the ward but not a seeded cell) → ward-typical fallbacks.
  return {
    exposure: exp?.exposure ?? 0.5,
    densityNorm: exp?.densityNorm ?? 0.5,
    heightNorm: exp?.heightNorm ?? 0.3,
    vulnerability: vul?.value ?? 0.55,
    deprivationNorm: vul?.deprivationNorm ?? 0.2181,
    floodProneFlag: vul?.floodProneFlag ?? 0,
  };
}

export async function runLiveSubmit(
  input: SubmitInput,
  image: ProcessedImage | null,
  existingIssues: Issue[],
): Promise<LiveResult> {
  const trace: LiveStep[] = [];
  let anyLive = false;
  const plusCellId = cellId(input.lat, input.lng);

  // 1) VISION — only if a photo was uploaded.
  let vision: z.infer<typeof VisionOut> | null = null;
  if (image) {
    try {
      vision = await generateLive({
        agent: "vision",
        tier: "flash-lite",
        prompt:
          "Look at this civic-report photo and describe ONLY what is visibly present. " +
          "Return 1-5 observedFeatures, a severitySignal 1-5 for how serious the visible " +
          "condition is, and confidence 0-1. Do not invent anything.",
        responseSchema: VISION_SCHEMA,
        validate: VisionOut,
        imageBase64: image.base64,
      });
      anyLive = true;
      trace.push({
        agent: "vision",
        label: "Gemini Vision",
        detail: `Read the photo — ${vision.observedFeatures.join(", ")} (severity signal ${vision.severitySignal}/5).`,
        live: true,
      });
    } catch {
      trace.push({
        agent: "vision",
        label: "Gemini Vision",
        detail: "Vision unavailable — proceeding from the text alone.",
        live: false,
      });
    }
  }

  // 2) SEVERITY — classify the report into one fixed table row (real call, with a
  //    vision-signal floor and a deterministic fallback).
  const rows = SEVERITY_TABLE[input.category];
  let row = vision?.severitySignal ?? 2;
  try {
    const sev = await generateLive({
      agent: "evidence",
      tier: "flash-lite",
      prompt:
        `Classify this ${input.category} report into ONE row (1-5) of this fixed severity ` +
        `table, where 1 is least and 5 is most severe:\n` +
        rows.map((r, i) => `${i + 1}. ${r}`).join("\n") +
        `\n\n<untrusted_report>\n${input.text}\n</untrusted_report>\n\nReturn the row number only.`,
      responseSchema: SEV_SCHEMA,
      validate: SevOut,
    });
    anyLive = true;
    row = Math.max(row, sev.row); // the worse of text vs photo
  } catch {
    /* keep the vision/default row */
  }
  const sevNorm = severityNorm(row);
  trace.push({
    agent: "severity",
    label: "Severity",
    detail: `Row ${row}/5 — “${severityLabel(input.category, row)}”.`,
    live: anyLive,
  });

  // 3) FACTORS + SCORES — the same auditable math as the frozen pipeline.
  const g = gridFor(plusCellId);
  const impactScore = computeImpact(sevNorm, g.exposure, g.vulnerability);
  // A fresh single report: modest engagement, full recency. Attention is the crowd
  // signal, and a brand-new report has barely any crowd yet — by design it starts low.
  const attentionScore = computeAttention({
    alarmIntensityMean: 0.4,
    upvotes: 0,
    replies: 0,
    maxWardEngagement: 20,
    recencyNorm: 1,
  });
  const quadrant = computeQuadrant(attentionScore, impactScore);
  trace.push({
    agent: "impact",
    label: "Impact ∥ Attention",
    detail: `Impact ${impactScore} = severity ${sevNorm.toFixed(2)} × exposure ${g.exposure} × vulnerability ${g.vulnerability} × 100. Attention ${attentionScore.toFixed(2)} (a new report, the crowd hasn't reacted yet).`,
    live: false,
  });

  // 4) CLUSTER — does this join an existing issue (same cell + category) or is it new?
  const match = existingIssues.find(
    (i) => i.plusCellId === plusCellId && i.category === input.category,
  );
  trace.push({
    agent: "cluster",
    label: "Cluster",
    detail: match
      ? `Joins an existing issue in this cell: “${match.title}”.`
      : "No existing issue in this cell — a new issue is born.",
    live: false,
  });

  // 5) RESOLUTION + 6) ACCOUNTABILITY — real drafting, with golden fallbacks.
  const auth = authorityFor(input.category);
  let actions: string[];
  try {
    const res = await generateLive({
      agent: "resolution",
      tier: "flash-lite",
      prompt:
        `Draft 2-4 concrete municipal action steps for this ${input.category} issue (severity ` +
        `${row}/5), to be carried out by ${auth.dept}. Return recommendedActions only.\n\n` +
        `<untrusted_report>\n${input.text}\n</untrusted_report>`,
      responseSchema: RES_SCHEMA,
      validate: ResOut,
    });
    actions = res.recommendedActions;
    anyLive = true;
  } catch {
    actions = [
      `Inspect the reported ${input.category} issue on site`,
      `Assign to ${auth.dept} for assessment and action`,
      "Update the reporter on the outcome",
    ];
  }
  trace.push({
    agent: "resolution",
    label: "Resolution",
    detail: `${actions.length} action steps → ${auth.dept}, SLA ${auth.slaDays}d.`,
    live: anyLive,
  });
  trace.push({
    agent: "accountability",
    label: "Accountability",
    detail: `Accountable authority: ${auth.officialRole}, ${auth.dept}.`,
    live: false,
  });

  // ── Assemble the born issue (same shape as the frozen issues) ──
  const id = `ISS_LIVE_${plusCellId.slice(-4)}`;
  const evidence = [
    { reportId: "LIVE", field: "text", value: input.text },
    ...(vision
      ? [
          {
            reportId: "LIVE",
            field: "media:photo",
            value: `observed: ${vision.observedFeatures.join(", ")} (severity signal ${vision.severitySignal}/5, conf ${vision.confidence})`,
            ...(image ? { imageUrl: undefined } : {}),
          },
        ]
      : []),
  ];

  const issue: Issue = {
    issueId: id,
    wardId: "blr-174-hsr",
    type: "single",
    title: input.text.length > 64 ? `${input.text.slice(0, 61)}…` : input.text,
    plusCellId,
    contributingReports: ["LIVE"],
    category: input.category,
    handoff: {
      claim: input.text,
      evidence,
      confidence: vision ? Math.min(0.9, vision.confidence) : 0.6,
      uncertainty: vision
        ? "Live submission — photo read by Gemini Vision; single-source."
        : "Live submission — single-source, text only.",
    },
    severity: { row, label: severityLabel(input.category, row), norm: sevNorm },
    exposure: {
      value: g.exposure,
      source: "open_buildings",
      provenance: "curated",
      inputs: { densityNorm: g.densityNorm, heightNorm: g.heightNorm, changeNorm: 0 },
    },
    vulnerability: {
      value: g.vulnerability,
      source: "data_commons",
      adminLevel: "district",
      lowGranularityWarning: true,
      provenance: "curated",
      inputs: { deprivationNorm: g.deprivationNorm, floodProneFlag: g.floodProneFlag },
    },
    impactScore,
    attentionScore,
    quadrant,
    recurrence: null,
    reversal: null,
    resolution: {
      recommendedActions: actions,
      responsibleDept: auth.dept,
      slaDays: auth.slaDays,
      estCostBand: auth.costBand,
      dependencies: [],
      effectivenessScore: 0.6,
    },
    escalation: {
      dept: auth.dept,
      officialRole: auth.officialRole,
      contact: auth.contact,
      jurisdictionAdminLevel: auth.jurisdictionAdminLevel,
      citations: auth.citations,
      briefMarkdown:
        `## Escalation Brief — ${input.text.slice(0, 60)}\n\n` +
        `**To:** ${auth.officialRole}, ${auth.dept}\n` +
        `**Assessed Impact:** ${impactScore}/100 (severity ${row}/5 × exposure ${g.exposure} × vulnerability ${g.vulnerability}).\n` +
        `**Location:** Plus Code cell ${plusCellId}, HSR Layout (BBMP Ward 174).\n\n` +
        `Requesting inspection and action per the recommended resolution path.`,
    },
    memory: null,
    synthesis: null,
    createdAt: new Date().toISOString(),
  };

  logger.info(
    { event: "live_submit", plusCellId, category: input.category, impactScore, anyLive },
    "live submission processed",
  );
  return { issue, trace, anyLive };
}
