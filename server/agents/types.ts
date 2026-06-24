// COMMONS — internal agent-pipeline contracts.
//
// These types are private to the agent layer (they describe how agents receive
// context, what they return, and how model-routing is decided). The PUBLIC data
// model — Issue, AgentHandoff, AgentRun, AgentStep, RunReversal — lives in
// shared/types.ts and is the wire format. This file only adds the in-process
// plumbing the orchestrator and agents share.
import type {
  AgentHandoff, AgentName, AgentStep, Issue, ModelTier, Report,
} from "@shared/types.ts";

// ── Model routing — the single source of truth ───────────────────────────────────
// Flash (the stronger, scarcer model: ~250 RPD) is reserved for the three steps
// that genuinely need deeper reasoning: the Hidden-Crisis critique, the
// Cross-Report synthesis evidence step, and the Accountability brief drafting.
// Everything else runs on Flash-Lite (~1000 RPD). The orchestrator records this
// map as the run's modelRoute, and the trace UI renders the tier per step.
export const ROUTE: Record<AgentName, ModelTier> = {
  evidence: "flash-lite", // upgraded to flash for synthesis issues — see routeFor()
  impact: "flash-lite",
  attention: "flash-lite",
  hidden_crisis: "flash",
  resolution: "flash-lite",
  accountability: "flash", // drafts the escalation brief prose
  memory: "flash-lite",
} as const;

// Evidence is the one agent whose tier depends on the issue: a synthesis cluster
// (separate-symptom → single latent cause) needs Flash's reasoning; a plain
// cluster does not. Every other agent's tier is fixed by ROUTE.
export function routeFor(agent: AgentName, issue: Issue): ModelTier {
  if (agent === "evidence" && issue.type === "synthesis") return "flash";
  return ROUTE[agent];
}

// ── Agent context — the frozen inputs every agent reads (never mutates) ──────────
// Built once per issue by the orchestrator. Agents read from here; they do not
// re-load files or reach into globals, so each agent is a pure function of ctx.
export interface AgentContext {
  issue: Issue; // the deterministic issue (numbers already final)
  members: Report[]; // its contributing reports, in chronological order
  vectors: Record<string, number[]>; // embeddingId/reportId → vector (for cosine)
  maxWardEngagement: number; // ward-wide engagement max (attention denominator)
  recencyNorm: (iso: string) => number; // ISO date → 0..1 recency within the corpus
  // Run-level ranking context, needed by the Hidden-Crisis critique agent so it
  // can see where this issue sits among all issues by impact vs by attention.
  ranking: {
    impactRankOf: (issueId: string) => number;
    attentionRankOf: (issueId: string) => number;
    byImpact: string[]; // issueIds, impact desc
    byAttention: string[]; // issueIds, attention desc
  };
}

// ── Agent result — what every agent returns ──────────────────────────────────────
// `handoff` is the typed claim+evidence+confidence+uncertainty for the trace.
// `patch` is the issue-field delta the agent produces (only the field it owns —
// an explainer agent returns an empty patch; an enrichment agent returns e.g.
// { resolution }). `step` is the trace step minus the timing/cache fields the
// orchestrator stamps.
export interface AgentResult {
  handoff: AgentHandoff;
  patch: Partial<Issue>;
  step: Omit<AgentStep, "ms" | "cached">;
}

// Every agent has this shape: a pure-ish async function of context. "Pure-ish"
// because it may make a cached/fallback-backed model call, but it never mutates
// ctx and never writes to disk.
export type Agent = (ctx: AgentContext) => Promise<AgentResult>;

// Raised when a model call is attempted but the key is not configured (or the
// call fails after retry). The orchestrator catches this per-step and lets the
// agent's deterministic golden fallback stand, so a run always completes.
export class AgentOffline extends Error {
  constructor(
    public readonly agent: AgentName,
    cause?: unknown,
  ) {
    super(`agent ${agent} ran offline (no live model)`);
    this.name = "AgentOffline";
    if (cause) this.cause = cause;
  }
}
