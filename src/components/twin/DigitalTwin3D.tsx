// COMMONS — the 3D Digital Twin (deck.gl, the primary path).
//
// deck.gl is the controlling component: it owns the camera (pitched 3D) and
// renders extruded columns (one per exposure cell, height = exposure, colour by
// the hottest issue in that cell) + pickable issue markers, with the CARTO dark
// raster map underneath via react-map-gl/maplibre. Clicking a marker opens the
// issue drawer. Fed by the SAME useTwinGeo data as the 2D fallback.
import { useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { ColumnLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Map as MapGL } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import {
  CARTO_DARK_STYLE, QUADRANT_COLOR, type TwinGeo, type TwinMarker, WARD_CENTER,
} from "../../lib/twinGeo.ts";
import type { Issue, Quadrant } from "@shared/types.ts";

// hex → [r,g,b] for deck.gl colour accessors.
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const INITIAL_VIEW = {
  longitude: WARD_CENTER.lng,
  latitude: WARD_CENTER.lat,
  zoom: 13.4,
  pitch: 52,
  bearing: -18,
};

interface Props {
  geo: TwinGeo;
  issues: Issue[];
  onSelect: (id: string) => void;
  focusCellId: string | null;
}

export function DigitalTwin3D({ geo, issues, onSelect, focusCellId }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; m: TwinMarker } | null>(null);

  // Each cell's column colour = the quadrant of the highest-impact issue sitting
  // in that cell (so the amber Hidden-Crisis cell glows), else a muted exposure tint.
  const cellQuadrant = useMemo(() => {
    const map = new Map<string, Quadrant>();
    const byCell = [...issues].sort((a, b) => b.impactScore - a.impactScore);
    for (const i of byCell) if (!map.has(i.plusCellId)) map.set(i.plusCellId, i.quadrant);
    return map;
  }, [issues]);

  const columnLayer = new ColumnLayer({
    id: "exposure-columns",
    data: geo.cells,
    diskResolution: 4, // square-ish footprint, ~cell shaped
    radius: 90,
    extruded: true,
    elevationScale: 1,
    getPosition: (c: TwinGeo["cells"][number]) => [c.lng, c.lat],
    getElevation: (c: TwinGeo["cells"][number]) => c.exposure * 700,
    getFillColor: (c: TwinGeo["cells"][number]) => {
      const q = cellQuadrant.get(c.plusCellId);
      const base = q ? rgb(QUADRANT_COLOR[q]) : [80, 100, 120];
      const a = c.plusCellId === focusCellId ? 255 : 190;
      return [base[0], base[1], base[2], a] as [number, number, number, number];
    },
    pickable: false,
    updateTriggers: { getFillColor: [focusCellId, cellQuadrant] },
  });

  const markerLayer = new ScatterplotLayer({
    id: "issue-markers",
    data: geo.markers,
    pickable: true,
    radiusUnits: "pixels",
    getPosition: (m: TwinMarker) => [m.lng, m.lat],
    getRadius: (m: TwinMarker) => 7 + (m.impactScore / 100) * 12,
    getFillColor: (m: TwinMarker) => [...rgb(m.color), 235] as [number, number, number, number],
    getLineColor: (m: TwinMarker) =>
      (m.plusCellId === focusCellId ? [230, 237, 243, 255] : rgb(m.color)) as [number, number, number, number],
    getLineWidth: 2,
    lineWidthUnits: "pixels",
    stroked: true,
    onHover: (info) =>
      setHover(info.object ? { x: info.x, y: info.y, m: info.object as TwinMarker } : null),
    onClick: (info) => info.object && onSelect((info.object as TwinMarker).issueId),
    updateTriggers: { getLineColor: [focusCellId] },
  });

  return (
    <div className="relative h-full w-full">
      <DeckGL
        initialViewState={INITIAL_VIEW}
        controller={{ doubleClickZoom: false }}
        layers={[columnLayer, markerLayer]}
        getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
      >
        <MapGL mapLib={maplibregl} mapStyle={CARTO_DARK_STYLE as maplibregl.StyleSpecification} attributionControl={false} />
      </DeckGL>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-[16rem] rounded-lg border border-line-strong bg-surface-overlay px-3 py-2 shadow-[var(--shadow-overlay)]"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className="text-[13px] font-medium text-ink">{hover.m.title}</div>
          <div className="mt-1 flex gap-3 font-data text-[11px] text-ink-muted">
            <span>impact <span className="text-ink">{hover.m.impactScore}</span></span>
            <span>attention <span className="text-ink">{hover.m.attentionScore.toFixed(2)}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
