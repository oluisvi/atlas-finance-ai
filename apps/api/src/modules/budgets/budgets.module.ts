import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { BUDGETS_DATABASE } from "./budgets-database.port.js";
import { BudgetsDatabaseAdapter } from "./budgets-database.adapter.js";
import { BudgetsController } from "./budgets.controller.js";
import { BudgetsService } from "./budgets.service.js";

@Module({ imports: [AuthModule, AuditModule, PrismaModule], controllers: [BudgetsController], providers: [BudgetsService, { provide: BUDGETS_DATABASE, useClass: BudgetsDatabaseAdapter }] })
export class BudgetsModule {}
