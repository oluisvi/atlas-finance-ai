import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";

/* OpenAPI's recursive structural types are intentionally kept local because Nest only
 * exports OpenAPIObject from its public package entry point. */
type SchemaObject = Record<string, unknown>;
type OperationObject = {
  content?: unknown;
  operationId?: string;
  parameters?: Array<Record<string, unknown>>;
  requestBody?: unknown;
  responses: Record<string, unknown>;
  security?: Array<Record<string, string[]>>;
  summary?: string;
  tags?: string[];
};
type PathItemObject = Record<string, OperationObject | undefined>;

const tags = ["Health", "Auth", "Accounts", "Categories", "Transactions", "Transfers", "Budgets", "Goals", "Recurring Transactions", "Dashboard", "Financial Health", "Imports", "Reports", "Exports", "Insights"];
const money: SchemaObject = { type: "string", pattern: "^-?\\d{1,15}(?:\\.\\d{1,4})?$", example: "1250.5000", description: "Decimal monetary value represented as a string; never a JSON number." };
const uuid: SchemaObject = { type: "string", format: "uuid" };
const dateTime: SchemaObject = { type: "string", format: "date-time", description: "ISO 8601 timestamp in UTC." };
const currency: SchemaObject = { type: "string", enum: ["BRL", "USD", "EUR"], example: "BRL", description: "Currency is not converted automatically; cross-currency totals are kept separate." };

