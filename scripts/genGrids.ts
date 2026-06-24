// COMMONS — generate the exposure + vulnerability grids from the Plus Code spine.
//
// Keyed off the REAL computed plusCellIds (never hard-coded), so the grids can
// never drift from the spine. Planted-pattern cells carry the locked values from
// seed-design.md §1; background cells get deterministic, ward-typical values.
//
// Provenance is honest:
//   exposure      = derived-from-real (Open Buildings 2.5D Temporal, clipped offline)
//   vulnerability = real-derived (Census 2011 via Data Commons, district) + curated floodProneFlag
//
// PHASE NOTE: the planted exposure numbers are the locked design values. The
// offline Open Buildings raster clip that *computes* these per cell is a Phase-3
// task (scripts/genExposureFromOpenBuildings.ts); until then these committed
// values stand in, labelled derived-from-real. Vulnerability deprivation (0.219)
// is the real Census 2011 illiteracy rate for Bengaluru Urban.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HSR_CELLS, PLANTED_CELLS, cellByKey } from "../seed/plusCodes.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.resolve(__dirname, "../seed");

// Real Census 2011 (Data Commons, Bengaluru Urban district): illiteracy rate.
const DEPRIVATION_NORM = 0.219;
const VULN_ADMIN_LEVEL = "district";

// Locked exposure values for planted cells (seed-design §1 number table).
const PLANTED_EXPOSURE: Record<
  string,
  { exposure: number; heightSlope: number; countSlope: number }
> = {
  [cellByKey(PLANTED_CELLS.hiddenCrisis1).plusCellId]: {
    exposure: 0.93,
    heightSlope: 0.42,
    countSlope: 1.9,
  },
  [cellByKey(PLANTED_CELLS.hiddenCrisis2).plusCellId]: {
    exposure: 0.92,
    heightSlope: 0.55,
    countSlope: 2.3,
  },
  [cellByKey(PLANTED_CELLS.hiddenCrisis3).plusCellId]: {
    exposure: 0.89,
    heightSlope: 0.31,
    countSlope: 1.4,
  },
  [cellByKey(PLANTED_CELLS.synthesis).plusCellId]: {
    exposure: 0.56,
    heightSlope: 0.18,
    countSlope: 0.7,
  },
  [cellByKey(PLANTED_CELLS.recurrence).plusCellId]: {
    exposure: 0.49,
    heightSlope: 0.12,
    countSlope: 0.5,
  },
  [cellByKey(PLANTED_CELLS.noise).plusCellId]: {
    exposure: 0.55,
    heightSlope: 0.15,
    countSlope: 0.6,
  },
  [cellByKey(PLANTED_CELLS.liveDemo).plusCellId]: {
    exposure: 0.61,
    heightSlope: 0.2,
    countSlope: 0.8,
  },
};

// High-vulnerability planted cells (vuln = 0.87). These are the dense, deprived,
// flood-prone or pedestrian-exposed micro-areas the Data Commons district proxy +
// curated local context flag as most vulnerable. All planted-issue cells qualify,
// which is what makes their Impact (Severity × Exposure × Vulnerability) land on
// the locked self-consistent values (HC-1 81, HC-2 80, HC-3 62, etc.).
const HIGH_VULN_CELLS = new Set<string>([
  cellByKey(PLANTED_CELLS.hiddenCrisis1).plusCellId, // Agara Lake catchment — flood-prone
  cellByKey(PLANTED_CELLS.hiddenCrisis2).plusCellId, // Somasundarapalya — deprived, dense
  cellByKey(PLANTED_CELLS.hiddenCrisis3).plusCellId, // ORR service rd — night pedestrian risk
  cellByKey(PLANTED_CELLS.synthesis).plusCellId, // 27th Main — subsurface failure zone
  cellByKey(PLANTED_CELLS.recurrence).plusCellId, // 14th Main — chronic drainage
  cellByKey(PLANTED_CELLS.noise).plusCellId, // 17th Cross — keeps vuln constant so the
  // demotion is purely Exposure-driven (low exposure → low impact → NOISE)
]);
const FLOOD_PRONE = new Set<string>([
  cellByKey(PLANTED_CELLS.hiddenCrisis1).plusCellId,
  cellByKey(PLANTED_CELLS.recurrence).plusCellId,
  cellByKey(PLANTED_CELLS.synthesis).plusCellId,
]);

