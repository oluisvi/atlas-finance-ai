import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";

import { AppModule } from "./app.module.js";
import { configureApplication } from "./shared/bootstrap/configure-application.js";
import type { AppConfiguration } from "./config/app-config.types.js";
import { configureSwagger } from "./config/swagger.config.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });
  const config = app.get(ConfigService<AppConfiguration, true>);

  configureApplication(app, config);
  configureSwagger(app, config.get("app.swaggerEnabled", { infer: true }));

  // Render injects the public listener port through PORT. API_PORT remains
  // available for local development and other self-hosted deployments.
  const port = Number.parseInt(process.env.PORT ?? String(config.get("app.port", { infer: true })), 10);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
