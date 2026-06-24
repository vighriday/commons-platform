import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../lib/api.ts";
import type { Issue } from "@shared/types.ts";

// Issue detail — slides from the right, keeps the quadrant in view. Shows the
// AUDITABLE impact breakdown (Severity × Exposure × Vulnerability, each cited),
// the contributing evidence, derived confidence, and the critique reversal.

const QUADRANT_LABEL: Record<string, string> = {
  critical: "Critical Priority",
  hidden_crisis: "Hidden Crisis",
  noise: "Noise",
  monitor: "Monitor",
};

export function IssueDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: issue, isPending } = useQuery({
    queryKey: ["issue", id],
    queryFn: () => api.issue(id),
  });

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-line bg-surface-raised shadow-card">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <span className="label">{issue ? QUADRANT_LABEL[issue.quadrant] : "Issue"}</span>
            <h2 className="mt-1 text-sm font-medium leading-snug text-ink">
              {isPending ? "Loading…" : issue?.title}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-faint hover:text-ink">
            <X size={18} />
          </button>
        </header>

        {issue && (
          <div className="flex-1 space-y-6 overflow-auto px-5 py-5">
            <ImpactBreakdown issue={issue} />
            {issue.reversal?.overruledAttention && <ReversalCard issue={issue} />}
            <Evidence issue={issue} />
          </div>
        )}
      </aside>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="label">{label}</div>
      <div className="mt-1 font-data text-lg text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-faint">{sub}</div>}
    </div>
  );
}

function ImpactBreakdown({ issue }: { issue: Issue }) {
  return (
    <section>
      <div className="label mb-2">Impact is auditable, not a guess</div>
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Impact" value={String(issue.impactScore)} sub="/ 100" />
        <Stat label="Severity" value={`${issue.severity.row}/5`} sub={issue.severity.label} />
        <Stat label="Exposure" value={issue.exposure.value.toFixed(2)} sub="Open Buildings" />
        <Stat label="Vuln." value={issue.vulnerability.value.toFixed(2)} sub={issue.vulnerability.adminLevel} />
      </div>
      <p className="mt-2 font-data text-[11px] leading-relaxed text-ink-faint">
        Impact {issue.impactScore} = Severity {issue.severity.norm.toFixed(2)} × Exposure{" "}
        {issue.exposure.value.toFixed(2)} × Vulnerability {issue.vulnerability.value.toFixed(2)} × 100
      </p>
      {issue.vulnerability.lowGranularityWarning && (
        <p className="mt-1 text-[11px] text-ink-faint">
          ⚠ Vulnerability uses a {issue.vulnerability.adminLevel}-level proxy (Census 2011 via Data
          Commons) — confidence adjusted accordingly.
        </p>
      )}
    </section>
  );
}

function ReversalCard({ issue }: { issue: Issue }) {
  const r = issue.reversal!;
  return (
    <section className="rounded-lg border border-hidden/40 bg-hidden/5 px-4 py-3">
      <div className="label text-hidden">⟲ Attention overruled</div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink">
        Ranked <span className="font-data">#{r.attentionRank}</span> by community attention, but{" "}
        <span className="font-data">#{r.impactRank}</span> by measured impact.
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">{r.reason}</p>
    </section>
  );
}

function Evidence({ issue }: { issue: Issue }) {
  return (
    <section>
      <div className="label mb-2">
        Evidence · confidence{" "}
        <span className="font-data text-ink">{issue.handoff.confidence.toFixed(2)}</span>
      </div>
      <ul className="space-y-2">
        {issue.handoff.evidence.map((e) => (
          <li key={e.reportId} className="rounded-lg border border-line bg-surface px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-data text-[11px] text-ink-faint">{e.reportId}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{e.value}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">{issue.handoff.uncertainty}</p>
    </section>
  );
}
