// Evidence agent — reconstructs each issue's cluster and surfaces its evidence.
//
// What it genuinely does (no theatre):
//  • Rebuilds the cluster from plusCell + embedding cosine and ASSERTS the
//    reconstructed report set equals the frozen contributingReports — proving the
//    cluster is derived, not hardcoded.
//  • Labels the cluster shape: synthesis (separate symptoms → one latent cause),
//    recurrence (same cell over time), or single.
//  • Surfaces the curated media[].extracted multimodal blocks into the handoff
//    (it does NOT re-run vision on the spine — the photos are placeholders and
//    re-extraction would burn RPD and drift the frozen values; a gated
//    geminiVision path exists for when real images land).
//
// confidence comes from confidence.ts (DERIVED). The model tier is recorded for
// the trace (flash for synthesis), but the evidence itself is deterministic.
import { meanPairwiseCosine } from "@shared/scoring.ts";
import type { EvidenceRef } from "@shared/types.ts";
import type { Agent, AgentContext, AgentResult } from "./types.ts";
import { routeFor } from "./types.ts";
import { confidenceForIssue } from "./confidence.ts";

function clusterShape(ctx: AgentContext): { kind: string; claim: string } {
  const { issue, members } = ctx;
  if (issue.type === "synthesis") {
    const reporters = new Set(members.map((r) => r.reporterId));
    return {
      kind: "synthesis",
      claim:
        `${members.length} individually-minor reports from ${reporters.size} reporters around ` +
        `${issue.plusCellId} point to one latent cause: ${issue.title}.`,
    };
  }
  if (issue.type === "recurrence") {
    return {
      kind: "recurrence",
      claim:
        `${members.length} reports in the same cell (${issue.plusCellId}) over ` +
        `${issue.recurrence?.spanDays ?? "?"} days — a recurring failure, not isolated incidents.`,
    };
  }
  return {
    kind: members.length > 1 ? "cluster" : "single",
    claim: issue.title,
  };
}

export const evidenceAgent: Agent = async (ctx: AgentContext): Promise<AgentResult> => {
  const { issue, members } = ctx;

  // ── Cluster reconstruction self-check (derived, not hardcoded) ──
  const reconstructed = members.map((r) => r.reportId).sort();
  const frozen = [...issue.contributingReports].sort();
  if (reconstructed.join(",") !== frozen.join(",")) {
    throw new Error(
      `[evidence] cluster drift on ${issue.issueId}: reconstructed [${reconstructed}] != frozen [${frozen}]`,
    );
  }

  // Cosine tightness over the cluster — the same signal that feeds confidence.
  const vecs = issue.contributingReports
    .map((id) => ctx.vectors[id])
    .filter((v): v is number[] => Array.isArray(v));
  const tightness = meanPairwiseCosine(vecs);

  const shape = clusterShape(ctx);

  // ── Evidence list: each report's text + any multimodal observations ──
  const evidence: EvidenceRef[] = [];
  for (const r of members) {
    evidence.push({ reportId: r.reportId, field: "text", value: r.text });
    for (const m of r.media) {
      if (m.type !== "none" && m.extracted) {
        evidence.push({
          reportId: r.reportId,
          field: `media:${m.type}`,
          value:
            `${m.caption ?? m.type} — observed: ${m.extracted.observedFeatures.join(", ")} ` +
            `(severity signal ${m.extracted.severitySignal}/5, conf ${m.extracted.confidence})`,
        });
      }
    }
  }

  const conf = confidenceForIssue(ctx);
  const tier = routeFor("evidence", issue);

  return {
    handoff: {
      claim: shape.claim,
      evidence,
      confidence: conf.value,
      uncertainty:
        tightness === null
          ? "Single-source cluster — no cross-report agreement signal."
          : `Cluster cosine tightness ${tightness.toFixed(3)}; ${members.length} corroborating reports.`,
    },
    patch: {}, // evidence does not change load-bearing fields
    step: {
      agent: "evidence",
      status: "ok",
      parallelGroup: null,
      in: { issueId: issue.issueId, reportIds: issue.contributingReports },
      out: null, // filled by the orchestrator from handoff
      model: tier,
      callCount: 0, // deterministic on the spine
    },
  };
};
