// COMMONS — the plain-language explainer.
//
// One place that turns the system's machinery into words a non-technical judge
// can read. It takes the RAW agent step (its typed `in` and `out`) and renders
// four plain sentences:
//
//   GOT   — what this agent received
//   DID   — what it actually did, in one human sentence
//   SAID  — the conclusion it produced
//   TRUST — why we should (or shouldn't fully) believe it
//
// Nothing here invents a number: every value is read straight off the frozen
// run. This module is intentionally exhaustive — every agent, every phase, and
// every score formula is described, because the brief is "a judge should be able
// to see the slightest of the information."

import type { AgentName, AgentStep } from "@shared/types.ts";

// ── Per-agent identity (name + one-line job, in plain words) ─────────────────────
export const AGENT_META: Record<AgentName, { label: string; job: string; reads: string }> = {
  evidence: {
    label: "Evidence",
    job: "Reads the citizen reports (and their photos) and names the real problem behind them.",
    reads: "the raw reports in one cluster",
  },
  synthesis: {
    label: "Synthesis",
    job: "Reasons across separate, individually-minor reports to the one hidden cause no single reporter could see.",
    reads: "the weak reports in a synthesis cluster",
  },
  impact: {
    label: "Impact",
    job: "Works out how dangerous the problem actually is — as a number, from real data.",
    reads: "severity, exposure and vulnerability",
  },
  attention: {
    label: "Attention",
    job: "Measures how much the community is actually talking about it.",
    reads: "upvotes, replies, alarm and recency",
  },
  hidden_crisis: {
    label: "Hidden-Crisis check",
    job: "Compares the two — and overrules the crowd when a quiet problem is the dangerous one.",
    reads: "the impact rank vs the attention rank",
  },
  resolution: {
    label: "Resolution",
    job: "Drafts the fix: the steps, the right department, how long it should take.",
    reads: "the category and severity",
  },
  accountability: {
    label: "Accountability",
    job: "Names the exact authority responsible and writes a ready-to-send escalation note.",
    reads: "the department and jurisdiction",
  },
  memory: {
    label: "Community Memory",
    job: "Builds the history — when this was first seen and whether it keeps coming back.",
    reads: "the past occurrences and dates",
  },
};

// ── Model tiers in plain words ───────────────────────────────────────────────────
export const MODEL_PLAIN: Record<string, string> = {
  flash: "Gemini 3.5 Flash — the stronger model, used for reading, judging and writing",
  "flash-lite": "Gemini 3.1 Flash-Lite — the fast workhorse, used for the routine steps",
  gemma: "Gemma — local fallback",
};

