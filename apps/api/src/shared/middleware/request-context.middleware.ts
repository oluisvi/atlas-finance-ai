import { Logger } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

const logger = new Logger("HttpRequest");
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;

export function requestContextMiddleware(request: Request, response: Response, next: NextFunction): void {
  const supplied = request.get("x-request-id");
  const requestId = supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : randomUUID();
  const startedAt = process.hrtime.bigint();

  response.setHeader("x-request-id", requestId);
  response.setHeader("cache-control", "private, no-store");
  response.locals.requestId = requestId;
  response.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.log(JSON.stringify({ durationMs: Number(durationMs.toFixed(2)), method: request.method, path: request.originalUrl, requestId, status: response.statusCode }));
  });
  next();
}
