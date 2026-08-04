import type { Prisma } from "@prisma/client";

export const budgetSelect = { id: true, userId: true, month: true, totalLimit: true, currency: true, status: true, createdAt: true, updatedAt: true, budgetCategoryLimits: { select: { id: true, categoryId: true, limitAmount: true, category: { select: { id: true, name: true, type: true } } } } } satisfies Prisma.MonthlyBudgetSelect;
export type BudgetRecord = Prisma.MonthlyBudgetGetPayload<{ select: typeof budgetSelect }>;
export interface BudgetLimitRecord { id: string; categoryId: string; limitAmount: Prisma.Decimal; }
export interface BudgetCategoryRecord { type: "INCOME" | "EXPENSE" | "BOTH"; }
export interface BudgetSpendingRecord { categoryId: string | null; amount: Prisma.Decimal | null; }
