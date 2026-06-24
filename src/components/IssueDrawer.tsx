import { useState } from "react";
import type { Issue } from "@shared/types.ts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useTwinStore } from "../lib/twinStore.ts";
import { CATEGORY_ICON, IconAlert, IconEscalate, IconLayers, IconReversal } from "./icons.tsx";

// Issue detail — slides from the right, keeps the quadrant in view. Shows the
// AUDITABLE impact breakdown (Severity × Exposure × Vulnerability, each cited),
// the contributing evidence, derived confidence, and the critique reversal.

const QUADRANT_LABEL: Record<string, string> = {
  critical: "Critical Priority",
  hidden_crisis: "Hidden Crisis",
  noise: "Noise",
  monitor: "Monitor",
};

const QUADRANT_COLOR: Record<string, string> = {
  critical: "#ff5c5c",
  hidden_crisis: "#f5a623",
  noise: "#6b7c93",
  monitor: "#3ea6ff",
};

export function IssueDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: issue, isPending } = useQuery({
    queryKey: ["issue", id],
    queryFn: () => api.issue(id),
  });
  const focusIssue = useTwinStore((s) => s.focusIssue);

  // Cross-wire: fly the Twin to this issue's cell + set the Time Machine to its
  // emergence date, then close the drawer so the map is unobstructed.
  function viewOnMap(): void {
    if (!issue) return;
    focusIssue(issue.plusCellId, issue.memory?.firstSeen ?? issue.createdAt);
    onClose();
  }

  const Cat = issue ? CATEGORY_ICON[issue.category] : null;
  const accent = issue ? QUADRANT_COLOR[issue.quadrant] : "#5d7184";

  return (
    <div role="dialog" aria-modal="true" aria-label={issue?.title ?? "Issue detail"}>
      <button
        type="button"
        aria-label="Close issue detail"
        className="fixed inset-0 z-40 animate-fade-in bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md animate-slide-in-right flex-col border-l border-line bg-surface-raised shadow-[var(--shadow-overlay)]">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 gap-3">
            {Cat && (
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                style={{ borderColor: `${accent}40`, color: accent, background: `${accent}0f` }}
              >
                <Cat size={18} />
              </span>
            )}
            <div className="min-w-0">
              <span className="label" style={{ color: accent }}>
                {issue ? QUADRANT_LABEL[issue.quadrant] : "Issue"}
              </span>
              <h2
                className="mt-1 font-semibold leading-snug text-ink"
                style={{ fontSize: "var(--text-h2)", lineHeight: "var(--text-h2--line-height)" }}
              >
                {isPending ? "Loading…" : issue?.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-overlay hover:text-ink"
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        {issue && (
          <div className="flex-1 space-y-6 overflow-auto px-5 py-5">
            <button
              type="button"
              onClick={viewOnMap}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface-overlay py-2 text-[13px] text-ink-muted transition-colors hover:border-brand hover:text-ink"
            >
              <IconLayers size={15} />
              View on the Digital Twin
            </button>
            <ImpactBreakdown issue={issue} />
            {issue.reversal?.overruledAttention && <ReversalCard issue={issue} />}
            {issue.escalation && <EscalationCard issue={issue} />}
            <Evidence issue={issue} />
          </div>
        )}
      </aside>
    </div>
  );
}

// The Accountability agent's escalation brief — the shareable, named-authority
// output. Copy-to-clipboard for sending; the brief itself is real Gemini prose.
function EscalationCard({ issue }: { issue: Issue }) {
  const esc = issue.escalation!;
  const [copied, setCopied] = useState(false);
  function copy(): void {
    navigator.clipboard?.writeText(esc.briefMarkdown).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }
  return (
    <section>
      <div className="label mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <IconEscalate size={13} />
          Escalation brief
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-line px-2 py-0.5 font-data text-[11px] normal-case tracking-normal text-ink-muted transition-colors hover:border-brand hover:text-ink"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="rounded-lg border border-line bg-surface px-3.5 py-3">
        <div className="text-[12px] text-ink-muted">
          <span className="text-ink-faint">To:</span>{" "}
          <span className="text-ink">{esc.officialRole}</span>, {esc.dept}
        </div>
        <p className="mt-2 whitespace-pre-wrap font-data text-[11px] leading-relaxed text-ink-muted">
          {esc.briefMarkdown}
        </p>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  lead,
}: { label: string; value: string; sub?: string; lead?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${lead ? "border-line-strong bg-surface-overlay" : "border-line bg-surface"}`}
    >
      <div className="label">{label}</div>
      <div
        className={`mt-1 font-data ${lead ? "text-[22px] text-ink" : "text-lg text-ink"} leading-none`}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-ink-faint">{sub}</div>}
    </div>
  );
}

function ImpactBreakdown({ issue }: { issue: Issue }) {
  return (
    <section>
      <div className="label mb-2.5">Impact is auditable, not a guess</div>
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Impact" value={String(issue.impactScore)} sub="of 100" lead />
        <Stat label="Severity" value={`${issue.severity.row}/5`} sub={issue.severity.label} />
        <Stat label="Exposure" value={issue.exposure.value.toFixed(2)} sub="Open Buildings" />
        <Stat
          label="Vuln."
          value={issue.vulnerability.value.toFixed(2)}
          sub={issue.vulnerability.adminLevel}
        />
      </div>
      <p className="mt-2.5 rounded-md bg-surface px-3 py-2 font-data text-[11px] leading-relaxed text-ink-muted">
        <span className="text-ink-faint">impact</span>{" "}
        <span className="text-ink">{issue.impactScore}</span>
        {" = "}
        {issue.severity.norm.toFixed(2)} × {issue.exposure.value.toFixed(2)} ×{" "}
        {issue.vulnerability.value.toFixed(2)} × 100
      </p>
      {issue.vulnerability.lowGranularityWarning && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
          <IconAlert size={14} className="mt-px shrink-0 text-hidden" />
          <span>
            Vulnerability uses a {issue.vulnerability.adminLevel}-level proxy (Census 2011 via Data
            Commons) — confidence is adjusted accordingly.
          </span>
        </p>
      )}
    </section>
  );
}

function ReversalCard({ issue }: { issue: Issue }) {
  const r = issue.reversal!;
  return (
    <section className="rounded-lg border border-hidden/40 bg-hidden/[0.06] px-4 py-3.5">
      <div className="label flex items-center gap-1.5 text-hidden">
        <IconReversal size={14} />
        Attention overruled
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink">
        Ranked <span className="font-data text-ink">#{r.attentionRank}</span> by community
        attention, but <span className="font-data text-hidden">#{r.impactRank}</span> by measured
        impact.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">{r.reason}</p>
    </section>
  );
}

function Evidence({ issue }: { issue: Issue }) {
  return (
    <section>
      <div className="label mb-2.5 flex items-center justify-between">
        <span>Evidence</span>
        <span className="flex items-center gap-1.5 normal-case tracking-normal">
          <span className="text-ink-faint">confidence</span>
          <span className="font-data text-ink">{issue.handoff.confidence.toFixed(2)}</span>
        </span>
      </div>
      <ul className="space-y-2">
        {issue.handoff.evidence.map((e) => (
          <li key={e.reportId} className="rounded-lg border border-line bg-surface px-3 py-2.5">
            <span className="font-data text-[11px] text-ink-faint">{e.reportId}</span>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{e.value}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
        <IconEscalate size={13} className="mt-px shrink-0 rotate-90 opacity-70" />
        <span>{issue.handoff.uncertainty}</span>
      </p>
    </section>
  );
}
