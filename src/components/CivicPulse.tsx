import type { CivicPulse as CivicPulseData, TwinDoc } from "@shared/types.ts";

// The Civic Pulse — the neighbourhood's at-a-glance assessment, led by the
// Civic Blind Spot (where attention and impact disagree most).
export function CivicPulse({ pulse, twin }: { pulse: CivicPulseData; twin: TwinDoc }) {
  return (
    <section className="rounded-2xl border border-line bg-surface-raised p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="label">Civic Pulse</div>
          <h2 className="mt-1 text-base font-medium text-ink">{twin.name}</h2>
        </div>
        <div className="text-right">
          <div className="label">Infra Health</div>
          <div className="font-data text-2xl text-ink">{twin.infraHealth}</div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-hidden/40 bg-hidden/5 px-4 py-3">
        <div className="label text-hidden">Civic Blind Spot</div>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">{pulse.civicBlindSpot}</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
        <Row term="Status" def={pulse.status} />
        <Row term="Emerging risk" def={pulse.emergingRisk} />
        <Row term="Most ignored" def={pulse.mostIgnoredProblem} />
        <Row term="Bottleneck" def={pulse.resolutionBottleneck} />
      </dl>

      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">
        {pulse.narrative}
      </p>
    </section>
  );
}

function Row({ term, def }: { term: string; def: string }) {
  return (
    <div>
      <dt className="label">{term}</dt>
      <dd className="mt-0.5 text-ink-muted">{def}</dd>
    </div>
  );
}
