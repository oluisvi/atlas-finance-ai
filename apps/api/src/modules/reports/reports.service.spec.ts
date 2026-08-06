import "reflect-metadata";
import { Prisma } from "@prisma/client";
import { CashFlowGroupDto } from "../dashboard/dto/dashboard.dto.js";
import { ReportsService } from "./reports.service.js";

const decimal = (value: string): Prisma.Decimal => new Prisma.Decimal(value);
const account = (id: string, currency: string, currentBalance: string) => ({ id, name: id, type: "CHECKING", currency, currentBalance: decimal(currentBalance) });
const transaction = (type: string, amount: string, date: string, accountId: string) => ({ type, amount: decimal(amount), transactionDate: new Date(date), accountId });

describe("ReportsService", () => {
  const dashboard = {
    overview: jest.fn(() => Promise.resolve({ period: {}, income: "10", expenses: "4", netCashFlow: "6" })),
    cashFlow: jest.fn(() => Promise.resolve({ data: [] })),
    categories: jest.fn(() => Promise.resolve({ data: [] })), budgets: jest.fn(() => Promise.resolve({ data: [] })),
    goals: jest.fn(() => Promise.resolve({ data: [] })), accounts: jest.fn(() => Promise.resolve({ data: [] })),
    recurring: jest.fn(() => Promise.resolve({ data: [] }))
  };
  const reader = { account: { findMany: jest.fn() }, transaction: { findMany: jest.fn() } };
  const service = new ReportsService(dashboard, reader);

  beforeEach(() => { jest.clearAllMocks(); reader.account.findMany.mockResolvedValue([]); reader.transaction.findMany.mockResolvedValue([]); });

  it("keeps the existing dashboard groupings", async () => {
    await service.cashFlow("user-a", {}); await service.monthly("user-a", {});
    expect(dashboard.cashFlow).toHaveBeenCalledWith("user-a", { groupBy: CashFlowGroupDto.DAY });
    expect(dashboard.cashFlow).toHaveBeenCalledWith("user-a", { groupBy: CashFlowGroupDto.MONTH });
  });

  it("calculates net worth, account participation, and a reconstructed timeline", async () => {
    reader.account.findMany.mockResolvedValue([account("a", "BRL", "150"), account("b", "BRL", "50")]);
    reader.transaction.findMany.mockResolvedValue([
      transaction("INCOME", "100", "2025-01-02", "a"), transaction("EXPENSE", "30", "2025-01-03", "a"),
      transaction("ADJUSTMENT", "10", "2025-01-04", "b")
    ]);
    const result = await service.netWorth("user-a", { startDate: "2025-01-01", endDate: "2025-01-31" });
    expect(result.data[0]).toMatchObject({ currency: "BRL", currentNetWorth: "200", estimatedInitialNetWorth: "120", netChange: "80", variationPercentage: "66.67" });
    expect(result.data[0]?.accounts).toEqual(expect.arrayContaining([expect.objectContaining({ accountId: "a", participationPercentage: "75.00" })]));
    expect(result.data[0]?.timeline).toEqual(expect.arrayContaining([expect.objectContaining({ date: "2025-01-02", netWorth: "220" }), expect.objectContaining({ date: "2025-01-31", netWorth: "200" })]));
    expect(reader.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "user-a", status: "CONFIRMED", deletedAt: null, type: { in: ["INCOME", "EXPENSE", "ADJUSTMENT"] } }) }));
  });

  it("separates currencies and keeps transfers out of the net-worth impact", async () => {
    reader.account.findMany.mockResolvedValue([account("brl", "BRL", "100"), account("usd", "USD", "20")]);
    reader.transaction.findMany.mockResolvedValue([]);
    const result = await service.netWorth("user-a", { startDate: "2025-01-01", endDate: "2025-01-31" });
    expect(result.data).toEqual(expect.arrayContaining([expect.objectContaining({ currency: "BRL", netChange: "0" }), expect.objectContaining({ currency: "USD", currentNetWorth: "20" })]));
    expect(reader.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ type: { in: ["INCOME", "EXPENSE", "ADJUSTMENT"] } }) }));
  });

  it("uses null percentage for zero initial net worth and rejects a foreign account safely", async () => {
    reader.account.findMany.mockResolvedValueOnce([account("a", "BRL", "100")]);
    reader.transaction.findMany.mockResolvedValueOnce([transaction("INCOME", "100", "2025-01-02", "a")]);
    await expect(service.netWorth("user-a", { startDate: "2025-01-01", endDate: "2025-01-31" })).resolves.toMatchObject({ data: [expect.objectContaining({ variationPercentage: null })] });
    reader.account.findMany.mockResolvedValueOnce([]);
    await expect(service.netWorth("user-b", { accountId: "00000000-0000-4000-8000-000000000099" })).rejects.toMatchObject({ response: expect.objectContaining({ code: "ACCOUNT_NOT_FOUND" }) });
  });

  it("creates an annual series per currency with zero-data years and year-end reconstruction", async () => {
    reader.account.findMany.mockResolvedValue([account("a", "BRL", "200")]);
    reader.transaction.findMany.mockResolvedValue([
      transaction("INCOME", "100", "2024-03-01", "a"), transaction("EXPENSE", "25", "2024-04-01", "a"),
      transaction("EXPENSE", "50", "2025-01-01", "a")
    ]);
    const result = await service.yearly("user-a", { startYear: 2024, endYear: 2026 });
    expect(result.data).toEqual([
      expect.objectContaining({ year: 2024, currency: "BRL", income: "100", expenses: "25", net: "75", transactionsCount: 2, savingsRate: "75.00", endingNetWorth: "250" }),
      expect.objectContaining({ year: 2025, currency: "BRL", income: "0", expenses: "50", net: "-50", transactionsCount: 1, savingsRate: null, endingNetWorth: "200" }),
      expect.objectContaining({ year: 2026, currency: "BRL", income: "0", expenses: "0", net: "0", transactionsCount: 0, endingNetWorth: "200" })
    ]);
    expect(result.data.every(row => row.completedGoals === null && row.activeRecurringAtYearEnd === null)).toBe(true);
  });

  it("separates yearly currencies, honors the account filter, and guards invalid ranges", async () => {
    reader.account.findMany.mockResolvedValue([account("brl", "BRL", "10"), account("usd", "USD", "20")]);
    reader.transaction.findMany.mockResolvedValue([transaction("INCOME", "10", "2025-01-01", "brl"), transaction("INCOME", "20", "2025-01-01", "usd")]);
    await expect(service.yearly("user-a", { startYear: 2025, endYear: 2025 })).resolves.toMatchObject({ data: [expect.objectContaining({ currency: "BRL" }), expect.objectContaining({ currency: "USD" })] });
    await expect(service.yearly("user-a", { startYear: 2026, endYear: 2025 })).rejects.toMatchObject({ response: expect.objectContaining({ code: "INVALID_YEAR_RANGE" }) });
  });
});
