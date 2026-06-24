// COMMONS — deterministic seed corpus generator.
//
// Authors the disclosed-synthetic 18-month corpus for HSR Layout (BBMP Ward 174):
// 96 reports = 12 named planted + 7 noise-pothole + 77 background filler. The
// planted patterns (synthesis, 3 hidden crises, recurrence, noise, dormant
// live-demo chain, trust-spam) are hand-authored verbatim from seed-design §1;
// the rest are templated. SEED=174 → fully reproducible.
//
// Build-time assertions fail the run if any invariant breaks (count, category
// tallies, every plantedPatternId present, planted-cell exposure present).
//
// Writes seed/reports.json + seed/reporters.json. (Issues are derived by the
// agent pipeline; embeddings by genEmbeddings.ts.)
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { cellByKey, PLANTED_CELLS, HSR_CELLS, seededJitter } from "../seed/plusCodes.ts";
import type { Category, Report, Reporter, MediaItem } from "../shared/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.resolve(__dirname, "../seed");
const WARD = "blr-174-hsr";

// ── Deterministic RNG (mulberry32, seeded 174) ──────────────────────────────────
let rngState = 174 >>> 0;
function rng(): number {
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function int(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ── Reporters (22; 3 power reporters) ────────────────────────────────────────────
const REPORTERS: Reporter[] = [
  { id: "U01", handle: "HSR_Citizen_Watch", displayName: "HSR Citizen Watch", adminLevel: "ngo", adminLevelScore: 0.8, homeCell: cellByKey("main27_s1").plusCellId, reportCount: 0 },
  { id: "U02", handle: "AgaraLakeVolunteers", displayName: "Agara Lake Volunteers", adminLevel: "ngo", adminLevelScore: 0.8, homeCell: cellByKey("agara_lake").plusCellId, reportCount: 0 },
  { id: "U03", handle: "Ward174_RWA", displayName: "Ward 174 RWA", adminLevel: "verified", adminLevelScore: 0.6, homeCell: cellByKey("main14_s3").plusCellId, reportCount: 0 },
  ...Array.from({ length: 19 }, (_, i) => ({
    id: `U${String(i + 4).padStart(2, "0")}`,
    handle: `resident_${i + 4}`,
    displayName: `Resident ${i + 4}`,
    adminLevel: "citizen" as const,
    adminLevelScore: 0.4,
    homeCell: HSR_CELLS[i % HSR_CELLS.length].plusCellId,
    reportCount: 0,
  })),
];
const POWER = ["U01", "U02", "U03"];

// ── Helpers ──────────────────────────────────────────────────────────────────────
function iso(date: string): string {
  return new Date(date + (date.length <= 10 ? "T00:00:00.000Z" : "Z")).toISOString();
}
function media(type: "photo" | "voice" | "none", caption: string | null, extracted: MediaItem["extracted"] = null): MediaItem[] {
  return [{ type, ref: type === "none" ? null : `seed/photos/placeholder.svg`, caption, extracted }];
}
function locFor(cellKey: string, reportId: string) {
  const cell = cellByKey(cellKey);
  const j = seededJitter(cell.centroidLat, cell.centroidLng, reportId);
  return {
    streetLabel: cell.streetLabel,
    lat: Math.round(j.lat * 1e6) / 1e6,
    lng: Math.round(j.lng * 1e6) / 1e6,
    plusCode: `${cell.plusCellId}+QC`,
    plusCellId: cell.plusCellId,
  };
}

const reports: Report[] = [];
function add(r: Omit<Report, "wardId" | "embeddingId" | "seed"> & { plantedPatternId?: string | null }): void {
  const { plantedPatternId = null, ...rest } = r;
  reports.push({
    ...rest,
    wardId: WARD,
    embeddingId: `E_${rest.reportId}`,
    seed: { isSynthetic: true, plantedPatternId },
  });
}

// ── 1.1 Synthesis chain (4 reports) ───────────────────────────────────────────────
add({ reportId: "R041", category: "water", text: "Water pressure very low past few days in 27th Main, second tap barely runs in morning.", createdAt: iso("2025-02-11T09:14:00"), reporterId: "U05", location: locFor("main27_s1", "R041"), media: media("none", null), engagement: { upvotes: 1, replies: 0, viewCount: 8 }, alarmIntensity: 0.22, isGenuine: true, spamScore: 0.02, plantedPatternId: "synthesis" });
add({ reportId: "R058", category: "roads", text: "Small depression forming on road near 27th Main / 5th Cross junction, getting bigger.", createdAt: iso("2025-03-26T18:40:00"), reporterId: "U09", location: locFor("main27_s1", "R058"), media: media("photo", "road subsidence near junction", { observedFeatures: ["asphalt depression ~40cm", "edge cracking"], severitySignal: 4, confidence: 0.86 }), engagement: { upvotes: 2, replies: 1, viewCount: 14 }, alarmIntensity: 0.28, isGenuine: true, spamScore: 0.03, plantedPatternId: "synthesis" });
add({ reportId: "R072", category: "water", text: "Brown / rusty water from tap on Tuesday morning, cleared by evening.", createdAt: iso("2025-05-09T07:55:00"), reporterId: "U12", location: locFor("main27_s1", "R072"), media: media("none", null), engagement: { upvotes: 1, replies: 0, viewCount: 6 }, alarmIntensity: 0.25, isGenuine: true, spamScore: 0.02, plantedPatternId: "synthesis" });
add({ reportId: "R086", category: "drainage", text: "Patch of road stays wet even when no rain for 3 days, near the depression.", createdAt: iso("2025-07-02T21:10:00"), reporterId: "U05", location: locFor("main27_s1", "R086"), media: media("none", null), engagement: { upvotes: 0, replies: 0, viewCount: 4 }, alarmIntensity: 0.20, isGenuine: true, spamScore: 0.02, plantedPatternId: "synthesis" });

// ── 1.2 Hidden crises ──────────────────────────────────────────────────────────────
// HC-1 (drainage choke, Agara Lake) — 2 reports
add({ reportId: "R033", category: "drainage", text: "Drain near Agara Lake Rd full of silt and plastic, water not moving.", createdAt: iso("2025-01-19T10:05:00"), reporterId: "U02", location: locFor("agara_lake", "R033"), media: media("photo", "silted storm drain", { observedFeatures: ["silt+plastic occlusion", "stagnant water"], severitySignal: 5, confidence: 0.83 }), engagement: { upvotes: 1, replies: 0, viewCount: 9 }, alarmIntensity: 0.18, isGenuine: true, spamScore: 0.02, plantedPatternId: "hiddenCrisis1" });
add({ reportId: "R077", category: "waste", text: "Garbage dumped in the storm drain again on Agara Lake Rd.", createdAt: iso("2025-05-30T16:20:00"), reporterId: "U14", location: locFor("agara_lake", "R077"), media: media("none", null), engagement: { upvotes: 0, replies: 0, viewCount: 5 }, alarmIntensity: 0.16, isGenuine: true, spamScore: 0.04, plantedPatternId: "hiddenCrisis1" });
// HC-2 (structural crack, Somasundarapalya) — 1 report
add({ reportId: "R064", category: "structural", text: "Crack running up the wall of the building near Somasundarapalya Main Rd, getting longer.", createdAt: iso("2025-04-15T08:30:00"), reporterId: "U17", location: locFor("somasundara", "R064"), media: media("photo", "diagonal wall crack", { observedFeatures: ["diagonal crack", ">3mm width", "load-bearing wall"], severitySignal: 5, confidence: 0.81 }), engagement: { upvotes: 0, replies: 0, viewCount: 7 }, alarmIntensity: 0.20, isGenuine: true, spamScore: 0.03, plantedPatternId: "hiddenCrisis2" });
// HC-3 (streetlight blackout, ORR) — 2 reports
add({ reportId: "R049", category: "streetlights", text: "Streetlights off again on ORR service road near bus stop, very dark.", createdAt: iso("2025-02-28T19:50:00"), reporterId: "U11", location: locFor("orr_service", "R049"), media: media("none", null), engagement: { upvotes: 1, replies: 0, viewCount: 10 }, alarmIntensity: 0.22, isGenuine: true, spamScore: 0.02, plantedPatternId: "hiddenCrisis3" });
add({ reportId: "R069", category: "streetlights", text: "Still no streetlights on the ORR service road stretch, unsafe walking at night.", createdAt: iso("2025-04-29T20:15:00"), reporterId: "U19", location: locFor("orr_service", "R069"), media: media("none", null), engagement: { upvotes: 1, replies: 1, viewCount: 12 }, alarmIntensity: 0.22, isGenuine: true, spamScore: 0.02, plantedPatternId: "hiddenCrisis3" });

// ── 1.3 Recurrence chain (3 reports, 14th Main drainage) ────────────────────────────
add({ reportId: "R028", category: "drainage", text: "Drain overflowing onto road at 14th Main 1st Cross, sewage smell.", createdAt: iso("2025-01-08T11:00:00"), reporterId: "U03", location: locFor("main14_s3", "R028"), media: media("none", null), engagement: { upvotes: 3, replies: 1, viewCount: 20 }, alarmIntensity: 0.30, isGenuine: true, spamScore: 0.02, plantedPatternId: "recurrence" });
add({ reportId: "R055", category: "drainage", text: "Same drain at 14th Main overflowing again, third time this season.", createdAt: iso("2025-03-21T17:30:00"), reporterId: "U03", location: locFor("main14_s3", "R055"), media: media("voice", "voice note: drain floods every monsoon, third year now", null), engagement: { upvotes: 4, replies: 2, viewCount: 25 }, alarmIntensity: 0.27, isGenuine: true, spamScore: 0.02, plantedPatternId: "recurrence" });
add({ reportId: "R083", category: "drainage", text: "Drain at 14th Main 1st Cross blocked and overflowing yet again, monsoon starting.", createdAt: iso("2025-06-19T09:40:00"), reporterId: "U08", location: locFor("main14_s3", "R083"), media: media("none", null), engagement: { upvotes: 5, replies: 2, viewCount: 30 }, alarmIntensity: 0.27, isGenuine: true, spamScore: 0.02, plantedPatternId: "recurrence" });

// ── 1.4 Noise pothole cluster (7 reports, loud + trivial) ────────────────────────────
const potholeTexts = [
  "DANGEROUS pothole on 17th Cross Sector 7, almost fell off my scooter!",
  "When will this 17th Cross pothole be fixed?? Reported weeks ago.",
  "Same big pothole on 17th Cross still not repaired, ridiculous.",
  "Pothole on 17th Cross getting worse, cars swerving into oncoming traffic.",
  "17th Cross pothole — third complaint. BBMP please act.",
  "Massive pothole 17th Cross Sector 7, dangerous at night.",
  "Still waiting on the 17th Cross pothole repair. Disappointing.",
];
const potholeIds = ["R047", "R051", "R052", "R060", "R068", "R074", "R081"];
const potholeDates = ["2025-02-20", "2025-03-05", "2025-03-12", "2025-04-02", "2025-04-25", "2025-05-15", "2025-06-08"];
const potholeUpvotes = [12, 9, 7, 8, 6, 5, 4];
potholeIds.forEach((id, i) => {
  add({ reportId: id, category: "roads", text: potholeTexts[i], createdAt: iso(potholeDates[i]), reporterId: i === 0 ? "U01" : pick(REPORTERS.slice(3)).id, location: locFor("cross17_s7", id), media: i === 0 ? media("photo", "pothole on 17th Cross", { observedFeatures: ["pothole ~30cm", "surface only"], severitySignal: 2, confidence: 0.78 }) : media("none", null), engagement: { upvotes: potholeUpvotes[i], replies: int(1, 4), viewCount: int(40, 90) }, alarmIntensity: 0.78 + rng() * 0.08, isGenuine: true, spamScore: 0.03, plantedPatternId: "noise" });
});

// ── Dormant live-demo chain (2 reports; judge's upload completes to 3) ───────────────
add({ reportId: "R090", category: "drainage", text: "Drain blocked near 100ft Road, water pooling on the road edge.", createdAt: iso("2026-04-12T10:00:00"), reporterId: "U07", location: locFor("road100ft", "R090"), media: media("none", null), engagement: { upvotes: 2, replies: 0, viewCount: 12 }, alarmIntensity: 0.28, isGenuine: true, spamScore: 0.02, plantedPatternId: "liveDemo" });
add({ reportId: "R093", category: "drainage", text: "Same 100ft Road drain overflowing again after light rain.", createdAt: iso("2026-05-18T14:30:00"), reporterId: "U10", location: locFor("road100ft", "R093"), media: media("none", null), engagement: { upvotes: 3, replies: 1, viewCount: 16 }, alarmIntensity: 0.30, isGenuine: true, spamScore: 0.02, plantedPatternId: "liveDemo" });

// ── Trust-spam reports (filtered out of clustering) ──────────────────────────────────
add({ reportId: "R095", category: "other", text: "Best plumbing service in HSR!! Call 99999 99999 for 50% off!!!", createdAt: iso("2026-03-02T13:00:00"), reporterId: "U20", location: locFor("bda_complex", "R095"), media: media("none", null), engagement: { upvotes: 0, replies: 0, viewCount: 3 }, alarmIntensity: 0.40, isGenuine: false, spamScore: 0.92, plantedPatternId: "spam" });
add({ reportId: "R096", category: "other", text: "asdf test test ignore", createdAt: iso("2026-02-14T09:00:00"), reporterId: "U21", location: locFor("bda_park", "R096"), media: media("none", null), engagement: { upvotes: 0, replies: 0, viewCount: 1 }, alarmIntensity: 0.10, isGenuine: false, spamScore: 0.75, plantedPatternId: "spam" });

// ── 77 background filler reports ──────────────────────────────────────────────────
// Locked distribution totals 96 across the 8 real categories. The 2 trust-spam
// reports are category 'other' (outside the 8), so to keep the corpus at exactly
// 96 we hold 2 slots for them by trimming the two largest filler categories by 1
// each (roads 26→25, drainage 16→15). Net: 94 real-category + 2 other = 96.
const TARGET: Record<Category, number> = { roads: 25, water: 14, drainage: 15, waste: 13, streetlights: 11, structural: 6, parks: 5, traffic: 5, other: 0 };
const used: Record<string, number> = {};
for (const r of reports) used[r.category] = (used[r.category] ?? 0) + 1;
// 'other' is only the 2 planted spam reports; add no filler 'other'.
TARGET.other = used.other ?? 0;

const fillerPhrases: Record<Category, string[]> = {
  roads: ["Pothole near {s}.", "Road surface cracking on {s}.", "Uneven patch repair on {s}.", "Speed bump worn out near {s}."],
  water: ["Low water pressure on {s}.", "Tap water muddy on {s} this week.", "Pipe leak on the footpath at {s}.", "No water supply since morning on {s}."],
  drainage: ["Drain slow to clear on {s}.", "Minor water pooling at {s}.", "Drain cover loose near {s}.", "Blocked gutter on {s}."],
  waste: ["Garbage not collected on {s}.", "Bin overflowing at {s}.", "Litter piling near {s}.", "Mixed waste dumped at {s}."],
  streetlights: ["One streetlight out on {s}.", "Flickering light near {s}.", "Dark patch on {s} at night.", "Streetlight pole leaning on {s}."],
  structural: ["Cracked compound wall near {s}.", "Loose plaster on culvert at {s}.", "Damaged footpath slab on {s}."],
  parks: ["Overgrown bushes in park near {s}.", "Broken bench at {s} park.", "Dead tree branch over path at {s}."],
  traffic: ["Faded zebra crossing at {s}.", "Missing signboard near {s}.", "Signal timing too short at {s}."],
  other: ["General concern reported near {s}."],
};

const bgCells = HSR_CELLS.filter(
  (c) => ![PLANTED_CELLS.synthesis, PLANTED_CELLS.hiddenCrisis1, PLANTED_CELLS.hiddenCrisis2, PLANTED_CELLS.hiddenCrisis3, PLANTED_CELLS.recurrence, PLANTED_CELLS.noise, PLANTED_CELLS.liveDemo].map((k) => cellByKey(k).plusCellId).includes(c.plusCellId),
);
const months = ["2024-12", "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
// monsoon weighting (Jun–Oct)
function weightedMonth(): string {
  const monsoon = ["2025-06", "2025-07", "2025-08", "2025-09", "2025-10"];
  return rng() < 0.32 ? pick(monsoon) : pick(months);
}

let fillerId = 100;
const cats = Object.keys(TARGET) as Category[];
for (const cat of cats) {
  const need = TARGET[cat] - (used[cat] ?? 0);
  for (let i = 0; i < need; i++) {
    const cell = pick(bgCells);
    const id = `RB${fillerId++}`;
    const month = weightedMonth();
    const day = String(int(1, 28)).padStart(2, "0");
    const phrase = pick(fillerPhrases[cat]).replace("{s}", cell.streetLabel);
    const isPower = rng() < 0.3;
    add({
      reportId: id,
      category: cat,
      text: phrase,
      createdAt: iso(`${month}-${day}T${String(int(7, 21)).padStart(2, "0")}:00:00`),
      reporterId: isPower ? pick(POWER) : pick(REPORTERS.slice(3)).id,
      location: locFor(cell.key, id),
      media: rng() < 0.25 ? media("photo", phrase, null) : media("none", null),
      engagement: { upvotes: int(0, 6), replies: int(0, 3), viewCount: int(3, 40) },
      alarmIntensity: Math.round((0.2 + rng() * 0.5) * 100) / 100,
      isGenuine: true,
      spamScore: Math.round(rng() * 0.1 * 100) / 100,
      plantedPatternId: null,
    });
  }
}

// ── Finalize: sort chronological, renumber reporter counts ──────────────────────────
reports.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
for (const r of reports) {
  const rep = REPORTERS.find((x) => x.id === r.reporterId);
  if (rep) rep.reportCount++;
}

// ── BUILD-TIME ASSERTIONS (fail loud) ────────────────────────────────────────────────
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    // eslint-disable-next-line no-console
    console.error(`[genSeed] ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
}
assert(reports.length === 96, `expected 96 reports, got ${reports.length}`);
const tally: Record<string, number> = {};
for (const r of reports) tally[r.category] = (tally[r.category] ?? 0) + 1;
for (const cat of ["roads", "water", "drainage", "waste", "streetlights", "structural", "parks", "traffic"] as Category[]) {
  assert(tally[cat] === TARGET[cat], `category ${cat}: expected ${TARGET[cat]}, got ${tally[cat] ?? 0}`);
}
assert((tally.other ?? 0) === 2, `expected 2 'other' (spam), got ${tally.other ?? 0}`);
const plantedIds = new Set(reports.map((r) => r.seed.plantedPatternId).filter(Boolean));
for (const p of ["synthesis", "hiddenCrisis1", "hiddenCrisis2", "hiddenCrisis3", "recurrence", "noise", "liveDemo", "spam"]) {
  assert(plantedIds.has(p), `missing planted pattern: ${p}`);
}
// every report's plusCell exists in the exposure grid
const expGrid = JSON.parse(readFileSync(path.join(SEED_DIR, "exposureGrid.json"), "utf8")) as { plusCellId: string }[];
const gridCells = new Set(expGrid.map((c) => c.plusCellId));
for (const r of reports) {
  assert(gridCells.has(r.location.plusCellId), `report ${r.reportId} cell ${r.location.plusCellId} missing from exposureGrid`);
}

// ── Write ──────────────────────────────────────────────────────────────────────────
mkdirSync(SEED_DIR, { recursive: true });
writeFileSync(path.join(SEED_DIR, "reports.json"), JSON.stringify(reports, null, 2));
writeFileSync(path.join(SEED_DIR, "reporters.json"), JSON.stringify(REPORTERS, null, 2));

// eslint-disable-next-line no-console
console.log(`[genSeed] OK — wrote ${reports.length} reports, ${REPORTERS.length} reporters. Category tally:`, tally);
