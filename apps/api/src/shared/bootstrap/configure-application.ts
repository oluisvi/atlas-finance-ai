import { VersioningType, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { INestApplication } from "@nestjs/common";
import { json, urlencoded } from "express";
import helmet from "helmet";

import type { AppConfiguration } from "../../config/app-config.types.js";
import { GlobalExceptionFilter } from "../filters/global-exception.filter.js";
import { requestContextMiddleware } from "../middleware/request-context.middleware.js";

export function configureApplication(
  app: INestApplication,
  config: ConfigService<AppConfiguration, true>
): void {
  const apiPrefix = config.get("app.apiPrefix", { infer: true });
  const apiVersion = config.get("app.apiVersion", { infer: true });
  const corsOrigins = config.get("app.corsOrigins", { infer: true });
  const nodeEnv = config.get("app.nodeEnv", { infer: true });

  app.use(requestContextMiddleware);
  app.use(json({ limit: config.get("app.jsonBodyLimit", { infer: true }) }));
  app.use(urlencoded({ extended: false, limit: config.get("app.urlEncodedBodyLimit", { infer: true }) }));
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false, hsts: nodeEnv === "production" ? undefined : false }));

  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    defaultVersion: apiVersion,
    type: VersioningType.URI
  });
  app.enableCors({
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    origin: corsOrigins.length > 0 ? corsOrigins : false
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false
      },
      whitelist: true
    })
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableShutdownHooks();
}
