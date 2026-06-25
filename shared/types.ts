// COMMONS — shared domain types.
//
// The single source of truth for the data model, imported by both the React
// client and the Node server. Mirrors the Firestore document shapes in
// docs/seed-design.md §3 (plus the audit addendum's agent-I/O fields). Dates are
// ISO strings on the wire (Firestore Timestamps are converted at the boundary).

// ── Enums ──────────────────────────────────────────────────────────────────────
export type Category =
  | "water"
  | "drainage"
  | "roads"
  | "waste"
  | "streetlights"
  | "structural"
  | "parks"
  | "traffic"
  | "other";

export type IssueType = "single" | "synthesis" | "recurrence" | "noise" | "hidden_crisis";

export type Quadrant = "critical" | "noise" | "hidden_crisis" | "monitor";

export type AdminLevel = "ward" | "subdistrict" | "district" | "state";

export type Provenance = "real" | "derived-from-real" | "curated";

// ── Reports ──────────────────────────────────────────────────────────────────
export interface MediaItem {
  type: "photo" | "voice" | "none";
  ref: string | null;
  caption: string | null;
  // Evidence-agent multimodal output (audit D6); null until processed.
  extracted: {
    observedFeatures: string[];
    severitySignal: number; // 1..5 the photo/audio supports
    confidence: number; // 0..1
  } | null;
}

export interface ReportLocation {
  streetLabel: string;
  lat: number;
  lng: number;
  plusCode: string; // 11-char OLC, e.g. "7J4VWJ6V+QF"
  plusCellId: string; // 8-char OLC prefix (~275m cell) — the join key
}

export interface Report {
  reportId: string; // "R041"
  wardId: string; // "blr-174-hsr"
  category: Category;
  text: string;
  createdAt: string; // ISO
  reporterId: string; // "U07"
  location: ReportLocation;
  media: MediaItem[];
  engagement: { upvotes: number; replies: number; viewCount: number };
  alarmIntensity: number; // 0..1 — attention input
  isGenuine: boolean; // trust classifier
  spamScore: number; // 0..1
  embeddingId: string;
  seed: { isSynthetic: true; plantedPatternId: string | null };
}

export interface Reporter {
  id: string; // "U07"
  handle: string; // "HSR_Citizen_Watch"
  displayName: string;
  adminLevel: "citizen" | "verified" | "ngo" | "official";
  adminLevelScore: number; // 0.4 | 0.6 | 0.8 | 1.0
  homeCell: string; // plusCellId
  reportCount: number;
}

export interface Embedding {
  embeddingId: string;
  reportId: string;
  wardId: string;
  model: string; // "gemini-embedding-001"
  dim: number; // 3072 (gemini-embedding-001 default)
  vector: number[];
  precomputed: boolean;
}

// ── Agent handoff (typed, confidence DERIVED not LLM-rated) ──────────────────────
export interface EvidenceRef {
  reportId: string;
  field: string;
  value: string;
  imageUrl?: string; // set on a media:photo row that has a real, servable image
}

export interface AgentHandoff {
  claim: string;
  evidence: EvidenceRef[];
  confidence: number; // 0..1 — derived (see deriveConfidence)
  uncertainty: string; // human-readable caveat
}

// ── Impact factors (each sourced + cited) ───────────────────────────────────────
export interface SeverityFactor {
  row: number; // 1..5
  label: string;
  norm: number; // row / 5
}

export interface ExposureInputs {
  densityNorm: number;
  heightNorm: number;
  changeNorm: number;
}

export interface ExposureFactor {
  value: number; // 0..1
  source: "open_buildings";
  provenance: Provenance;
  inputs: ExposureInputs;
}

export interface VulnInputs {
  deprivationNorm: number;
  floodProneFlag: number;
}

export interface VulnerabilityFactor {
  value: number; // 0..1
  source: "data_commons";
  adminLevel: AdminLevel;
  lowGranularityWarning: boolean;
  provenance: Provenance;
  inputs: VulnInputs;
}

// ── Agent-specific outputs (audit D1/D2/D5) ─────────────────────────────────────
export interface Resolution {
  recommendedActions: string[];
  responsibleDept: string;
  slaDays: number;
  estCostBand: string;
  dependencies: string[];
  effectivenessScore: number; // 0..1
}

export interface Escalation {
  dept: string;
  officialRole: string;
  contact: { phone: string; email: string; portal: string };
  jurisdictionAdminLevel: string;
  citations: string[];
  briefMarkdown: string;
}

export interface Memory {
  priorTitles: string[];
  occurrenceTimeline: { reportId: string; date: string; plusCellId: string }[];
  seasonalPattern: string;
  firstSeen: string; // ISO
  narrative: string;
}

export interface Reversal {
  overruledAttention: boolean;
  attentionRank: number;
  impactRank: number;
  reason: string;
}

// Cross-Report Synthesis — the latent cause a Gemini reasoning pass connects from
// individually-trivial reports that no single reporter could have seen.
export interface SynthesisInsight {
  latentCause: string; // the hidden, connecting cause
  signalChain: string[]; // how each weak report points to it
  whyMissed: string; // why no single report revealed it
}

