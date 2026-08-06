import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { ImportsController } from "./imports.controller.js";
import { ImportsService } from "./imports.service.js";
@Module({ imports: [PrismaModule, AuditModule, AuthModule], controllers: [ImportsController], providers: [ImportsService] })
export class ImportsModule {}
