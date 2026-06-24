// Confidence for the agent pipeline — DERIVED, never LLM-rated (build-plan B12).
//
// This is a thin wrapper over deriveConfidence from shared/scoring.ts that feeds
// it the SAME inputs deriveIssues.ts uses (contributing count, district admin
// level, mean pairwise cosine over the member embeddings). Because the inputs
// are identical, the value equals the frozen issue's handoff.confidence to the
// digit — so the trace's confidence never contradicts the stored issue.
import { deriveConfidence, meanPairwiseCosine } from "@shared/scoring.ts";
import type { AgentContext } from "./types.ts";

export function confidenceForIssue(ctx: AgentContext): { value: number; singleSource: boolean } {
  const vecs = ctx.issue.contributingReports
    .map((id) => ctx.vectors[id])
    .filter((v): v is number[] => Array.isArray(v));
  const mpc = meanPairwiseCosine(vecs);
  return deriveConfidence({
    contributingCount: ctx.issue.contributingReports.length,
    adminLevel: "district", // matches deriveIssues.ts — the honest admin-gap level
    meanPairwiseCosine: mpc,
  });
}
