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
  if (res.headersSent) return;

  // Client errors raised by body parsing should NOT surface as 500. A malformed
  // JSON body (entity.parse.failed) is a 400; an over-limit body (entity.too.large)
  // is a 413. These are caused by the request, not a server fault, so we log them
  // at a lower level and return the correct 4xx — a probing client/judge sees a
  // clean validation response, not an internal-error.
  const e = err as { type?: string; status?: number; statusCode?: number };
  if (e?.type === "entity.parse.failed") {
    logger.warn({ requestId: req.requestId, path: req.path }, "malformed_json_body");
    res.status(400).json({ error: "INVALID_JSON", requestId: req.requestId });
    return;
  }
  if (e?.type === "entity.too.large") {
    logger.warn({ requestId: req.requestId, path: req.path }, "body_too_large");
    res.status(413).json({ error: "PAYLOAD_TOO_LARGE", requestId: req.requestId });
    return;
  }
  // A handler that already set a 4xx status on the error object — honour it.
  const status = e?.status ?? e?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    logger.warn({ err, requestId: req.requestId, path: req.path, status }, "client_error");
    res.status(status).json({ error: "BAD_REQUEST", requestId: req.requestId });
    return;
  }

  // A genuine server fault — log fully, return an opaque 500.
  logger.error(
    { err, requestId: req.requestId, path: req.path, method: req.method },
    "unhandled_error",
  );
  res.status(500).json({ error: "INTERNAL", requestId: req.requestId });
};
