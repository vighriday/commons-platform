import type { RequestHandler } from "express";
// Security headers, including a Content-Security-Policy tuned for COMMONS.
//
// The CSP is deliberately explicit rather than helmet's defaults, because the
// map layer (MapLibre + deck.gl) needs blob: workers and WASM, and the tiles
// come from a specific CDN. Gemini is intentionally ABSENT from connect-src —
// the browser never calls Gemini directly; all model calls go through our server.
//
// Dev vs prod: in development Vite serves the app via middleware and needs an
// inline preamble script + an HMR websocket, and the page is plain http on
// localhost. Those relaxations are gated to dev ONLY — the deployed (prod) CSP
// stays strict (no 'unsafe-inline' script, no ws:, HTTPS upgraded).
import helmet from "helmet";

// CARTO basemap CDN used by the card-free MapLibre style. Adjust here if the
// basemap source changes — this is the single place tile origins are allowed.
const TILE_CDN = "https://*.basemaps.cartocdn.com";

const isDev = process.env.NODE_ENV !== "production";

// Vite dev injects an inline React-Refresh preamble and opens an HMR websocket.
const devScriptSrc = isDev ? ["'unsafe-inline'"] : [];
const devConnectSrc = isDev ? ["ws://localhost:*", "http://localhost:*"] : [];

const helmetHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      // deck.gl / MapLibre spin up blob: workers and use WASM. Dev adds the
      // inline Vite preamble (stripped in prod).
      scriptSrc: ["'self'", "blob:", ...devScriptSrc],
      workerSrc: ["'self'", "blob:"],
      // MapLibre injects inline styles for the canvas.
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", TILE_CDN],
      fontSrc: ["'self'"],
      // Same-origin API + map tiles. Gemini is server-side only, NOT listed.
      // Dev adds the HMR websocket (stripped in prod).
      connectSrc: ["'self'", TILE_CDN, ...devConnectSrc],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      // Only force HTTPS in prod — localhost dev is plain http.
      ...(isDev ? {} : { upgradeInsecureRequests: [] }),
    },
  },
  // Cloud Run terminates TLS; instruct browsers to stick to HTTPS.
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  // X-Content-Type-Options: nosniff, X-Frame-Options, etc. come from helmet.
});

// helmet does not set Permissions-Policy. COMMONS needs none of the powerful
// browser features (camera, mic, geolocation, payment, USB, …), so deny them all
// — defence-in-depth that shrinks the attack surface of any injected/embedded
// content. Wrap helmet so both run in order.
export const securityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()",
  );
  helmetHeaders(req, res, next);
};
