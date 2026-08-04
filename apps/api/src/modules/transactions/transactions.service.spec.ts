import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { Test } from "@nestjs/testing";

import { AuditService } from "../audit/audit.service.js";
import { FINANCIAL_DATABASE, type FinancialDatabasePort } from "../financial/financial-database.port.js";
import { createAccount, createAuthenticatedUser, createCategory, createTransaction, createUser, testDate, testDecimal, testUuid } from "../../test-utils/financial-fixtures.js";
import { createFinancialPrismaMock, type FinancialPrismaMock } from "../../test-utils/financial-prisma.mock.js";
import { ListTransactionsDto, SortOrderDto, TransactionSortByDto } from "./dto/list-transactions.dto.js";
import { CreateTransactionDto, TransactionTypeDto } from "./dto/transaction.dto.js";
import { TransactionsService } from "./transactions.service.js";

describe("TransactionsService", () => {
  let database: FinancialPrismaMock;
  let service: TransactionsService;
  const audit = { record: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined) };

  beforeEach(async () => {
    database = createFinancialPrismaMock();
    const module = await Test.createTestingModule({ providers: [TransactionsService, { provide: FINANCIAL_DATABASE, useValue: database satisfies FinancialDatabasePort }, { provide: AuditService, useValue: audit }] }).compile();
    service = module.get(TransactionsService);
    audit.record.mockClear();
  });

  it("creates an income for the authenticated user with a Decimal balance increment", async () => {
    const user = createUser(); const authenticated = createAuthenticatedUser({ id: user.id }); const account = createAccount({ userId: user.id }); const category = createCategory({ userId: user.id, type: "INCOME" }); const record = createTransaction({ userId: user.id, accountId: account.id, categoryId: category.id, type: "INCOME", amount: testDecimal("12.3400") });
    database.account.findFirst.mockResolvedValue(account); database.category.findFirst.mockResolvedValue(category); database.transaction.create.mockResolvedValue(record); database.account.update.mockResolvedValue(account);
    const result = await service.create(authenticated.id, { accountId: account.id, amount: "12.3400", categoryId: category.id, description: "Salary", transactionDate: testDate().toISOString(), type: TransactionTypeDto.INCOME });
    expect(result.amount).toBe("12.34"); expect(database.transactionCalls).toBe(1); expect(account.initialBalance.toString()).toBe("100"); expect(database.account.update).toHaveBeenCalledWith(expect.objectContaining({ data: { currentBalance: { increment: record.amount } } })); expect(audit.record).not.toHaveBeenCalled(); expect(testUuid(7)).toHaveLength(36);
  });

  it("creates an expense with a Decimal balance decrement and permits a global category", async () => {
    const user = createUser(); const account = createAccount({ userId: user.id }); const category = createCategory({ userId: null, isDefault: true, type: "EXPENSE" }); const record = createTransaction({ userId: user.id, accountId: account.id, categoryId: category.id, type: "EXPENSE", amount: testDecimal("3.3333") });
    database.account.findFirst.mockResolvedValue(account); database.category.findFirst.mockResolvedValue(category); database.transaction.create.mockResolvedValue(record); database.account.update.mockResolvedValue(account);
    await service.create(user.id, { accountId: account.id, amount: "3.3333", categoryId: category.id, description: "Lunch", transactionDate: testDate().toISOString(), type: TransactionTypeDto.EXPENSE });
    expect(database.account.update).toHaveBeenCalledWith(expect.objectContaining({ data: { currentBalance: { decrement: record.amount } } }));
  });

  it("rejects unavailable accounts and incompatible categories", async () => {
    const user = createUser(); const account = createAccount({ userId: testUuid(22) }); database.account.findFirst.mockResolvedValue(null);
    await expect(service.create(user.id, { accountId: account.id, amount: "1.0000", description: "Denied", transactionDate: testDate().toISOString(), type: TransactionTypeDto.EXPENSE })).rejects.toMatchObject({ status: 404 });
    database.account.findFirst.mockResolvedValue(createAccount({ userId: user.id })); database.category.findFirst.mockResolvedValue(createCategory({ userId: user.id, type: "INCOME" }));
    await expect(service.create(user.id, { accountId: account.id, categoryId: testUuid(44), amount: "1.0000", description: "Denied", transactionDate: testDate().toISOString(), type: TransactionTypeDto.EXPENSE })).rejects.toMatchObject({ status: 409 });
  });

  it("returns owned non-deleted records and scopes the lookup", async () => {
    const user = createUser(); const record = createTransaction({ userId: user.id }); database.transaction.findFirst.mockResolvedValue(record);
    await expect(service.findOne(user.id, record.id)).resolves.toMatchObject({ id: record.id, amount: "10" });
    expect(database.transaction.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null, id: record.id, userId: user.id } })); database.transaction.findFirst.mockResolvedValue(null);
    await expect(service.findOne(user.id, record.id)).rejects.toMatchObject({ status: 404 });
  });

  it("builds a paginated, filtered and stable transaction query", async () => {
    const user = createUser(); const record = createTransaction({ userId: user.id }); database.transaction.findMany.mockResolvedValue([record]); database.transaction.count.mockResolvedValue(1);
    const query = plainToInstance(ListTransactionsDto, { accountId: record.accountId, categoryId: testUuid(8), currency: "BRL", endDate: "2026-01-31", page: "2", pageSize: "10", search: "test", sortBy: TransactionSortByDto.AMOUNT, sortOrder: SortOrderDto.ASC, startDate: "2026-01-01", status: "CONFIRMED", type: "INCOME" });
    expect(await validate(query)).toHaveLength(0); const result = await service.list(user.id, query);
    expect(result.meta).toEqual({ page: 2, pageSize: 10, total: 1, totalPages: 1 }); expect(result.data[0]?.amount).toBe("10"); expect(database.transactionCalls).toBe(1); expect(database.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ amount: "asc" }, { id: "asc" }], skip: 10, take: 10 }));
  });

  it("rejects invalid decimal strings and invalid pagination DTO values", async () => {
    for (const amount of ["0", "-1", "1.00001", "1e3", "NaN", "Infinity"]) { const dto = plainToInstance(CreateTransactionDto, { accountId: testUuid(1), amount, description: "Invalid", transactionDate: testDate().toISOString(), type: TransactionTypeDto.INCOME }); expect((await validate(dto)).length).toBeGreaterThan(0); }
    const query = plainToInstance(ListTransactionsDto, { page: "0", pageSize: "101" }); expect((await validate(query)).length).toBeGreaterThan(0);
  });

  it("reverses the previous income and applies the updated expense in one transaction", async () => {
    const user = createUser(); const oldAccount = createAccount({ userId: user.id }); const newAccount = createAccount({ id: testUuid(55), userId: user.id }); const previous = createTransaction({ userId: user.id, accountId: oldAccount.id, amount: testDecimal("10.2500"), type: "INCOME" }); const updated = createTransaction({ id: previous.id, userId: user.id, accountId: newAccount.id, amount: testDecimal("3.5000"), type: "EXPENSE" });
    database.transaction.findFirst.mockResolvedValue(previous); database.account.findFirst.mockResolvedValue(newAccount); database.transaction.update.mockResolvedValue(updated); database.account.update.mockResolvedValue(newAccount);
    const result = await service.update(user.id, previous.id, { accountId: newAccount.id, amount: "3.5000", type: TransactionTypeDto.EXPENSE });
    expect(result.amount).toBe("3.5"); expect(database.transactionCalls).toBe(1); expect(database.account.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: oldAccount.id }, data: { currentBalance: { decrement: previous.amount } } })); expect(database.account.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: newAccount.id }, data: { currentBalance: { decrement: updated.amount } } })); expect(oldAccount.initialBalance.toString()).toBe("100");
  });

  it("rejects updates for soft-deleted or foreign transactions without applying balances", async () => {
    const user = createUser(); database.transaction.findFirst.mockResolvedValue(null);
    await expect(service.update(user.id, testUuid(99), { description: "Denied" })).rejects.toMatchObject({ status: 404 });
    expect(database.account.update).not.toHaveBeenCalled(); expect(database.transactionCalls).toBe(1);
  });

  it("soft-deletes a confirmed transaction, reverses its balance and audits the deletion", async () => {
    const user = createUser(); const account = createAccount({ userId: user.id }); const record = createTransaction({ userId: user.id, accountId: account.id, type: "EXPENSE", amount: testDecimal("8.0000") }); database.transaction.findFirst.mockResolvedValue(record); database.account.update.mockResolvedValue(account); database.transaction.update.mockResolvedValue({ ...record, deletedAt: testDate(), status: "DELETED" });
    await service.remove(user.id, record.id);
    expect(database.account.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: account.id }, data: { currentBalance: { increment: record.amount } } })); expect(database.transaction.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DELETED" }) })); expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "transaction.delete", entityId: record.id })); expect(database.transactionCalls).toBe(1); expect(account.initialBalance.toString()).toBe("100");
  });

  it("does not delete a pending transaction or apply its balance twice", async () => {
    const user = createUser(); const record = createTransaction({ userId: user.id, status: "PENDING" }); database.transaction.findFirst.mockResolvedValue(record);
    await expect(service.remove(user.id, record.id)).rejects.toMatchObject({ status: 409 });
    expect(database.account.update).not.toHaveBeenCalled(); expect(database.transaction.update).not.toHaveBeenCalled();
  });
});
