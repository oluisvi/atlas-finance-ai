import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { FinancialModule } from "../financial/financial.module.js";
import { GoalsController } from "./goals.controller.js";
import { GoalsService } from "./goals.service.js";
@Module({ imports: [AuthModule, AuditModule, FinancialModule], controllers: [GoalsController], providers: [GoalsService] })
export class GoalsModule {}
