// COMMONS — category → responsible civic authority map (Bengaluru / BBMP).
//
// These are AUDITABLE FACTS, not model output: which department owns which class
// of civic issue, its jurisdiction level, SLA, and escalation contact. The
// Accountability and Resolution agents read this map deterministically; the model
// only drafts the prose brief AROUND these fixed facts. Sources: BBMP department
// structure + the parastatal utilities (BWSSB water/sewage, BESCOM electricity).
// Contacts are the published public grievance channels (not personal numbers).
import type { Category } from "../shared/types.ts";

export interface Authority {
  dept: string; // the owning department / body
  officialRole: string; // the role a brief is addressed to
  contact: { phone: string; email: string; portal: string };
  jurisdictionAdminLevel: string; // ward | zone | city | utility
  slaDays: number; // published / typical resolution SLA
  costBand: string; // rough remediation cost band
  citations: string[]; // what the routing is grounded in
}

// BBMP = Bruhat Bengaluru Mahanagara Palike (the city corporation).
// BWSSB = Bangalore Water Supply and Sewerage Board (water + sewerage).
// BESCOM = Bangalore Electricity Supply Company (power + street lighting).
export const AUTHORITY_MAP: Record<Category, Authority> = {
  drainage: {
    dept: "BBMP Storm Water Drain (SWD) Division",
    officialRole: "Executive Engineer, SWD",
    contact: { phone: "080-22660000", email: "swd@bbmp.gov.in", portal: "https://bbmp.gov.in" },
    jurisdictionAdminLevel: "zone",
    slaDays: 15,
    costBand: "₹2L–₹10L",
    citations: [
      "BBMP SWD owns stormwater drains and desilting",
      "Ward 174 falls under BBMP Bommanahalli zone",
    ],
  },
  water: {
    dept: "Bangalore Water Supply & Sewerage Board (BWSSB)",
    officialRole: "Assistant Executive Engineer, BWSSB Sub-division",
    contact: {
      phone: "1916",
      email: "complaints@bwssb.gov.in",
      portal: "https://bwssb.karnataka.gov.in",
    },
    jurisdictionAdminLevel: "utility",
    slaDays: 7,
    costBand: "₹5L–₹25L",
    citations: [
      "BWSSB owns trunk water mains + supply",
      "Trunk-main failure is a parastatal, not BBMP, jurisdiction",
    ],
  },
  structural: {
    dept: "BBMP Town Planning / Technical Vigilance Cell (TVCC)",
    officialRole: "Executive Engineer, BBMP Bommanahalli",
    contact: { phone: "080-22221188", email: "tvcc@bbmp.gov.in", portal: "https://bbmp.gov.in" },
    jurisdictionAdminLevel: "city",
    slaDays: 3,
    costBand: "₹1L–₹50L+",
    citations: [
      "Building safety / load-bearing defects = BBMP TVCC",
      "Life-safety items carry an expedited SLA",
    ],
  },
  streetlights: {
    dept: "BESCOM (Bangalore Electricity Supply Company)",
    officialRole: "Section Officer, BESCOM HSR sub-division",
    contact: {
      phone: "1912",
      email: "feedback@bescom.co.in",
      portal: "https://bescom.karnataka.gov.in",
    },
    jurisdictionAdminLevel: "utility",
    slaDays: 5,
    costBand: "₹20k–₹2L",
    citations: [
      "BESCOM owns street-light feeders + maintenance",
      "Pedestrian-risk blackouts are priority-routed",
    ],
  },
  roads: {
    dept: "BBMP Roads & Infrastructure",
    officialRole: "Assistant Executive Engineer, BBMP Ward 174",
    contact: { phone: "080-22975555", email: "roads@bbmp.gov.in", portal: "https://bbmp.gov.in" },
    jurisdictionAdminLevel: "ward",
    slaDays: 10,
    costBand: "₹50k–₹5L",
    citations: ["Potholes / road surface = BBMP Roads", "Ward-level routine maintenance"],
  },
  waste: {
    dept: "BBMP Solid Waste Management (SWM)",
    officialRole: "Health Inspector, BBMP Ward 174",
    contact: { phone: "080-22975802", email: "swm@bbmp.gov.in", portal: "https://bbmp.gov.in" },
    jurisdictionAdminLevel: "ward",
    slaDays: 2,
    costBand: "₹10k–₹1L",
    citations: ["Garbage / black-spots = BBMP SWM", "Ward-level sanitation"],
  },
  parks: {
    dept: "BBMP Horticulture",
    officialRole: "Assistant Director, BBMP Horticulture",
    contact: {
      phone: "080-23440000",
      email: "horticulture@bbmp.gov.in",
      portal: "https://bbmp.gov.in",
    },
    jurisdictionAdminLevel: "zone",
    slaDays: 20,
    costBand: "₹50k–₹5L",
    citations: ["Parks / greenery = BBMP Horticulture"],
  },
  traffic: {
    dept: "Bengaluru Traffic Police",
    officialRole: "Traffic Inspector, HSR Layout Traffic PS",
    contact: {
      phone: "080-22942222",
      email: "dcptr.east@ksp.gov.in",
      portal: "https://btp.gov.in",
    },
    jurisdictionAdminLevel: "city",
    slaDays: 7,
    costBand: "₹10k–₹2L",
    citations: ["Signals / signage / congestion = Bengaluru Traffic Police"],
  },
  other: {
    dept: "BBMP Ward 174 Office",
    officialRole: "Ward Engineer, BBMP Ward 174",
    contact: { phone: "080-22660000", email: "ward174@bbmp.gov.in", portal: "https://bbmp.gov.in" },
    jurisdictionAdminLevel: "ward",
    slaDays: 14,
    costBand: "—",
    citations: ["Unclassified civic issues route to the ward office for triage"],
  },
};

export function authorityFor(category: Category): Authority {
  return AUTHORITY_MAP[category];
}
