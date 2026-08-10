import "reflect-metadata";
import { writeFile } from "node:fs/promises";

// Builds Nest route metadata without listening or initializing Prisma, so the
// OpenAPI contract can be regenerated in CI without a localhost API or secrets.
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/postgres";
process.env.DIRECT_URL ??= "postgresql://postgres:postgres@localhost:5432/postgres";
process.env.API_PORT ??= "3000";
process.env.API_PREFIX ??= "api";
process.env.API_VERSION ??= "1";
process.env.DATABASE_POOL_MAX ??= "1";
process.env.JWT_ACCESS_SECRET ??= "openapi-generation-access-secret-at-least-32-characters";
process.env.JWT_REFRESH_SECRET ??= "openapi-generation-refresh-secret-at-least-32-characters";
process.env.JWT_ACCESS_TTL ??= "15m";
process.env.JWT_REFRESH_TTL ??= "30d";
process.env.JWT_ISSUER ??= "atlas-finance-ai-openapi";
process.env.JWT_AUDIENCE ??= "atlas-finance-ai-openapi";

const [{ Test }, { AppModule }, { createOpenApiDocument }, { configureApplication }, { ConfigService }] = await Promise.all([
  import("@nestjs/testing"),
  import("../apps/api/src/app.module.js"),
  import("../apps/api/src/config/swagger.config.js"),
  import("../apps/api/src/shared/bootstrap/configure-application.js"),
  import("@nestjs/config")
]);

const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
const app = moduleRef.createNestApplication();
try {
  configureApplication(app, app.get(ConfigService));
  await writeFile("apps/api/openapi.json", `${JSON.stringify(createOpenApiDocument(app), null, 2)}\n`);
} finally {
  await app.close();
}
