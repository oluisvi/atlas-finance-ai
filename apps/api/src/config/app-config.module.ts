import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { appConfig, authConfig, databaseConfig, throttlingConfig } from "./configuration.js";
import { validateEnvironment } from "./environment.validation.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      expandVariables: true,
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig, throttlingConfig],
      validate: validateEnvironment
    })
  ]
})
export class AppConfigModule {}
