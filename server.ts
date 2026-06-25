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
import { sanitize } from "./server/ingest/sanitizer.ts";
import { classifyCategory, runLiveSubmit } from "./server/ingest/submitPipeline.ts";
import { photoUpload, processImage } from "./server/ingest/upload.ts";
import { logger } from "./server/lib/logger.ts";
import { errorHandler, notFoundHandler } from "./server/middleware/errorHandler.ts";
import { requestId } from "./server/middleware/requestId.ts";
import { securityHeaders } from "./server/middleware/securityHeaders.ts";
import { StatusSchema, SubmitSchema } from "./server/schemas/submit.ts";
import { persistenceEnabled } from "./server/state/persistence.ts";
import { advanceStatus, corroborate, slaState } from "./server/state/store.ts";

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
      persistence: persistenceEnabled(),
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
    // Attach the live SLA state (overdue computed against the wall clock) so the
    // drawer renders the accountability clock without a second round-trip.
    const sla = slaState(issue, issue.resolution?.slaDays ?? 15);
    res.json({ ...issue, sla });
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

  // ── Live submission (the only Gemini-spending route) ─────────────────────────
  // A citizen submits text + location + an optional photo, and the REAL pipeline
  // runs on the spot. Because each call spends quota, this route carries its own
  // strict per-IP limit on top of the global one (C8), and runs the full guard
  // gauntlet: upload safety (C6) → Zod validation (C7) → injection sanitizer (C2)
  // → the live pipeline (which itself honours the circuit-breaker, C9).
  const submitLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // per hour
    limit: 12, // a demo needs only a few; abuse is throttled to an identity
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn({ ip: req.ip, event: "submit_rate_limit" }, "submit_rate_limited");
      res.status(429).json({ error: "TOO_MANY_SUBMISSIONS", requestId: req.requestId });
    },
  });

  // M4 — GLOBAL daily ceiling on Gemini-spending routes, across ALL clients. The
  // per-IP limiter stops one identity; this stops a distributed swarm from draining
  // the day's free-tier quota before the circuit-breaker (the last resort) trips.
  // A constant well below the RPD soft cap, reset on a rolling 24h window. Keyed on
  // a constant so every request shares one bucket regardless of IP.
  const globalLiveCap = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    limit: 600, // total live-spending calls/day across everyone; demo uses a handful
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: () => "global",
    handler: (req, res) => {
      logger.warn({ event: "global_live_cap" }, "global daily live-call ceiling reached");
      res.status(429).json({ error: "DAILY_LIMIT_REACHED", requestId: req.requestId });
    },
  });

  api.post("/submit", globalLiveCap, submitLimiter, (req, res) => {
    // multer parses multipart (the photo + text fields) within the size caps.
    photoUpload(req, res, async (uploadErr) => {
      if (uploadErr) {
        const code =
          uploadErr.message === "UNSUPPORTED_MEDIA_TYPE"
            ? 415
            : uploadErr.message?.includes("File too large")
              ? 413
              : 400;
        res
          .status(code)
          .json({ error: uploadErr.message ?? "UPLOAD_FAILED", requestId: req.requestId });
        return;
      }
      try {
        // C7 — validate the text fields (strict; identity is never from the body).
        const parsed = SubmitSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: "VALIDATION_FAILED",
            fields: parsed.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
            requestId: req.requestId,
          });
          return;
        }

        // C2 — injection sanitizer. Flagged text is quarantined, not processed.
        const verdict = await sanitize(parsed.data.text);
        // Fail closed: if the screening model was unavailable, do NOT process
        // unscreened text — ask the citizen to retry.
        if (verdict.degraded) {
          res.status(503).json({ error: "SCREENING_UNAVAILABLE", requestId: req.requestId });
          return;
        }
        if (verdict.injectionDetected) {
          res.status(422).json({
            error: "QUARANTINED",
            quarantine: { reason: verdict.reason },
            requestId: req.requestId,
          });
          return;
        }

        // C6 — verify + sanitize the image (sharp re-decode strips EXIF, proves it's
        // really an image). A non-image throws and is reported as 415.
        let image = null;
        const file = (req as express.Request & { file?: { buffer: Buffer } }).file;
        if (file?.buffer) {
          try {
            image = await processImage(file.buffer);
          } catch {
            res.status(415).json({ error: "INVALID_IMAGE", requestId: req.requestId });
            return;
          }
        }

        const result = await runLiveSubmit(parsed.data, image, data.listIssues());
        // Register the born issue so it appears in the matrix and is trackable /
        // corroboratable like any seed issue (lives in the runtime store).
        data.addLiveIssue(result.issue);
        res.json({ ...result, piiNote: verdict.piiPresent ? "PII detected in text" : null });
      } catch (err) {
        logger.error({ err, requestId: req.requestId }, "submit_failed");
        res.status(500).json({ error: "SUBMIT_FAILED", requestId: req.requestId });
      }
    });
  });

  // AI category suggestion for the submit form — runs the classifier on the typed
  // text so the citizen sees "the AI reads this as drainage" before committing. A
  // real Gemini call (spends a little quota), so it shares the submit limiter and
  // sanitises the untrusted text first. Returns null suggestion if the model is off.
  api.post("/classify", globalLiveCap, submitLimiter, async (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (text.length < 8 || text.length > 5000) {
      res.status(400).json({ error: "VALIDATION_FAILED", requestId: req.requestId });
      return;
    }
    const verdict = await sanitize(text);
    if (verdict.injectionDetected) {
      res.status(422).json({
        error: "QUARANTINED",
        quarantine: { reason: verdict.reason },
        requestId: req.requestId,
      });
      return;
    }
    // /classify is a non-blocking hint; if screening is degraded, just return no
    // suggestion (the manual picker still works) rather than running it unscreened.
    if (verdict.degraded) {
      res.json({ suggested: null, confidence: 0, alternative: null, reason: "" });
      return;
    }
    const cat = await classifyCategory(text);
    res.json(cat ?? { suggested: null, confidence: 0, alternative: null, reason: "" });
  });

  // ── Community verification + lifecycle tracking ──────────────────────────────
  // These mutate the runtime overlay (no Gemini spend), so they carry a lighter
  // limit than /submit but are still throttled so a single client can't inflate
  // attention or churn the lifecycle. Identity/timestamp/transition-legality are
  // all server-decided; the body carries only the minimal intent.
  const interactLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 40,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({ error: "TOO_MANY_REQUESTS", requestId: req.requestId }),
  });

  // "I see this too" — a citizen corroborates an issue. Bumps the live attention
  // and reports whether the crowd just crossed into the model's ranking (a Hidden
  // Crisis the AI flagged early, now caught up to by the community).
  api.post("/issues/:id/corroborate", interactLimiter, (req, res) => {
    const issue = data.rawIssue(req.params.id);
    if (!issue) {
      res.status(404).json({ error: "ISSUE_NOT_FOUND", requestId: req.requestId });
      return;
    }
    const r = corroborate(issue);
    res.json({
      issueId: issue.issueId,
      ...r,
      // The reversal context — if the model had this high on impact but low on
      // attention, a corroboration is the crowd validating the AI's early call.
      modelFlaggedEarly: Boolean(issue.reversal?.overruledAttention),
      requestId: req.requestId,
    });
  });

  // Advance an issue's lifecycle by one legal step. Returns the new status, the
  // timeline, and the live SLA state (overdue computed against the wall clock).
  api.post("/issues/:id/status", interactLimiter, (req, res) => {
    const issue = data.rawIssue(req.params.id);
    if (!issue) {
      res.status(404).json({ error: "ISSUE_NOT_FOUND", requestId: req.requestId });
      return;
    }
    const parsed = StatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "VALIDATION_FAILED", requestId: req.requestId });
      return;
    }
    const note =
      parsed.data.to === "assigned"
        ? `Routed to ${issue.resolution?.responsibleDept ?? "the responsible department"}`
        : parsed.data.to === "resolved"
          ? "Marked resolved"
          : parsed.data.to === "recurred"
            ? "Reopened — the problem returned"
            : "Acknowledged by an authority";
    const result = advanceStatus(issue, parsed.data.to, note, "authority");
    if (!result.ok) {
      res
        .status(409)
        .json({ error: "ILLEGAL_TRANSITION", reason: result.reason, requestId: req.requestId });
      return;
    }
    const sla = slaState(issue, issue.resolution?.slaDays ?? 15);
    res.json({
      issueId: issue.issueId,
      status: result.status,
      timeline: result.timeline,
      sla,
      requestId: req.requestId,
    });
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

  // Last-resort safety nets — without these a single stray async throw anywhere in
  // a handler can take down the whole container mid-demo.
  //  • An unhandled REJECTION is logged and swallowed: one failed promise must not
  //    crash a long-running server; the affected request already returned a 500.
  //  • An uncaughtException leaves the process in an unknown state, so we log it and
  //    exit cleanly — Cloud Run then restarts a fresh container (and the disk store
  //    rehydrates), which is safer than serving from a corrupted process.
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "unhandled_rejection");
  });
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "uncaught_exception");
    server.close(() => process.exit(1));
    setTimeout(() => process.exit(1), 5_000).unref();
  });
}

startServer().catch((err) => {
  logger.error({ err }, "server_failed_to_start");
  process.exit(1);
});
