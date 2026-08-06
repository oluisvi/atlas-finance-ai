import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard.service.js";
@Module({ imports: [AuthModule, PrismaModule], controllers: [DashboardController], providers: [DashboardService], exports: [DashboardService] }) export class DashboardModule {}
