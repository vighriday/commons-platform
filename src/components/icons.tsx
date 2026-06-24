// COMMONS icon set — hand-crafted, one consistent stroke weight (1.5px on a
// 24px grid), monochrome (currentColor). These replace every emoji glyph and
// generic icon-library import, per the design language's anti-slop rule:
// "custom hand-crafted SVGs ... 1.5px stroke, 24px grid, never emoji."
//
// All icons share one wrapper so stroke weight, line caps, and grid never drift.
import type { JSX, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

// ── Navigation ──────────────────────────────────────────────────────────────

// Dashboard / the Attention×Impact matrix — a quartered field.
export const IconMatrix = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
    <path d="M12 3.5v17M3.5 12h17" />
  </Icon>
);

// Civic Pulse — a steady civic signal reading.
export const IconPulse = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12h3.5l2-5.5 3 11 2.5-7 1.5 1.5H21" />
  </Icon>
);

// Layers — the digital twin / map stack.
export const IconLayers = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5 21 8l-9 4.5L3 8z" />
    <path d="m3 12 9 4.5L21 12" />
    <path d="m3 16 9 4.5L21 16" />
  </Icon>
);

// Trace — the agent pipeline / run timeline.
export const IconTrace = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6" cy="6" r="2" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="12" r="2" />
    <path d="M6 8v8M8 6h6.5a1.5 1.5 0 0 1 1.5 1.5V10M8 18h6.5a1.5 1.5 0 0 0 1.5-1.5V14" />
  </Icon>
);

// Time — the Time Machine snapshot scrubber.
export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5l3.5 2" />
  </Icon>
);

// ── Semantic / state ────────────────────────────────────────────────────────

// Reversal — attention overruled by impact. A measured rotation, not the ⟲ glyph.
export const IconReversal = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 9a7.5 7.5 0 0 1 13-3.2L20 8" />
    <path d="M20 4v4h-4" />
    <path d="M19.5 15a7.5 7.5 0 0 1-13 3.2L4 16" />
    <path d="M4 20v-4h4" />
  </Icon>
);

// Alert — the vulnerability / low-granularity caveat. Replaces the ⚠ glyph.
export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.5 21 19.5H3z" />
    <path d="M12 10v4.5" />
    <circle cx="12" cy="17.4" r="0.4" fill="currentColor" stroke="none" />
  </Icon>
);

// Escalate — the accountability brief routed up to a named authority.
export const IconEscalate = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20V6" />
    <path d="m6 11 6-6 6 6" />
    <path d="M5 4h14" />
  </Icon>
);

// ── Category icons (report types) ───────────────────────────────────────────

export const IconWater = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5c3.5 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-6 6-10z" />
  </Icon>
);

export const IconDrainage = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
    <path d="M9 4.5 7.5 9.5M15 4.5l-1.5 5M12 14.5 10.5 19.5" />
  </Icon>
);

export const IconRoad = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 20 9.5 4M17 20 14.5 4" />
    <path d="M12 6v2.5M12 11v2.5M12 16v2.5" />
  </Icon>
);

export const IconWaste = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 7h14" />
    <path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
    <path d="M6.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12" />
  </Icon>
);

export const IconLight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5a5.5 5.5 0 0 0-3 10.1V16h6v-2.4a5.5 5.5 0 0 0-3-10.1z" />
    <path d="M10 19h4M10.5 21.5h3" />
  </Icon>
);

export const IconStructural = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V8l8-4.5L20 8v12" />
    <path d="M4 20h16" />
    <path d="M9.5 20v-6h5v6" />
  </Icon>
);

// Resolve a category string to its icon (single source of truth for the mapping).
import type { Category } from "@shared/types.ts";

export const CATEGORY_ICON: Record<Category, (p: IconProps) => JSX.Element> = {
  water: IconWater,
  drainage: IconDrainage,
  roads: IconRoad,
  waste: IconWaste,
  streetlights: IconLight,
  structural: IconStructural,
  parks: IconLayers,
  traffic: IconRoad,
  other: IconAlert,
};