// ── Lifecycle / accountability tracking ──────────────────────────────────────────
// The status an issue moves through. "recurred" is the accountability beat: an
// issue marked resolved that comes back is not a new incident — it is a systemic
// failure, and tracking it as such is what turns "resolved 5×" into evidence.
export type IssueStatus =
  | "reported" // born from a citizen report, not yet seen by an authority
  | "acknowledged" // an authority has seen it
  | "assigned" // routed to the responsible department, SLA clock running
  | "resolved" // marked fixed
  | "recurred"; // came back after being resolved — feeds the memory agent

// One entry in the audit trail of an issue's lifecycle.
export interface StatusEvent {
  status: IssueStatus;
  at: string; // ISO
  note: string; // human-readable ("Routed to BBMP SWD Division")
  actor: "system" | "authority" | "citizen";
}

// Live accountability state — overlaid on the issue at read time. The SLA clock,
// the corroboration count, and the lifecycle are all computed/mutated at runtime,
// never frozen into the seed.
export interface Tracking {
  status: IssueStatus;
  timeline: StatusEvent[];
  // When the issue entered "assigned" — the moment the SLA clock starts. Null
  // until assigned. slaDays comes from the resolution; overdue is computed live.
  assignedAt: string | null;
  // Crowd corroboration ("I see this too"). Each bump nudges attentionScore live,
  // so the community can push back on — or catch up to — the model's ranking.
  corroborations: number;
  // The attention the issue was BORN with (seed/derived), before any live crowd
  // signal. Lets the UI show "model flagged this before the crowd reacted".
  baselineAttention: number;
}

// AI categorization output — the model's own read of which category a free-text
// (+ photo) report belongs to, with the runner-up it considered. The citizen
// confirms or overrides; the suggestion is shown, never silently applied.
export interface AICategorization {
  suggested: Category;
  confidence: number; // 0..1
  alternative: Category | null;
  reason: string; // one line — why the model chose it
}

// ── Issue (cluster / synthesized output) ────────────────────────────────────────
export interface Issue {
  issueId: string;
  wardId: string;
  type: IssueType;
  title: string;
  plusCellId: string;
  contributingReports: string[];
  category: Category;
  handoff: AgentHandoff;
  severity: SeverityFactor;
  exposure: ExposureFactor;
  vulnerability: VulnerabilityFactor;
  impactScore: number; // 0..100
  attentionScore: number; // 0..1
  quadrant: Quadrant;
  recurrence: { count: number; spanDays: number } | null;
  reversal: Reversal | null;
  resolution: Resolution | null;
  escalation: Escalation | null;
  memory: Memory | null;
  synthesis: SynthesisInsight | null; // set only on synthesis-type clusters
  // Live lifecycle + crowd state, overlaid at read time from the runtime store.
  // Optional so the raw seed/scoring tests don't need to fabricate it.
  tracking?: Tracking;
  createdAt: string; // ISO
}

// ── Agent run (the trace) ───────────────────────────────────────────────────────
export type AgentName =
  | "evidence"
  | "synthesis"
  | "impact"
  | "attention"
  | "hidden_crisis"
  | "resolution"
  | "accountability"
  | "memory";

export type ModelTier = "flash" | "flash-lite" | "gemma";

export interface AgentStep {
  agent: AgentName;
  status: "ok" | "skipped" | "overruled" | "error";
  parallelGroup: string | null; // e.g. "impact-attention" for the 2∥3 fork
  in: unknown;
  out: AgentHandoff | null;
  model: ModelTier;
  ms: number;
  callCount: number;
  cached: boolean;
}

export interface RunReversal {
  issueId: string;
  beforeRanking: string[];
  afterRanking: string[];
  overruledIssueId: string;
  promotedIssueId: string;
  reason: string;
}

export interface AgentRun {
  runId: string;
  wardId: string;
  inputHash: string;
  startedAt: string; // ISO
  finishedAt: string; // ISO
  modelRoute: { agent: AgentName; model: ModelTier }[];
  steps: AgentStep[];
  reversal: RunReversal | null;
  snapshotId: string;
}

// ── Digital Twin + snapshots ────────────────────────────────────────────────────
export interface ExposureGridCell {
  plusCellId: string;
  exposure: number;
  heightSlope: number;
  countSlope: number;
}

export interface TwinDoc {
  wardId: string;
  name: string; // "HSR Layout (BBMP Ward 174)"
  infraHealth: number; // 0..100
  issueVelocity: number; // reports/30d ratio
  issueDensity: number; // issues/plusCell
  engagementIndex: number;
  resolutionEffectiveness: number;
  emergingRisks: string[];
  exposureGrid: ExposureGridCell[];
  lastSnapshotId: string;
}

export interface CivicPulse {
  status: string;
  emergingRisk: string;
  mostIgnoredProblem: string;
  attentionPattern: string;
  civicBlindSpot: string;
  resolutionBottleneck: string;
  priorityRecommendation: string;
  narrative: string;
}

// Building footprints for the Digital Twin — a disclosed-synthetic visual whose
// per-cell count + height are scaled by the real Open Buildings density/height.
export interface Footprint {
  plusCellId: string;
  polygon: [number, number][]; // [lng, lat] ring
  heightM: number;
}
export interface FootprintDoc {
  wardId: string;
  provenance: Provenance;
  source: string;
  count: number;
  footprints: Footprint[];
}

export interface Snapshot {
  wardId: string;
  takenAt: string; // ISO
  quadrantState: {
    issueId: string;
    attentionScore: number;
    impactScore: number;
    quadrant: Quadrant;
  }[];
  twin: TwinDoc;
  summary: CivicPulse;
}
