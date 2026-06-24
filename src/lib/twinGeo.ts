// COMMONS — the coordinate join for the Digital Twin.
//
// The server's exposureGrid + issues carry plusCellId but no lat/lng. This module
// holds the canonical cell centroids (mirroring seed/plusCodes.ts HSR_CELLS,
// verified 14/14) and joins both into map-ready geometry that the 3D deck.gl path
// and the 2D MapLibre fallback BOTH consume — so the two renderers are always
// data-identical.
import type { Issue, Quadrant, TwinDoc } from "@shared/types.ts";

// Canonical HSR Layout cell centroids (lat/lng), keyed by plusCellId. These are
// the real computed Plus Code cell centers from the seed spine.
export const CELL_CENTROIDS: Record<string, { street: string; lat: number; lng: number }> = {
  "7J4VWJ6R": { street: "27th Main, Sector 1", lat: 12.9116, lng: 77.6411 },
  "7J4VWJFQ": { street: "Agara Lake Rd", lat: 12.9229, lng: 77.6389 },
  "7J4VWJ7Q": { street: "14th Main x 1st Cross, Sector 3", lat: 12.9148, lng: 77.6385 },
  "7J4VWJ5W": { street: "17th Cross, Sector 7", lat: 12.9081, lng: 77.6452 },
  "7J4VWM82": { street: "Somasundarapalya Main Rd", lat: 12.9168, lng: 77.6502 },
  "7J4VWJCW": { street: "ORR Service Rd (near bus stop)", lat: 12.9205, lng: 77.6475 },
  "7J4VWJ5V": { street: "19th Main, Sector 4", lat: 12.9098, lng: 77.6435 },
  "7J4VWJ7V": { street: "100ft Road", lat: 12.9136, lng: 77.6448 },
  "7J4VWJ6W": { street: "BDA Complex Rd", lat: 12.9122, lng: 77.6471 },
  "7J4VWJ5R": { street: "5th Main, Sector 6", lat: 12.9092, lng: 77.6418 },
  "7J4VWJ7P": { street: "24th Main, Sector 2", lat: 12.9128, lng: 77.6372 },
  "7J4VWJ4V": { street: "9th Cross, Sector 5", lat: 12.9072, lng: 77.6428 },
  "7J4VWJFW": { street: "Outer Ring Road junction", lat: 12.9242, lng: 77.6458 },
  "7J4VWJ7R": { street: "HSR BDA Park edge", lat: 12.9145, lng: 77.6415 },
};

// Ward bounding box + center (matches seed WARD_BBOX), for the initial camera.
export const WARD_BBOX = { latMin: 12.9, latMax: 12.925, lngMin: 77.635, lngMax: 77.655 };
export const WARD_CENTER = { lat: 12.9125, lng: 77.645 };

// ~half an 8-char Plus Code cell (≈275 m). Used to draw cell squares in 2D.
export const CELL_HALF_DEG = 0.00125;

export const QUADRANT_COLOR: Record<Quadrant, string> = {
  critical: "#ff5c5c",
  hidden_crisis: "#f5a623",
  noise: "#6b7c93",
  monitor: "#3ea6ff",
};

export interface TwinCell {
  plusCellId: string;
  street: string;
  lat: number;
  lng: number;
  exposure: number; // 0..1
  heightSlope: number;
  countSlope: number;
}

export interface TwinMarker {
  issueId: string;
  title: string;
  plusCellId: string;
  lat: number;
  lng: number;
  impactScore: number;
  attentionScore: number;
  quadrant: Quadrant;
  color: string;
}

export interface TwinGeo {
  cells: TwinCell[];
  markers: TwinMarker[];
  center: { lat: number; lng: number };
}

// Join the twin's exposureGrid + the issue set to coordinates. Cells/issues
// whose plusCellId has no known centroid are dropped (logged once would be ideal,
// but in practice all 14 + all 6 resolve — verified).
export function buildTwinGeo(twin: TwinDoc | null, issues: Issue[]): TwinGeo {
  const cells: TwinCell[] = (twin?.exposureGrid ?? [])
    .map((c) => {
      const ctr = CELL_CENTROIDS[c.plusCellId];
      if (!ctr) return null;
      return {
        plusCellId: c.plusCellId,
        street: ctr.street,
        lat: ctr.lat,
        lng: ctr.lng,
        exposure: c.exposure,
        heightSlope: c.heightSlope,
        countSlope: c.countSlope,
      };
    })
    .filter((c): c is TwinCell => c !== null);

  const markers: TwinMarker[] = issues
    .map((i) => {
      const ctr = CELL_CENTROIDS[i.plusCellId];
      if (!ctr) return null;
      return {
        issueId: i.issueId,
        title: i.title,
        plusCellId: i.plusCellId,
        lat: ctr.lat,
        lng: ctr.lng,
        impactScore: i.impactScore,
        attentionScore: i.attentionScore,
        quadrant: i.quadrant,
        color: QUADRANT_COLOR[i.quadrant],
      };
    })
    .filter((m): m is TwinMarker => m !== null);

  return { cells, markers, center: WARD_CENTER };
}

// The inlined CARTO dark RASTER style — subdomained tile hosts (a/b/c/d.) match
// the CSP `*.basemaps.cartocdn.com` allowance; raster avoids vector glyph fetches,
// so the map is 100% CSP-clean with no external style.json and no token.
export const CARTO_DARK_STYLE = {
  version: 8 as const,
  sources: {
    carto: {
      type: "raster" as const,
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap © CARTO",
    },
  },
  layers: [{ id: "carto-dark", type: "raster" as const, source: "carto" }],
};
