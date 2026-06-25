// Build-time: generate building-footprint polygons for the Digital Twin.
//
// Each ~275 m Plus Code cell gets a cluster of footprints whose COUNT scales with
// the cell's real densityNorm and whose HEIGHT scales with its real heightNorm
// (both from the Open Buildings 2.5D exposure grid). So the 3D ward reads as an
// actual built-up neighbourhood — denser and taller exactly where the real
// exposure data says it is. The footprints themselves are a disclosed-synthetic
// visual derived from the real per-cell density/height signal (provenance:
// derived-from-real), generated deterministically so the seed stays byte-stable.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CELL_CENTROIDS, CELL_HALF_DEG } from "../src/lib/twinGeo.ts";

interface ExposureCell {
  plusCellId: string;
  densityNorm: number;
  heightNorm: number;
}
interface Footprint {
  plusCellId: string;
  polygon: [number, number][]; // [lng, lat] ring
  heightM: number;
}

const SEED_DIR = path.resolve(process.cwd(), "seed");

// A tiny deterministic PRNG (mulberry32) seeded per cell, so the output is
// identical on every run — no Math.random (which is also blocked at runtime).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable integer seed from a cell id (so each cell's cluster is fixed).
function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// One rotated rectangle footprint around (cx,cy), sized in degrees.
function rect(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rot: number,
): [number, number][] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const corners: [number, number][] = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];
  return corners.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

function main(): void {
  const grid = JSON.parse(
    readFileSync(path.join(SEED_DIR, "exposureGrid.json"), "utf8"),
  ) as ExposureCell[];

  const footprints: Footprint[] = [];

  for (const cell of grid) {
    const ctr = CELL_CENTROIDS[cell.plusCellId];
    if (!ctr) continue;
    const rng = mulberry32(seedOf(cell.plusCellId));

    // Count scales with density: a sparse cell ~8 buildings, a dense one ~40.
    const count = Math.round(8 + cell.densityNorm * 32);
    // Footprint size in degrees (~8–18 m); height from the cell's heightNorm.
    for (let i = 0; i < count; i++) {
      // Scatter within the cell, biased toward the centre.
      const r = CELL_HALF_DEG * 0.92 * Math.sqrt(rng());
      const theta = rng() * Math.PI * 2;
      const cx = ctr.lng + r * Math.cos(theta);
      const cy = ctr.lat + r * Math.sin(theta);
      const w = 0.00008 + rng() * 0.0001; // ~9–20 m
      const h = 0.00008 + rng() * 0.0001;
      const rot = rng() * Math.PI;
      // Height: 6 m base + up to ~40 m, scaled by the cell's heightNorm + jitter.
      const heightM = Math.round(6 + cell.heightNorm * 38 * (0.6 + rng() * 0.4));
      footprints.push({ plusCellId: cell.plusCellId, polygon: rect(cx, cy, w, h, rot), heightM });
    }
  }

  const out = {
    wardId: "blr-174-hsr",
    provenance: "derived-from-real",
    source: "synthetic footprints scaled by OpenBuildings 2.5D density/height per cell",
    count: footprints.length,
    footprints,
  };
  const file = path.join(SEED_DIR, "footprints.json");
  writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  // eslint-disable-next-line no-console
  console.log(`wrote ${footprints.length} footprints across ${grid.length} cells → ${file}`);
}

main();
