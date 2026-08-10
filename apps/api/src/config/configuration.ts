import { registerAs } from "@nestjs/config";

import type { NodeEnvironment } from "./app-config.types.js";

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export const appConfig = registerAs("app", () => ({
  apiPrefix: process.env.API_PREFIX ?? "api",
  apiVersion: process.env.API_VERSION ?? "1",
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? "256kb",
  nodeEnv: (process.env.NODE_ENV ?? "development") as NodeEnvironment,
  port: Number.parseInt(process.env.API_PORT ?? "3000", 10),
  swaggerEnabled: process.env.SWAGGER_ENABLED === undefined
    ? (process.env.NODE_ENV ?? "development") !== "production"
    : process.env.SWAGGER_ENABLED === "true",
  urlEncodedBodyLimit: process.env.URLENCODED_BODY_LIMIT ?? "64kb"
}));

export const databaseConfig = registerAs("database", () => ({
  directUrl: process.env.DIRECT_URL,
  poolMax: Number.parseInt(process.env.DATABASE_POOL_MAX ?? "10", 10),
  url: process.env.DATABASE_URL ?? ""
}));

export const authConfig = registerAs("auth", () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET ?? "",
  accessTtl: process.env.JWT_ACCESS_TTL ?? process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  audience: process.env.JWT_AUDIENCE ?? "atlas-finance-ai",
  issuer: process.env.JWT_ISSUER ?? "atlas-finance-ai",
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? "",
  refreshTtl: process.env.JWT_REFRESH_TTL ?? process.env.JWT_REFRESH_EXPIRES_IN ?? "30d"
}));

export const throttlingConfig = registerAs("throttling", () => ({
  defaultLimit: Number.parseInt(process.env.RATE_LIMIT_DEFAULT ?? "120", 10),
  defaultTtlMs: 60_000
}));
