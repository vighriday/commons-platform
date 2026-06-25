// COMMONS — the A2A Agent Card.
//
// Exposes the pipeline as a machine-readable agent under the A2A (Agent-to-Agent)
// convention, so another agent could discover what COMMONS does and how to call
// it. Served at the well-known A2A path AND a friendly /api alias. The skills are
// derived from the real seven-agent route map, so the card can never drift from
// what the pipeline actually runs.
import type { AgentName } from "../shared/types.ts";
import { ROUTE } from "./agents/types.ts";
import { config } from "./config.ts";

const SKILL_DESC: Record<AgentName, { name: string; description: string }> = {
  evidence: {
    name: "Cluster evidence",
    description: "Group citizen reports (and their photos) into one named real-world problem.",
  },
  synthesis: {
    name: "Cross-report synthesis",
    description:
      "Reason across separate, individually-minor reports to the one hidden cause no single reporter could see.",
  },
  impact: {
    name: "Score impact",
    description:
      "Compute an auditable danger score from Severity × Exposure (Open Buildings) × Vulnerability (Data Commons).",
  },
  attention: {
    name: "Score attention",
    description: "Measure the community-attention signal from alarm, engagement and recency.",
  },
  hidden_crisis: {
    name: "Detect hidden crisis",
    description:
      "Compare impact rank vs attention rank and overrule the crowd when a quiet problem is the dangerous one.",
  },
  resolution: {
    name: "Draft resolution",
    description: "Produce the action plan, responsible department, SLA and cost band.",
  },
  accountability: {
    name: "Assign accountability",
    description: "Name the responsible authority and draft a ready-to-send escalation brief.",
  },
  memory: {
    name: "Recall history",
    description: "Build the occurrence timeline and the recurrence/seasonality narrative.",
  },
};

const ORDER: AgentName[] = [
  "evidence",
  "synthesis",
  "impact",
  "attention",
  "hidden_crisis",
  "resolution",
  "accountability",
  "memory",
];

// Build the A2A Agent Card. `origin` is the request's own origin so the URLs in
// the card are correct whether running on localhost or Cloud Run.
export function buildAgentCard(origin: string) {
  return {
    // A2A core descriptor fields.
    name: "COMMONS Community-Attention Pipeline",
    description:
      "Finds the civic problems hidden between the reports — high-impact, low-attention 'hidden crises' — and assigns each a fix and an accountable authority.",
    version: "0.1.0",
    url: `${origin}/api`,
    provider: { organization: "COMMONS", url: origin },
    documentationUrl: `${origin}/`,
    // The pipeline speaks JSON over HTTP; no streaming/push in this read-only demo.
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    // One A2A skill per real agent, in pipeline order, with the model tier it runs on.
    skills: ORDER.map((agent) => ({
      id: agent,
      name: SKILL_DESC[agent].name,
      description: SKILL_DESC[agent].description,
      tags: ["civic", "geospatial", agent],
      model: ROUTE[agent] === "flash" ? config.gemini.models.flash : config.gemini.models.flashLite,
    })),
  } as const;
}
