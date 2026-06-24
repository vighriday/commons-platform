// Security headers, including a Content-Security-Policy tuned for COMMONS.
//
// The CSP is deliberately explicit rather than helmet's defaults, because the
// map layer (MapLibre + deck.gl) needs blob: workers and WASM, and the tiles
// come from a specific CDN. Gemini is intentionally ABSENT from connect-src —
// the browser never calls Gemini directly; all model calls go through our server.
import helmet from "helmet";
import type { RequestHandler } from "express";

// CARTO basemap CDN used by the card-free MapLibre style. Adjust here if the
// basemap source changes — this is the single place tile origins are allowed.
const TILE_CDN = "https://*.basemaps.cartocdn.com";

export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      // deck.gl / MapLibre spin up blob: workers and use WASM.
      scriptSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"],
      // MapLibre injects inline styles for the canvas.
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", TILE_CDN],
      fontSrc: ["'self'"],
      // Same-origin API + map tiles. Gemini is server-side only, NOT listed.
      connectSrc: ["'self'", TILE_CDN],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  // Cloud Run terminates TLS; instruct browsers to stick to HTTPS.
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  // X-Content-Type-Options: nosniff, X-Frame-Options, etc. come from helmet.
});
