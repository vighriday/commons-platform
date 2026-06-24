// COMMONS server.
//
// Serves the built React SPA and a small same-origin /api surface. In this
// Phase-0 "de-risk" form it exposes three endpoints that prove the deployment
// works end to end:
//   GET /api/health       — liveness, no dependencies
//   GET /api/_smoke        — confirms the server can read its own config
//   GET /api/gemini-ping   — proves the server-side Gemini key works
//
// Security headers, request ids, structured logging, error hygiene, and graceful
// shutdown are wired from the very first commit — not bolted on later.
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import compression from "compression";
import { config } from "./config.ts";
import { logger } from "./lib/logger.ts";
import { securityHeaders } from "./middleware/securityHeaders.ts";
import { requestId } from "./middleware/requestId.ts";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.ts";
import { geminiPing } from "./gemini.ts";

const app = express();

// Cloud Run sits behind a proxy; trust it so req.ip is the real client.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Order matters: security headers first, then ids, then body/compression.
app.use(securityHeaders);
app.use(requestId);
app.use(compression());
app.use(express.json({ limit: "1mb" }));

// ── API ──────────────────────────────────────────────────────────────────────
const api = express.Router();

api.get("/health", (_req, res) => {
  res.json({ ok: true, service: "commons", time: new Date().toISOString() });
});

api.get("/_smoke", (req, res) => {
  res.json({
    ok: true,
    requestId: req.requestId,
    env: config.nodeEnv,
    geminiConfigured: config.gemini.isConfigured,
    models: config.gemini.models,
  });
});

api.get("/gemini-ping", async (req, res) => {
  if (!config.gemini.isConfigured) {
    res.status(503).json({
      ok: false,
      error: "GEMINI_NOT_CONFIGURED",
      requestId: req.requestId,
    });
    return;
  }
  try {
    const text = await geminiPing();
    res.json({ ok: true, model: config.gemini.models.flashLite, text });
  } catch {
    // Detail is logged inside geminiPing; client gets a clean shape.
    res
      .status(502)
      .json({ ok: false, error: "GEMINI_CALL_FAILED", requestId: req.requestId });
  }
});

app.use("/api", api);

// ── Static SPA (production) ────────────────────────────────────────────────────
// In production the built client lives in dist/ and is served from the same
// origin as the API. In development, Vite serves the client and proxies /api here.
if (config.isProduction) {
  const dist = path.resolve(fileURLToPath(new URL("../dist", import.meta.url)));
  app.use(express.static(dist));
  // SPA fallback: anything not under /api returns index.html.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

// ── Error handling (last) ──────────────────────────────────────────────────────
app.use("/api", notFoundHandler);
app.use(errorHandler);

// ── Boot + graceful shutdown ───────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.nodeEnv, geminiConfigured: config.gemini.isConfigured },
    "server_started",
  );
});

function shutdown(signal: string) {
  logger.info({ signal }, "shutdown_requested");
  server.close(() => {
    logger.info("server_closed");
    process.exit(0);
  });
  // Don't hang forever if connections won't drain.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
