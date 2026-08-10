import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import type { AppConfiguration } from "./config/app-config.types.js";

import { AppConfigModule } from "./config/app-config.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { AccountsModule } from "./modules/accounts/accounts.module.js";
import { CategoriesModule } from "./modules/categories/categories.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { PrismaModule } from "./modules/prisma/prisma.module.js";
import { UsersModule } from "./modules/users/users.module.js";
import { TransactionsModule } from "./modules/transactions/transactions.module.js";
import { TransfersModule } from "./modules/transfers/transfers.module.js";
import { BudgetsModule } from "./modules/budgets/budgets.module.js";
import { GoalsModule } from "./modules/goals/goals.module.js";
import { RecurringTransactionsModule } from "./modules/recurring-transactions/recurring-transactions.module.js";
import { DashboardModule } from "./modules/dashboard/dashboard.module.js";
import { FinancialHealthModule } from "./modules/financial-health/financial-health.module.js";
import { ImportsModule } from "./modules/imports/imports.module.js";
import { ReportsModule } from "./modules/reports/reports.module.js";
import { ExportsModule } from "./modules/exports/exports.module.js";
import { InsightsModule } from "./modules/insights/insights.module.js";

@Module({
  imports: [AppConfigModule, ThrottlerModule.forRootAsync({ inject: [ConfigService], useFactory: (config: ConfigService<AppConfiguration, true>) => [{ limit: config.get("throttling.defaultLimit", { infer: true }), name: "default", ttl: config.get("throttling.defaultTtlMs", { infer: true }) }] }), PrismaModule, AuditModule, UsersModule, AuthModule, AccountsModule, CategoriesModule, TransactionsModule, TransfersModule, BudgetsModule, GoalsModule, RecurringTransactionsModule, DashboardModule, FinancialHealthModule, ImportsModule, ReportsModule, ExportsModule, InsightsModule, HealthModule],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule {}
