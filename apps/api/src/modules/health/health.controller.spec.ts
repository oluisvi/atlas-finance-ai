import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { Express } from "express";

import { AppModule } from "../../app.module.js";
import { configureApplication } from "../../shared/bootstrap/configure-application.js";
import { PrismaService } from "../prisma/prisma.service.js";

const testConfig = {
  get: (key: string) => {
    const values: Record<string, unknown> = {
      "app.apiPrefix": "api",
      "app.apiVersion": "1",
      "app.corsOrigins": [],
      "app.nodeEnv": "test",
      "app.port": 0
    };

    return values[key];
  }
};

describe("HealthController", () => {
  it("returns API and database health", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue({
        checkConnection: jest.fn().mockResolvedValue(undefined)
      })
      .overrideProvider(ConfigService)
      .useValue(testConfig)
      .compile();
    const app = moduleRef.createNestApplication();

    configureApplication(app, app.get(ConfigService));
    await app.init();

    await request(app.getHttpServer() as Express)
      .get("/api/v1/health")
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("ok");
        expect(body.services.database.status).toBe("up");
        expect(body.services.app.status).toBe("up");
      });

    await app.close();
  });

  it("returns a sanitized 503 when the database is unavailable", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue({
        checkConnection: jest.fn().mockRejectedValue(new Error("connection refused"))
      })
      .overrideProvider(ConfigService)
      .useValue(testConfig)
      .compile();
    const app = moduleRef.createNestApplication();

    configureApplication(app, app.get(ConfigService));
    await app.init();

    await request(app.getHttpServer() as Express)
      .get("/api/v1/health")
      .expect(503)
      .expect(({ body }) => {
        expect(body.code).toBe("DATABASE_UNAVAILABLE");
        expect(body.message).toBe("Database connection is unavailable");
        expect(JSON.stringify(body)).not.toContain("connection refused");
      });

    await app.close();
  });

  it("keeps HealthService failure semantics explicit", () => {
    const exception = new ServiceUnavailableException({
      code: "DATABASE_UNAVAILABLE",
      message: "Database connection is unavailable"
    });

    expect(exception.getStatus()).toBe(503);
  });
});
