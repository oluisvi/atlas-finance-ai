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

export function validateEnvironment(env: Environment): Environment {
  const nodeEnv = env.NODE_ENV ?? "development";

  if (!allowedNodeEnvironments.has(nodeEnv as NodeEnvironment)) {
    throw new Error("NODE_ENV must be one of development, test, staging or production");
  }

  assertIntegerInRange("API_PORT", env.API_PORT ?? "3000", 1, 65535);
  assertIntegerInRange("DATABASE_POOL_MAX", env.DATABASE_POOL_MAX ?? "10", 1, 50);
  assertPostgresUrl("DATABASE_URL", env.DATABASE_URL, true);
  assertPostgresUrl("DIRECT_URL", env.DIRECT_URL, false);

  return {
    ...env,
    API_PREFIX: env.API_PREFIX ?? "api",
    API_VERSION: env.API_VERSION ?? "1",
    API_PORT: env.API_PORT ?? "3000",
    DATABASE_POOL_MAX: env.DATABASE_POOL_MAX ?? "10",
    NODE_ENV: nodeEnv
  };
}
