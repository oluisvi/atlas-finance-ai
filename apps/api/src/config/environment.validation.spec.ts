import { validateEnvironment } from "./environment.validation.js";

describe("validateEnvironment", () => {
  it("throws when DATABASE_URL is missing", () => {
    expect(() => validateEnvironment({ NODE_ENV: "test" })).toThrow("DATABASE_URL is required");
  });

  it("throws when DATABASE_URL still contains placeholders", () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: "postgresql://postgres:<DB_PASSWORD>@localhost:5432/postgres",
        NODE_ENV: "test"
      })
    ).toThrow("DATABASE_URL must not contain placeholder tokens");
  });

  it("returns normalized defaults for a valid environment", () => {
    const env = validateEnvironment({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/postgres",
      JWT_ACCESS_SECRET: "test-access-secret-that-is-long-enough-for-validation",
      JWT_ACCESS_TTL: "15m",
      JWT_AUDIENCE: "atlas-finance-ai-test",
      JWT_ISSUER: "atlas-finance-ai-test",
      JWT_REFRESH_SECRET: "test-refresh-secret-that-is-long-enough-for-validation",
      JWT_REFRESH_TTL: "30d",
      NODE_ENV: "test"
    });

    expect(env.API_PORT).toBe("3000");
    expect(env.API_PREFIX).toBe("api");
    expect(env.API_VERSION).toBe("1");
    expect(env.DATABASE_POOL_MAX).toBe("10");
  });

  it("accepts an explicit Swagger serving flag", () => {
    const valid = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/postgres",
      JWT_ACCESS_SECRET: "test-access-secret-that-is-long-enough-for-validation",
      JWT_ACCESS_TTL: "15m",
      JWT_AUDIENCE: "atlas-finance-ai-test",
      JWT_ISSUER: "atlas-finance-ai-test",
      JWT_REFRESH_SECRET: "test-refresh-secret-that-is-long-enough-for-validation",
      JWT_REFRESH_TTL: "30d",
      NODE_ENV: "test"
    };
    expect(validateEnvironment({ ...valid, SWAGGER_ENABLED: "false" }).SWAGGER_ENABLED).toBe("false");
    expect(() => validateEnvironment({ ...valid, SWAGGER_ENABLED: "yes" })).toThrow("SWAGGER_ENABLED must be true or false");
  });
});