// Small helpers — read fields off the untyped `in`/`out` safely.
function rec(v: unknown): Record<string, unknown> {
  return (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
}
function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
function pct(v: unknown): string {
  const n = num(v);
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

export interface StepExplain {
  got: string;
  did: string;
  said: string;
  trust: string;
}

// The heart of it — one agent step → four plain sentences. Reads only what the
// step carries; if a field is missing it degrades to a still-true sentence.
export function explainStep(step: AgentStep): StepExplain {
  const i = rec(step.in);
  const out = step.out;
  const claim = out?.claim ?? "—";
  const conf = out ? `${Math.round(out.confidence * 100)}%` : "—";
  const uncertainty = out?.uncertainty ?? "";

  switch (step.agent) {
    case "evidence": {
      const ids = Array.isArray(i.reportIds) ? (i.reportIds as string[]) : [];
      const photo = out?.evidence?.some((e) => e.field === "media:photo");
      return {
        got: `${ids.length} citizen report${ids.length === 1 ? "" : "s"} (${ids.join(", ") || "—"})${
          photo ? ", including a photo" : ""
        }.`,
        did: photo
          ? "Read the text of every report and looked at the photo to confirm what was actually there."
          : "Read the text of every report and grouped them into one real-world problem.",
        said: `“${claim}”`,
        trust: `${conf} confident. ${uncertainty}`,
      };
    }
    case "impact": {
      const sev = num(i.severityNorm);
      const exp = num(i.exposure);
      const vul = num(i.vulnerability);
      const score =
        sev !== null && exp !== null && vul !== null ? Math.round(sev * exp * vul * 100) : null;
      return {
        got: `Severity ${sev !== null ? `${Math.round(sev * 5)}/5` : "—"}, exposure ${pct(
          exp,
        )} (how built-up the area is, from Google Open Buildings), vulnerability ${pct(
          vul,
        )} (how at-risk the people are, from Google Data Commons).`,
        did: "Multiplied the three together and scaled to 100 — a fixed formula, not a guess.",
        said: score !== null ? `Impact = ${score} out of 100.` : claim,
        trust: `${conf} confident. ${uncertainty}`,
      };
    }
    case "attention": {
      const up = num(i.upvotes);
      const rep = num(i.replies);
      const alarm = num(i.alarmMean);
      return {
        got: `${up ?? 0} upvote${up === 1 ? "" : "s"}, ${rep ?? 0} repl${
          rep === 1 ? "y" : "ies"
        }, alarm level ${pct(alarm)}, and how recent the reports are.`,
        did: "Blended the crowd signals into one attention score (half alarm, a third engagement, a fifth recency).",
        said: claim,
        trust: `${conf} confident. Attention measures the crowd only — on purpose, it ignores how dangerous the problem is.`,
      };
    }
    case "hidden_crisis": {
      const ir = num(i.impactRank);
      const ar = num(i.attentionRank);
      const overruled = step.status === "overruled";
      return {
        got: `This problem ranks #${ir ?? "—"} by danger but only #${ar ?? "—"} by how much the crowd talks about it.`,
        did: overruled
          ? "Saw the gap and overruled the crowd — flagged it as a hidden crisis the community is missing."
          : "Compared the two rankings; no overrule needed here.",
        said: claim,
        trust: `${conf} confident. The overrule is a rule (danger rank beats crowd rank), not the model's opinion.`,
      };
    }
    case "resolution": {
      const cat = typeof i.category === "string" ? i.category : "—";
      const actions = out?.evidence?.filter((e) => e.field.startsWith("action")) ?? [];
      return {
        got: `The problem category (${cat}) and how severe it is.`,
        did: `Drafted ${actions.length || "a set of"} concrete fix step${
          actions.length === 1 ? "" : "s"
        } and matched it to the right department and a target timeline.`,
        said: claim,
        trust: `${conf} confident. The steps are drafted by the model; the department, deadline and cost are fixed facts.`,
      };
    }
    case "accountability": {
      const dept = typeof i.dept === "string" ? i.dept : "—";
      return {
        got: `The responsible department (${dept}) and which civic body has jurisdiction.`,
        did: "Named the exact official and wrote a ready-to-send escalation note citing why they own it.",
        said: claim,
        trust: `${conf} confident. The note is written by the model; the authority and contact come from a fixed map of real Bengaluru civic bodies.`,
      };
    }
    case "memory": {
      const first = typeof i.firstSeen === "string" ? i.firstSeen.slice(0, 10) : "—";
      const occ = out?.evidence?.filter((e) => e.field === "occurrence") ?? [];
      return {
        got: "Every past time this problem was reported, with dates and locations.",
        did: `Built a timeline (${occ.length || "the"} occurrence${
          occ.length === 1 ? "" : "s"
        }) and worked out if it's seasonal or recurring. First seen ${first}.`,
        said: claim,
        trust: `${conf} confident. The timeline is real data; the wording of the pattern is drafted by the model.`,
      };
    }
    default:
      return { got: "—", did: claim, said: claim, trust: `${conf} confident.` };
  }
}

// ── The phases, in plain words — the top-of-page overview ─────────────────────────
export interface PhaseExplain {
  n: number;
  title: string;
  plain: string;
  proof: string; // where to see it live
}

export const PHASES: PhaseExplain[] = [
  {
    n: 0,
    title: "The reports come in",
    plain:
      "Citizens report local problems — a drain, a pothole, a crack — with text, a photo, and a location. We use a realistic set of reports for HSR Layout so the demo is honest and repeatable.",
    proof: "Every report is openable below, exactly as it came in.",
  },
  {
    n: 1,
    title: "Two numbers per problem",
    plain:
      "Each problem gets a danger score (Impact, 0–100) from real data, and a loudness score (Attention) from the crowd. Plotting one against the other is the matrix — and the gap between them is the whole point.",
    proof: "See it on the Matrix view; open any dot for the full breakdown.",
  },
  {
    n: 2,
    title: "Seven agents reason it through",
    plain:
      "A pipeline of seven Gemini agents reads the evidence, scores it, checks the crowd, overrules the crowd when a quiet problem is the dangerous one, drafts the fix, names the authority, and remembers the history.",
    proof: "This page — every agent's input, action and conclusion is shown.",
  },
  {
    n: 3,
    title: "See it in space and time",
    plain:
      "The Digital Twin shows where the danger physically sits across the ward in 3D. The Time Machine scrubs the last months so you can watch the loud problem stay loud while the quiet crisis stays ignored.",
    proof: "Open the Twin and Time views.",
  },
];

// ── The two score formulas, spelled out plainly ──────────────────────────────────
export const FORMULAS = [
  {
    name: "Impact — how dangerous it is",
    formula: "Severity × Exposure × Vulnerability × 100",
    plain:
      "Severity = which row of a fixed, published table the problem fits (e.g. “sewage flooding homes” = 5/5). Exposure = how built-up the area is (Google Open Buildings). Vulnerability = how at-risk the people are (Google Data Commons). Because the table and the data are fixed, the number is auditable — not an AI guess.",
  },
  {
    name: "Attention — how loud it is",
    formula: "½ Alarm + ⅓ Engagement + ⅕ Recency",
    plain:
      "Alarm = how worried the reporters sound. Engagement = upvotes and replies. Recency = how fresh the reports are. This is the crowd's voice only — it deliberately knows nothing about how dangerous the problem is, so the gap between the two scores is meaningful.",
  },
];
