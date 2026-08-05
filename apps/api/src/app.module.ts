import { Module } from "@nestjs/common";

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

@Module({
  imports: [AppConfigModule, PrismaModule, AuditModule, UsersModule, AuthModule, AccountsModule, CategoriesModule, TransactionsModule, TransfersModule, BudgetsModule, GoalsModule, HealthModule]
})
export class AppModule {}
