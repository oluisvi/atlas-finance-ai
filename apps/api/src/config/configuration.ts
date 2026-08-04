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
  nodeEnv: (process.env.NODE_ENV ?? "development") as NodeEnvironment,
  port: Number.parseInt(process.env.API_PORT ?? "3000", 10)
}));

export const databaseConfig = registerAs("database", () => ({
  directUrl: process.env.DIRECT_URL,
  poolMax: Number.parseInt(process.env.DATABASE_POOL_MAX ?? "10", 10),
  url: process.env.DATABASE_URL ?? ""
}));
