import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module.js";
import { FinancialDatabaseAdapter } from "./financial-database.adapter.js";
import { FINANCIAL_DATABASE } from "./financial-database.port.js";
@Module({ imports: [PrismaModule], providers: [{ provide: FINANCIAL_DATABASE, useClass: FinancialDatabaseAdapter }], exports: [FINANCIAL_DATABASE] })
export class FinancialModule {}
