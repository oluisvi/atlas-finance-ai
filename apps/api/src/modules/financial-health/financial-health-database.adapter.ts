import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { FinancialHealthDatabasePort, FinancialHealthBudgetLimitRow, FinancialHealthBudgetSpendingRow, FinancialHealthEmergencyFundRow, FinancialHealthFlowRow, FinancialHealthGoalRow } from "./financial-health-database.port.js";

@Injectable()
export class FinancialHealthDatabaseAdapter implements FinancialHealthDatabasePort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listCurrencies(userId: string): Promise<{ currency: string }[]> { return this.prisma.account.findMany({ where: { userId, deletedAt: null, status: { not: "DELETED" } }, select: { currency: true }, distinct: ["currency"] }); }
  async summarizeFlow(userId: string, currency: string, start: Date, end: Date): Promise<FinancialHealthFlowRow[]> { const rows = await this.prisma.transaction.groupBy({ by: ["type"], where: { userId, deletedAt: null, status: "CONFIRMED", transactionDate: { gte: start, lte: end }, account: { currency }, type: { in: ["INCOME", "EXPENSE", "ADJUSTMENT"] } }, _sum: { amount: true } }); return rows.map(row => ({ type: row.type, amount: row._sum.amount })); }
  listGoals(userId: string, currency: string): Promise<FinancialHealthGoalRow[]> { return this.prisma.goal.findMany({ where: { userId, deletedAt: null, status: "ACTIVE", currency, type: { not: "EMERGENCY_FUND" } }, select: { targetAmount: true, currentAmount: true, targetDate: true } }); }
  async findEmergencyFund(userId: string, currency: string): Promise<FinancialHealthEmergencyFundRow | null> { const plan = await this.prisma.emergencyFundPlan.findFirst({ where: { userId, goal: { deletedAt: null, type: "EMERGENCY_FUND", currency } }, select: { desiredMonths: true, essentialMonthlyExpense: true, goal: { select: { currentAmount: true } } } }); return plan === null ? null : { desiredMonths: plan.desiredMonths, essentialMonthlyExpense: plan.essentialMonthlyExpense, currentAmount: plan.goal.currentAmount }; }
  async sumCurrentBalance(userId: string, currency: string) { const value = await this.prisma.account.aggregate({ where: { userId, deletedAt: null, status: { not: "DELETED" }, currency }, _sum: { currentBalance: true } }); return value._sum.currentBalance; }
  async listBudgetLimits(userId: string, currency: string, month: Date): Promise<FinancialHealthBudgetLimitRow[]> { const budgets = await this.prisma.monthlyBudget.findMany({ where: { userId, deletedAt: null, month, currency }, select: { budgetCategoryLimits: { select: { categoryId: true, limitAmount: true } } } }); return budgets.flatMap(budget => budget.budgetCategoryLimits); }
  async summarizeBudgetSpending(userId: string, currency: string, start: Date, end: Date, categoryIds: string[]): Promise<FinancialHealthBudgetSpendingRow[]> { const rows = await this.prisma.transaction.groupBy({ by: ["categoryId"], where: { userId, deletedAt: null, status: "CONFIRMED", type: "EXPENSE", categoryId: { in: categoryIds }, transactionDate: { gte: start, lt: end }, account: { currency } }, _sum: { amount: true } }); return rows.map(row => ({ categoryId: row.categoryId, amount: row._sum.amount })); }
}
