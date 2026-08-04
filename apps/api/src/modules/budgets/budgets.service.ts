import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service.js";
import { BUDGETS_DATABASE, type BudgetsDatabasePort } from "./budgets-database.port.js";
import type { BudgetRecord } from "./budgets.types.js";
import type { CreateBudgetCategoryLimitDto, CreateBudgetDto, ListBudgetsDto, UpdateBudgetCategoryLimitDto, UpdateBudgetDto } from "./dto/budget.dto.js";

const money = /^(?!0(?:\.0{1,4})?$)\d{1,15}(?:\.\d{1,4})?$/;
const currency = /^[A-Z]{3}$/;
const budgetStatuses = new Set(["DRAFT", "ACTIVE", "CLOSED"]);

function monthDate(year: number, month: number): Date { return new Date(Date.UTC(year, month - 1, 1)); }
function nextMonth(month: Date): Date { return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)); }
function assertAmount(value: string): void { if (!money.test(value)) throw new BadRequestException({ code: "INVALID_AMOUNT", message: "Invalid amount" }); }
function assertBudgetInput(dto: CreateBudgetDto): void { if (!Number.isInteger(dto.month) || dto.month < 1 || dto.month > 12) throw new BadRequestException({ code: "INVALID_BUDGET_MONTH", message: "Invalid budget month" }); if (!Number.isInteger(dto.year) || dto.year < 2000 || dto.year > 2100) throw new BadRequestException({ code: "INVALID_BUDGET_YEAR", message: "Invalid budget year" }); if (dto.currency !== undefined && !currency.test(dto.currency)) throw new BadRequestException({ code: "INVALID_BUDGET_CURRENCY", message: "Invalid budget currency" }); if (dto.status !== undefined && !budgetStatuses.has(dto.status)) throw new BadRequestException({ code: "INVALID_BUDGET_STATUS", message: "Invalid budget status" }); }
function serialize(value: Prisma.Decimal): string { return value.toString(); }
function limitStatus(percent: Prisma.Decimal): "NORMAL" | "ALERT" | "EXCEEDED" { if (percent.greaterThanOrEqualTo(100)) return "EXCEEDED"; if (percent.greaterThanOrEqualTo(80)) return "ALERT"; return "NORMAL"; }

@Injectable()
export class BudgetsService {
  constructor(@Inject(BUDGETS_DATABASE) private readonly prisma: BudgetsDatabasePort, @Inject(AuditService) private readonly audit: AuditService) {}

  async create(userId: string, dto: CreateBudgetDto) { assertBudgetInput(dto);
    if (dto.totalLimit) assertAmount(dto.totalLimit);
    const month = monthDate(dto.year, dto.month);
    try {
      const budget = await this.prisma.createBudget({ userId, month, currency: dto.currency ?? "BRL", totalLimit: dto.totalLimit ? new Prisma.Decimal(dto.totalLimit) : null, status: dto.status ?? "DRAFT" });
      await this.audit.record({ action: "budget.create", actorUserId: userId, entityId: budget.id, entityType: "monthly_budget", eventType: "ENTITY_CREATED", riskLevel: "LOW", userId });
      return this.present(budget);
    } catch (error) { if (this.unique(error)) throw new ConflictException({ code: "BUDGET_DUPLICATE", message: "Budget already exists for this month" }); throw error; }
  }

