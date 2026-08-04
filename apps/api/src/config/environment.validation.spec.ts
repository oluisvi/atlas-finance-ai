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
      NODE_ENV: "test"
    });

    expect(env.API_PORT).toBe("3000");
    expect(env.API_PREFIX).toBe("api");
    expect(env.API_VERSION).toBe("1");
    expect(env.DATABASE_POOL_MAX).toBe("10");
  });
});
