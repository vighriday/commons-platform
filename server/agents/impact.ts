// Impact agent — explains the Impact score; never recomputes-and-stores it.
//
// It reads the issue's stored factors (severity.norm, exposure.value,
// vulnerability.value), re-runs the SAME computeImpact from shared/scoring.ts,
// and ASSERTS the result equals the frozen issue.impactScore. If anything has
// drifted it throws — so "agents never move a load-bearing number" is enforced
// as executable code, not just a promise. The handoff narrates the arithmetic
// with each factor's provenance, which is the auditable "show your work" the
// product is built around.
import { computeImpact } from "@shared/scoring.ts";
import type { Agent, AgentContext, AgentResult } from "./types.ts";

export const impactAgent: Agent = async (ctx: AgentContext): Promise<AgentResult> => {
  const { issue } = ctx;
  const recomputed = computeImpact(
    issue.severity.norm,
    issue.exposure.value,
    issue.vulnerability.value,
  );
  if (recomputed !== issue.impactScore) {
    throw new Error(
      `[impact] drift on ${issue.issueId}: recomputed ${recomputed} != frozen ${issue.impactScore}`,
    );
  }

  const claim =
    `Impact ${issue.impactScore} = severity ${issue.severity.norm.toFixed(2)} ` +
    `(${issue.severity.label}) × exposure ${issue.exposure.value.toFixed(2)} (Open Buildings) ` +
    `× vulnerability ${issue.vulnerability.value.toFixed(2)} (Data Commons, ${issue.vulnerability.adminLevel}) × 100.`;

  return {
    handoff: {
      claim,
      evidence: [
        {
          reportId: issue.issueId,
          field: "severity",
          value: `${issue.severity.row}/5 (${issue.severity.label})`,
        },
        {
          reportId: issue.issueId,
          field: "exposure",
          value: `${issue.exposure.value} — ${issue.exposure.provenance}`,
        },
        {
          reportId: issue.issueId,
          field: "vulnerability",
          value: `${issue.vulnerability.value} — ${issue.vulnerability.adminLevel}-level proxy`,
        },
      ],
      confidence: issue.handoff.confidence,
      uncertainty: issue.vulnerability.lowGranularityWarning
        ? `Vulnerability is a ${issue.vulnerability.adminLevel}-level proxy (Census 2011 via Data Commons).`
        : "All three factors sourced and cited.",
    },
    patch: {}, // explainer: reads the number, never writes it
    step: {
      agent: "impact",
      status: "ok",
      parallelGroup: "impact-attention",
      in: {
        severityNorm: issue.severity.norm,
        exposure: issue.exposure.value,
        vulnerability: issue.vulnerability.value,
      },
      out: null,
      model: "flash-lite",
      callCount: 0,
    },
  };
};
