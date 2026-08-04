import { Test } from "@nestjs/testing";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AuditService } from "../audit/audit.service.js";
import { createBudgetCategoryLimit, createCategory, createMonthlyBudget, createUser, testDecimal, testUuid } from "../../test-utils/financial-fixtures.js";
import { createBudgetsPrismaMock, type BudgetsPrismaMock } from "../../test-utils/budgets-prisma.mock.js";
import { BUDGETS_DATABASE, type BudgetsDatabasePort } from "./budgets-database.port.js";
import { BudgetsService } from "./budgets.service.js";
import { BudgetStatusDto, CreateBudgetCategoryLimitDto, CreateBudgetDto, ListBudgetsDto } from "./dto/budget.dto.js";

describe("BudgetsService", () => {
  let database: BudgetsPrismaMock;
  let service: BudgetsService;
  const audit = { record: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined) };

  beforeEach(async () => {
    database = createBudgetsPrismaMock();
    const module = await Test.createTestingModule({ providers: [BudgetsService, { provide: BUDGETS_DATABASE, useValue: database satisfies BudgetsDatabasePort }, { provide: AuditService, useValue: audit }] }).compile();
    service = module.get(BudgetsService);
    audit.record.mockClear();
  });

  it("creates a user-owned budget with Decimal input and sanitized output", async () => {
    const user = createUser(); const budget = createMonthlyBudget({ userId: user.id });
    database.createBudget.mockResolvedValue({ ...budget, budgetCategoryLimits: [] }); database.groupExpenseSpending.mockResolvedValue([]);
    const result = await service.create(user.id, { year: 2026, month: 1, totalLimit: "150.2500", status: BudgetStatusDto.ACTIVE });
    expect(result.totalLimit).toBe("100"); expect("userId" in result).toBe(false); expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "budget.create" }));
  });

  it("adds only positive limits for owned expense categories", async () => {
    const user = createUser(); const budget = createMonthlyBudget({ userId: user.id }); const category = createCategory({ userId: user.id }); const limit = createBudgetCategoryLimit({ budgetId: budget.id, userId: user.id, categoryId: category.id, limitAmount: testDecimal("80.0000") });
    database.findBudget.mockResolvedValue({ ...budget, budgetCategoryLimits: [] }); database.findExpenseCategory.mockResolvedValue({ type: "EXPENSE" }); database.createLimit.mockResolvedValue(limit);
    await expect(service.addLimit(user.id, budget.id, { categoryId: category.id, limitAmount: "80.0000" })).resolves.toMatchObject({ limitAmount: "80" });
    await expect(service.addLimit(user.id, budget.id, { categoryId: category.id, limitAmount: "0" })).rejects.toMatchObject({ status: 400 });
    database.findExpenseCategory.mockResolvedValue({ type: "INCOME" }); await expect(service.addLimit(user.id, budget.id, { categoryId: category.id, limitAmount: "1" })).rejects.toMatchObject({ status: 409 });
  });

  it("aggregates confirmed expense spending with Decimal alert thresholds", async () => {
    const user = createUser(); const category = createCategory({ userId: user.id }); const budget = createMonthlyBudget({ userId: user.id }); const limit = createBudgetCategoryLimit({ budgetId: budget.id, userId: user.id, categoryId: category.id, limitAmount: testDecimal("100.0000") });
    database.findBudget.mockResolvedValue({ ...budget, budgetCategoryLimits: [{ id: limit.id, categoryId: category.id, limitAmount: limit.limitAmount, category: { id: category.id, name: category.name, type: category.type } }] }); database.groupExpenseSpending.mockResolvedValue([{ categoryId: category.id, amount: testDecimal("100.0000") }]);
    await expect(service.findOne(user.id, budget.id)).resolves.toMatchObject({ budgetCategoryLimits: [expect.objectContaining({ spentAmount: "100", remainingAmount: "0", usedPercentage: "100.00", status: "EXCEEDED" })] });
    expect(database.groupExpenseSpending).toHaveBeenCalledWith(user.id, [category.id], budget.month, budget.currency);
  });

  it("returns a safe 404 for foreign budgets and limits", async () => {
    const user = createUser(); database.findBudget.mockResolvedValue(null); database.findLimit.mockResolvedValue(null);
    await expect(service.findOne(user.id, testUuid(90))).rejects.toMatchObject({ status: 404 }); await expect(service.removeLimit(user.id, testUuid(91), testUuid(92))).rejects.toMatchObject({ status: 404 }); expect(database.deleteLimit).not.toHaveBeenCalled();
  });

  it("maps duplicate budgets to a conflict and validates immutable client input", async () => {
    const user = createUser();
    database.createBudget.mockRejectedValue({ code: "P2002" });
    await expect(service.create(user.id, { year: 2026, month: 1 })).rejects.toMatchObject({ status: 409 });
    const dto = plainToInstance(CreateBudgetDto, { year: 2026, month: 13, currency: "brl", userId: user.id });
    expect((await validate(dto, { forbidNonWhitelisted: true, whitelist: true })).length).toBeGreaterThan(0);
  });

  it("rejects invalid month, year and currency at the service boundary", async () => {
    const user = createUser();
    await expect(service.create(user.id, { year: 2026, month: 13 })).rejects.toMatchObject({ status: 400 });
    await expect(service.create(user.id, { year: 1999, month: 1 })).rejects.toMatchObject({ status: 400 });
    await expect(service.create(user.id, { year: 2026, month: 1, currency: "brl" })).rejects.toMatchObject({ status: 400 });
    expect(database.createBudget).not.toHaveBeenCalled();
  });

  it("lists only owned, non-deleted budgets with bounded stable pagination", async () => {
    const user = createUser(); const budget = createMonthlyBudget({ userId: user.id });
    database.listBudgets.mockResolvedValue({ records: [{ ...budget, budgetCategoryLimits: [] }], total: 11 });
    const query = plainToInstance(ListBudgetsDto, { year: "2026", month: "1", currency: "BRL", status: "ACTIVE", page: "2", pageSize: "10", sortBy: "createdAt", sortOrder: "asc" });
    expect(await validate(query)).toHaveLength(0);
    await expect(service.list(user.id, query)).resolves.toMatchObject({ meta: { page: 2, pageSize: 10, total: 11, totalPages: 2 } });
    expect(database.listBudgets).toHaveBeenCalledWith(expect.objectContaining({ userId: user.id, skip: 10, take: 10, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }));
  });

  it("updates and soft-deletes only an owned budget with audit records", async () => {
    const user = createUser(); const budget = createMonthlyBudget({ userId: user.id });
    database.findBudget.mockResolvedValue({ ...budget, budgetCategoryLimits: [] }); database.updateBudget.mockResolvedValue({ ...budget, totalLimit: testDecimal("250.0000"), budgetCategoryLimits: [] }); database.groupExpenseSpending.mockResolvedValue([]);
    await expect(service.update(user.id, budget.id, { totalLimit: "250.0000" })).resolves.toMatchObject({ totalLimit: "250" });
    await service.remove(user.id, budget.id);
    expect(database.updateBudget).toHaveBeenLastCalledWith(budget.id, expect.objectContaining({ deletedAt: expect.any(Date), status: "DELETED" }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "budget.delete" }));
  });

  it("updates and removes an owned category limit and audits both operations", async () => {
    const user = createUser(); const budget = createMonthlyBudget({ userId: user.id }); const limit = createBudgetCategoryLimit({ budgetId: budget.id, userId: user.id });
    database.findLimit.mockResolvedValue({ id: limit.id, categoryId: limit.categoryId, limitAmount: limit.limitAmount }); database.updateLimit.mockResolvedValue({ id: limit.id, categoryId: limit.categoryId, limitAmount: testDecimal("120.0000") });
    await expect(service.updateLimit(user.id, budget.id, limit.id, { limitAmount: "120.0000" })).resolves.toMatchObject({ limitAmount: "120" });
    await service.removeLimit(user.id, budget.id, limit.id);
    expect(database.deleteLimit).toHaveBeenCalledWith(limit.id);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "budget.limit.delete" }));
  });

  it("rejects invalid monetary limit formats at the service boundary", async () => {
    const user = createUser(); const budget = createMonthlyBudget({ userId: user.id });
    for (const limitAmount of ["0", "-1", "1.00001", "1e3", "NaN", "Infinity"]) await expect(service.addLimit(user.id, budget.id, { categoryId: testUuid(71), limitAmount })).rejects.toMatchObject({ status: 400 });
    const dto = plainToInstance(CreateBudgetCategoryLimitDto, { categoryId: testUuid(72), limitAmount: "0" });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it.each([
    ["79.9999", "NORMAL", "20.0001"],
    ["80.0000", "ALERT", "20"],
    ["99.9999", "ALERT", "0.0001"],
    ["100.0000", "EXCEEDED", "0"],
    ["120.5000", "EXCEEDED", "-20.5"],
  ])("calculates %s as the expected budget state", async (amount, status, remainingAmount) => {
    const user = createUser(); const category = createCategory({ userId: user.id }); const budget = createMonthlyBudget({ userId: user.id }); const limit = createBudgetCategoryLimit({ budgetId: budget.id, userId: user.id, categoryId: category.id, limitAmount: testDecimal("100.0000") });
    database.findBudget.mockResolvedValue({ ...budget, budgetCategoryLimits: [{ id: limit.id, categoryId: category.id, limitAmount: limit.limitAmount, category: { id: category.id, name: category.name, type: category.type } }] }); database.groupExpenseSpending.mockResolvedValue([{ categoryId: category.id, amount: testDecimal(amount) }]);
    await expect(service.findOne(user.id, budget.id)).resolves.toMatchObject({ budgetCategoryLimits: [expect.objectContaining({ status, remainingAmount })] });
  });
});
