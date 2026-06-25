import type { AgentRun, AgentStep, Issue } from "@shared/types.ts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api.ts";
import { AGENT_META, FORMULAS, PHASES, explainStep } from "../lib/explain.ts";
import { StepInspector } from "./StepInspector.tsx";
import { IconReversal, IconTrace } from "./icons.tsx";

// The Agent Trace — the visible record of the 7-agent pipeline. This is the
// Agentic-Depth artifact: each issue is processed by Evidence → (Impact ∥
// Attention) → Hidden-Crisis → Resolution → Accountability → Memory, with the
// parallel fork rendered as a fork, the model tier (Flash / Flash-Lite) shown
// per step, and the critique reversal laid out as a before/after panel. It reads
// the FROZEN run (0 live model calls) — the trace is an audit, not a live spend.

// What the inspector needs to render a single clicked step.
interface Inspecting {
  step: AgentStep;
  issueTitle: string;
  stepIndex: number;
}

export function AgentTrace({
  issues,
  onSelect,
}: { issues: Issue[]; onSelect: (id: string) => void }) {
  const runQ = useQuery({ queryKey: ["agent-run"], queryFn: api.agentRun });
  // Explain Mode flips every lane from compact chips to full plain-language prose.
  const [explain, setExplain] = useState(false);
  // The single step the judge clicked to inspect in detail.
  const [inspect, setInspect] = useState<Inspecting | null>(null);

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

  // Open the inspector for one step (used by every chip and every prose row).
  function openStep(lane: Lane, step: AgentStep) {
    const idx = lane.steps.indexOf(step);
    setInspect({
      step,
      issueTitle: byTitle.get(lane.issueId) ?? lane.issueId,
      stepIndex: idx + 1,
    });
  }

  return (
    <div className="space-y-5">
      {/* ── How it works, end to end — the plain-language overview ── */}
      <PhaseOverview />

      <section className="rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-card)]">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="label flex items-center gap-1.5">
              <IconTrace size={13} /> Agent Pipeline · Phase 2
            </div>
            <h2
              className="mt-1 font-semibold text-ink"
              style={{
                fontSize: "var(--text-h2)",
                lineHeight: "var(--text-h2--line-height)",
                letterSpacing: "var(--text-h2--letter-spacing)",
              }}
            >
              How each problem was reasoned through
            </h2>
            <p className="mt-1 text-[13px] text-ink-faint">
              Seven agents per problem. Click any step to see exactly what it did — or flip on
              Explain to read them all.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ExplainToggle on={explain} onToggle={() => setExplain((v) => !v)} />
            <RunMeta run={run} laneCount={lanes.length} />
          </div>
        </header>

        {/* The reversal — the headline of the whole pipeline. */}
        {run.reversal && <ReversalPanel run={run} titleOf={(id) => byTitle.get(id) ?? id} />}

        {/* The model legend. */}
        <div className="mb-4 mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 text-[11px]">
          <ModelBadge tier="flash" />{" "}
          <span className="text-ink-faint">deep reasoning · synthesis · critique · brief</span>
          <ModelBadge tier="flash-lite" />{" "}
          <span className="text-ink-faint">the workhorse steps</span>
          <span className="ml-auto flex items-center gap-1.5 text-ink-faint">
            <Dot className="bg-brand" /> parallel fork
          </span>
        </div>

        {/* One pipeline lane per problem — compact chips, or full prose in Explain Mode. */}
        <ul className="space-y-2.5">
          {lanes.map((lane) =>
            explain ? (
              <ExplainLane
                key={lane.issueId}
                lane={lane}
                title={byTitle.get(lane.issueId) ?? lane.issueId}
                onTitle={() => onSelect(lane.issueId)}
                onStep={(s) => openStep(lane, s)}
              />
            ) : (
              <PipelineLane
                key={lane.issueId}
                lane={lane}
                title={byTitle.get(lane.issueId) ?? lane.issueId}
                onTitle={() => onSelect(lane.issueId)}
                onStep={(s) => openStep(lane, s)}
              />
            ),
          )}
        </ul>
      </section>

      {inspect && (
        <StepInspector
          step={inspect.step}
          issueTitle={inspect.issueTitle}
          stepIndex={inspect.stepIndex}
          onClose={() => setInspect(null)}
        />
      )}
    </div>
  );
}

