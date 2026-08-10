import type { FinancialInsight, InsightGenerationRun } from "@prisma/client";
import type { FinancialInsightDelegate, InsightGenerationRunDelegate, InsightsDatabasePort, InsightsTransactionClient } from "./insights-database.port.js";

export interface InsightsDatabaseState {
  insights: FinancialInsight[];
  runs: InsightGenerationRun[];
}

export interface InsightsDatabaseMock extends InsightsDatabasePort {
  financialInsight: { [Key in keyof FinancialInsightDelegate]: jest.MockedFunction<FinancialInsightDelegate[Key]> };
  insightGenerationRun: { [Key in keyof InsightGenerationRunDelegate]: jest.MockedFunction<InsightGenerationRunDelegate[Key]> };
  transactionCalls: Array<(database: InsightsTransactionClient) => Promise<unknown>>;
  state: InsightsDatabaseState;
}

export function createInsightsDatabaseMock(initial?: Partial<InsightsDatabaseState>): InsightsDatabaseMock {
  const state: InsightsDatabaseState = { insights: [...(initial?.insights ?? [])], runs: [...(initial?.runs ?? [])] };
  const financialInsight = {
    count: jest.fn<ReturnType<FinancialInsightDelegate["count"]>, Parameters<FinancialInsightDelegate["count"]>>(),
    create: jest.fn<ReturnType<FinancialInsightDelegate["create"]>, Parameters<FinancialInsightDelegate["create"]>>(),
    findFirst: jest.fn<ReturnType<FinancialInsightDelegate["findFirst"]>, Parameters<FinancialInsightDelegate["findFirst"]>>(),
    findMany: jest.fn<ReturnType<FinancialInsightDelegate["findMany"]>, Parameters<FinancialInsightDelegate["findMany"]>>(),
    update: jest.fn<ReturnType<FinancialInsightDelegate["update"]>, Parameters<FinancialInsightDelegate["update"]>>()
  };
  const insightGenerationRun = {
    create: jest.fn<ReturnType<InsightGenerationRunDelegate["create"]>, Parameters<InsightGenerationRunDelegate["create"]>>(),
    update: jest.fn<ReturnType<InsightGenerationRunDelegate["update"]>, Parameters<InsightGenerationRunDelegate["update"]>>()
  };
  const transactionCalls: Array<(database: InsightsTransactionClient) => Promise<unknown>> = [];
  const database: InsightsDatabaseMock = {
    financialInsight,
    insightGenerationRun,
    state,
    transactionCalls,
    $transaction: jest.fn(async <T>(operation: (client: InsightsTransactionClient) => Promise<T>, _options?: { isolationLevel: "Serializable" }): Promise<T> => {
      void _options;
      transactionCalls.push(operation);
      return operation({ financialInsight, insightGenerationRun });
    })
  };
  return database;
}
