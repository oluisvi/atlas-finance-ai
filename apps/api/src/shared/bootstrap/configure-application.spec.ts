/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest's App type does not model Nest's runtime HTTP server */
import { Body, Controller, Get, Module, Post } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { IsString } from "class-validator";
import request from "supertest";

import type { AppConfiguration } from "../../config/app-config.types.js";
import { configureApplication } from "./configure-application.js";

class PayloadDto { @IsString() name!: string; }
@Controller("probe") class ProbeController {
  @Post() create(@Body() body: PayloadDto) { return body; }
  @Get("failure") fail() { throw new Error("postgresql://secret:secret@db/internal SQL detail"); }
}
@Module({ controllers: [ProbeController], imports: [ThrottlerModule.forRoot([{ limit: 2, ttl: 60_000 }])], providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }] }) class ProbeModule {}

describe("configureApplication hardening", () => {
  async function createApp() {
    const app = await NestFactory.create(ProbeModule, { logger: false });
    const values = new Map<string, unknown>([["app.apiPrefix", "api"], ["app.apiVersion", "1"], ["app.corsOrigins", ["https://allowed.example"]], ["app.nodeEnv", "test"], ["app.jsonBodyLimit", "1kb"], ["app.urlEncodedBodyLimit", "1kb"]]);
    configureApplication(app, { get: (key: string) => values.get(key) } as ConfigService<AppConfiguration, true>);
    await app.init();
    return app;
  }
  it("rejects unknown properties and returns the correlation id", async () => {
    const app = await createApp(); const response = await request(app.getHttpServer()).post("/api/v1/probe").set("x-request-id", "request-1234").send({ name: "ok", userId: "injected" }).expect(400);
    expect(response.headers["x-request-id"]).toBe("request-1234"); expect(response.body.requestId).toBe("request-1234"); await app.close();
  });
  it("sets API security and private-cache headers", async () => {
    const app = await createApp(); const response = await request(app.getHttpServer()).post("/api/v1/probe").send({ name: "ok" }).expect(201);
    expect(response.headers["x-content-type-options"]).toBe("nosniff"); expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN"); expect(response.headers["cache-control"]).toBe("private, no-store"); expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/); await app.close();
  });
  it("allows only configured CORS origins", async () => {
    const app = await createApp(); await request(app.getHttpServer()).options("/api/v1/probe").set("origin", "https://allowed.example").set("access-control-request-method", "POST").expect(204).expect("access-control-allow-origin", "https://allowed.example");
    const denied = await request(app.getHttpServer()).options("/api/v1/probe").set("origin", "https://denied.example").set("access-control-request-method", "POST").expect(204); expect(denied.headers["access-control-allow-origin"]).toBeUndefined(); await app.close();
  });
  it("sanitizes unknown errors and rejects oversized JSON", async () => {
    const app = await createApp(); const failure = await request(app.getHttpServer()).get("/api/v1/probe/failure").expect(500); expect(failure.body.message).toBe("Internal server error"); expect(JSON.stringify(failure.body)).not.toContain("postgresql"); await request(app.getHttpServer()).post("/api/v1/probe").send({ name: "x".repeat(2_000) }).expect(413); await app.close();
  });
  it("returns 429 after the configured process-local limit", async () => {
    const app = await createApp();
    await request(app.getHttpServer()).post("/api/v1/probe").send({ name: "one" }).expect(201);
    await request(app.getHttpServer()).post("/api/v1/probe").send({ name: "two" }).expect(201);
    const limited = await request(app.getHttpServer()).post("/api/v1/probe").send({ name: "three" }).expect(429);
    expect(limited.body.statusCode).toBe(429);
    await app.close();
  });
});
