import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";

import { AppModule } from "./app.module.js";
import { configureApplication } from "./shared/bootstrap/configure-application.js";
import type { AppConfiguration } from "./config/app-config.types.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });
  const config = app.get(ConfigService<AppConfiguration, true>);

  configureApplication(app, config);

  await app.listen(config.get("app.port", { infer: true }));
}

void bootstrap();