// ── The plain-language overview — Phase 0→1→2→3 + the two formulas ───────────────
function PhaseOverview() {
  return (
    <section className="rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-card)]">
      <div className="label">How COMMONS works, end to end</div>
      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
        Four stages turn raw citizen reports into a ranked, accountable action list. Each stage is
        visible somewhere in the app — here's the whole chain in plain words.
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {PHASES.map((p) => (
          <li key={p.n} className="rounded-lg border border-line bg-surface px-4 py-3">
            <div className="flex items-baseline gap-2">
              <span className="font-data text-[11px] text-brand">Stage {p.n}</span>
              <span className="text-[13px] font-medium text-ink">{p.title}</span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{p.plain}</p>
            <p className="mt-1.5 text-[11px] italic leading-relaxed text-ink-faint">{p.proof}</p>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 md:grid-cols-2">
        {FORMULAS.map((f) => (
          <div key={f.name} className="rounded-lg border border-line bg-surface px-4 py-3">
            <div className="text-[13px] font-medium text-ink">{f.name}</div>
            <div className="mt-1 font-data text-[12px] text-brand">{f.formula}</div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{f.plain}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// The Explain Mode switch.
function ExplainToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
        on
          ? "border-brand bg-brand/[0.08] text-brand"
          : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
      }`}
    >
      <span
        className={`relative h-3.5 w-6 rounded-full transition-colors ${on ? "bg-brand" : "bg-line-strong"}`}
      >
        <span
          className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-surface transition-all ${on ? "left-3" : "left-0.5"}`}
        />
      </span>
      Explain
    </button>
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
  onTitle,
  onStep,
}: { lane: Lane; title: string; onTitle: () => void; onStep: (s: AgentStep) => void }) {
  // Split out the impact∥attention fork so it renders under one bracket.
  const ordered = orderSteps(lane.steps);
  return (
    <li className="rounded-lg border border-line bg-surface px-3.5 py-3">
      <button
        type="button"
        onClick={onTitle}
        className="mb-2.5 block text-left text-[13px] font-medium text-ink hover:text-brand"
      >
        {title}
      </button>
      <div className="flex flex-wrap items-stretch gap-1.5">
        {ordered.map((node, n) => (
          <span
            key={node.kind === "single" ? node.step.agent : "impact-attention-fork"}
            className="flex items-center gap-1.5"
          >
            {node.kind === "single" ? (
              <StepChip step={node.step} onClick={() => onStep(node.step)} />
            ) : (
              <ForkBracket a={node.a} b={node.b} onStep={onStep} />
            )}
            {n < ordered.length - 1 && <Arrow />}
          </span>
        ))}
      </div>
    </li>
  );
}

// Explain Mode — the same lane, opened up into plain-language rows (GOT/DID/SAID
// per step), so all six problems read top to bottom with no clicking required.
function ExplainLane({
  lane,
  title,
  onTitle,
  onStep,
}: { lane: Lane; title: string; onTitle: () => void; onStep: (s: AgentStep) => void }) {
  return (
    <li className="rounded-lg border border-line bg-surface px-4 py-3.5">
      <button
        type="button"
        onClick={onTitle}
        className="mb-3 block text-left text-[14px] font-medium text-ink hover:text-brand"
      >
        {title}
      </button>
      <ol className="space-y-2.5">
        {lane.steps.map((step, n) => {
          const meta = AGENT_META[step.agent];
          const x = explainStep(step);
          const overruled = step.status === "overruled";
          return (
            <li key={step.agent} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-data text-[10px] ${
                  overruled ? "bg-hidden/15 text-hidden" : "bg-surface-overlay text-ink-faint"
                }`}
              >
                {n + 1}
              </span>
              <button
                type="button"
                onClick={() => onStep(step)}
                className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-left transition-colors hover:border-line hover:bg-surface-raised"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[12px] font-medium ${overruled ? "text-hidden" : "text-ink"}`}
                  >
                    {meta.label}
                  </span>
                  <ModelDot tier={step.model} />
                  {overruled && (
                    <span className="flex items-center gap-1 text-[10px] text-hidden">
                      <IconReversal size={11} /> overruled
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
                  <span className="text-ink-faint">Did:</span> {x.did}{" "}
                  <span className="text-ink-faint">→</span>{" "}
                  <span className="text-ink">{x.said}</span>
                </p>
              </button>
            </li>
          );
        })}
      </ol>
    </li>
  );
}

function StepChip({ step, onClick }: { step: AgentStep; onClick: () => void }) {
  const overruled = step.status === "overruled";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group/chip relative flex flex-col rounded-md border px-2.5 py-1.5 text-left transition-colors hover:border-brand ${
        overruled ? "border-hidden/50 bg-hidden/[0.07]" : "border-line bg-surface-raised"
      }`}
      title={`${AGENT_META[step.agent].label} — click to see what it did`}
    >
      <span className="flex items-center gap-1.5">
        <span className={`text-[11px] font-medium ${overruled ? "text-hidden" : "text-ink"}`}>
          {AGENT_META[step.agent].label}
        </span>
        <ModelDot tier={step.model} />
      </span>
      <span className="font-data text-[10px] text-ink-faint">
        {step.cached ? "cached" : `${step.ms}ms`}
        {step.callCount > 0 ? ` · ${step.callCount}×` : ""}
      </span>
    </button>
  );
}

function ForkBracket({
  a,
  b,
  onStep,
}: { a: AgentStep; b: AgentStep; onStep: (s: AgentStep) => void }) {
  return (
    <span className="flex flex-col gap-1 rounded-md border border-brand/30 bg-brand/[0.04] p-1">
      <span className="px-1 text-[9px] font-medium uppercase tracking-wider text-brand">
        parallel
      </span>
      <span className="flex gap-1">
        <StepChip step={a} onClick={() => onStep(a)} />
        <StepChip step={b} onClick={() => onStep(b)} />
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
