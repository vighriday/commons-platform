import type { CivicPulse as CivicPulseData, TwinDoc } from "@shared/types.ts";
import { IconAlert } from "./icons.tsx";

// The Civic Pulse — the neighbourhood's at-a-glance assessment, led by the
// Civic Blind Spot (where attention and impact disagree most). The Infra Health
// number reads as the panel's single hero metric; everything else supports it.
export function CivicPulse({ pulse, twin }: { pulse: CivicPulseData; twin: TwinDoc }) {
  return (
    <section className="rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="label">Civic Pulse</div>
          <h2
            className="mt-1 truncate font-semibold text-ink"
            style={{
              fontSize: "var(--text-h2)",
              lineHeight: "var(--text-h2--line-height)",
              letterSpacing: "var(--text-h2--letter-spacing)",
            }}
          >
            {twin.name}
          </h2>
        </div>
        <div className="shrink-0 text-right">
          <div className="label">Infra Health</div>
          <div className="mt-0.5 font-data text-[32px] leading-none text-ink">{twin.infraHealth}</div>
        </div>
      </div>

      {/* The headline insight — the contradiction, framed in amber. */}
      <div className="mt-4 rounded-lg border border-hidden/40 bg-hidden/[0.06] px-4 py-3.5">
        <div className="label flex items-center gap-1.5 text-hidden">
          <IconAlert size={14} />
          Civic Blind Spot
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink">{pulse.civicBlindSpot}</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3.5">
        <Row term="Status" def={pulse.status} />
        <Row term="Emerging risk" def={pulse.emergingRisk} />
        <Row term="Most ignored" def={pulse.mostIgnoredProblem} />
        <Row term="Bottleneck" def={pulse.resolutionBottleneck} />
      </dl>

      <p className="mt-4 border-t border-line pt-3.5 text-[13px] leading-relaxed text-ink-muted">
        {pulse.narrative}
      </p>
    </section>
  );
}

function Row({ term, def }: { term: string; def: string }) {
  return (
    <div className="min-w-0">
      <dt className="label">{term}</dt>
      <dd className="mt-1 text-[13px] leading-snug text-ink-muted">{def}</dd>
    </div>
  );
}
