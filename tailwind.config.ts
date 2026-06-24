import type { Config } from "tailwindcss";

// COMMONS design system — a calm, high-contrast "civic command center".
// Dark surface, restrained ink, and four semantic accents that map directly
// onto the four quadrants of the Attention-vs-Impact matrix so the product's
// core idea is legible in the colour language itself.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Surfaces
        surface: {
          DEFAULT: "#0b0f14", // app background
          raised: "#121821", // cards
          overlay: "#1a2330", // popovers / drawers
        },
        ink: {
          DEFAULT: "#e6edf3", // primary text
          muted: "#9bb0c3", // secondary text
          faint: "#5d7184", // tertiary / labels
        },
        line: "#1f2a37", // hairline borders
        // Quadrant semantics (Attention × Impact)
        critical: "#ff5c5c", // high attention + high impact
        hidden: "#f5a623", // low attention + high impact (the Hidden Crisis)
        noise: "#6b7c93", // high attention + low impact
        monitor: "#3ea6ff", // low attention + low impact
        // Brand
        brand: {
          DEFAULT: "#3ddc97",
          dim: "#2bbd80",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
} satisfies Config;
