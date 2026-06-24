import { Type } from "@google/genai";
import type { Schema } from "@google/genai";
import type { Escalation } from "@shared/types.ts";
// Accountability agent — fills issue.escalation (the "who is responsible + the
// brief to send them" field).
//
// Everything that must be FACTUAL — dept, official role, contact, jurisdiction,
// citations — comes deterministically from the authority map. The model (Flash)
// drafts ONLY the briefMarkdown prose, addressed to the named authority, citing
// the impact math. A golden brief fallback (built from the same facts) is used
// offline, so the escalation is always complete and never fabricates a contact.
import { z } from "zod";
import { authorityFor } from "../../seed/authorityMap.ts";
import { generateStructured } from "../gemini.ts";
import { stableHash } from "./stable.ts";
import type { Agent, AgentContext, AgentResult } from "./types.ts";
import { AgentOffline } from "./types.ts";

const PROMPT_VERSION = "accountability.v1";

const ModelOut = z.object({ briefMarkdown: z.string().min(40) });
type ModelOut = z.infer<typeof ModelOut>;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: { briefMarkdown: { type: Type.STRING } },
  required: ["briefMarkdown"],
};

function goldenBrief(ctx: AgentContext): string {
  const { issue } = ctx;
  const auth = authorityFor(issue.category);
  return [
    `## Escalation Brief — ${issue.title}`,
    ``,
    `**To:** ${auth.officialRole}, ${auth.dept}`,
    `**Jurisdiction:** ${auth.jurisdictionAdminLevel} · **Target SLA:** ${auth.slaDays} days`,
    ``,
    `**Assessed Impact:** ${issue.impactScore}/100 — severity ${issue.severity.row}/5 ` +
      `× exposure ${issue.exposure.value} (Open Buildings) × vulnerability ${issue.vulnerability.value} ` +
      `(Data Commons, ${issue.vulnerability.adminLevel}-level).`,
    `**Location:** Plus Code cell ${issue.plusCellId}, HSR Layout (BBMP Ward 174).`,
    ``,
    issue.reversal?.overruledAttention
      ? `**Note:** This issue ranks #${issue.reversal.impactRank} by measured impact despite ranking ` +
        `only #${issue.reversal.attentionRank} by community attention — a civic blind spot.`
      : `**Note:** Supported by ${issue.contributingReports.length} corroborating report(s).`,
    ``,
    `Requesting inspection and action per the recommended resolution path.`,
  ].join("\n");
}

export const accountabilityAgent: Agent = async (ctx: AgentContext): Promise<AgentResult> => {
  const { issue } = ctx;
  const auth = authorityFor(issue.category);
  const inputHash = stableHash({
    v: PROMPT_VERSION,
    issue: issue.issueId,
    title: issue.title,
    impact: issue.impactScore,
    reversal: Boolean(issue.reversal?.overruledAttention),
  });

  const prompt =
    `Draft a concise, professional municipal escalation brief in Markdown, addressed to ` +
    `${auth.officialRole} at ${auth.dept}. Cite the assessed impact (${issue.impactScore}/100), the location ` +
    `(${issue.plusCellId}, HSR Layout, BBMP Ward 174), and request inspection + action. ` +
    (issue.reversal?.overruledAttention
      ? `Emphasise that this is a civic BLIND SPOT — high measured impact, low community attention. `
      : ``) +
    `Do NOT invent contact details or SLAs. Keep it under 150 words.\n\nIssue: ${issue.title}\nCategory: ${issue.category}.`;

  let briefMarkdown: string;
  let callCount = 0;
  let offline = false;
  try {
    const r = await generateStructured<ModelOut>({
      agent: "accountability",
      tier: "flash",
      prompt,
      responseSchema: RESPONSE_SCHEMA,
      validate: ModelOut,
      inputHash,
    });
    briefMarkdown = r.value.briefMarkdown;
    callCount = r.callCount;
  } catch (err) {
    if (!(err instanceof AgentOffline)) throw err;
    briefMarkdown = goldenBrief(ctx);
    offline = true;
  }

  const escalation: Escalation = {
    dept: auth.dept,
    officialRole: auth.officialRole,
    contact: auth.contact,
    jurisdictionAdminLevel: auth.jurisdictionAdminLevel,
    citations: auth.citations,
    briefMarkdown,
  };

  return {
    handoff: {
      claim: `Accountable authority for ${issue.title}: ${auth.dept} (${auth.officialRole}).`,
      evidence: auth.citations.map((c, n) => ({
        reportId: issue.issueId,
        field: `citation${n + 1}`,
        value: c,
      })),
      confidence: issue.handoff.confidence,
      uncertainty: offline
        ? "Brief from the deterministic golden fallback (model offline)."
        : "Brief drafted by Flash; authority + contact are fixed facts from the authority map.",
    },
    patch: { escalation },
    step: {
      agent: "accountability",
      status: "ok",
      parallelGroup: null,
      in: { category: issue.category, dept: auth.dept },
      out: null,
      model: "flash",
      callCount,
    },
  };
};
