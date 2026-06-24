import { Type } from "@google/genai";
import type { Schema } from "@google/genai";
import type { Resolution } from "@shared/types.ts";
// Resolution agent — fills issue.resolution (the "what to do about it" field).
//
// Deterministic facts come from the authority map (responsibleDept, slaDays,
// estCostBand) and a formula (effectivenessScore — NOT LLM-rated, mirroring the
// confidence philosophy). The model (Flash-Lite) drafts ONLY the recommended-
// action list as prose; a per-category golden fallback validates against the same
// zod schema, so a failed/offline call still yields a complete, valid Resolution.
import { z } from "zod";
import { authorityFor } from "../../seed/authorityMap.ts";
import { generateStructured } from "../gemini.ts";
import { stableHash } from "./stable.ts";
import type { Agent, AgentContext, AgentResult } from "./types.ts";
import { AgentOffline } from "./types.ts";

const PROMPT_VERSION = "resolution.v1";

// The model returns ONLY the action list + dependencies (prose); the rest is
// deterministic. Keeping the model's surface small makes it reliable + auditable.
const ModelOut = z.object({
  recommendedActions: z.array(z.string().min(3)).min(2).max(6),
  dependencies: z.array(z.string()).max(5),
});
type ModelOut = z.infer<typeof ModelOut>;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
    dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["recommendedActions", "dependencies"],
};

// effectivenessScore — DERIVED: higher severity + fewer cross-dependencies ⇒ a
// clearer, more effective single intervention. Bounded 0..1.
function effectiveness(severityRow: number, depCount: number): number {
  const base = 0.4 + 0.1 * severityRow; // sev 1→0.5 … sev 5→0.9
  const penalty = 0.08 * depCount;
  return Math.round(Math.min(1, Math.max(0.2, base - penalty)) * 100) / 100;
}

function goldenActions(category: string): ModelOut {
  const byCat: Record<string, ModelOut> = {
    drainage: {
      recommendedActions: [
        "Dispatch a desilting crew to clear the choke point",
        "Camera-survey the drain run for collapse",
        "Add the cell to the pre-monsoon priority list",
      ],
      dependencies: [
        "Jetting truck availability",
        "Coordination with the lake-overflow channel owner",
      ],
    },
    water: {
      recommendedActions: [
        "Pressure-test the trunk main section",
        "Isolate and replace the failing pipe length",
        "Notify affected connections before shutoff",
      ],
      dependencies: ["BWSSB pipeline crew", "Temporary supply tankers during repair"],
    },
    structural: {
      recommendedActions: [
        "Issue an immediate structural-safety inspection notice",
        "Cordon the at-risk frontage",
        "Order shoring or evacuation per the engineer's finding",
      ],
      dependencies: ["Licensed structural engineer", "Occupant relocation if unsafe"],
    },
    streetlights: {
      recommendedActions: [
        "Restore the dark feeder section",
        "Audit the full stretch for further outages",
        "Prioritise the pedestrian-risk span",
      ],
      dependencies: ["BESCOM feeder access", "Replacement luminaires in stock"],
    },
    roads: {
      recommendedActions: [
        "Patch the pothole on the next maintenance round",
        "Log it on the ward road-defect register",
      ],
      dependencies: ["Hot-mix availability"],
    },
  };
  return (
    byCat[category] ?? {
      recommendedActions: [
        "Triage at the ward office and route to the owning department",
        "Schedule a site inspection",
      ],
      dependencies: ["Ward engineer availability"],
    }
  );
}

export const resolutionAgent: Agent = async (ctx: AgentContext): Promise<AgentResult> => {
  const { issue } = ctx;
  const auth = authorityFor(issue.category);
  const inputHash = stableHash({
    v: PROMPT_VERSION,
    issue: issue.issueId,
    title: issue.title,
    category: issue.category,
  });

  const prompt =
    `You are a municipal operations planner for Bengaluru (BBMP). For this civic issue, list 2-6 concrete ` +
    `recommended actions and any cross-department dependencies. Be specific and operational. Do NOT invent ` +
    `departments, costs, or SLAs — those are fixed elsewhere.\n\n` +
    `Issue: ${issue.title}\nCategory: ${issue.category}\nSeverity: ${issue.severity.row}/5 (${issue.severity.label})\n` +
    `Owning department: ${auth.dept}.`;

  let model: ModelOut;
  let callCount = 0;
  let offline = false;
  try {
    const r = await generateStructured<ModelOut>({
      agent: "resolution",
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
    model = goldenActions(issue.category);
    offline = true;
  }

  const resolution: Resolution = {
    recommendedActions: model.recommendedActions,
    responsibleDept: auth.dept,
    slaDays: auth.slaDays,
    estCostBand: auth.costBand,
    dependencies: model.dependencies,
    effectivenessScore: effectiveness(issue.severity.row, model.dependencies.length),
  };

  return {
    handoff: {
      claim: `Recommended resolution path for ${issue.title}: ${auth.dept}, SLA ${auth.slaDays}d.`,
      evidence: resolution.recommendedActions.map((a, n) => ({
        reportId: issue.issueId,
        field: `action${n + 1}`,
        value: a,
      })),
      confidence: issue.handoff.confidence,
      uncertainty: offline
        ? "Action list from the deterministic golden fallback (model offline)."
        : "Action list drafted by Flash-Lite; department/SLA/cost are fixed facts.",
    },
    patch: { resolution },
    step: {
      agent: "resolution",
      status: "ok",
      parallelGroup: null,
      in: { category: issue.category, severityRow: issue.severity.row },
      out: null,
      model: "flash-lite",
      callCount,
    },
  };
};
