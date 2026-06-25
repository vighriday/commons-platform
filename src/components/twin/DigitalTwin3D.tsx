// COMMONS — the 3D Digital Twin (deck.gl interleaved with MapLibre).
//
// react-map-gl owns the single camera; deck.gl attaches as an interleaved
// MapboxOverlay (via useControl) and draws its columns + markers INTO the map's
// WebGL context. This is the deck.gl-documented pattern that avoids the
// two-cameras-fighting jitter you get when DeckGL wraps the Map. The result is a
// rock-steady 3D scene that pans/tilts/rotates with the map.
import { ColumnLayer, PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { Footprint, Issue, Quadrant } from "@shared/types.ts";
import maplibregl from "maplibre-gl";
import { useCallback, useMemo, useRef, useState } from "react";
import MapGL, { useControl } from "react-map-gl/maplibre";
import {
  CARTO_DARK_STYLE,
  QUADRANT_COLOR,
  type TwinGeo,
  type TwinMarker,
  WARD_CENTER,
} from "../../lib/twinGeo.ts";

// hex → [r,g,b] for deck.gl colour accessors.
function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface Props {
  geo: TwinGeo;
  issues: Issue[];
  footprints: Footprint[];
  onSelect: (id: string) => void;
  focusCellId: string | null;
}

// The deck.gl overlay, mounted as a MapLibre control so the map owns the camera.
function DeckOverlay({ layers }: { layers: unknown[] }) {
  const overlay = useControl(
    () => new MapboxOverlay({ interleaved: true, layers: layers as never }),
  );
  // Push new layers when they change (the control persists across renders).
  (overlay as MapboxOverlay).setProps({ layers: layers as never });
  return null;
}

export function DigitalTwin3D({ geo, issues, footprints, onSelect, focusCellId }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; m: TwinMarker } | null>(null);

  // Each cell's column colour = the quadrant of the highest-impact issue in that
  // cell (so the amber Hidden-Crisis cell glows), else a muted exposure tint.
  const cellQuadrant = useMemo(() => {
    const map = new Map<string, Quadrant>();
    const byCell = [...issues].sort((a, b) => b.impactScore - a.impactScore);
    for (const i of byCell) if (!map.has(i.plusCellId)) map.set(i.plusCellId, i.quadrant);
    return map;
  }, [issues]);

  const onHover = useCallback((info: { object?: unknown; x: number; y: number }) => {
    setHover(info.object ? { x: info.x, y: info.y, m: info.object as TwinMarker } : null);
  }, []);
  const onClickRef = useRef(onSelect);
  onClickRef.current = onSelect;

  const layers = useMemo(
    () => [
      // Building footprints — a low, dark extruded layer UNDER the columns, so the
      // ward reads as a real built-up place. Count/height per cell scale with the
      // real Open Buildings density/height (see scripts/genFootprints.ts).
      new PolygonLayer({
        id: "building-footprints",
        data: footprints,
        extruded: true,
        // Match the column elevation scale (exposure × 700) so buildings read as
        // real massing beneath the taller exposure columns, not flat slabs.
        elevationScale: 5,
        getPolygon: (f: Footprint) => f.polygon,
        getElevation: (f: Footprint) => f.heightM,
        // Lighter slate so the massing is legible against the dark basemap.
        getFillColor: [96, 116, 140, 240],
        getLineColor: [140, 160, 184, 255],
        getLineWidth: 1,
        lineWidthUnits: "pixels",
        stroked: true,
        material: { ambient: 0.6, diffuse: 0.7, shininess: 24 },
        pickable: false,
      }),
      new ColumnLayer({
        id: "exposure-columns",
        data: geo.cells,
        diskResolution: 4,
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
      }),
      new ScatterplotLayer({
        id: "issue-markers",
        data: geo.markers,
        pickable: true,
        radiusUnits: "pixels",
        getPosition: (m: TwinMarker) => [m.lng, m.lat],
        getRadius: (m: TwinMarker) => 7 + (m.impactScore / 100) * 12,
        getFillColor: (m: TwinMarker) => [...rgb(m.color), 235] as [number, number, number, number],
        getLineColor: (m: TwinMarker) =>
          (m.plusCellId === focusCellId ? [230, 237, 243, 255] : rgb(m.color)) as [
            number,
            number,
            number,
            number,
          ],
        getLineWidth: 2,
        lineWidthUnits: "pixels",
        stroked: true,
        onHover,
        onClick: (info) => info.object && onClickRef.current((info.object as TwinMarker).issueId),
        updateTriggers: { getLineColor: [focusCellId] },
      }),
    ],
    [geo, footprints, cellQuadrant, focusCellId, onHover],
  );

  return (
    <div className="relative h-full w-full">
      <MapGL
        mapLib={maplibregl}
        initialViewState={{
          longitude: WARD_CENTER.lng,
          latitude: WARD_CENTER.lat,
          zoom: 13.4,
          pitch: 52,
          bearing: -18,
        }}
        mapStyle={CARTO_DARK_STYLE as maplibregl.StyleSpecification}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <DeckOverlay layers={layers} />
      </MapGL>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-[16rem] rounded-lg border border-line-strong bg-surface-overlay px-3 py-2 shadow-[var(--shadow-overlay)]"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className="text-[13px] font-medium text-ink">{hover.m.title}</div>
          <div className="mt-1 flex gap-3 font-data text-[11px] text-ink-muted">
            <span>
              impact <span className="text-ink">{hover.m.impactScore}</span>
            </span>
            <span>
              attention <span className="text-ink">{hover.m.attentionScore.toFixed(2)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