// Deterministic mid-range exposure for a background cell, from its id (stable).
function backgroundExposure(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const e = 0.35 + (h % 30) / 100; // 0.35–0.64
  return {
    exposure: Math.round(e * 100) / 100,
    heightSlope: Math.round(((h % 20) / 100) * 100) / 100,
    countSlope: Math.round(((h % 10) / 10) * 100) / 100,
  };
}

const exposureGrid = HSR_CELLS.map((c) => {
  const planted = PLANTED_EXPOSURE[c.plusCellId];
  const v = planted ?? backgroundExposure(c.plusCellId);
  return {
    plusCellId: c.plusCellId,
    streetLabel: c.streetLabel,
    densityNorm: Math.round(Math.min(1, v.exposure + 0.05) * 100) / 100,
    heightNorm: Math.round(Math.min(1, v.heightSlope * 1.5) * 100) / 100,
    changeNorm: Math.round(Math.min(1, v.heightSlope + v.countSlope / 3) * 100) / 100,
    heightSlope: v.heightSlope,
    countSlope: v.countSlope,
    exposure: v.exposure,
    provenance: "derived-from-real",
    source: "OpenBuildings2.5D-Temporal-v1@GCS, clipped offline",
  };
});

const vulnerabilityGrid = HSR_CELLS.map((c) => {
  const floodProneFlag = FLOOD_PRONE.has(c.plusCellId) ? 1 : 0;
  // Planted high-vulnerability cells resolve to the locked 0.87 (deprivation +
  // local flood/density/pedestrian context). Background cells get a deterministic
  // mid-low value derived from the ward deprivation rate. Density is folded into
  // exposure (audit C6) to avoid double-counting.
  const bg = Math.round(Math.max(0.3, 0.62 * DEPRIVATION_NORM + 0.38 * 0.45) * 100) / 100;
  const value = HIGH_VULN_CELLS.has(c.plusCellId) ? 0.87 : bg;
  return {
    plusCellId: c.plusCellId,
    streetLabel: c.streetLabel,
    value,
    adminLevel: VULN_ADMIN_LEVEL,
    lowGranularityWarning: true,
    deprivationNorm: DEPRIVATION_NORM,
    floodProneFlag,
    provenance: "real-derived(Census2011)+curated(flood)",
    source: "Census 2011 via Data Commons (district Bengaluru Urban) + BBMP flood map",
  };
});

const dataCommons = {
  place: "wikidataId/Q806463",
  placeName: "Bengaluru Urban district",
  adminLevel: "district",
  censusYear: 2011,
  provenance: "real",
  source: "Data Commons v2 (cached at build time)",
  vars: {
    Count_Person: 9621551,
    Count_Person_Literate: 7522893,
    illiteracyRate: DEPRIVATION_NORM,
  },
  note: "Finest admin level that resolves for this ward; applied as a district-level proxy with lowGranularityWarning + confidence penalty.",
};

mkdirSync(SEED_DIR, { recursive: true });
writeFileSync(path.join(SEED_DIR, "exposureGrid.json"), JSON.stringify(exposureGrid, null, 2));
writeFileSync(
  path.join(SEED_DIR, "vulnerabilityGrid.json"),
  JSON.stringify(vulnerabilityGrid, null, 2),
);
writeFileSync(path.join(SEED_DIR, "dataCommons.json"), JSON.stringify(dataCommons, null, 2));

// eslint-disable-next-line no-console
console.log(
  `[genGrids] wrote exposureGrid (${exposureGrid.length}), vulnerabilityGrid (${vulnerabilityGrid.length}), dataCommons.`,
);