const schemas: Record<string, SchemaObject> = {
  ErrorResponse: { type: "object", required: ["statusCode", "code", "message", "method", "path", "requestId", "timestamp"], properties: { statusCode: { type: "integer", example: 400 }, code: { type: "string", example: "VALIDATION_ERROR" }, message: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] }, method: { type: "string", example: "GET" }, path: { type: "string", example: "/api/v1/accounts" }, requestId: { type: "string" }, timestamp: dateTime } },
  PaginationMeta: { type: "object", required: ["page", "pageSize", "total", "totalPages"], properties: { page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100 }, total: { type: "integer", minimum: 0 }, totalPages: { type: "integer", minimum: 0 } } },
  AuthTokens: { type: "object", required: ["accessToken", "refreshToken", "tokenType"], properties: { accessToken: { type: "string", description: "Short-lived Bearer JWT." }, refreshToken: { type: "string", description: "Opaque refresh credential; store securely." }, tokenType: { type: "string", enum: ["Bearer"] } } },
  PublicUser: { type: "object", required: ["id", "email", "name", "status", "createdAt"], properties: { id: uuid, email: { type: "string", format: "email", example: "ana@example.test" }, name: { type: "string", example: "Ana Silva" }, status: { type: "string", enum: ["ACTIVE", "INACTIVE"] }, createdAt: dateTime } },
  AuthResponse: { type: "object", required: ["user", "tokens"], properties: { user: { $ref: "#/components/schemas/PublicUser" }, tokens: { $ref: "#/components/schemas/AuthTokens" } } },
  Account: { type: "object", required: ["id", "name", "type", "currency", "initialBalance", "currentBalance", "status"], properties: { id: uuid, name: { type: "string" }, type: { type: "string", enum: ["CHECKING", "SAVINGS", "CASH", "CREDIT_CARD", "INVESTMENT", "OTHER"] }, currency, initialBalance: money, currentBalance: money, status: { type: "string", enum: ["ACTIVE", "ARCHIVED"] }, createdAt: dateTime, updatedAt: dateTime } },
  Category: { type: "object", required: ["id", "name", "type", "isDefault"], properties: { id: uuid, name: { type: "string" }, type: { type: "string", enum: ["INCOME", "EXPENSE", "BOTH"] }, parentId: { ...uuid, nullable: true }, isDefault: { type: "boolean", description: "Global default categories are read-only for users." }, status: { type: "string", enum: ["ACTIVE", "ARCHIVED"] } } },
  Transaction: { type: "object", required: ["id", "accountId", "type", "status", "description", "amount", "transactionDate"], properties: { id: uuid, accountId: uuid, categoryId: { ...uuid, nullable: true }, type: { type: "string", enum: ["INCOME", "EXPENSE", "ADJUSTMENT", "TRANSFER_IN", "TRANSFER_OUT"] }, status: { type: "string", enum: ["PENDING", "CONFIRMED", "CANCELLED"] }, description: { type: "string" }, amount: money, transactionDate: dateTime, createdAt: dateTime } },
  Transfer: { type: "object", properties: { id: uuid, sourceAccountId: uuid, destinationAccountId: uuid, amount: money, status: { type: "string", enum: ["COMPLETED", "REVERSED"] }, reversedAt: { ...dateTime, nullable: true } } },
  Budget: { type: "object", properties: { id: uuid, name: { type: "string" }, month: { type: "integer", minimum: 1, maximum: 12 }, year: { type: "integer" }, currency, amount: money, spent: money, state: { type: "string", enum: ["NORMAL", "ALERT", "EXCEEDED"] } } },
  Goal: { type: "object", properties: { id: uuid, name: { type: "string" }, type: { type: "string" }, status: { type: "string" }, currency, targetAmount: money, currentAmount: money, dueDate: { type: "string", format: "date", nullable: true } } },
  RecurringTransaction: { type: "object", properties: { id: uuid, accountId: uuid, amount: money, frequency: { type: "string", enum: ["WEEKLY", "MONTHLY", "YEARLY"] }, status: { type: "string", enum: ["ACTIVE", "PAUSED", "CANCELLED"] }, nextRunAt: { ...dateTime, nullable: true } } },
  Insight: { type: "object", properties: { id: uuid, status: { type: "string", enum: ["ACTIVE", "READ", "DISMISSED", "RESOLVED", "ARCHIVED"] }, severity: { type: "string", enum: ["INFO", "OPPORTUNITY", "WARNING", "CRITICAL"] }, source: { type: "string" }, title: { type: "string" }, message: { type: "string" }, currency, resolvedAt: { ...dateTime, nullable: true }, createdAt: dateTime, updatedAt: dateTime } },
  FinancialHealth: {
    type: "object",
    description: "Deterministic, read-only financial health calculation.",
    properties: {
      currency,
      score: { type: "number", minimum: 0, maximum: 100 },
      classification: { type: "string", enum: ["CRITICAL", "ATTENTION", "GOOD", "EXCELLENT"] },
      components: { type: "array", items: { type: "object", properties: { score: { type: "number" }, effectiveWeight: { type: "number" }, dataQuality: { type: "string" } } } },
      factors: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } }
    }
  },
  Health: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ok", "ready", "not_ready"] }, timestamp: dateTime } },
  GenericFinancialResponse: { type: "object", additionalProperties: true, description: "Domain response. All monetary members are decimal strings and nullable ratios remain null when undefined." },
  PaginatedResponse: { type: "object", required: ["data", "meta"], properties: { data: { type: "array", items: { $ref: "#/components/schemas/GenericFinancialResponse" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }
};

const errorResponse = (description: string) => ({ description, headers: { "X-Request-Id": { description: "Correlation identifier for support and logs.", schema: { type: "string" } } }, content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } });
const responseRef = (name: string, description = "Successful response") => ({ description, headers: { "X-Request-Id": { description: "Correlation identifier.", schema: { type: "string" } } }, content: { "application/json": { schema: { $ref: `#/components/schemas/${name}` } } } });
const body = (schema: SchemaObject) => ({ required: true, content: { "application/json": { schema } } });
const propertyBody = (properties: Record<string, SchemaObject>, required: string[]) => body({ type: "object", properties, required });

function tagFor(path: string): string {
  const segment = path.split("/").filter(Boolean).at(2) ?? "health";
  return ({ "recurring-transactions": "Recurring Transactions", "financial-health": "Financial Health" } as Record<string, string>)[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

function enhanceOperation(path: string, method: string, operation: OperationObject): void {
  const tag = tagFor(path);
  operation.tags = [tag];
  operation.operationId = `${tag.replace(/\s+/g, "").replace(/s$/, "").toLowerCase()}_${method}_${path.split("/").slice(3).join("_").replace(/[{}]/g, "") || "root"}`;
  operation.summary ??= `${method.toUpperCase()} ${path.replace("/api/v1/", "")}`;
  const isPublic = tag === "Health" || ["/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/refresh"].includes(path);
  operation.security = isPublic ? [] : [{ bearerAuth: [] }];
  operation.responses ??= {};
  if (!operation.responses["200"] && !operation.responses["201"] && !operation.responses["204"]) operation.responses[method === "post" ? "201" : "200"] = responseRef("GenericFinancialResponse");
  for (const [status, description] of [["400", "Invalid request"], ["401", "Missing or invalid Bearer token"], ["404", "Resource not found"], ["409", "Domain conflict"], ["413", "Payload too large"], ["415", "Unsupported media type"], ["429", "Too many requests"], ["500", "Internal server error"]] as const) operation.responses[status] ??= errorResponse(description);
  if (isPublic) delete operation.responses["401"];
  if (method === "delete") operation.responses = { "204": { description: "Deleted successfully" }, "400": errorResponse("Invalid request"), "401": errorResponse("Missing or invalid Bearer token"), "404": errorResponse("Resource not found"), "429": errorResponse("Too many requests") };
  if (method === "get" && !path.includes("/{id}")) operation.parameters ??= [];
}

function applyPreciseContracts(document: OpenAPIObject): void {
  const op = (path: string, method: string): OperationObject | undefined => (document.paths[path] as unknown as PathItemObject | undefined)?.[method];
  const accountInput = { name: { type: "string", maxLength: 100 }, type: { type: "string", enum: ["CHECKING", "SAVINGS", "CASH", "CREDIT_CARD", "INVESTMENT", "OTHER"] }, currency, initialBalance: money };
  op("/api/v1/accounts", "post")!.requestBody = propertyBody(accountInput, ["name", "type", "currency", "initialBalance"]);
  op("/api/v1/accounts", "post")!.responses["201"] = responseRef("Account"); op("/api/v1/accounts", "get")!.responses["200"] = { description: "Accounts", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Account" } } } } };
  for (const p of ["/api/v1/accounts/{id}"]) for (const m of ["get", "patch"] as const) if (op(p, m)) op(p, m)!.responses[m === "get" ? "200" : "200"] = responseRef("Account");
  op("/api/v1/auth/register", "post")!.requestBody = propertyBody({ email: { type: "string", format: "email" }, name: { type: "string" }, password: { type: "string", format: "password", minLength: 8 } }, ["email", "name", "password"]); op("/api/v1/auth/register", "post")!.responses["201"] = { description: "Registered user; call login to obtain tokens.", content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/PublicUser" } } } } } };
  op("/api/v1/auth/login", "post")!.requestBody = propertyBody({ email: { type: "string", format: "email" }, password: { type: "string", format: "password" } }, ["email", "password"]); op("/api/v1/auth/login", "post")!.responses["200"] = responseRef("AuthResponse");
  op("/api/v1/auth/refresh", "post")!.requestBody = propertyBody({ refreshToken: { type: "string" } }, ["refreshToken"]);
  op("/api/v1/auth/me", "get")!.responses["200"] = { description: "Current user", content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/PublicUser" } } } } } };
  const upload = op("/api/v1/imports/upload", "post"); if (upload) upload.requestBody = { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["file", "accountId", "sourceType"], properties: { file: { type: "string", format: "binary", description: "CSV, OFX or QFX file; maximum 10 MB." }, accountId: uuid, sourceType: { type: "string", enum: ["CSV", "OFX"] } } } } } };
  const exportOp = op("/api/v1/exports/reports/{reportType}", "get"); if (exportOp) { exportOp.parameters = [...(exportOp.parameters ?? []), { name: "format", in: "query", required: true, schema: { type: "string", enum: ["csv", "xlsx", "pdf"] } }]; exportOp.responses["200"] = { description: "Generated report file", headers: { "Content-Disposition": { schema: { type: "string" } }, "X-Request-Id": { schema: { type: "string" } } }, content: { "text/csv": { schema: { type: "string", format: "binary" } }, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { schema: { type: "string", format: "binary" } }, "application/pdf": { schema: { type: "string", format: "binary" } } } }; }
  const healthPaths = ["/api/v1/health", "/api/v1/health/liveness", "/api/v1/health/readiness"]; for (const p of healthPaths) if (op(p, "get")) op(p, "get")!.responses["200"] = responseRef("Health");
  const financial = op("/api/v1/financial-health", "get"); if (financial) financial.responses["200"] = { description: "One currency when requested, otherwise one result per currency.", content: { "application/json": { schema: { oneOf: [{ $ref: "#/components/schemas/FinancialHealth" }, { type: "array", items: { $ref: "#/components/schemas/FinancialHealth" } }] } } } };
  for (const item of Object.values(document.paths)) for (const operation of Object.values(item ?? {})) if (operation && typeof operation === "object" && "responses" in operation) { const typed = operation as OperationObject; if (typed.parameters) typed.parameters = typed.parameters.filter((parameter, index, all) => !("name" in parameter) || all.findIndex(candidate => "name" in candidate && candidate.name === parameter.name && candidate.in === parameter.in) === index); }
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder().setTitle("Atlas Finance AI API").setDescription("Stable HTTP contract for Atlas Finance AI V1. Monetary values are decimal strings; currencies are never converted automatically.").setVersion("1.0.0").addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Authorization: Bearer <access_token>" }, "bearerAuth").addServer("/", "Current server");
  for (const tag of tags) config.addTag(tag);
  const document = SwaggerModule.createDocument(app, config.build(), { operationIdFactory: (controller, method) => `${controller.replace(/Controller$/, "").toLowerCase()}_${method}` });
  document.components ??= {}; document.components.schemas = { ...(document.components.schemas ?? {}), ...schemas };
  for (const [path, item] of Object.entries(document.paths)) for (const method of ["get", "post", "patch", "put", "delete"] as const) { const operation = item?.[method] as OperationObject | undefined; if (operation) enhanceOperation(path, method, operation); }
  applyPreciseContracts(document);
  return document;
}

export function configureSwagger(app: INestApplication, enabled: boolean): OpenAPIObject {
  const document = createOpenApiDocument(app);
  if (enabled) SwaggerModule.setup("api/docs", app, document, { jsonDocumentUrl: "/api/docs-json", swaggerOptions: { persistAuthorization: false, displayRequestDuration: true } });
  return document;
}
