import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { OpenAPIObject } from "@nestjs/swagger";

import { AppModule } from "../app.module.js";
import type { AppConfiguration } from "../config/app-config.types.js";
import { createOpenApiDocument } from "../config/swagger.config.js";
import { configureApplication } from "../shared/bootstrap/configure-application.js";

describe("OpenAPI V1 contract", () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApplication(app, app.get(ConfigService<AppConfiguration, true>));
    document = createOpenApiDocument(app);
  });

  afterAll(async () => app.close());

  it("generates OpenAPI 3 with all 86 runtime operations and unique operation IDs", () => {
    expect(document.openapi).toMatch(/^3\./);
    const operations = Object.values(document.paths).flatMap(item => [item.get, item.post, item.patch, item.put, item.delete]).filter(Boolean);
    expect(operations).toHaveLength(86);
    const ids = operations.map(operation => operation?.operationId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registers Bearer JWT and every public domain tag", () => {
    expect(document.components?.securitySchemes?.bearerAuth).toMatchObject({ type: "http", scheme: "bearer" });
    expect(document.tags?.map(tag => tag.name)).toEqual(expect.arrayContaining(["Health", "Auth", "Accounts", "Categories", "Transactions", "Transfers", "Budgets", "Goals", "Recurring Transactions", "Dashboard", "Financial Health", "Imports", "Reports", "Exports", "Insights"]));
  });

  it("keeps public routes public and protected routes secured", () => {
    expect(document.paths["/api/v1/health"]?.get?.security).toEqual([]);
    expect(document.paths["/api/v1/auth/login"]?.post?.security).toEqual([]);
    expect(document.paths["/api/v1/accounts"]?.get?.security).toEqual([{ bearerAuth: [] }]);
  });

  it("documents the complete critical route allowlist", () => {
    const expected = ["/api/v1/auth/register", "/api/v1/auth/me", "/api/v1/accounts", "/api/v1/categories", "/api/v1/transactions", "/api/v1/transfers", "/api/v1/budgets", "/api/v1/goals", "/api/v1/recurring-transactions", "/api/v1/dashboard/overview", "/api/v1/financial-health", "/api/v1/imports/upload", "/api/v1/reports/yearly", "/api/v1/exports/reports/{reportType}", "/api/v1/insights/generate", "/api/v1/health/readiness"];
    expect(Object.keys(document.paths)).toEqual(expect.arrayContaining(expected));
  });

  it("models money as decimal strings and nullable fields explicitly", () => {
    const account = document.components?.schemas?.Account as { properties?: Record<string, { type?: string }> };
    expect(account.properties?.currentBalance?.type).toBe("string");
    const goal = document.components?.schemas?.Goal as { properties?: Record<string, { nullable?: boolean }> };
    expect(goal.properties?.dueDate?.nullable).toBe(true);
  });

  it("models import upload as multipart binary with its additional fields", () => {
    const requestBody = document.paths["/api/v1/imports/upload"]?.post?.requestBody as { content: Record<string, { schema: { properties: Record<string, { format?: string }> } }> };
    expect(requestBody.content["multipart/form-data"]?.schema.properties.file?.format).toBe("binary");
    expect(requestBody.content["multipart/form-data"]?.schema.properties).toHaveProperty("accountId");
    expect(requestBody.content["multipart/form-data"]?.schema.properties).toHaveProperty("sourceType");
  });

  it("models CSV, XLSX and PDF downloads as binary", () => {
    const response = document.paths["/api/v1/exports/reports/{reportType}"]?.get?.responses?.["200"] as { content: Record<string, { schema: { format?: string } }> };
    expect(Object.keys(response.content)).toEqual(expect.arrayContaining(["text/csv", "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]));
    expect(Object.values(response.content).every(value => value.schema.format === "binary")).toBe(true);
  });

  it("represents the financial-health object-or-list union", () => {
    const response = document.paths["/api/v1/financial-health"]?.get?.responses?.["200"] as unknown as { content: { "application/json": { schema: { oneOf: unknown[] } } } };
    expect(response.content["application/json"].schema.oneOf).toHaveLength(2);
  });

  it("contains no broken local schema references", () => {
    const serialized = JSON.stringify(document);
    const refs = [...serialized.matchAll(/#\/components\/schemas\/([A-Za-z0-9_]+)/g)].map(match => match[1]);
    for (const ref of refs) expect(document.components?.schemas).toHaveProperty(ref!);
  });

  it("does not expose internal fields, hashes, secrets or connection configuration", () => {
    const serialized = JSON.stringify(document);
    for (const forbidden of ["passwordHash", "refreshTokenHash", "fingerprint", "DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "connectionString", "contentBase64"]) expect(serialized).not.toContain(forbidden);
  });
});
