import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { createServer as createViteServer } from "vite";

import { config } from "./server/config.ts";
import { geminiPing } from "./server/gemini.ts";
import { logger } from "./server/lib/logger.ts";
import { errorHandler, notFoundHandler } from "./server/middleware/errorHandler.ts";
import { requestId } from "./server/middleware/requestId.ts";
import { securityHeaders } from "./server/middleware/securityHeaders.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Basic security and request utilities
  app.use(requestId);
  app.use(securityHeaders);
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));

  // Basic rate limiter for API routes
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window`
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn({ ip: req.ip, path: req.path }, "rate_limit_exceeded");
      res.status(429).json({ error: "TOO_MANY_REQUESTS" });
    },
  });

  // Apply rate limiter to all API endpoints
  app.use("/api/", apiLimiter);

  // --- API Endpoints ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      service: "commons",
      time: new Date().toISOString(),
    });
  });

  // Smoke test config
  app.get("/api/_smoke", (req, res) => {
    res.json({
      ok: true,
      env: config.nodeEnv,
      geminiConfigured: config.gemini.isConfigured,
      models: config.gemini.models,
    });
  });

  // Gemini Ping end-to-end check
  app.get("/api/gemini-ping", async (req, res) => {
    try {
      if (!config.gemini.isConfigured) {
        res.json({
          ok: false,
          error: "GEMINI_NOT_CONFIGURED",
        });
        return;
      }
      const reply = await geminiPing();
      res.json({
        ok: true,
        model: config.gemini.models.flashLite,
        text: reply,
      });
    } catch (error) {
      const err = error as Error;
      logger.error({ err, requestId: req.requestId }, "api_gemini_ping_failed");
      res.json({
        ok: false,
        error: err.message || "Failed to communicate with Gemini",
      });
    }
  });

  // --- Serve Frontend Application ---

  if (config.nodeEnv !== "production") {
    // Development: Use Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);

    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Production: Serve statically built assets
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  // Error handling middleware
  app.use(notFoundHandler);
  app.use(errorHandler);

  const port = config.port;
  app.listen(port, "0.0.0.0", () => {
    logger.info({ port, env: config.nodeEnv }, "server_started");
  });
}

startServer().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Critical server startup failure:", err);
  process.exit(1);
});
