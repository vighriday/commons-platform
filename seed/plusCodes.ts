// COMMONS — Plus Codes (Open Location Code) spine.
//
// Plus Codes are the offline, card-free locality spine. Every report snaps to an
// 11-char code; its 8-char prefix (`plusCellId`, ≈275 m cell) is the join key for
// recurrence, clustering, exposure, and vulnerability. This is a self-contained
// implementation of the OLC algorithm — no API, no key, no quota.
//
// All demo cells are re-derived from real HSR Layout (Bengaluru, BBMP Ward 174)
// coordinates inside bbox 12.900–12.925 N, 77.635–77.655 E (audit B15/C9/C10).

const CODE_ALPHABET = "23456789CFGHJMPQRVWX";
const LATITUDE_MAX = 90;
const LONGITUDE_MAX = 180;
const PAIR_CODE_LENGTH = 10;
const SEPARATOR = "+";
const SEPARATOR_POSITION = 8;
// Resolution of each pair, in degrees: 20, 1, 1/20, 1/400, 1/8000.
const PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025, 0.000125];

function clipLatitude(lat: number): number {
  return Math.min(Math.max(lat, -LATITUDE_MAX), LATITUDE_MAX);
}

function normalizeLongitude(lng: number): number {
  let v = lng;
  while (v < -LONGITUDE_MAX) v += 360;
  while (v >= LONGITUDE_MAX) v -= 360;
  return v;
}

/**
 * Encode a lat/lng to an Open Location Code of the given length (default 11:
 * 10 pair digits + 1 grid refinement is not implemented; 11 here means the
 * standard 10-digit code plus the '+' — sufficient for our ≈14m precision).
 */
export function encode(latitude: number, longitude: number, codeLength = PAIR_CODE_LENGTH): string {
  const len = Math.min(codeLength, PAIR_CODE_LENGTH);
  let lat = clipLatitude(latitude);
  const lng = normalizeLongitude(longitude);
  // Keep the southern-most point in range.
  if (lat === LATITUDE_MAX) lat -= 0.9 * PAIR_RESOLUTIONS[len / 2 - 1];

  let code = "";
  let adjLat = lat + LATITUDE_MAX;
  let adjLng = lng + LONGITUDE_MAX;
  let digit = 0;
  while (digit < len) {
    const placeValue = PAIR_RESOLUTIONS[Math.floor(digit / 2)];
    if (digit % 2 === 0) {
      const value = Math.floor(adjLat / placeValue);
      code += CODE_ALPHABET[value];
      adjLat -= value * placeValue;
    } else {
      const value = Math.floor(adjLng / placeValue);
      code += CODE_ALPHABET[value];
      adjLng -= value * placeValue;
      digit++;
      continue;
    }
    digit++;
  }
  return code.slice(0, SEPARATOR_POSITION) + SEPARATOR + code.slice(SEPARATOR_POSITION);
}

/** The 8-char cell prefix used as the join key (drops the '+' and grid digits). */
export function cellId(latitude: number, longitude: number): string {
  return encode(latitude, longitude).replace(SEPARATOR, "").slice(0, SEPARATOR_POSITION);
}

/** Deterministic jitter of a point within its ≈275m cell, seeded by a string. */
export function seededJitter(lat: number, lng: number, seed: string): { lat: number; lng: number } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r1 = ((h >>> 0) % 1000) / 1000 - 0.5;
  const r2 = (((h >>> 10) >>> 0) % 1000) / 1000 - 0.5;
  // ±0.00125° ≈ ±140 m, keeping the jittered point inside the same ~275m cell.
  return { lat: lat + r1 * 0.0025, lng: lng + r2 * 0.0025 };
}

// ── The HSR Layout cell table (real centroids) ──────────────────────────────────
export interface PlusCell {
  plusCellId: string;
  streetLabel: string;
  centroidLat: number;
  centroidLng: number;
}

// Centroids are real HSR Layout locations, spaced ≥1 cell (~300m) apart so each
// resolves to a DISTINCT plusCellId. plusCellId is COMPUTED from the centroid so
// the spine is internally consistent (encode(centroid) starts with plusCellId).
// `key` is a stable semantic handle the seed generator uses to attach planted
// patterns to a cell without hard-coding the computed OLC string.
const CELL_SEEDS: (Omit<PlusCell, "plusCellId"> & { key: string })[] = [
  { key: "main27_s1", streetLabel: "27th Main, Sector 1", centroidLat: 12.9116, centroidLng: 77.6411 },
  { key: "agara_lake", streetLabel: "Agara Lake Rd", centroidLat: 12.9229, centroidLng: 77.6389 },
  { key: "main14_s3", streetLabel: "14th Main x 1st Cross, Sector 3", centroidLat: 12.9148, centroidLng: 77.6385 },
  { key: "cross17_s7", streetLabel: "17th Cross, Sector 7", centroidLat: 12.9081, centroidLng: 77.6452 },
  { key: "somasundara", streetLabel: "Somasundarapalya Main Rd", centroidLat: 12.9168, centroidLng: 77.6502 },
  { key: "orr_service", streetLabel: "ORR Service Rd (near bus stop)", centroidLat: 12.9205, centroidLng: 77.6475 },
  { key: "main19_s4", streetLabel: "19th Main, Sector 4", centroidLat: 12.9098, centroidLng: 77.6435 },
  { key: "road100ft", streetLabel: "100ft Road", centroidLat: 12.9136, centroidLng: 77.6448 },
  { key: "bda_complex", streetLabel: "BDA Complex Rd", centroidLat: 12.9122, centroidLng: 77.6471 },
  { key: "main5_s6", streetLabel: "5th Main, Sector 6", centroidLat: 12.9092, centroidLng: 77.6418 },
  { key: "main24_s2", streetLabel: "24th Main, Sector 2", centroidLat: 12.9128, centroidLng: 77.6372 },
  { key: "cross9_s5", streetLabel: "9th Cross, Sector 5", centroidLat: 12.9072, centroidLng: 77.6428 },
  { key: "orr_junction", streetLabel: "Outer Ring Road junction", centroidLat: 12.9242, centroidLng: 77.6458 },
  { key: "bda_park", streetLabel: "HSR BDA Park edge", centroidLat: 12.9145, centroidLng: 77.6415 },
];

export const HSR_CELLS: (PlusCell & { key: string })[] = CELL_SEEDS.map((c) => ({
  ...c,
  plusCellId: cellId(c.centroidLat, c.centroidLng),
}));

/** Resolve a semantic cell key to its computed plusCellId. */
export function cellByKey(key: string): PlusCell & { key: string } {
  const cell = HSR_CELLS.find((c) => c.key === key);
  if (!cell) throw new Error(`Unknown cell key: ${key}`);
  return cell;
}

// Semantic mapping of planted patterns → cell keys (the seed generator uses
// these; the actual OLC strings are derived, never hard-coded).
export const PLANTED_CELLS = {
  synthesis: "main27_s1", // failing trunk water main
  hiddenCrisis1: "agara_lake", // stormwater drain choke
  hiddenCrisis2: "somasundara", // structural crack, low-income block
  hiddenCrisis3: "orr_service", // streetlight blackout
  recurrence: "main14_s3", // recurring drainage failure
  noise: "cross17_s7", // loud pothole
  liveDemo: "road100ft", // dormant chain the judge completes
} as const;

/** Find a cell by its computed id. */
export function findCell(id: string): PlusCell | undefined {
  return HSR_CELLS.find((c) => c.plusCellId === id);
}

export const WARD_BBOX = { latMin: 12.9, latMax: 12.925, lngMin: 77.635, lngMax: 77.655 };
