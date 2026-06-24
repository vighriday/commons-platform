import type { AgentRun, AgentStep, Issue } from "@shared/types.ts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { IconReversal, IconTrace } from "./icons.tsx";

// The Agent Trace — the visible record of the 7-agent pipeline. This is the
// Agentic-Depth artifact: each issue is processed by Evidence → (Impact ∥
// Attention) → Hidden-Crisis → Resolution → Accountability → Memory, with the
// parallel fork rendered as a fork, the model tier (Flash / Flash-Lite) shown
// per step, and the critique reversal laid out as a before/after panel. It reads
// the FROZEN run (0 live model calls) — the trace is an audit, not a live spend.

const AGENT_LABEL: Record<string, string> = {
  evidence: "Evidence",
  impact: "Impact",
  attention: "Attention",
  hidden_crisis: "Hidden-Crisis",
  resolution: "Resolution",
  accountability: "Accountability",
  memory: "Community Memory",
};

const AGENT_BLURB: Record<string, string> = {
  evidence: "Clusters the reports, reads the photos, names the pattern.",
  impact: "Recomputes Severity × Exposure × Vulnerability — and asserts it.",
  attention: "Recomputes the community-attention signal — and asserts it.",
  hidden_crisis: "Critiques the ranking; overrules attention when impact wins.",
  resolution: "Drafts the action plan, department, SLA, and cost band.",
  accountability: "Names the authority and drafts the escalation brief.",
  memory: "Builds the occurrence timeline and the recurrence narrative.",
};

export function AgentTrace({
  issues,
  onSelect,
}: { issues: Issue[]; onSelect: (id: string) => void }) {
  const runQ = useQuery({ queryKey: ["agent-run"], queryFn: api.agentRun });

  if (runQ.isPending) {
    return (
      <PanelShell>
        <span className="font-data text-xs text-ink-faint">Loading the agent trace…</span>
      </PanelShell>
    );
  }
  if (runQ.isError || !runQ.data) {
    return (
      <PanelShell>
        <span className="font-data text-xs text-ink-faint">Agent trace unavailable.</span>
      </PanelShell>
    );
  }

  const run = runQ.data;
  const byTitle = new Map(issues.map((i) => [i.issueId, i.title]));

  // The trace records 7 steps per issue, in order. Group them back per issue so
  // we can render one pipeline lane per issue. (Order in `steps` is issue-major.)
  const lanes = groupByIssue(run.steps);

  return (
    <section className="rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-card)]">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="label flex items-center gap-1.5">
            <IconTrace size={13} /> Agent Pipeline
          </div>
          <h2
            className="mt-1 font-semibold text-ink"
            style={{
              fontSize: "var(--text-h2)",
              lineHeight: "var(--text-h2--line-height)",
              letterSpacing: "var(--text-h2--letter-spacing)",
            }}
          >
            How each issue was reasoned
          </h2>
        </div>
        <RunMeta run={run} laneCount={lanes.length} />
      </header>

      {/* The reversal — the headline of the whole pipeline. */}
      {run.reversal && <ReversalPanel run={run} titleOf={(id) => byTitle.get(id) ?? id} />}

      {/* The model legend. */}
      <div className="mb-4 mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 text-[11px]">
        <ModelBadge tier="flash" />{" "}
        <span className="text-ink-faint">deep reasoning · synthesis · critique · brief</span>
        <ModelBadge tier="flash-lite" /> <span className="text-ink-faint">the workhorse steps</span>
        <span className="ml-auto flex items-center gap-1.5 text-ink-faint">
          <Dot className="bg-brand" /> parallel fork
        </span>
      </div>

      {/* One pipeline lane per issue. */}
      <ul className="space-y-2.5">
        {lanes.map((lane) => (
          <PipelineLane
            key={lane.issueId}
            lane={lane}
            title={byTitle.get(lane.issueId) ?? lane.issueId}
            onSelect={() => onSelect(lane.issueId)}
          />
        ))}
      </ul>
    </section>
  );
}

// ── Run-level metadata ───────────────────────────────────────────────────────────
function RunMeta({ run, laneCount }: { run: AgentRun; laneCount: number }) {
  return (
    <div className="shrink-0 text-right">
      <div className="label">Run</div>
      <div className="mt-0.5 font-data text-[11px] text-ink-muted">
        {laneCount} issues · {run.steps.length} steps
      </div>
      <div className="font-data text-[11px] text-ink-faint">{run.runId}</div>
    </div>
  );
}

// ── The reversal before/after panel — the Contradiction made explicit ───────────
function ReversalPanel({ run, titleOf }: { run: AgentRun; titleOf: (id: string) => string }) {
  const r = run.reversal!;
  return (
    <div className="rounded-lg border border-hidden/40 bg-hidden/[0.06] p-4">
      <div className="label flex items-center gap-1.5 text-hidden">
        <IconReversal size={14} /> The overrule
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink">{r.reason}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <RankColumn
          label="What the crowd sees"
          sub="by attention"
          order={r.beforeRanking}
          titleOf={titleOf}
          highlightId={r.overruledIssueId}
          tone="overruled"
        />
        <RankColumn
          label="What impact says"
          sub="by measured impact"
          order={r.afterRanking}
          titleOf={titleOf}
          highlightId={r.promotedIssueId}
          tone="promoted"
        />
      </div>
    </div>
  );
}

