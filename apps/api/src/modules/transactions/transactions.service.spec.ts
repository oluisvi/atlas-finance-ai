import { Test } from "@nestjs/testing";
import { AuditService } from "../audit/audit.service.js";
import { FINANCIAL_DATABASE, type FinancialDatabasePort } from "../financial/financial-database.port.js";
import { createAccount, createAuthenticatedUser, createCategory, createTransaction, createTransfer, createUser, testDate, testDecimal, testUuid } from "../../test-utils/financial-fixtures.js";
import { createFinancialPrismaMock, type FinancialPrismaMock } from "../../test-utils/financial-prisma.mock.js";
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

  it("creates an income with a Decimal amount, authenticated owner and balance increment", async () => {
    const user = createUser(); const authenticated = createAuthenticatedUser({ id: user.id }); const account = createAccount({ userId: user.id }); const category = createCategory({ userId: user.id, type: "INCOME" }); const expected = createTransaction({ accountId: account.id, amount: testDecimal("12.3400"), categoryId: category.id, type: "INCOME", userId: user.id }); const transfer = createTransfer();
    expect(transfer.amount.toString()).toBe("10");
    database.account.findFirst.mockResolvedValue(account); database.category.findFirst.mockResolvedValue(category); database.transaction.create.mockResolvedValue(expected); database.account.update.mockResolvedValue(account);
    const result = await service.create(authenticated.id, { accountId: account.id, amount: "12.3400", categoryId: category.id, description: "Salary", transactionDate: testDate().toISOString(), type: "INCOME" });
    expect(result.amount).toBe("12.34"); expect(database.transaction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: expect.anything(), userId: user.id }) })); expect(database.account.update).toHaveBeenCalledWith(expect.objectContaining({ data: { currentBalance: { increment: expected.amount } } })); expect(database.transactionCalls).toBe(1); expect(account.initialBalance.toString()).toBe("100"); expect(testUuid(77)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects an account outside the authenticated user scope", async () => {
    const user = createUser(); const account = createAccount({ userId: testUuid(2) }); database.account.findFirst.mockResolvedValue(null);
    await expect(service.create(user.id, { accountId: account.id, amount: "1.0000", description: "Expense", transactionDate: testDate().toISOString(), type: "EXPENSE" })).rejects.toMatchObject({ status: 404 });
    expect(database.account.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ deletedAt: null, userId: user.id }) }));
  });

  it("returns only non-deleted user transactions in stable paginated form", async () => {
    const user = createUser(); const record = createTransaction({ userId: user.id }); database.transaction.findMany.mockResolvedValue([record]); database.transaction.count.mockResolvedValue(1);
    const result = await service.list(user.id, { page: 1, pageSize: 20, sortBy: "transactionDate", sortOrder: "desc" });
    expect(result).toEqual(expect.objectContaining({ meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } })); expect(result.data[0]?.amount).toBe("10"); expect(database.transactionCalls).toBe(1);
  });
});
