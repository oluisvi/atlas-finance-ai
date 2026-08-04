import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AuditModule } from "../audit/audit.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { UsersModule } from "../users/users.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";

@Module({
  controllers: [AuthController],
  exports: [AuthService],
  imports: [JwtModule.register({}), PrismaModule, UsersModule, AuditModule],
  providers: [AuthService, JwtAuthGuard]
})
export class AuthModule {}
