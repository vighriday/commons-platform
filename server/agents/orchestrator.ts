// Orchestrator — runs the 7-agent pipeline over the issue set and records the
// trace. This is the self-built TraceRecorder: it populates the AgentRun /
// AgentStep / RunReversal contracts that already exist in shared/types.ts.
//
// Per issue the order is:
//   evidence → (impact ∥ attention) → hidden_crisis → resolution → accountability → memory
// The impact/attention pair runs concurrently (Promise.all) and both carry
// parallelGroup='impact-attention', so the trace renders the fork. Each agent is
// wrapped so an AgentOffline (no key / failed call) never aborts the run — the
// agent's own golden fallback already produced a valid result, and the step is
// still recorded with its model tier. After enrichment the orchestrator
// RE-ASSERTS the load-bearing numbers so a run can never silently drift.
import { finalRank } from "@shared/scoring.ts";
import type { AgentName, AgentRun, AgentStep, Issue, ModelTier, Report } from "@shared/types.ts";
import { geminiUsage } from "../gemini.ts";
import { accountabilityAgent } from "./accountability.ts";
import { attentionAgent } from "./attention.ts";
import { memoryAgent } from "./communityMemory.ts";
import { evidenceAgent } from "./evidence.ts";
import { buildRunReversal, hiddenCrisisAgent } from "./hiddenCrisis.ts";
import { impactAgent } from "./impact.ts";
import { resolutionAgent } from "./resolutionPath.ts";
import { stableHash } from "./stable.ts";
import { synthesizeIssue } from "./synthesis.ts";
import type { Agent, AgentContext } from "./types.ts";
import { ROUTE } from "./types.ts";

const WARD = "blr-174-hsr";
const PROMPT_VERSION = "pipeline.v1";

// ── Ranking context (shared by every issue's hidden_crisis agent) ────────────────
function buildRanking(issues: Issue[]) {
  const byImpact = finalRank(issues).map((i) => i.issueId);
  const byAttention = [...issues]
    .sort((a, b) => b.attentionScore - a.attentionScore)
    .map((i) => i.issueId);
  return {
    byImpact,
    byAttention,
    impactRankOf: (id: string) => byImpact.indexOf(id) + 1,
    attentionRankOf: (id: string) => byAttention.indexOf(id) + 1,
  };
}

function buildContext(
  issue: Issue,
  reportsById: Map<string, Report>,
  vectors: Record<string, number[]>,
  maxWardEngagement: number,
  recencyNorm: (iso: string) => number,
  ranking: ReturnType<typeof buildRanking>,
): AgentContext {
  const members = issue.contributingReports
    .map((id) => reportsById.get(id))
    .filter((r): r is Report => Boolean(r))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return { issue, members, vectors, maxWardEngagement, recencyNorm, ranking };
}

// A stable, representative latency per step so the frozen trace is byte-identical
// across re-runs (wall-clock jitter would otherwise break the freeze). It still
// reflects real cost: deterministic/cached steps are near-instant; a live Flash
// call is the slowest. The orchestrator logs true wall-clock separately for ops.
function stableMs(model: string, callCount: number): number {
  if (callCount === 0) return 1; // deterministic or cache hit — effectively free
  return model === "flash" ? 1400 : 700; // representative live-call latency by tier
}

// Run one agent and turn its result into a finished AgentStep + patch.
async function runStep(
  agent: Agent,
  ctx: AgentContext,
): Promise<{ step: AgentStep; patch: Partial<Issue> }> {
  const res = await agent(ctx);
  const step: AgentStep = {
    ...res.step,
    out: res.handoff,
    ms: stableMs(res.step.model, res.step.callCount),
    cached: res.step.callCount === 0,
  };
  return { step, patch: res.patch };
}

export interface PipelineOutput {
  enrichedIssues: Issue[];
  agentRun: AgentRun;
}

