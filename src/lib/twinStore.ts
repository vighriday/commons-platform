// COMMONS — shared view + cross-navigation state.
//
// A tiny Zustand store that owns which main view is showing and the cross-wire
// focus (the cell to fly the Twin to + the date to set the Time Machine to).
// Quadrant / IssueDrawer WRITE focus via setFocus; DigitalTwin / TimeMachine
// READ it. Keeping this in a store (not prop-drilling through App) lets a click
// in the Matrix view drive two sibling views at once.
import { create } from "zustand";

export type View = "matrix" | "trace" | "twin" | "time" | "submit";

interface TwinState {
  view: View;
  focusCellId: string | null; // plusCellId the Twin should fly to
  focusDateISO: string | null; // date the Time Machine should scrub to
  setView: (v: View) => void;
  // Focus an issue on the map + timeline and switch to the Twin view.
  focusIssue: (plusCellId: string, dateISO: string | null) => void;
  clearFocus: () => void;
}

export const useTwinStore = create<TwinState>((set) => ({
  view: "matrix",
  focusCellId: null,
  focusDateISO: null,
  setView: (view) => set({ view }),
  focusIssue: (focusCellId, focusDateISO) => set({ focusCellId, focusDateISO, view: "twin" }),
  clearFocus: () => set({ focusCellId: null, focusDateISO: null }),
}));
