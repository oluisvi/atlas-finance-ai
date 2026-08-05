import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { GoalContributionType, GoalStatus, Prisma, type Goal, type GoalContribution } from "@prisma/client";
import { AuditService } from "../audit/audit.service.js";
import { FINANCIAL_DATABASE, type FinancialDatabasePort, type FinancialTransactionPort } from "../financial/financial-database.port.js";
import { serializeDecimal } from "../financial/money.js";
import { CreateGoalContributionDto, CreateGoalDto, ListGoalsDto, UpdateGoalDto } from "./dto/goal.dto.js";

const money = /^(?!0(?:\.0{1,4})?$)\d{1,15}(?:\.\d{1,4})?$/;
const currency = /^[A-Z]{3}$/;
const goalTypes = new Set(["GENERIC", "EMERGENCY_FUND", "TRAVEL", "VEHICLE", "PROPERTY", "RETIREMENT", "PURCHASE"]);
const priorities = new Set(["LOW", "MEDIUM", "HIGH"]);
const statuses = new Set(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]);
const contributionTypes = new Set(["CONTRIBUTION", "WITHDRAWAL", "ADJUSTMENT"]);
type GoalStatusInput = Exclude<GoalStatus, "DELETED">;
type GoalSortField = "createdAt" | "targetDate" | "targetAmount" | "priority";
type GoalResponse = { id: string; name: string; type: string; targetAmount: string; currentAmount: string; remainingAmount: string; progressPercentage: string; targetDate: Date | null; currency: string; priority: string; status: string; completedAt: Date | null; createdAt: Date; updatedAt: Date };
type ContributionResponse = { id: string; goalId: string; type: string; amount: string; contributionDate: Date; notes: string | null; createdAt: Date; updatedAt: Date };
type AuditPort = Pick<AuditService, "record">;

@Injectable()
export class GoalsService {
  constructor(@Inject(FINANCIAL_DATABASE) private readonly prisma: FinancialDatabasePort, @Inject(AuditService) private readonly audit: AuditPort) {}

  async create(userId: string, dto: CreateGoalDto): Promise<GoalResponse> {
    this.assertCreate(dto);
    const goal = await this.prisma.goal.create({ data: { userId, name: dto.name.trim(), type: dto.type ?? "GENERIC", targetAmount: new Prisma.Decimal(dto.targetAmount), targetDate: dto.targetDate ? this.date(dto.targetDate, "INVALID_TARGET_DATE") : null, currency: dto.currency ?? "BRL", priority: dto.priority ?? "MEDIUM" } });
    await this.record(userId, "goal.create", goal.id, "ENTITY_CREATED", "LOW");
    return this.present(goal);
  }