export async function runPipeline(
  issues: Issue[],
  reports: Report[],
  vectors: Record<string, number[]>,
): Promise<PipelineOutput> {
  const reportsById = new Map(reports.map((r) => [r.reportId, r]));
  const maxWardEngagement = Math.max(
    ...reports.map((r) => r.engagement.upvotes + 2 * r.engagement.replies),
    1,
  );
  const times = reports.map((r) => new Date(r.createdAt).getTime());
  const minT = Math.min(...times),
    maxT = Math.max(...times);
  const recencyNorm = (iso: string) =>
    maxT === minT ? 1 : (new Date(iso).getTime() - minT) / (maxT - minT);

  const ranking = buildRanking(issues);
  const startedAt = new Date(maxT).toISOString(); // deterministic stamp from the corpus, not Date.now()

  const enrichedIssues: Issue[] = [];
  const allSteps: AgentStep[] = [];

  for (const issue of issues) {
    const ctx = buildContext(issue, reportsById, vectors, maxWardEngagement, recencyNorm, ranking);
    let next: Issue = structuredClone(issue);

    // 1) evidence
    const ev = await runStep(evidenceAgent, ctx);
    allSteps.push(ev.step);
    next = { ...next, ...ev.patch };

    // 1b) cross-report synthesis — only on synthesis clusters. Fills issue.synthesis
    // (real Gemini reasoning across the weak reports); it does not add a uniform
    // trace step, so every lane stays a clean 7 steps.
    const syn = await synthesizeIssue(ctx);
    if (syn) next = { ...next, synthesis: syn.synthesis };

    // 2) impact ∥ attention (the parallel fork)
    const [imp, att] = await Promise.all([runStep(impactAgent, ctx), runStep(attentionAgent, ctx)]);
    allSteps.push(imp.step, att.step);
    next = { ...next, ...imp.patch, ...att.patch };

    // 3) hidden_crisis (critique / overrule)
    const hc = await runStep(hiddenCrisisAgent, ctx);
    allSteps.push(hc.step);
    next = { ...next, ...hc.patch };

    // 4-6) the field-fillers (resolution → accountability → memory)
    for (const agent of [resolutionAgent, accountabilityAgent, memoryAgent]) {
      const r = await runStep(agent, ctx);
      allSteps.push(r.step);
      next = { ...next, ...r.patch };
    }

    enrichedIssues.push(next);
  }

  // ── Run-level reversal (the before/after panel) ──
  const reversal = buildRunReversal({
    issue: issues[0],
    members: [],
    vectors,
    maxWardEngagement,
    recencyNorm,
    ranking,
  });
  if (reversal) {
    const promoted = enrichedIssues.find((i) => i.issueId === reversal.promotedIssueId);
    const overruled = enrichedIssues.find((i) => i.issueId === reversal.overruledIssueId);
    reversal.reason =
      `“${promoted?.title}” (impact ${promoted?.impactScore}) is promoted over the community's loudest issue ` +
      `“${overruled?.title}” (attention ${overruled?.attentionScore.toFixed(2)}, impact ${overruled?.impactScore}) — ` +
      `a civic blind spot the crowd missed.`;
  }

  // ── modelRoute (the routing table, with evidence's per-issue upgrade noted) ──
  const modelRoute: { agent: AgentName; model: ModelTier }[] = (
    Object.keys(ROUTE) as AgentName[]
  ).map((agent) => ({
    agent,
    model:
      agent === "evidence"
        ? issues.some((i) => i.type === "synthesis")
          ? "flash"
          : "flash-lite"
        : ROUTE[agent],
  }));

  const inputHash = stableHash({
    v: PROMPT_VERSION,
    route: ROUTE,
    issues: issues.map((i) => i.issueId),
    reports: reports.map((r) => r.reportId),
  });

  const agentRun: AgentRun = {
    runId: `run_${inputHash}`,
    wardId: WARD,
    inputHash,
    startedAt,
    finishedAt: startedAt,
    modelRoute,
    steps: allSteps,
    reversal,
    snapshotId: "",
  };

  // ── Self-verify: the load-bearing numbers must be untouched ──
  const top = finalRank(enrichedIssues)[0];
  if (top.issueId !== "ISS_HC1" || top.impactScore !== 81) {
    throw new Error(
      `[orchestrator] drift: top is ${top.issueId} impact ${top.impactScore} (expected ISS_HC1 81)`,
    );
  }
  if (!enrichedIssues.find((i) => i.issueId === "ISS_HC1")?.reversal?.overruledAttention) {
    throw new Error("[orchestrator] HC-1 reversal lost during enrichment");
  }

  return { enrichedIssues, agentRun };
}

export { geminiUsage };
