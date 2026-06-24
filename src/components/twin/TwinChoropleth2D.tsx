// COMMONS — the 2D exposure choropleth (the guaranteed fallback).
//
// Built BEFORE the 3D twin and consumes the IDENTICAL joined geometry, so when
// deck.gl/WebGL is unavailable the DigitalTwin wrapper swaps to this with no data
// difference: same 14 cells, same 6 markers, same colours, same click→drawer.
// Pure MapLibre (no WebGL2 columns) — works anywhere a raster map works.
import { Layer, Marker, Source } from "react-map-gl/maplibre";
import { BaseMap } from "./BaseMap.tsx";
import { type TwinGeo, CELL_HALF_DEG } from "../../lib/twinGeo.ts";
import type { FeatureCollection } from "geojson";

// Amber→red exposure ramp (low → high risk). The hottest cells (Agara Lake 0.93,
// Somasundara 0.92) read deepest red.
function exposureFill(): maplibregl.ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["get", "exposure"],
    0.3, "#3a2f1a",
    0.5, "#6b4e1f",
    0.7, "#b5701f",
    0.9, "#e0521f",
    1.0, "#ff3b30",
  ] as unknown as maplibregl.ExpressionSpecification;
}

function cellsToGeoJSON(geo: TwinGeo): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: geo.cells.map((c) => ({
      type: "Feature",
      properties: { plusCellId: c.plusCellId, exposure: c.exposure, street: c.street },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [c.lng - CELL_HALF_DEG, c.lat - CELL_HALF_DEG],
            [c.lng + CELL_HALF_DEG, c.lat - CELL_HALF_DEG],
            [c.lng + CELL_HALF_DEG, c.lat + CELL_HALF_DEG],
            [c.lng - CELL_HALF_DEG, c.lat + CELL_HALF_DEG],
            [c.lng - CELL_HALF_DEG, c.lat - CELL_HALF_DEG],
          ],
        ],
      },
    })),
  };
}

export function TwinChoropleth2D({
  geo,
  onSelect,
  focusCellId,
}: {
  geo: TwinGeo;
  onSelect: (id: string) => void;
  focusCellId: string | null;
}) {
  const data = cellsToGeoJSON(geo);
  return (
    <BaseMap>
      <Source id="cells" type="geojson" data={data}>
        <Layer id="cell-fill" type="fill" paint={{ "fill-color": exposureFill(), "fill-opacity": 0.55 }} />
        <Layer id="cell-line" type="line" paint={{ "line-color": "#1f2a37", "line-width": 1 }} />
      </Source>

      {/* Issue markers — sized by impact, coloured by quadrant, click → drawer. */}
      {geo.markers.map((m) => {
        const size = 14 + (m.impactScore / 100) * 22;
        const focused = m.plusCellId === focusCellId;
        return (
          <Marker key={m.issueId} longitude={m.lng} latitude={m.lat} anchor="center">
            <button
              type="button"
              aria-label={`${m.title} — impact ${m.impactScore}`}
              onClick={() => onSelect(m.issueId)}
              className="flex items-center justify-center rounded-full transition-transform hover:scale-110"
              style={{
                width: size,
                height: size,
                background: `${m.color}cc`,
                border: `2px solid ${focused ? "#e6edf3" : m.color}`,
                boxShadow: focused ? `0 0 0 4px ${m.color}55` : "none",
              }}
            >
              <span className="font-data text-[10px] font-medium text-black/80">{m.impactScore}</span>
            </button>
          </Marker>
        );
      })}
    </BaseMap>
  );
}
