import type { Prisma, TransactionType } from "@prisma/client";

export type FinancialHealthFlowRow = { type: TransactionType; amount: Prisma.Decimal | null };
export type FinancialHealthBudgetSpendingRow = { categoryId: string | null; amount: Prisma.Decimal | null };
export type FinancialHealthGoalRow = { targetAmount: Prisma.Decimal; currentAmount: Prisma.Decimal; targetDate: Date | null };
export type FinancialHealthEmergencyFundRow = { desiredMonths: number; essentialMonthlyExpense: Prisma.Decimal | null; currentAmount: Prisma.Decimal };
export type FinancialHealthBudgetLimitRow = { categoryId: string; limitAmount: Prisma.Decimal };

export interface FinancialHealthDatabasePort {
  listCurrencies(userId: string): Promise<{ currency: string }[]>;
  summarizeFlow(userId: string, currency: string, start: Date, end: Date): Promise<FinancialHealthFlowRow[]>;
  listGoals(userId: string, currency: string): Promise<FinancialHealthGoalRow[]>;
  findEmergencyFund(userId: string, currency: string): Promise<FinancialHealthEmergencyFundRow | null>;
  sumCurrentBalance(userId: string, currency: string): Promise<Prisma.Decimal | null>;
  listBudgetLimits(userId: string, currency: string, month: Date): Promise<FinancialHealthBudgetLimitRow[]>;
  summarizeBudgetSpending(userId: string, currency: string, start: Date, end: Date, categoryIds: string[]): Promise<FinancialHealthBudgetSpendingRow[]>;
}

export const FINANCIAL_HEALTH_DATABASE = Symbol("FINANCIAL_HEALTH_DATABASE");
