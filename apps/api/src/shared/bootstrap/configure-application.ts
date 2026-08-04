import { VersioningType, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { INestApplication } from "@nestjs/common";

import type { AppConfiguration } from "../../config/app-config.types.js";
import { GlobalExceptionFilter } from "../filters/global-exception.filter.js";

export function configureApplication(
  app: INestApplication,
  config: ConfigService<AppConfiguration, true>
): void {
  const apiPrefix = config.get("app.apiPrefix", { infer: true });
  const apiVersion = config.get("app.apiVersion", { infer: true });
  const corsOrigins = config.get("app.corsOrigins", { infer: true });
  const nodeEnv = config.get("app.nodeEnv", { infer: true });

  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    defaultVersion: apiVersion,
    type: VersioningType.URI
  });
  app.enableCors({
    credentials: true,
    origin: corsOrigins.length > 0 ? corsOrigins : nodeEnv === "production" ? false : true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true
      },
      whitelist: true
    })
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableShutdownHooks();
}
