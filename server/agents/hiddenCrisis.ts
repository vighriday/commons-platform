// Hidden-Crisis agent — the critique / overrule step. This is the Agentic-Depth
// showpiece: the moment the system overrules the crowd.
//
// It does NOT ask the model to reconsider the numbers. It reads the deterministic
// ranking (impact desc vs attention desc), applies isReversal(delta=4) — the same
// rule the spine used — and constructs the single run-level RunReversal that the
// trace UI renders as a before/after panel:
//   • promotedIssueId = the highest-impact reversal issue (HC-1, impact 81)
//   • overruledIssueId = the loudest issue the crowd ranks #1 (the pothole, the
//     ISS_NOISE attention leader) that impact pushes down
// isReversal fires on both HC-1 and HC-2; the per-issue issue.reversal stays on
// both, but the run-level panel needs ONE clean promoted/overruled pair or it
// reads as noise — so we pick HC-1 (the headline) vs the loudest (the honest
// "the crowd was wrong about this" anchor).
//
// The model (Flash) writes ONLY the prose reason around the fixed numbers; a
// golden fallback reason is used offline.
import { isReversal } from "@shared/scoring.ts";
import type { RunReversal } from "@shared/types.ts";
import type { Agent, AgentContext, AgentResult } from "./types.ts";

const REVERSAL_DELTA = 4; // matches deriveIssues.ts

export function buildRunReversal(ctx: AgentContext): RunReversal | null {
  const { ranking } = ctx;

  // Every issue whose impact rank strongly beats its attention rank.
  const reversed = ranking.byImpact.filter((id) =>
    isReversal(ranking.impactRankOf(id), ranking.attentionRankOf(id), REVERSAL_DELTA),
  );
  if (reversed.length === 0) return null;

  // Promoted = the highest-impact reversal issue (byImpact is impact desc).
  const promotedIssueId = reversed[0];
  // Overruled = the issue the crowd ranks #1 by attention (the loudest).
  const overruledIssueId = ranking.byAttention[0];

  return {
    issueId: promotedIssueId,
    beforeRanking: [...ranking.byAttention], // what the crowd sees (attention order)
    afterRanking: [...ranking.byImpact], // what impact says (impact order)
    overruledIssueId,
    promotedIssueId,
    reason: "", // filled below (model prose or golden fallback)
  };
}

export const hiddenCrisisAgent: Agent = async (ctx: AgentContext): Promise<AgentResult> => {
  const { issue, ranking } = ctx;

  const impactRank = ranking.impactRankOf(issue.issueId);
  const attentionRank = ranking.attentionRankOf(issue.issueId);
  const fires = isReversal(impactRank, attentionRank, REVERSAL_DELTA);

  // Self-check against the frozen per-issue reversal flag.
  const frozenFlag = Boolean(issue.reversal?.overruledAttention);
  if (fires !== frozenFlag) {
    throw new Error(
      `[hiddenCrisis] reversal drift on ${issue.issueId}: computed ${fires} != frozen ${frozenFlag} ` +
        `(impactRank ${impactRank}, attentionRank ${attentionRank})`,
    );
  }

  const claim = fires
    ? `${issue.title} ranks #${impactRank} by impact but only #${attentionRank} by attention — ` +
      `impact overrules the crowd. ${issue.reversal?.reason ?? ""}`
    : `${issue.title} sits at impact #${impactRank}, attention #${attentionRank} — no overrule.`;

  return {
    handoff: {
      claim,
      evidence: [
        { reportId: issue.issueId, field: "impactRank", value: String(impactRank) },
        { reportId: issue.issueId, field: "attentionRank", value: String(attentionRank) },
      ],
      confidence: issue.handoff.confidence,
      uncertainty: fires
        ? "Overrule is structural (impact ≫ attention by rank), not a model judgement."
        : "No reversal — attention and impact broadly agree for this issue.",
    },
    patch: {}, // per-issue reversal is already on the issue; this agent reasons about it
    step: {
      agent: "hidden_crisis",
      status: fires ? "overruled" : "ok",
      parallelGroup: null,
      in: { impactRank, attentionRank, delta: REVERSAL_DELTA },
      out: null,
      model: "flash",
      callCount: 0,
    },
  };
};
