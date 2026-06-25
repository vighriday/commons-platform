// Validation schema for a live citizen submission (C7 — Zod at the boundary).
//
// `.strict()` rejects any unexpected field (kills mass-assignment). Identity and
// status are NEVER taken from the body — they are server-assigned. Bounds keep a
// pasted-dump / oversized-text out of the pipeline before any model call.
import { z } from "zod";

// HSR Layout ward bounding box (matches src/lib/twinGeo.ts WARD_BBOX) — a submitted
// point must fall inside the ward we model, so a stray global coordinate can't
// land an issue off-map.
const WARD = { latMin: 12.9, latMax: 12.925, lngMin: 77.635, lngMax: 77.655 };

export const SubmitSchema = z
  .object({
    text: z.string().trim().min(8, "Describe the issue (min 8 chars)").max(5000),
    category: z.enum([
      "water",
      "drainage",
      "roads",
      "waste",
      "streetlights",
      "structural",
      "parks",
      "traffic",
      "other",
    ]),
    lat: z.coerce.number().min(WARD.latMin).max(WARD.latMax),
    lng: z.coerce.number().min(WARD.lngMin).max(WARD.lngMax),
  })
  .strict();

export type SubmitInput = z.infer<typeof SubmitSchema>;

// Status-advance body — only the target status is taken from the client; the
// transition's legality, the timestamp, and the note are decided server-side.
export const StatusSchema = z
  .object({
    to: z.enum(["acknowledged", "assigned", "resolved", "recurred"]),
  })
  .strict();

export type StatusInput = z.infer<typeof StatusSchema>;
