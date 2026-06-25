import type { Issue, Quadrant, TwinDoc } from "@shared/types.ts";
// COMMONS — the Digital Twin (public component App's "twin" view renders).
//
// Decides 3D-vs-2D and degrades safely:
//   1. WebGL2 capability probe — if the browser can't do WebGL2 (headless /
//      software GL / locked-down judge machine), render the 2D choropleth
//      directly and never instantiate deck.gl.
//   2. Otherwise render the 3D twin inside an error boundary whose fallback is
//      the SAME 2D choropleth — so a runtime deck.gl throw degrades, not blanks.
// Both paths consume one buildTwinGeo() join, so they are data-identical.
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "../../lib/api.ts";
import { QUADRANT_COLOR, buildTwinGeo } from "../../lib/twinGeo.ts";
import { useTwinStore } from "../../lib/twinStore.ts";
import { DigitalTwin3D } from "./DigitalTwin3D.tsx";
import { TwinChoropleth2D } from "./TwinChoropleth2D.tsx";
import { TwinErrorBoundary } from "./TwinErrorBoundary.tsx";

// One-time WebGL2 capability probe.
function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

interface Props {
  ward: string;
  twin: TwinDoc | null;
  issues: Issue[];
  onSelect: (id: string) => void;
}

export function DigitalTwin({ ward, twin, issues, onSelect }: Props) {
  const focusCellId = useTwinStore((s) => s.focusCellId);
  const geo = useMemo(() => buildTwinGeo(twin, issues), [twin, issues]);
  const webgl2 = useMemo(hasWebGL2, []);
  // Building footprints enrich the 3D scene only (the 2D choropleth ignores them).
  const footprintsQ = useQuery({
    queryKey: ["footprints", ward],
    queryFn: () => api.footprints(ward),
    enabled: webgl2,
  });
  const footprints = footprintsQ.data?.footprints ?? [];

  if (geo.cells.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="font-data text-xs text-ink-faint">Loading the digital twin…</span>
      </div>
    );
  }

  const fallback2D = <TwinChoropleth2D geo={geo} onSelect={onSelect} focusCellId={focusCellId} />;

  return (
    <div className="relative h-full w-full">
      {webgl2 ? (
        <TwinErrorBoundary fallback={fallback2D}>
          <DigitalTwin3D
            geo={geo}
            issues={issues}
            footprints={footprints}
            onSelect={onSelect}
            focusCellId={focusCellId}
          />
        </TwinErrorBoundary>
      ) : (
        fallback2D
      )}
      <TwinOverlay webgl2={webgl2} />
    </div>
  );
}

// Header + legend overlay — names the surface, credits Open Buildings, and maps
// the quadrant colours. Sits over the map, doesn't intercept map drags.
function TwinOverlay({ webgl2 }: { webgl2: boolean }) {
  return (
    <>
      <div className="pointer-events-none absolute left-5 top-5 z-10 max-w-sm rounded-lg border border-line bg-surface/85 p-4 backdrop-blur-sm">
        <div className="label">Digital Twin · HSR Layout</div>
        <h2
          className="mt-1 font-semibold text-ink"
          style={{ fontSize: "var(--text-h2)", lineHeight: "var(--text-h2--line-height)" }}
        >
          {webgl2 ? "Exposure, extruded" : "Exposure choropleth"}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
          {webgl2
            ? "Buildings are massed by real Open Buildings density/height. Each tall column is a ~275 m cell — taller = more built exposure. Markers are issues, sized by impact."
            : "Each square is a ~275 m cell, shaded by built exposure (Open Buildings 2.5D). Markers are issues, sized by impact."}
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-5 z-10 flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-line bg-surface/85 px-4 py-2.5 backdrop-blur-sm">
        {(Object.keys(QUADRANT_COLOR) as Quadrant[]).map((q) => (
          <span key={q} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: QUADRANT_COLOR[q] }} />
            {q === "hidden_crisis" ? "Hidden Crisis" : q[0].toUpperCase() + q.slice(1)}
          </span>
        ))}
      </div>
    </>
  );
}
