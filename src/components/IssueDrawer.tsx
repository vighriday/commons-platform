import type { Issue, IssueStatus } from "@shared/types.ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type IssueDetail, type SlaState, api } from "../lib/api.ts";
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
            <TrackingCard issue={issue} />
            <VerifyCard issue={issue} />
            {issue.synthesis && <SynthesisCard issue={issue} />}
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

// Cross-Report Synthesis — the latent cause a Gemini reasoning pass connected
// from individually-trivial reports. The "no single reporter could see this" beat.
function SynthesisCard({ issue }: { issue: Issue }) {
  const s = issue.synthesis!;
  return (
    <section className="rounded-lg border border-brand/40 bg-brand/[0.06] px-4 py-3.5">
      <div className="label flex items-center gap-1.5 text-brand">
        <IconLayers size={14} />
        Cross-report synthesis · Gemini reasoning
      </div>
      <p className="mt-2 text-[14px] font-medium leading-snug text-ink">{s.latentCause}</p>
      <div className="mt-3 space-y-1.5">
        {s.signalChain.map((line) => (
          <div key={line} className="flex gap-2 text-[12px] leading-relaxed text-ink-muted">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
            <span>{line}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-brand/20 pt-2.5 text-[12px] leading-relaxed text-ink-faint">
        <span className="font-medium text-ink-muted">Why no one saw it: </span>
        {s.whyMissed}
      </p>
    </section>
  );
}

// ── Lifecycle tracking — the accountability clock ──────────────────────────────
// The status, the timeline of what happened when, and the live SLA (overdue
// computed against the wall clock). The "advance" control walks the issue one
// legal step so a judge can see the lifecycle move in real time.
const STATUS_META: Record<IssueStatus, { label: string; color: string; dot: string }> = {
  reported: { label: "Reported", color: "#6b7c93", dot: "#6b7c93" },
  acknowledged: { label: "Acknowledged", color: "#3ea6ff", dot: "#3ea6ff" },
  assigned: { label: "Assigned", color: "#f5a623", dot: "#f5a623" },
  resolved: { label: "Resolved", color: "#36c98b", dot: "#36c98b" },
  recurred: { label: "Recurred", color: "#ff5c5c", dot: "#ff5c5c" },
};
const NEXT_STATUS: Record<IssueStatus, IssueStatus | null> = {
  reported: "acknowledged",
  acknowledged: "assigned",
  assigned: "resolved",
  resolved: "recurred",
  recurred: "acknowledged",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function SlaBadge({ sla, status }: { sla: SlaState; status: IssueStatus }) {
  if (status === "resolved") {
    return (
      <span className="rounded-md bg-[#36c98b]/12 px-2 py-0.5 font-data text-[11px] text-[#36c98b]">
        ✓ closed
      </span>
    );
  }
  if (!sla.running) {
    return <span className="font-data text-[11px] text-ink-faint">SLA not started</span>;
  }
  if (sla.overdue) {
    return (
      <span className="rounded-md bg-critical/12 px-2 py-0.5 font-data text-[11px] font-medium text-critical">
        ⏱ {Math.abs(sla.daysRemaining)}d overdue
      </span>
    );
  }
  return (
    <span className="rounded-md bg-surface-overlay px-2 py-0.5 font-data text-[11px] text-ink-muted">
      {sla.daysRemaining}d left
    </span>
  );
}

function TrackingCard({ issue }: { issue: IssueDetail }) {
  const qc = useQueryClient();
  const t = issue.tracking;
  const next = t ? NEXT_STATUS[t.status] : null;
  const advance = useMutation({
    mutationFn: (to: IssueStatus) => api.advanceStatus(issue.issueId, to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issue", issue.issueId] });
      qc.invalidateQueries({ queryKey: ["issues"] });
    },
  });
  if (!t) return null;
  const meta = STATUS_META[t.status];
  return (
    <section>
      <div className="label mb-2.5 flex items-center justify-between">
        <span>Tracking · accountability clock</span>
        <SlaBadge sla={issue.sla} status={t.status} />
      </div>

      {/* The lifecycle rail */}
      <div className="rounded-lg border border-line bg-surface px-3.5 py-3">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />
          <span className="text-[13px] font-medium" style={{ color: meta.color }}>
            {meta.label}
          </span>
          {t.status === "recurred" && (
            <span className="rounded-md bg-critical/10 px-1.5 py-0.5 font-data text-[10px] text-critical">
              systemic — not a one-off
            </span>
          )}
        </div>

        {/* Timeline */}
        <ol className="relative space-y-2.5 border-l border-line pl-4">
          {t.timeline.map((e, n) => (
            <li key={`${e.status}-${n}`} className="relative">
              <span
                className="absolute -left-[21px] top-1 h-2 w-2 rounded-full ring-2 ring-surface"
                style={{ background: STATUS_META[e.status].dot }}
              />
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-ink">{STATUS_META[e.status].label}</span>
                <span className="shrink-0 font-data text-[10px] text-ink-faint">
                  {fmtDate(e.at)}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-ink-muted">{e.note}</p>
            </li>
          ))}
        </ol>

        {/* Advance control — walk the lifecycle live */}
        {next && (
          <button
            type="button"
            disabled={advance.isPending}
            onClick={() => advance.mutate(next)}
            className="mt-3 w-full rounded-md border border-line-strong bg-surface-overlay py-1.5 text-[12px] text-ink-muted transition-colors hover:border-brand hover:text-ink disabled:opacity-50"
          >
            {advance.isPending ? "Updating…" : `Advance → ${STATUS_META[next].label}`}
          </button>
        )}
      </div>
      {issue.sla.overdue && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-critical/90">
          <IconAlert size={14} className="mt-px shrink-0" />
          <span>
            Past its {issue.resolution?.slaDays}-day SLA. The model ranked this high on impact; the
            clock shows it has been waiting.
          </span>
        </p>
      )}
    </section>
  );
}

// ── Community verification — "I see this too" ──────────────────────────────────
// A corroboration bumps the live attention. When the model had this high on impact
// but low on attention (a Hidden Crisis), each tap is the crowd validating the AI's
// early call — and the card narrates that catch-up explicitly.
function VerifyCard({ issue }: { issue: IssueDetail }) {
  const qc = useQueryClient();
  const [justCrossed, setJustCrossed] = useState(false);
  const corroborate = useMutation({
    mutationFn: () => api.corroborate(issue.issueId),
    onSuccess: (r) => {
      if (r.crossedIntoCrowd) setJustCrossed(true);
      qc.invalidateQueries({ queryKey: ["issue", issue.issueId] });
      qc.invalidateQueries({ queryKey: ["issues"] });
    },
  });
  const count = issue.tracking?.corroborations ?? 0;
  const modelEarly = Boolean(issue.reversal?.overruledAttention);
  return (
    <section className="rounded-lg border border-line bg-surface px-3.5 py-3">
      <div className="label mb-2 flex items-center justify-between">
        <span>Community verification</span>
        <span className="font-data text-[11px] text-ink-muted">
          attention <span className="text-ink">{issue.attentionScore.toFixed(2)}</span>
        </span>
      </div>
      <p className="text-[12px] leading-relaxed text-ink-muted">
        {count > 0
          ? `${count} ${count === 1 ? "person has" : "people have"} confirmed they see this too.`
          : "Be the first to confirm you see this problem too."}
      </p>
      <button
        type="button"
        disabled={corroborate.isPending}
        onClick={() => corroborate.mutate()}
        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-md bg-brand/[0.1] py-2 text-[13px] font-medium text-brand transition-colors hover:bg-brand/[0.16] disabled:opacity-50"
      >
        <IconAlert size={14} />
        {corroborate.isPending ? "Recording…" : "⚠ I see this too"}
      </button>
      {modelEarly && (
        <p className="mt-2.5 border-t border-line pt-2.5 text-[11px] leading-relaxed text-hidden">
          The AI flagged this as high-impact <span className="font-medium">before</span> the crowd
          reacted. Every corroboration is the community catching up to what the model already knew.
        </p>
      )}
      {justCrossed && (
        <p className="mt-2 rounded-md bg-hidden/10 px-2.5 py-1.5 text-[11px] font-medium leading-relaxed text-hidden">
          The crowd just crossed into the model's ranking — community attention now matches the
          AI-assessed priority.
        </p>
      )}
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
        {issue.handoff.evidence.map((e, n) => (
          <li
            key={`${e.reportId}-${e.field}-${n}`}
            className="overflow-hidden rounded-lg border border-line bg-surface"
          >
            {e.imageUrl && (
              <div className="relative">
                <img
                  src={e.imageUrl}
                  alt={`Evidence photo for ${e.reportId}`}
                  className="h-36 w-full object-cover"
                  loading="lazy"
                />
                <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                  👁 read by Gemini Vision
                </span>
              </div>
            )}
            <div className="px-3 py-2.5">
              <span className="font-data text-[11px] text-ink-faint">{e.reportId}</span>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{e.value}</p>
            </div>
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
