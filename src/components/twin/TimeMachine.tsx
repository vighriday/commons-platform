import type { Issue, Quadrant } from "@shared/types.ts";
import { useQuery } from "@tanstack/react-query";
// COMMONS — the Time Machine (snapshot scrubber).
//
// Scrubs the month-end snapshots so the contradiction is visible OVER TIME: the
// pothole's attention climbs loud (it crosses into NOISE) while its impact stays
// low, and the Agara Lake drain (HC-1) sits quietly high-impact / low-attention
// the whole way — the silent crisis the crowd never looked at. Reads the frozen
// snapshots (0 model calls); the slider is the only interaction.
import { useMemo, useState } from "react";
import { api } from "../../lib/api.ts";
import { QUADRANT_COLOR } from "../../lib/twinGeo.ts";
import { useTwinStore } from "../../lib/twinStore.ts";
import { IconReversal } from "../icons.tsx";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function label(iso: string): string {
  const d = new Date(iso);
  return `${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function TimeMachine({ ward, issues }: { ward: string; issues: Issue[] }) {
  const snapQ = useQuery({ queryKey: ["snapshots", ward], queryFn: () => api.snapshots(ward) });
  const focusDateISO = useTwinStore((s) => s.focusDateISO);
  const [idx, setIdx] = useState<number | null>(null);

  const snapshots = snapQ.data?.snapshots ?? [];
  // Default to the latest frame; if a cross-wire set a focus date, start nearest it.
  const activeIdx = useMemo(() => {
    if (idx !== null) return idx;
    if (focusDateISO && snapshots.length) {
      const t = new Date(focusDateISO).getTime();
      let best = 0,
        bestD = Number.POSITIVE_INFINITY;
      snapshots.forEach((s, i) => {
        const d = Math.abs(new Date(s.takenAt).getTime() - t);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    }
    return Math.max(0, snapshots.length - 1);
  }, [idx, focusDateISO, snapshots]);

  if (snapQ.isPending) {
    return (
      <Shell>
        <span className="font-data text-xs text-ink-faint">Loading the Time Machine…</span>
      </Shell>
    );
  }
  if (snapQ.isError || snapshots.length === 0) {
    return (
      <Shell>
        <span className="font-data text-xs text-ink-faint">Time Machine unavailable.</span>
      </Shell>
    );
  }

  const frame = snapshots[activeIdx];
  const titleOf = (id: string) => issues.find((i) => i.issueId === id)?.title ?? id;

  return (
    <div className="mx-auto max-w-[1400px] px-7 py-7">
      <header className="mb-6 animate-rise">
        <div className="label">Time Machine · HSR Layout</div>
        <h2
          className="mt-1 font-semibold text-ink"
          style={{
            fontSize: "var(--text-display)",
            lineHeight: "var(--text-display--line-height)",
            letterSpacing: "var(--text-display--letter-spacing)",
          }}
        >
          The loud problem and the quiet one
        </h2>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Scrub the last months. Watch the pothole's <span className="text-noise">attention</span>{" "}
          climb while a silent <span className="text-hidden">drainage crisis</span> stays
          high-impact and ignored.
        </p>
      </header>

      {/* The scrubber */}
      <div className="rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <span className="font-data text-[13px] text-ink">{label(frame.takenAt)}</span>
          <span className="font-data text-[11px] text-ink-faint">
            frame {activeIdx + 1} / {snapshots.length}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={snapshots.length - 1}
          value={activeIdx}
          onChange={(e) => setIdx(Number(e.target.value))}
          aria-label="Scrub time"
          className="mt-3 w-full accent-[var(--color-brand)]"
        />
        <div className="mt-1 flex justify-between font-data text-[10px] text-ink-faint">
          {snapshots.map((s) => (
            <span key={s.takenAt}>{label(s.takenAt).split(" ")[0]}</span>
          ))}
        </div>
      </div>

      {/* Per-frame issue state — the two protagonists highlighted. */}
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        {[...frame.quadrantState]
          .sort((a, b) => b.impactScore - a.impactScore)
          .map((q) => {
            const hot = q.issueId === "ISS_HC1" || q.issueId === "ISS_NOISE";
            return (
              <FrameRow
                key={q.issueId}
                title={titleOf(q.issueId)}
                impact={q.impactScore}
                attention={q.attentionScore}
                quadrant={q.quadrant}
                emphasised={hot}
              />
            );
          })}
      </div>

      <p className="mt-5 flex items-start gap-2 text-[13px] leading-relaxed text-ink-muted">
        <IconReversal size={15} className="mt-px shrink-0 text-hidden" />
        <span>{frame.summary.civicBlindSpot}</span>
      </p>
    </div>
  );
}

function FrameRow({
  title,
  impact,
  attention,
  quadrant,
  emphasised,
}: { title: string; impact: number; attention: number; quadrant: Quadrant; emphasised: boolean }) {
  const color = QUADRANT_COLOR[quadrant];
  return (
    <div
      className={`rounded-lg border px-4 py-3 transition-colors ${
        emphasised ? "border-line-strong bg-surface-overlay" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`text-[13px] ${emphasised ? "font-medium text-ink" : "text-ink-muted"}`}>
          {title}
        </span>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {quadrant === "hidden_crisis" ? "Hidden" : quadrant[0].toUpperCase() + quadrant.slice(1)}
        </span>
      </div>
      {/* Twin bars — impact (amber) vs attention (grey), so the gap is visible. */}
      <div className="mt-2.5 space-y-1.5">
        <Bar label="impact" value={impact} max={100} color="#f5a623" />
        <Bar label="attention" value={Math.round(attention * 100)} max={100} color="#6b7c93" />
      </div>
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  color,
}: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 font-data text-[10px] text-ink-faint">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-overlay">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${(value / max) * 100}%`, background: color }}
        />
      </div>
      <span className="w-7 shrink-0 text-right font-data text-[10px] text-ink-muted">{value}</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-[520px] max-w-[1400px] items-center justify-center px-7">
      {children}
    </div>
  );
}
