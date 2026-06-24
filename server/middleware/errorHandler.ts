// Centralized error + 404 handling. Clients never see a stack trace — only a
// stable shape `{ error, requestId }`. The full error goes to the structured
// logs (the only place internals belong).
import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../lib/logger.ts";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: "NOT_FOUND", requestId: req.requestId });
};

// Express identifies an error handler by its four arguments — keep all four.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error(
    { err, requestId: req.requestId, path: req.path, method: req.method },
    "unhandled_error",
  );
  if (res.headersSent) return;
  res.status(500).json({ error: "INTERNAL", requestId: req.requestId });
};
