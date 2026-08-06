import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import type { InsightsDatabasePort, InsightsTransactionClient } from "./insights-database.port.js";

@Injectable()
export class InsightsDatabaseAdapter implements InsightsDatabasePort {
  readonly financialInsight;
  readonly insightGenerationRun;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    this.financialInsight = prisma.financialInsight;
    this.insightGenerationRun = prisma.insightGenerationRun;
  }

  $transaction<T>(operation: (database: InsightsTransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((transaction: Prisma.TransactionClient) => operation(transaction));
  }
}
