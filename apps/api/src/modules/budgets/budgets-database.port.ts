import type { Prisma } from "@prisma/client";
import type { BudgetCategoryRecord, BudgetLimitRecord, BudgetRecord, BudgetSpendingRecord } from "./budgets.types.js";

export interface BudgetListQuery { userId: string; currency?: string; status?: "DRAFT" | "ACTIVE" | "CLOSED"; month?: { gte: Date; lt: Date }; orderBy: Prisma.MonthlyBudgetOrderByWithRelationInput[]; skip: number; take: number; }
export interface BudgetsDatabasePort {
  createBudget(data: Prisma.MonthlyBudgetUncheckedCreateInput): Promise<BudgetRecord>;
  findBudget(userId: string, id: string): Promise<BudgetRecord | null>;
  findCurrentBudget(userId: string, month: Date): Promise<BudgetRecord | null>;
  listBudgets(query: BudgetListQuery): Promise<{ records: BudgetRecord[]; total: number }>;
  updateBudget(id: string, data: Prisma.MonthlyBudgetUpdateInput): Promise<BudgetRecord>;
  createLimit(data: Prisma.BudgetCategoryLimitUncheckedCreateInput): Promise<BudgetLimitRecord>;
  findLimit(userId: string, budgetId: string, id: string): Promise<BudgetLimitRecord | null>;
  updateLimit(id: string, amount: Prisma.Decimal): Promise<BudgetLimitRecord>;
  deleteLimit(id: string): Promise<void>;
  findExpenseCategory(userId: string, id: string): Promise<BudgetCategoryRecord | null>;
  groupExpenseSpending(userId: string, categoryIds: string[], month: Date, currency: string): Promise<BudgetSpendingRecord[]>;
}
export const BUDGETS_DATABASE = Symbol("BUDGETS_DATABASE");
