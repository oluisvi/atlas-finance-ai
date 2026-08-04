import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import type { BudgetListQuery, BudgetsDatabasePort } from "./budgets-database.port.js";
import { budgetSelect, type BudgetCategoryRecord, type BudgetLimitRecord, type BudgetRecord, type BudgetSpendingRecord } from "./budgets.types.js";

@Injectable()
export class BudgetsDatabaseAdapter implements BudgetsDatabasePort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  createBudget(data: Prisma.MonthlyBudgetUncheckedCreateInput): Promise<BudgetRecord> { return this.prisma.monthlyBudget.create({ data, select: budgetSelect }); }
  findBudget(userId: string, id: string): Promise<BudgetRecord | null> { return this.prisma.monthlyBudget.findFirst({ where: { id, userId, deletedAt: null }, select: budgetSelect }); }
  findCurrentBudget(userId: string, month: Date): Promise<BudgetRecord | null> { return this.prisma.monthlyBudget.findFirst({ where: { userId, month, deletedAt: null }, select: budgetSelect }); }
  async listBudgets(query: BudgetListQuery): Promise<{ records: BudgetRecord[]; total: number }> { const where = { userId: query.userId, deletedAt: null, currency: query.currency, status: query.status, month: query.month }; const [records, total] = await this.prisma.$transaction([this.prisma.monthlyBudget.findMany({ where, select: budgetSelect, orderBy: query.orderBy, skip: query.skip, take: query.take }), this.prisma.monthlyBudget.count({ where })]); return { records, total }; }
  updateBudget(id: string, data: Prisma.MonthlyBudgetUpdateInput): Promise<BudgetRecord> { return this.prisma.monthlyBudget.update({ where: { id }, data, select: budgetSelect }); }
  async createLimit(data: Prisma.BudgetCategoryLimitUncheckedCreateInput): Promise<BudgetLimitRecord> { return this.prisma.budgetCategoryLimit.create({ data, select: { id: true, categoryId: true, limitAmount: true } }); }
  async findLimit(userId: string, budgetId: string, id: string): Promise<BudgetLimitRecord | null> { return this.prisma.budgetCategoryLimit.findFirst({ where: { id, budgetId, userId, budget: { deletedAt: null } }, select: { id: true, categoryId: true, limitAmount: true } }); }
  async updateLimit(id: string, amount: Prisma.Decimal): Promise<BudgetLimitRecord> { return this.prisma.budgetCategoryLimit.update({ where: { id }, data: { limitAmount: amount }, select: { id: true, categoryId: true, limitAmount: true } }); }
  async deleteLimit(id: string): Promise<void> { await this.prisma.budgetCategoryLimit.delete({ where: { id } }); }
  findExpenseCategory(userId: string, id: string): Promise<BudgetCategoryRecord | null> { return this.prisma.category.findFirst({ where: { id, deletedAt: null, status: "ACTIVE", OR: [{ userId }, { userId: null, isDefault: true }] }, select: { type: true } }); }
  async groupExpenseSpending(userId: string, categoryIds: string[], month: Date, currency: string): Promise<BudgetSpendingRecord[]> { const records = await this.prisma.transaction.groupBy({ by: ["categoryId"], _sum: { amount: true }, where: { userId, categoryId: { in: categoryIds }, deletedAt: null, status: "CONFIRMED", type: "EXPENSE", transactionDate: { gte: month, lt: new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)) }, account: { currency } } }); return records.map(record => ({ categoryId: record.categoryId, amount: record._sum.amount })); }
}
