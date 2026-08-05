import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { FinancialModule } from "../financial/financial.module.js";
import { RecurringTransactionsController } from "./recurring-transactions.controller.js";
import { RecurringTransactionsService } from "./recurring-transactions.service.js";
@Module({ imports: [AuthModule, AuditModule, FinancialModule], controllers: [RecurringTransactionsController], providers: [RecurringTransactionsService] })
export class RecurringTransactionsModule {}
