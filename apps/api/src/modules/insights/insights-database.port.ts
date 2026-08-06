import type { Prisma, FinancialInsight, InsightGenerationRun } from "@prisma/client";

export const INSIGHTS_DATABASE = Symbol("INSIGHTS_DATABASE");

export interface FinancialInsightDelegate {
  count(args: Prisma.FinancialInsightCountArgs): Promise<number>;
  create(args: Prisma.FinancialInsightCreateArgs): Promise<FinancialInsight>;
  findFirst(args: Prisma.FinancialInsightFindFirstArgs): Promise<FinancialInsight | null>;
  findMany(args: Prisma.FinancialInsightFindManyArgs): Promise<FinancialInsight[]>;
  update(args: Prisma.FinancialInsightUpdateArgs): Promise<FinancialInsight>;
}

export interface InsightGenerationRunDelegate {
  create(args: Prisma.InsightGenerationRunCreateArgs): Promise<InsightGenerationRun>;
  update(args: Prisma.InsightGenerationRunUpdateArgs): Promise<InsightGenerationRun>;
}

export interface InsightsTransactionClient {
  financialInsight: FinancialInsightDelegate;
  insightGenerationRun: InsightGenerationRunDelegate;
}

export interface InsightsDatabasePort extends InsightsTransactionClient {
  $transaction<T>(operation: (database: InsightsTransactionClient) => Promise<T>): Promise<T>;
}
