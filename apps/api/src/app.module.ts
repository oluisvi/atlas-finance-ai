import { Module } from "@nestjs/common";

import { AppConfigModule } from "./config/app-config.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { PrismaModule } from "./modules/prisma/prisma.module.js";

@Module({
  imports: [AppConfigModule, PrismaModule, HealthModule]
})
export class AppModule {}
