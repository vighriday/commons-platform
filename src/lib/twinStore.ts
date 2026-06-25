// COMMONS — shared view + cross-navigation state.
//
// A tiny Zustand store that owns which main view is showing and the cross-wire
// focus (the cell to fly the Twin to + the date to set the Time Machine to).
// Quadrant / IssueDrawer WRITE focus via setFocus; DigitalTwin / TimeMachine
// READ it. Keeping this in a store (not prop-drilling through App) lets a click
// in the Matrix view drive two sibling views at once.
import { create } from "zustand";
import type { AICategorization, SubmitResult } from "./api.ts";

export type View = "matrix" | "trace" | "twin" | "time" | "submit";

// The Submit form's draft, lifted into the store so it survives tab switches
// (SubmitView unmounts when another view shows; local useState would reset). Held
// in memory only — the photo File and the last result ride along as live object
// references. Cleared explicitly when the user resets the form.
export interface SubmitDraft {
  text: string;
  category: string;
  lat: number;
  lng: number;
  photo: File | null;
  suggest: AICategorization | null;
  result: SubmitResult | null;
}

interface TwinState {
  view: View;
  focusCellId: string | null; // plusCellId the Twin should fly to
  focusDateISO: string | null; // date the Time Machine should scrub to
  setView: (v: View) => void;
  // Focus an issue on the map + timeline and switch to the Twin view.
  focusIssue: (plusCellId: string, dateISO: string | null) => void;
  clearFocus: () => void;
  // Submit-form persistence (survives tab switches).
  submitDraft: SubmitDraft | null;
  setSubmitDraft: (patch: Partial<SubmitDraft>) => void;
  resetSubmitDraft: () => void;
}

const EMPTY_DRAFT: SubmitDraft = {
  text: "",
  category: "drainage",
  lat: 0,
  lng: 0,
  photo: null,
  suggest: null,
  result: null,
};

export const useTwinStore = create<TwinState>((set) => ({
  view: "matrix",
  focusCellId: null,
  focusDateISO: null,
  setView: (view) => set({ view }),
  focusIssue: (focusCellId, focusDateISO) => set({ focusCellId, focusDateISO, view: "twin" }),
  clearFocus: () => set({ focusCellId: null, focusDateISO: null }),
  submitDraft: null,
  setSubmitDraft: (patch) =>
    set((s) => ({ submitDraft: { ...(s.submitDraft ?? EMPTY_DRAFT), ...patch } })),
  resetSubmitDraft: () => set({ submitDraft: null }),
}));
