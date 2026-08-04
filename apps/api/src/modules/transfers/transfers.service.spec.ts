import { Test } from "@nestjs/testing";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AuditService } from "../audit/audit.service.js";
import { FINANCIAL_DATABASE, type FinancialDatabasePort } from "../financial/financial-database.port.js";
import { createAccount, createAuthenticatedUser, createCategory, createTransaction, createTransfer, createUser, testDate, testDecimal, testUuid } from "../../test-utils/financial-fixtures.js";
import { createFinancialPrismaMock, type FinancialPrismaMock } from "../../test-utils/financial-prisma.mock.js";
import { CreateTransferDto } from "./dto/create-transfer.dto.js";
import { ListTransfersDto, SortOrderDto, TransferSortByDto } from "./dto/list-transfers.dto.js";
import { TransfersService } from "./transfers.service.js";

describe("TransfersService", () => {
  let database: FinancialPrismaMock;
  let service: TransfersService;
  const audit = { record: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined) };
  beforeEach(async () => { database = createFinancialPrismaMock(); const module = await Test.createTestingModule({ providers: [TransfersService, { provide: FINANCIAL_DATABASE, useValue: database satisfies FinancialDatabasePort }, { provide: AuditService, useValue: audit }] }).compile(); service = module.get(TransfersService); audit.record.mockClear(); });

  it("creates an atomic transfer with linked out/in transactions and precise balances", async () => {
    const user = createUser(); const authenticated = createAuthenticatedUser({ id: user.id }); const from = createAccount({ userId: user.id }); const to = createAccount({ id: testUuid(33), userId: user.id }); const transfer = createTransfer({ userId: user.id, fromAccountId: from.id, toAccountId: to.id, amount: testDecimal("12.3456") }); const exampleTransaction = createTransaction({ userId: user.id, amount: transfer.amount }); const category = createCategory();
    expect(category.name).toBe("General"); expect(exampleTransaction.amount.toString()).toBe("12.3456"); database.account.findMany.mockResolvedValue([from, to]); database.transfer.create.mockResolvedValue(transfer); database.transaction.createMany.mockResolvedValue({ count: 2 }); database.account.update.mockResolvedValue(from);
    const result = await service.create(authenticated.id, { fromAccountId: from.id, toAccountId: to.id, amount: "12.3456", transferDate: testDate().toISOString() });
    expect(result.amount).toBe("12.3456"); expect(database.transaction.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ accountId: from.id, transferId: transfer.id, type: "TRANSFER_OUT" }), expect.objectContaining({ accountId: to.id, transferId: transfer.id, type: "TRANSFER_IN" })]) })); expect(database.account.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: { currentBalance: { decrement: transfer.amount } }, where: { id: from.id } })); expect(database.account.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { currentBalance: { increment: transfer.amount } }, where: { id: to.id } })); expect(from.initialBalance.toString()).toBe("100"); expect(to.initialBalance.toString()).toBe("100"); expect(database.transactionCalls).toBe(1); expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "transfer.create", entityId: transfer.id }));
  });

  it("rejects same-account, foreign and currency-mismatched transfers", async () => {
    const user = createUser(); const account = createAccount({ userId: user.id }); const foreign = createAccount({ id: testUuid(22), userId: testUuid(23) });
    await expect(service.create(user.id, { fromAccountId: account.id, toAccountId: account.id, amount: "1.0000", transferDate: testDate().toISOString() })).rejects.toMatchObject({ status: 409 });
    database.account.findMany.mockResolvedValue([account]); await expect(service.create(user.id, { fromAccountId: account.id, toAccountId: foreign.id, amount: "1.0000", transferDate: testDate().toISOString() })).rejects.toMatchObject({ status: 404 });
    database.account.findMany.mockResolvedValue([account, createAccount({ id: foreign.id, userId: user.id, currency: "USD" })]); await expect(service.create(user.id, { fromAccountId: account.id, toAccountId: foreign.id, amount: "1.0000", transferDate: testDate().toISOString() })).rejects.toMatchObject({ status: 409 }); expect(testUuid(44)).toHaveLength(36);
  });

  it("scopes active source and destination accounts to the authenticated user", async () => {
    const user = createUser();
    const from = createAccount({ userId: user.id });
    const archived = createAccount({ id: testUuid(42), userId: user.id, status: "ARCHIVED" });

    database.account.findMany.mockResolvedValue([]);

    await expect(service.create(user.id, {
      fromAccountId: from.id,
      toAccountId: archived.id,
      amount: "1.0000",
      transferDate: testDate().toISOString(),
    })).rejects.toMatchObject({ status: 404 });

    expect(database.account.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        id: { in: [from.id, archived.id] },
        status: "ACTIVE",
        userId: user.id,
      },
    });
    expect(database.transfer.create).not.toHaveBeenCalled();
  });

  it("propagates a failed transfer creation without recording an audit event", async () => {
    const user = createUser();
    const from = createAccount({ userId: user.id });
    const to = createAccount({ id: testUuid(43), userId: user.id });

    database.account.findMany.mockResolvedValue([from, to]);
    database.transfer.create.mockRejectedValue(new Error("database failure"));

    await expect(service.create(user.id, {
      fromAccountId: from.id,
      toAccountId: to.id,
      amount: "1.0000",
      transferDate: testDate().toISOString(),
    })).rejects.toThrow("database failure");

    expect(database.transactionCalls).toBe(1);
    expect(database.transaction.createMany).not.toHaveBeenCalled();
    expect(database.account.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("finds only an owned non-deleted transfer", async () => {
    const user = createUser();
    const transfer = createTransfer({ userId: user.id, amount: testDecimal("7.5000") });

    database.transfer.findFirst.mockResolvedValue(transfer);

    await expect(service.findOne(user.id, transfer.id)).resolves.toMatchObject({
      amount: "7.5",
      id: transfer.id,
    });
    expect(database.transfer.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { deletedAt: null, id: transfer.id, userId: user.id },
    }));

    database.transfer.findFirst.mockResolvedValue(null);
    await expect(service.findOne(user.id, transfer.id)).rejects.toMatchObject({ status: 404 });
  });

  it("builds a scoped, filtered, paginated and stably ordered transfer query", async () => {
    const user = createUser();
    const transfer = createTransfer({ userId: user.id });
    const query = plainToInstance(ListTransfersDto, {
      destinationAccountId: transfer.toAccountId,
      endDate: "2026-01-31",
      page: "2",
      pageSize: "10",
      sortBy: TransferSortByDto.AMOUNT,
      sortOrder: SortOrderDto.ASC,
      sourceAccountId: transfer.fromAccountId,
      startDate: "2026-01-01",
    });

    database.transfer.findMany.mockResolvedValue([transfer]);
    database.transfer.count.mockResolvedValue(11);

    expect(await validate(query)).toHaveLength(0);
    await expect(service.list(user.id, query)).resolves.toEqual({
      data: [expect.objectContaining({ amount: "10", id: transfer.id })],
      meta: { page: 2, pageSize: 10, total: 11, totalPages: 2 },
    });
    expect(database.transactionCalls).toBe(1);
    expect(database.transfer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ amount: "asc" }, { id: "asc" }],
      skip: 10,
      take: 10,
      where: expect.objectContaining({
        deletedAt: null,
        fromAccountId: transfer.fromAccountId,
        toAccountId: transfer.toAccountId,
        userId: user.id,
      }),
    }));
    expect(database.transfer.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: user.id }),
    }));
  });

  it("rejects invalid list pagination and filters at the DTO boundary", async () => {
    const query = plainToInstance(ListTransfersDto, {
      destinationAccountId: "not-a-uuid",
      page: "0",
      pageSize: "101",
      sortBy: "unknown",
      sourceAccountId: "not-a-uuid",
      startDate: "not-a-date",
    });

    expect((await validate(query)).length).toBeGreaterThan(0);
  });

  it("returns scoped records and reverses both balance legs on soft delete", async () => {
    const user = createUser(); const transfer = createTransfer({ userId: user.id }); const from = createAccount({ id: transfer.fromAccountId, userId: user.id }); const to = createAccount({ id: transfer.toAccountId, userId: user.id }); database.transfer.findFirst.mockResolvedValue(transfer); database.account.update.mockResolvedValue(from); database.transaction.updateMany.mockResolvedValue({ count: 2 }); database.transfer.update.mockResolvedValue({ ...transfer, deletedAt: testDate(), status: "DELETED" });
    await service.remove(user.id, transfer.id); expect(database.account.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: { currentBalance: { increment: transfer.amount } }, where: { id: from.id } })); expect(database.account.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { currentBalance: { decrement: transfer.amount } }, where: { id: to.id } })); expect(database.transaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null, transferId: transfer.id } })); expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "transfer.delete" }));
    database.transfer.findMany.mockResolvedValue([transfer]); database.transfer.count.mockResolvedValue(1); const list = await service.list(user.id, { page: 1, pageSize: 20, sortBy: TransferSortByDto.TRANSFER_DATE, sortOrder: SortOrderDto.DESC } satisfies ListTransfersDto); expect(list.meta.total).toBe(1);
  });

  it("does not reverse a foreign or already deleted transfer and does not audit it", async () => {
    const user = createUser();

    database.transfer.findFirst.mockResolvedValue(null);

    await expect(service.remove(user.id, testUuid(98))).rejects.toMatchObject({ status: 404 });
    expect(database.account.update).not.toHaveBeenCalled();
    expect(database.transaction.updateMany).not.toHaveBeenCalled();
    expect(database.transfer.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
    expect(database.transfer.findFirst).toHaveBeenCalledWith({
      where: { deletedAt: null, id: testUuid(98), userId: user.id },
    });
  });

  it("does not audit a failed reversal", async () => {
    const user = createUser();
    const transfer = createTransfer({ userId: user.id });

    database.transfer.findFirst.mockResolvedValue(transfer);
    database.account.update.mockRejectedValue(new Error("balance update failure"));

    await expect(service.remove(user.id, transfer.id)).rejects.toThrow("balance update failure");

    expect(database.transactionCalls).toBe(1);
    expect(database.transaction.updateMany).not.toHaveBeenCalled();
    expect(database.transfer.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("validates transfer DTO amount format", async () => {
    const baseTransfer = {
      fromAccountId: testUuid(1),
      toAccountId: testUuid(2),
      transferDate: testDate().toISOString(),
    };

    for (const amount of ["0", "0.0000", "-1.00", "1.00000", "1e3"]) {
      const errors = await validate(
        plainToInstance(CreateTransferDto, { ...baseTransfer, amount }),
      );

      expect(errors).not.toHaveLength(0);
    }

    const validErrors = await validate(
      plainToInstance(CreateTransferDto, {
        ...baseTransfer,
        amount: "0.0001",
      }),
    );

    expect(validErrors).toHaveLength(0);
  });
});
