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
  createdAt: string; // ISO
}

// ── Agent run (the trace) ───────────────────────────────────────────────────────
export type AgentName =
  | "evidence"
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
