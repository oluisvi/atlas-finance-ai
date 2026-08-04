import { Module } from "@nestjs/common";

import { AppConfigModule } from "./config/app-config.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { PrismaModule } from "./modules/prisma/prisma.module.js";
import { UsersModule } from "./modules/users/users.module.js";

@Module({
  imports: [AppConfigModule, PrismaModule, AuditModule, UsersModule, AuthModule, HealthModule]
})
export class AppModule {}