  async list(userId: string, query: ListBudgetsDto) {
    const page = this.page(query.page, 1, Number.MAX_SAFE_INTEGER); const pageSize = this.page(query.pageSize, 20, 100); const sortBy = query.sortBy ?? "month"; const sortOrder = query.sortOrder ?? "desc";
    const monthFilter = query.year && query.month ? { gte: monthDate(query.year, query.month), lt: nextMonth(monthDate(query.year, query.month)) } : query.year ? { gte: monthDate(query.year, 1), lt: monthDate(query.year + 1, 1) } : undefined;
    const { records, total } = await this.prisma.listBudgets({ userId, currency: query.currency, status: query.status, month: monthFilter, orderBy: [{ [sortBy]: sortOrder }, { id: sortOrder }], skip: (page - 1) * pageSize, take: pageSize });
    return { data: records.map(record => this.presentSummary(record)), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async current(userId: string) { const now = new Date(); const budget = await this.prisma.findCurrentBudget(userId, monthDate(now.getUTCFullYear(), now.getUTCMonth() + 1)); if (!budget) throw this.notFound(); return this.present(budget); }
  async findOne(userId: string, id: string) { const budget = await this.prisma.findBudget(userId, id); if (!budget) throw this.notFound(); return this.present(budget); }
  async update(userId: string, id: string, dto: UpdateBudgetDto) { if (dto.totalLimit !== undefined && dto.totalLimit !== null) assertAmount(dto.totalLimit); await this.requireBudget(userId, id); const budget = await this.prisma.updateBudget(id, { totalLimit: dto.totalLimit === undefined ? undefined : dto.totalLimit === null ? null : new Prisma.Decimal(dto.totalLimit), status: dto.status }); await this.audit.record({ action: "budget.update", actorUserId: userId, entityId: id, entityType: "monthly_budget", eventType: "ENTITY_UPDATED", riskLevel: "LOW", userId }); return this.present(budget); }
  async remove(userId: string, id: string): Promise<void> { await this.requireBudget(userId, id); await this.prisma.updateBudget(id, { deletedAt: new Date(), status: "DELETED" }); await this.audit.record({ action: "budget.delete", actorUserId: userId, entityId: id, entityType: "monthly_budget", eventType: "ENTITY_DELETED", riskLevel: "MEDIUM", userId }); }
  async addLimit(userId: string, budgetId: string, dto: CreateBudgetCategoryLimitDto) { assertAmount(dto.limitAmount); await this.requireBudget(userId, budgetId); await this.requireExpenseCategory(userId, dto.categoryId); try { const limit = await this.prisma.createLimit({ budgetId, userId, categoryId: dto.categoryId, limitAmount: new Prisma.Decimal(dto.limitAmount) }); await this.audit.record({ action: "budget.limit.create", actorUserId: userId, entityId: limit.id, entityType: "budget_category_limit", eventType: "ENTITY_CREATED", riskLevel: "LOW", userId }); return { ...limit, limitAmount: serialize(limit.limitAmount) }; } catch (error) { if (this.unique(error)) throw new ConflictException({ code: "BUDGET_CATEGORY_DUPLICATE", message: "Category already has a budget limit" }); throw error; } }
  async updateLimit(userId: string, budgetId: string, id: string, dto: UpdateBudgetCategoryLimitDto) { assertAmount(dto.limitAmount); const limit = await this.prisma.findLimit(userId, budgetId, id); if (!limit) throw this.notFound(); const updated = await this.prisma.updateLimit(id, new Prisma.Decimal(dto.limitAmount)); await this.audit.record({ action: "budget.limit.update", actorUserId: userId, entityId: id, entityType: "budget_category_limit", eventType: "ENTITY_UPDATED", riskLevel: "LOW", userId }); return { ...updated, limitAmount: serialize(updated.limitAmount) }; }
  async removeLimit(userId: string, budgetId: string, id: string): Promise<void> { const limit = await this.prisma.findLimit(userId, budgetId, id); if (!limit) throw this.notFound(); await this.prisma.deleteLimit(id); await this.audit.record({ action: "budget.limit.delete", actorUserId: userId, entityId: id, entityType: "budget_category_limit", eventType: "ENTITY_DELETED", riskLevel: "MEDIUM", userId }); }
  private presentSummary(record: BudgetRecord) { const budget = { id: record.id, month: record.month, totalLimit: record.totalLimit, currency: record.currency, status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt }; return { ...budget, totalLimit: budget.totalLimit ? serialize(budget.totalLimit) : null, categoryLimitCount: record.budgetCategoryLimits.length }; }
  private async present(record: BudgetRecord) { const categoryIds = record.budgetCategoryLimits.map(limit => limit.categoryId); const grouped = await this.prisma.groupExpenseSpending(record.userId, categoryIds, record.month, record.currency); const spending = new Map(grouped.map(item => [item.categoryId, item.amount ?? new Prisma.Decimal(0)])); return { ...this.presentSummary(record), budgetCategoryLimits: record.budgetCategoryLimits.map(limit => { const spent = spending.get(limit.categoryId) ?? new Prisma.Decimal(0); const remaining = limit.limitAmount.minus(spent); const percent = spent.dividedBy(limit.limitAmount).mul(100); return { id: limit.id, category: limit.category, categoryId: limit.categoryId, limitAmount: serialize(limit.limitAmount), spentAmount: serialize(spent), remainingAmount: serialize(remaining), usedPercentage: percent.toFixed(2), status: limitStatus(percent) }; }) }; }
  private async requireBudget(userId: string, id: string) { if (!await this.prisma.findBudget(userId, id)) throw this.notFound(); }
  private async requireExpenseCategory(userId: string, id: string) { const category = await this.prisma.findExpenseCategory(userId, id); if (!category) throw this.notFound(); if (category.type !== "EXPENSE" && category.type !== "BOTH") throw new ConflictException({ code: "BUDGET_CATEGORY_INCOMPATIBLE", message: "Category must support expenses" }); }
  private page(value: number | undefined, fallback: number, maximum: number) { const candidate = value ?? fallback; const parsed = typeof candidate === "number" ? candidate : Number.parseInt(String(candidate), 10); if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) throw new BadRequestException({ code: "INVALID_PAGINATION", message: "Invalid pagination" }); return parsed; }
  private unique(error: unknown) { return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"; }
  private notFound() { return new NotFoundException({ code: "BUDGET_NOT_FOUND", message: "Budget not found" }); }
}
