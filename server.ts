// COMMONS server entry.
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
//
// Lives at the repo root and binds 0.0.0.0:$PORT to match the Google AI Studio /
// Cloud Run runtime contract.
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import express from "express";
import compression from "compression";
import { config } from "./server/config.ts";
import { logger } from "./server/lib/logger.ts";
import { securityHeaders } from "./server/middleware/securityHeaders.ts";
import { requestId } from "./server/middleware/requestId.ts";
import { errorHandler, notFoundHandler } from "./server/middleware/errorHandler.ts";
import { geminiPing } from "./server/gemini.ts";
import { data } from "./server/data.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();

  // Cloud Run sits behind a proxy; trust it so req.ip is the real client.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // Order matters: security headers first, then ids, then body/compression.
  app.use(securityHeaders);
  app.use(requestId);
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));

  // ── API ──────────────────────────────────────────────────────────────────
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
      res
        .status(502)
        .json({ ok: false, error: "GEMINI_CALL_FAILED", requestId: req.requestId });
    }
  });

  // Issues — the Attention×Impact issue set.
  api.get("/issues", (_req, res) => {
    res.json({ ward: data.ward, issues: data.listIssues() });
  });

  api.get("/issues/:id", (req, res) => {
    const issue = data.getIssue(req.params.id);
    if (!issue) {
      res.status(404).json({ error: "ISSUE_NOT_FOUND", requestId: req.requestId });
      return;
    }
    res.json(issue);
  });

  // Neighborhood — the Digital Twin + Civic Pulse for a ward.
  api.get("/neighborhood/:ward", (req, res) => {
    if (req.params.ward !== data.ward) {
      res.status(404).json({ error: "WARD_NOT_FOUND", requestId: req.requestId });
      return;
    }
    res.json(data.getNeighborhood());
  });

  app.use("/api", api);

  // ── Frontend ───────────────────────────────────────────────────────────────
  if (config.isProduction) {
    // Production: serve the statically built client from dist/.
    const dist = path.resolve(__dirname, "dist");
    app.use(express.static(dist));
    app.use("/api", notFoundHandler);
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(dist, "index.html"));
    });
  } else {
    // Development: mount Vite as middleware so the client + API share one origin
    // (mirrors the production same-origin posture). Vite is imported lazily so it
    // is never bundled into the production server.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
    app.use("/api", notFoundHandler);
    app.use(/^(?!\/api).*/, async (req, res, next) => {
      try {
        const template = await vite.transformIndexHtml(
          req.originalUrl,
          fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8"),
        );
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  // ── Error handling (last) ────────────────────────────────────────────────────
  app.use(errorHandler);

  // ── Boot + graceful shutdown ─────────────────────────────────────────────────
  const server = app.listen(config.port, "0.0.0.0", () => {
    logger.info(
      {
        port: config.port,
        env: config.nodeEnv,
        geminiConfigured: config.gemini.isConfigured,
      },
      "server_started",
    );
  });

  function shutdown(signal: string) {
    logger.info({ signal }, "shutdown_requested");
    server.close(() => {
      logger.info("server_closed");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  logger.error({ err }, "server_failed_to_start");
  process.exit(1);
});
