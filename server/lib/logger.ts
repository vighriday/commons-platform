// Structured JSON logging to stdout. On Cloud Run, stdout is captured by Cloud
// Logging automatically (card-free), and because our production container is
// distroless (no shell), these logs are the ONLY window into a running server —
// so logging is mandatory, not optional.
import pino from "pino";
import { config } from "../config.ts";

export const logger = pino({
  level: config.isProduction ? "info" : "debug",
  // In dev, pretty-print is nice but we avoid the extra dep; raw JSON is fine
  // and matches exactly what Cloud Logging will ingest in production.
  base: { service: "commons" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    // Never let a secret or raw PII reach the logs.
    paths: ["req.headers.authorization", "*.apiKey", "*.GEMINI_API_KEY"],
    remove: true,
  },
});

export type Logger = typeof logger;
