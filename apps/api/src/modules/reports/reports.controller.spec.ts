import "reflect-metadata";
import { ReportsController } from "./reports.controller.js";

describe("ReportsController", () => {
  const service = {
    summary: jest.fn(() => Promise.resolve({ period: {}, income: "0", expenses: "0", netCashFlow: "0" })), cashFlow: jest.fn(() => Promise.resolve({})), incomeExpense: jest.fn(() => Promise.resolve({ period: {}, data: [] })),
    categories: jest.fn(() => Promise.resolve({})), netWorth: jest.fn(() => Promise.resolve({ period: { startDate: new Date(), endDate: new Date(), currency: null }, data: [] })), goals: jest.fn(() => Promise.resolve({})),
    budgets: jest.fn(() => Promise.resolve({})), accounts: jest.fn(() => Promise.resolve({})), recurring: jest.fn(() => Promise.resolve({})),
    monthly: jest.fn(() => Promise.resolve({})), yearly: jest.fn(() => Promise.resolve({ startYear: 2025, endYear: 2025, currency: null, data: [] }))
  };
  const controller = new ReportsController(service);
  const user = { id: "00000000-0000-4000-8000-000000000001", sessionId: "00000000-0000-4000-8000-000000000002" };

  it("forwards the authenticated user and typed net-worth query", async () => {
    const query = { accountId: "00000000-0000-4000-8000-000000000003", currency: "BRL", startDate: "2025-01-01", endDate: "2025-01-31" };
    await controller.net(user, query);
    expect(service.netWorth).toHaveBeenCalledWith(user.id, query);
  });

  it("forwards annual bounds without changing the public route", async () => {
    const query = { startYear: 2024, endYear: 2025, currency: "USD" };
    await controller.yearly(user, query);
    expect(service.yearly).toHaveBeenCalledWith(user.id, query);
  });
});
