// COMMONS server entry.
//
// Serves the built React SPA and a same-origin /api surface:
//   GET /api/health             — liveness
//   GET /api/_smoke              — config echo
//   GET /api/gemini-ping        — proves the server-side Gemini key works
//   GET /api/issues             — the Attention×Impact issue set
//   GET /api/issues/:id         — one issue (auditable breakdown)
//   GET /api/neighborhood/:ward — Digital Twin + Civic Pulse
//
// Security headers, request ids, structured logging, error hygiene, rate
// limiting, and graceful shutdown are wired in. Binds 0.0.0.0:$PORT and resolves
// static paths from process.cwd() to match the Cloud Run / AI Studio runtime.
import fs from "node:fs";
import path from "node:path";
import compression from "compression";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { buildAgentCard } from "./server/agentCard.ts";
import { config } from "./server/config.ts";
import { data } from "./server/data.ts";
import { geminiPing, geminiUsage } from "./server/gemini.ts";
import { logger } from "./server/lib/logger.ts";
import { errorHandler, notFoundHandler } from "./server/middleware/errorHandler.ts";
import { requestId } from "./server/middleware/requestId.ts";
import { securityHeaders } from "./server/middleware/securityHeaders.ts";

// The request's own origin (scheme + host), trusting the Cloud Run proxy headers
// so the A2A card advertises the public URL, not the internal container address.
function originOf(req: express.Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol;
  const host = req.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

async function startServer() {
  const app = express();

  // Cloud Run sits behind a proxy; trust it so req.ip is the real client.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // Order: security headers first, then ids, then body/compression.
  app.use(securityHeaders);
  app.use(requestId);
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));

  // Generous rate limit on the API; the demo path is well within it, and abuse
  // (which would burn Gemini quota) is throttled to an IP.
  app.use(
    "/api/",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn({ ip: req.ip, path: req.path }, "rate_limit_exceeded");
        res.status(429).json({ error: "TOO_MANY_REQUESTS", requestId: req.requestId });
      },
    }),
  );

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
      res.status(503).json({ ok: false, error: "GEMINI_NOT_CONFIGURED", requestId: req.requestId });
      return;
    }
    try {
      const text = await geminiPing();
      res.json({ ok: true, model: config.gemini.models.flashLite, text });
    } catch {
      res.status(502).json({ ok: false, error: "GEMINI_CALL_FAILED", requestId: req.requestId });
    }
  });

  api.get("/issues", (_req, res) => {
    res.json({ ward: data.ward, issues: data.listIssues() });
  });

  // Phase 0 raw inputs — the citizen reports that fed the pipeline. The
  // transparency layer shows the chain from raw report → clustered issue → agent.
  api.get("/reports", (_req, res) => {
    res.json({ ward: data.ward, reports: data.listReports() });
  });

  api.get("/issues/:id", (req, res) => {
    const issue = data.getIssue(req.params.id);
    if (!issue) {
      res.status(404).json({ error: "ISSUE_NOT_FOUND", requestId: req.requestId });
      return;
    }
    res.json(issue);
  });

  api.get("/neighborhood/:ward", (req, res) => {
    if (req.params.ward !== data.ward) {
      res.status(404).json({ error: "WARD_NOT_FOUND", requestId: req.requestId });
      return;
    }
    res.json(data.getNeighborhood());
  });

  // The frozen 7-agent trace (Agentic Depth). Served as-is; 0 live model calls.
  api.get("/agent-run", (req, res) => {
    const run = data.getAgentRun();
    if (!run) {
      res.status(404).json({ error: "AGENT_RUN_NOT_FOUND", requestId: req.requestId });
      return;
    }
    res.json(run);
  });

  // Live RPD counter — proves the demo path spends ~0 quota off the frozen cache,
  // and surfaces the Gemma soft-cap state (the RPD-wall fallback).
  api.get("/agent-run/usage", (_req, res) => {
    res.json(geminiUsage());
  });

  // A2A Agent Card (friendly alias). The canonical discovery path is
  // /.well-known/agent.json, registered below before the SPA catch-all.
  api.get("/agent-card", (req, res) => {
    res.json(buildAgentCard(originOf(req)));
  });

  // Digital-Twin building footprints (disclosed-synthetic, density/height scaled
  // from the real Open Buildings exposure grid). 200 with empty list if absent.
  api.get("/footprints/:ward", (req, res) => {
    if (req.params.ward !== data.ward) {
      res.status(404).json({ error: "WARD_NOT_FOUND", requestId: req.requestId });
      return;
    }
    const doc = data.getFootprints();
    res.json(
      doc ?? {
        wardId: data.ward,
        provenance: "derived-from-real",
        source: "",
        count: 0,
        footprints: [],
      },
    );
  });

  // Time Machine snapshots (month-end frames of the quadrant state).
  api.get("/snapshots/:ward", (req, res) => {
    if (req.params.ward !== data.ward) {
      res.status(404).json({ error: "WARD_NOT_FOUND", requestId: req.requestId });
      return;
    }
    res.json({ ward: data.ward, snapshots: data.listSnapshots() });
  });

  app.use("/api", api);

  // Evidence photos (real, EXIF-stripped, CC-licensed) — served read-only so the
  // report drawer can show the actual image the Vision agent analysed.
  app.use(
    "/seed/photos",
    express.static(path.resolve(process.cwd(), "seed/photos"), {
      maxAge: "1d",
      fallthrough: false,
    }),
  );

  // A2A discovery — the canonical well-known path. Must be registered before the
  // SPA catch-all (which would otherwise serve index.html for this path).
  app.get("/.well-known/agent.json", (req, res) => {
    res.json(buildAgentCard(originOf(req)));
  });

  // ── Frontend ───────────────────────────────────────────────────────────────
  // Paths resolved from process.cwd() (the container working dir) for reliable
  // resolution regardless of how the server module is bundled/run.
  if (config.isProduction) {
    const dist = path.resolve(process.cwd(), "dist");
    app.use(express.static(dist));
    app.use("/api", notFoundHandler);
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(dist, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "custom" });
    app.use(vite.middlewares);
    app.use("/api", notFoundHandler);
    app.use(/^(?!\/api).*/, async (req, res, next) => {
      try {
        const template = await vite.transformIndexHtml(
          req.originalUrl,
          fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8"),
        );
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  app.use(errorHandler);

  const server = app.listen(config.port, "0.0.0.0", () => {
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
    setTimeout(() => process.exit(1), 10_000).unref();
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  logger.error({ err }, "server_failed_to_start");
  process.exit(1);
});
