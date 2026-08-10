import type { NodeEnvironment } from "./app-config.types.js";

const allowedNodeEnvironments = new Set<NodeEnvironment>([
  "development",
  "test",
  "staging",
  "production"
]);

type Environment = Record<string, string | undefined>;

function assertPostgresUrl(name: string, value: string | undefined, required: boolean): void {
  if (!value || value.trim() === "") {
    if (required) {
      throw new Error(`${name} is required`);
    }
    return;
  }

  if (value.includes("<") || value.includes(">")) {
    throw new Error(`${name} must not contain placeholder tokens`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL connection URL`);
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`${name} must use the postgresql:// protocol`);
  }
}

function assertIntegerInRange(name: string, rawValue: string, min: number, max: number): void {
  const value = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(value) || String(value) !== rawValue || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
}

function assertSecret(name: string, value: string | undefined): void {
  if (!value || value.length < 32 || value.includes("replace-with") || value.includes("<") || value.includes(">")) {
    throw new Error(`${name} must be a non-placeholder secret with at least 32 characters`);
  }
}

function assertDuration(name: string, value: string | undefined): void {
  if (!value || !/^\d+[smhd]$/.test(value)) {
    throw new Error(`${name} must use an integer duration with s, m, h or d suffix`);
  }
}

export function validateEnvironment(env: Environment): Environment {
  const nodeEnv = env.NODE_ENV ?? "development";
  const accessTtl = env.JWT_ACCESS_TTL ?? env.JWT_ACCESS_EXPIRES_IN;
  const refreshTtl = env.JWT_REFRESH_TTL ?? env.JWT_REFRESH_EXPIRES_IN;

  if (!allowedNodeEnvironments.has(nodeEnv as NodeEnvironment)) {
    throw new Error("NODE_ENV must be one of development, test, staging or production");
  }

  assertIntegerInRange("API_PORT", env.API_PORT ?? "3000", 1, 65535);
  assertIntegerInRange("DATABASE_POOL_MAX", env.DATABASE_POOL_MAX ?? "10", 1, 50);
  assertIntegerInRange("RATE_LIMIT_DEFAULT", env.RATE_LIMIT_DEFAULT ?? "120", 1, 10_000);
  assertPostgresUrl("DATABASE_URL", env.DATABASE_URL, true);
  assertPostgresUrl("DIRECT_URL", env.DIRECT_URL, false);
  assertSecret("JWT_ACCESS_SECRET", env.JWT_ACCESS_SECRET);
  assertSecret("JWT_REFRESH_SECRET", env.JWT_REFRESH_SECRET);
  assertDuration("JWT_ACCESS_TTL", accessTtl);
  assertDuration("JWT_REFRESH_TTL", refreshTtl);

  if (!env.JWT_ISSUER || !env.JWT_AUDIENCE) {
    throw new Error("JWT_ISSUER and JWT_AUDIENCE are required");
  }

  if (nodeEnv === "production" && (!env.CORS_ORIGIN || env.CORS_ORIGIN.trim() === "")) {
    throw new Error("CORS_ORIGIN is required in production");
  }

  for (const name of ["JSON_BODY_LIMIT", "URLENCODED_BODY_LIMIT"] as const) {
    const value = env[name] ?? (name === "JSON_BODY_LIMIT" ? "256kb" : "64kb");
    if (!/^\d+(?:kb|mb)$/.test(value)) throw new Error(`${name} must use a positive kb or mb value`);
  }

  return {
    ...env,
    API_PREFIX: env.API_PREFIX ?? "api",
    API_VERSION: env.API_VERSION ?? "1",
    API_PORT: env.API_PORT ?? "3000",
    DATABASE_POOL_MAX: env.DATABASE_POOL_MAX ?? "10",
    JWT_ACCESS_TTL: accessTtl ?? "15m",
    JWT_REFRESH_TTL: refreshTtl ?? "30d",
    NODE_ENV: nodeEnv
  };
}