  async list(userId: string, query: ListGoalsDto): Promise<{ data: GoalResponse[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }> {
    const page = this.page(query.page, 1, Number.MAX_SAFE_INTEGER); const pageSize = this.page(query.pageSize, 20, 100); const order = query.sortOrder ?? "desc"; const sortBy = (query.sortBy ?? "createdAt") as GoalSortField;
    const targetDate = this.dateRange(query.startDate, query.endDate);
    const where: Prisma.GoalWhereInput = { userId, deletedAt: null, type: query.type, priority: query.priority, status: query.status, currency: query.currency, targetDate, ...(query.search ? { name: { contains: query.search.trim(), mode: "insensitive" } } : {}) };
    const [records, total] = await this.prisma.$transaction([this.prisma.goal.findMany({ where, orderBy: [{ [sortBy]: order }, { id: order }], skip: (page - 1) * pageSize, take: pageSize }), this.prisma.goal.count({ where })]);
    return { data: records.map(record => this.present(record)), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(userId: string, id: string): Promise<GoalResponse & { contributions: ContributionResponse[] }> {
    const goal = await this.requireGoal(this.prisma, userId, id);
    const contributions = await this.prisma.goalContribution.findMany({ where: { userId, goalId: id, deletedAt: null }, orderBy: [{ contributionDate: "desc" }, { id: "desc" }] });
    return { ...this.present(goal), contributions: contributions.map(item => this.presentContribution(item)) };
  }

  async update(userId: string, id: string, dto: UpdateGoalDto): Promise<GoalResponse> {
    this.assertUpdate(dto); const goal = await this.requireGoal(this.prisma, userId, id);
    const currentStatus: GoalStatusInput = goal.status === "DELETED" ? "ARCHIVED" : goal.status; const status: GoalStatusInput = dto.status ?? currentStatus; this.assertTransition(goal.status, status);
    const updated = await this.prisma.goal.update({ where: { id }, data: { name: dto.name?.trim(), type: dto.type, targetAmount: dto.targetAmount === undefined ? undefined : new Prisma.Decimal(dto.targetAmount), targetDate: dto.targetDate === undefined ? undefined : dto.targetDate === null ? null : this.date(dto.targetDate, "INVALID_TARGET_DATE"), currency: dto.currency, priority: dto.priority, status, completedAt: status === "COMPLETED" && goal.status !== "COMPLETED" ? new Date() : undefined } });
    await this.record(userId, "goal.update", id, "ENTITY_UPDATED", "LOW"); return this.present(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireGoal(this.prisma, userId, id); await this.prisma.goal.update({ where: { id }, data: { status: "DELETED", deletedAt: new Date() } }); await this.record(userId, "goal.delete", id, "ENTITY_DELETED", "MEDIUM");
  }

  async addContribution(userId: string, goalId: string, dto: CreateGoalContributionDto): Promise<ContributionResponse> {
    this.assertContribution(dto);
    const contribution = await this.prisma.$transaction(async transaction => {
      const goal = await this.requireGoal(transaction, userId, goalId); if (goal.status !== "ACTIVE") throw new ConflictException({ code: "GOAL_NOT_ACTIVE", message: "Goal must be active" });
      const amount = new Prisma.Decimal(dto.amount); const next = this.nextAmount(goal.currentAmount, amount, dto.type); if (next.isNegative()) throw new ConflictException({ code: "GOAL_INSUFFICIENT_BALANCE", message: "Contribution would make goal amount negative" });
      const created = await transaction.goalContribution.create({ data: { userId, goalId, type: dto.type, amount, contributionDate: this.date(dto.contributionDate, "INVALID_CONTRIBUTION_DATE"), notes: dto.notes?.trim() || null } });
      await transaction.goal.update({ where: { id: goalId }, data: { currentAmount: next } }); return created;
    });
    await this.record(userId, "goal.contribution.create", contribution.id, "ENTITY_CREATED", "LOW"); return this.presentContribution(contribution);
  }

  async listContributions(userId: string, goalId: string): Promise<{ data: ContributionResponse[] }> {
    await this.requireGoal(this.prisma, userId, goalId); const contributions = await this.prisma.goalContribution.findMany({ where: { userId, goalId, deletedAt: null }, orderBy: [{ contributionDate: "desc" }, { id: "desc" }] }); return { data: contributions.map(item => this.presentContribution(item)) };
  }

  async removeContribution(userId: string, goalId: string, contributionId: string): Promise<void> {
    await this.prisma.$transaction(async transaction => {
      const goal = await this.requireGoal(transaction, userId, goalId); const contribution = await transaction.goalContribution.findFirst({ where: { id: contributionId, userId, goalId, deletedAt: null } }); if (!contribution) throw new NotFoundException({ code: "GOAL_CONTRIBUTION_NOT_FOUND", message: "Goal contribution not found" });
      const next = this.reverseAmount(goal.currentAmount, contribution.amount, contribution.type); if (next.isNegative()) throw new ConflictException({ code: "GOAL_INSUFFICIENT_BALANCE", message: "Contribution cannot be removed safely" });
      await transaction.goalContribution.update({ where: { id: contributionId }, data: { deletedAt: new Date() } }); await transaction.goal.update({ where: { id: goalId }, data: { currentAmount: next } });
    });
    await this.record(userId, "goal.contribution.delete", contributionId, "ENTITY_DELETED", "MEDIUM");
  }

  private async requireGoal(database: FinancialTransactionPort, userId: string, id: string): Promise<Goal> { const goal = await database.goal.findFirst({ where: { id, userId, deletedAt: null } }); if (!goal) throw new NotFoundException({ code: "GOAL_NOT_FOUND", message: "Goal not found" }); return goal; }
  private present(goal: Goal): GoalResponse { const remaining = Prisma.Decimal.max(new Prisma.Decimal(0), goal.targetAmount.minus(goal.currentAmount)); const progress = goal.currentAmount.dividedBy(goal.targetAmount).mul(100); return { id: goal.id, name: goal.name, type: goal.type, targetAmount: serializeDecimal(goal.targetAmount), currentAmount: serializeDecimal(goal.currentAmount), remainingAmount: serializeDecimal(remaining), progressPercentage: progress.toFixed(2), targetDate: goal.targetDate, currency: goal.currency, priority: goal.priority, status: goal.status, completedAt: goal.completedAt, createdAt: goal.createdAt, updatedAt: goal.updatedAt }; }
  private presentContribution(item: GoalContribution): ContributionResponse { return { id: item.id, goalId: item.goalId, type: item.type, amount: serializeDecimal(item.amount), contributionDate: item.contributionDate, notes: item.notes, createdAt: item.createdAt, updatedAt: item.updatedAt }; }
  private nextAmount(current: Prisma.Decimal, amount: Prisma.Decimal, type: string): Prisma.Decimal { return type === "WITHDRAWAL" ? current.minus(amount) : current.plus(amount); }
  private reverseAmount(current: Prisma.Decimal, amount: Prisma.Decimal, type: GoalContributionType): Prisma.Decimal { return type === "WITHDRAWAL" ? current.plus(amount) : current.minus(amount); }
  private assertCreate(dto: CreateGoalDto): void { if (!dto.name?.trim()) throw new BadRequestException({ code: "INVALID_GOAL_NAME", message: "Invalid goal name" }); if (!money.test(dto.targetAmount)) this.invalidAmount(); if (dto.currency !== undefined && !currency.test(dto.currency)) throw new BadRequestException({ code: "INVALID_GOAL_CURRENCY", message: "Invalid currency" }); if (dto.type !== undefined && !goalTypes.has(dto.type)) throw new BadRequestException({ code: "INVALID_GOAL_TYPE", message: "Invalid goal type" }); if (dto.priority !== undefined && !priorities.has(dto.priority)) throw new BadRequestException({ code: "INVALID_GOAL_PRIORITY", message: "Invalid goal priority" }); }
  private assertUpdate(dto: UpdateGoalDto): void { if (dto.name !== undefined && !dto.name.trim()) throw new BadRequestException({ code: "INVALID_GOAL_NAME", message: "Invalid goal name" }); if (dto.targetAmount !== undefined && !money.test(dto.targetAmount)) this.invalidAmount(); if (dto.currency !== undefined && !currency.test(dto.currency)) throw new BadRequestException({ code: "INVALID_GOAL_CURRENCY", message: "Invalid currency" }); if (dto.type !== undefined && !goalTypes.has(dto.type)) throw new BadRequestException({ code: "INVALID_GOAL_TYPE", message: "Invalid goal type" }); if (dto.priority !== undefined && !priorities.has(dto.priority)) throw new BadRequestException({ code: "INVALID_GOAL_PRIORITY", message: "Invalid goal priority" }); if (dto.status !== undefined && !statuses.has(dto.status)) throw new BadRequestException({ code: "INVALID_GOAL_STATUS", message: "Invalid goal status" }); }
  private assertContribution(dto: CreateGoalContributionDto): void { if (!money.test(dto.amount)) this.invalidAmount(); if (!contributionTypes.has(dto.type)) throw new BadRequestException({ code: "INVALID_CONTRIBUTION_TYPE", message: "Invalid contribution type" }); }
  private assertTransition(from: GoalStatus, to: GoalStatusInput): void { const allowed: Record<GoalStatus, readonly GoalStatusInput[]> = { ACTIVE: ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"], PAUSED: ["PAUSED", "ACTIVE", "COMPLETED", "ARCHIVED"], COMPLETED: ["COMPLETED", "ARCHIVED"], ARCHIVED: ["ARCHIVED"], DELETED: [] }; if (!allowed[from].includes(to)) throw new ConflictException({ code: "INVALID_GOAL_STATUS_TRANSITION", message: "Invalid goal status transition" }); }
  private date(value: string, code: string): Date { const date = new Date(value); if (Number.isNaN(date.getTime())) throw new BadRequestException({ code, message: "Invalid date" }); return date; }
  private dateRange(start?: string, end?: string): Prisma.DateTimeFilter | undefined { if (!start && !end) return undefined; const range: Prisma.DateTimeFilter = {}; if (start) range.gte = this.date(start, "INVALID_DATE_RANGE"); if (end) range.lte = this.date(end, "INVALID_DATE_RANGE"); if (range.gte && range.lte && range.gte > range.lte) throw new BadRequestException({ code: "INVALID_DATE_RANGE", message: "Invalid date range" }); return range; }
  private page(value: number | undefined, fallback: number, maximum: number): number { const candidate = value ?? fallback; const parsed = typeof candidate === "number" ? candidate : Number.parseInt(String(candidate), 10); if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) throw new BadRequestException({ code: "INVALID_PAGINATION", message: "Invalid pagination" }); return parsed; }
  private invalidAmount(): never { throw new BadRequestException({ code: "INVALID_AMOUNT", message: "Invalid amount" }); }
  private async record(userId: string, action: string, entityId: string, eventType: "ENTITY_CREATED" | "ENTITY_UPDATED" | "ENTITY_DELETED", riskLevel: "LOW" | "MEDIUM"): Promise<void> { await this.audit.record({ action, actorUserId: userId, entityId, entityType: "goal", eventType, riskLevel, userId }); }
}