function RankColumn({
  label,
  sub,
  order,
  titleOf,
  highlightId,
  tone,
}: {
  label: string;
  sub: string;
  order: string[];
  titleOf: (id: string) => string;
  highlightId: string;
  tone: "promoted" | "overruled";
}) {
  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <div className="label">{label}</div>
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-ink-faint">
        {sub}
      </div>
      <ol className="space-y-1">
        {order.slice(0, 6).map((id, n) => {
          const hot = id === highlightId;
          return (
            <li key={id} className="flex items-center gap-2 text-[11px]">
              <span className="font-data text-ink-faint">{n + 1}</span>
              <span
                className={
                  hot
                    ? tone === "promoted"
                      ? "font-medium text-hidden"
                      : "text-ink-faint line-through"
                    : "text-ink-muted"
                }
              >
                {titleOf(id)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── One issue's pipeline, rendered as a step row ─────────────────────────────────
interface Lane {
  issueId: string;
  steps: AgentStep[];
}

function PipelineLane({
  lane,
  title,
  onSelect,
}: { lane: Lane; title: string; onSelect: () => void }) {
  // Split out the impact∥attention fork so it renders under one bracket.
  const ordered = orderSteps(lane.steps);
  return (
    <li className="rounded-lg border border-line bg-surface px-3.5 py-3">
      <button
        type="button"
        onClick={onSelect}
        className="mb-2.5 block text-left text-[13px] font-medium text-ink hover:text-brand"
      >
        {title}
      </button>
      <div className="flex flex-wrap items-stretch gap-1.5">
        {ordered.map((node, n) => (
          <span key={n} className="flex items-center gap-1.5">
            {node.kind === "single" ? (
              <StepChip step={node.step} />
            ) : (
              <ForkBracket a={node.a} b={node.b} />
            )}
            {n < ordered.length - 1 && <Arrow />}
          </span>
        ))}
      </div>
    </li>
  );
}

function StepChip({ step }: { step: AgentStep }) {
  const overruled = step.status === "overruled";
  return (
    <span
      className={`group/chip relative flex flex-col rounded-md border px-2.5 py-1.5 ${
        overruled ? "border-hidden/50 bg-hidden/[0.07]" : "border-line bg-surface-raised"
      }`}
      title={AGENT_BLURB[step.agent]}
    >
      <span className="flex items-center gap-1.5">
        <span className={`text-[11px] font-medium ${overruled ? "text-hidden" : "text-ink"}`}>
          {AGENT_LABEL[step.agent]}
        </span>
        <ModelDot tier={step.model} />
      </span>
      <span className="font-data text-[10px] text-ink-faint">
        {step.cached ? "cached" : `${step.ms}ms`}
        {step.callCount > 0 ? ` · ${step.callCount}×` : ""}
      </span>
    </span>
  );
}

function ForkBracket({ a, b }: { a: AgentStep; b: AgentStep }) {
  return (
    <span className="flex flex-col gap-1 rounded-md border border-brand/30 bg-brand/[0.04] p-1">
      <span className="px-1 text-[9px] font-medium uppercase tracking-wider text-brand">
        parallel
      </span>
      <span className="flex gap-1">
        <StepChip step={a} />
        <StepChip step={b} />
      </span>
    </span>
  );
}

function Arrow() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="shrink-0 text-ink-faint"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

// ── Small UI atoms ───────────────────────────────────────────────────────────────
function ModelBadge({ tier }: { tier: "flash" | "flash-lite" }) {
  return (
    <span className="flex items-center gap-1.5">
      <ModelDot tier={tier} />
      <span className="font-data text-[11px] text-ink-muted">
        {tier === "flash" ? "Flash" : "Flash-Lite"}
      </span>
    </span>
  );
}

function ModelDot({ tier }: { tier: "flash" | "flash-lite" | "gemma" }) {
  const color = tier === "flash" ? "#3ea6ff" : tier === "gemma" ? "#6b7c93" : "#3ddc97";
  return <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />;
}

function Dot({ className }: { className: string }) {
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${className}`} />;
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex h-[520px] items-center justify-center rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-card)]">
      {children}
    </section>
  );
}

// ── Step grouping helpers ────────────────────────────────────────────────────────
function groupByIssue(steps: AgentStep[]): Lane[] {
  // The run records 7 steps per issue, issue-major. Re-chunk by 7.
  const lanes: Lane[] = [];
  for (let i = 0; i < steps.length; i += 7) {
    const chunk = steps.slice(i, i + 7);
    // Derive the issueId from the step's `in` payload (evidence carries issueId).
    const ev = chunk.find((s) => s.agent === "evidence");
    const issueId = (ev?.in as { issueId?: string })?.issueId ?? `issue-${i / 7}`;
    lanes.push({ issueId, steps: chunk });
  }
  return lanes;
}

type Node = { kind: "single"; step: AgentStep } | { kind: "fork"; a: AgentStep; b: AgentStep };

function orderSteps(steps: AgentStep[]): Node[] {
  const nodes: Node[] = [];
  const fork = steps.filter((s) => s.parallelGroup === "impact-attention");
  const seen = new Set<AgentStep>();
  for (const s of steps) {
    if (s.parallelGroup === "impact-attention") {
      if (!seen.has(s) && fork.length === 2) {
        nodes.push({ kind: "fork", a: fork[0], b: fork[1] });
        fork.forEach((f) => seen.add(f));
      }
      continue;
    }
    nodes.push({ kind: "single", step: s });
  }
  return nodes;
}
