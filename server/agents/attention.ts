// Attention agent — explains the Attention score; never recomputes-and-stores it.
//
// Mirrors the Impact agent: it reads the member reports' alarm/engagement/recency,
// re-runs the SAME computeAttention from shared/scoring.ts, and ASSERTS the
// result equals the frozen issue.attentionScore (throws on drift). It runs in the
// Impact∥Attention parallel fork (parallelGroup tag) so the trace renders the two
// explainers side by side. The handoff narrates the 0.5·alarm + 0.3·engagement +
// 0.2·recency split — the "why is the crowd loud (or quiet) about this" half of
// the Contradiction Engine.
import { computeAttention } from "@shared/scoring.ts";
import type { Agent, AgentContext, AgentResult } from "./types.ts";

export const attentionAgent: Agent = async (ctx: AgentContext): Promise<AgentResult> => {
  const { issue, members, maxWardEngagement, recencyNorm } = ctx;

  const alarmMean = members.reduce((s, r) => s + r.alarmIntensity, 0) / members.length;
  const upvotes = members.reduce((s, r) => s + r.engagement.upvotes, 0);
  const replies = members.reduce((s, r) => s + r.engagement.replies, 0);
  const recency = Math.max(...members.map((r) => recencyNorm(r.createdAt)));

  const recomputed = computeAttention({
    alarmIntensityMean: alarmMean,
    upvotes,
    replies,
    maxWardEngagement,
    recencyNorm: recency,
  });
  if (recomputed !== issue.attentionScore) {
    throw new Error(
      `[attention] drift on ${issue.issueId}: recomputed ${recomputed} != frozen ${issue.attentionScore}`,
    );
  }

  const loud = issue.attentionScore >= 0.5;
  const claim =
    `Attention ${issue.attentionScore.toFixed(2)} = 0.5·alarm ${alarmMean.toFixed(2)} ` +
    `+ 0.3·engagement (${upvotes}↑ ${replies}↺) + 0.2·recency ${recency.toFixed(2)}. ` +
    `${loud ? "The crowd is loud here." : "The crowd is quiet here."}`;

  return {
    handoff: {
      claim,
      evidence: members.map((r) => ({
        reportId: r.reportId,
        field: "engagement",
        value: `alarm ${r.alarmIntensity}, ${r.engagement.upvotes}↑ ${r.engagement.replies}↺ ${r.engagement.viewCount}👁`,
      })),
      confidence: issue.handoff.confidence,
      uncertainty: "Attention reflects community signal only — it is deliberately independent of measured impact.",
    },
    patch: {},
    step: {
      agent: "attention",
      status: "ok",
      parallelGroup: "impact-attention",
      in: { alarmMean, upvotes, replies, recency },
      out: null,
      model: "flash-lite",
      callCount: 0,
    },
  };
};
