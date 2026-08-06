import { TransactionType } from "@prisma/client";
import { FinancialHealthService } from "./financial-health.service.js";
import { createFinancialHealthDatabaseMock } from "../../test-utils/financial-health-database.mock.js";
import { createGoal, testDecimal, testUuid } from "../../test-utils/financial-fixtures.js";

type ScoreResponse = Exclude<Awaited<ReturnType<FinancialHealthService["calculate"]>>, { data: unknown }>;
function score(result: Awaited<ReturnType<FinancialHealthService["calculate"]>>): ScoreResponse { if ("data" in result) throw new Error("Expected one currency score"); return result; }

describe("FinancialHealthService", () => {
  const userId = testUuid(1);
  let database = createFinancialHealthDatabaseMock();
  let service: FinancialHealthService;

  beforeEach(() => {
    database = createFinancialHealthDatabaseMock(); service = new FinancialHealthService(database);
    database.listCurrencies.mockResolvedValue([]); database.summarizeFlow.mockResolvedValue([]); database.listGoals.mockResolvedValue([]);
    database.findEmergencyFund.mockResolvedValue(null); database.sumCurrentBalance.mockResolvedValue(testDecimal("0"));
    database.listBudgetLimits.mockResolvedValue([]); database.summarizeBudgetSpending.mockResolvedValue([]);
  });

  it("returns explicit insufficient data and scopes every query to the authenticated user", async () => {
    const result = score(await service.calculate(userId, { currency: "BRL" }));
    expect(result.score).toBeNull(); expect(result.classification).toBeNull(); expect(result.dataQuality.status).toBe("INSUFFICIENT");
    expect(database.summarizeFlow).toHaveBeenCalledWith(userId, "BRL", expect.any(Date), expect.any(Date));
    expect(database.listGoals).toHaveBeenCalledWith(userId, "BRL"); expect(database.sumCurrentBalance).toHaveBeenCalledWith(userId, "BRL");
  });

  it("calculates savings, goals and net worth without converting decimals to floats", async () => {
    database.summarizeFlow.mockResolvedValue([{ type: TransactionType.INCOME, amount: testDecimal("100") }, { type: TransactionType.EXPENSE, amount: testDecimal("20") }]);
    database.listGoals.mockResolvedValue([(() => { const goal = createGoal({ userId, targetAmount: testDecimal("100"), currentAmount: testDecimal("50"), currency: "BRL" }); return { targetAmount: goal.targetAmount, currentAmount: goal.currentAmount, targetDate: goal.targetDate }; })()]);
    database.sumCurrentBalance.mockResolvedValue(testDecimal("80"));
    const result = score(await service.calculate(userId, { currency: "BRL" }));
    const savings = result.components.find(component => component.code === "savingsRate");
    expect(savings?.metrics.savingsRate).toBe("80.00"); expect(savings?.score).toBe(100);
    expect(result.positiveFactors.some(factor => factor.code === "HIGH_SAVINGS_RATE")).toBe(true);
  });

  it("keeps currencies isolated when no currency filter is sent", async () => {
    database.listCurrencies.mockResolvedValue([{ currency: "USD" }, { currency: "BRL" }]);
    const result = await service.calculate(userId, {});
    expect("data" in result).toBe(true); if ("data" in result) expect(result.data.map(item => item.period.currency).sort()).toEqual(["BRL", "USD"]);
  });

  it("calculates budget control from confirmed category spending", async () => {
    const categoryId = testUuid(2); database.listBudgetLimits.mockResolvedValue([{ categoryId, limitAmount: testDecimal("100") }]);
    database.summarizeBudgetSpending.mockResolvedValue([{ categoryId, amount: testDecimal("80") }]);
    const result = score(await service.calculate(userId, { currency: "BRL" }));
    const budget = result.components.find(component => component.code === "budgetControl");
    expect(budget?.score).toBe(75); expect(budget?.metrics.usagePercentage).toBe("80.00");
    expect(database.summarizeBudgetSpending).toHaveBeenCalledWith(userId, "BRL", expect.any(Date), expect.any(Date), [categoryId]);
  });

  it.each([["79", 100], ["80", 75], ["100", 50], ["120", 50], ["150", 0]])("applies deterministic budget threshold %s", async (spent, expectedScore) => {
    const categoryId = testUuid(3); database.listBudgetLimits.mockResolvedValue([{ categoryId, limitAmount: testDecimal("100") }]);
    database.summarizeBudgetSpending.mockResolvedValue([{ categoryId, amount: testDecimal(spent) }]);
    const result = score(await service.calculate(userId, { currency: "BRL" }));
    expect(result.components.find(component => component.code === "budgetControl")?.score).toBe(expectedScore);
  });

  it("marks multiple exceeded budget limits as critical and produces a recommendation", async () => {
    database.listBudgetLimits.mockResolvedValue([{ categoryId: testUuid(4), limitAmount: testDecimal("100") }, { categoryId: testUuid(5), limitAmount: testDecimal("100") }]);
    database.summarizeBudgetSpending.mockResolvedValue([{ categoryId: testUuid(4), amount: testDecimal("120") }, { categoryId: testUuid(5), amount: testDecimal("101") }]);
    const result = score(await service.calculate(userId, { currency: "BRL" }));
    expect(result.components.find(component => component.code === "budgetControl")?.score).toBe(25);
    expect(result.recommendations).toContainEqual({ code: "REDUCE_BUDGET_OVERRUN" });
  });

  it("uses the emergency fund plan instead of treating missing data as a healthy reserve", async () => {
    database.findEmergencyFund.mockResolvedValue({ desiredMonths: 6, essentialMonthlyExpense: testDecimal("100"), currentAmount: testDecimal("50") });
    const result = score(await service.calculate(userId, { currency: "BRL" }));
    const fund = result.components.find(component => component.code === "emergencyFund");
    expect(fund?.score).toBe(20); expect(fund?.metrics.coverageMonths).toBe("0.50");
    expect(result.negativeFactors.some(factor => factor.code === "NO_EMERGENCY_FUND")).toBe(true);
  });

  it("uses confirmed net impact for the net worth trend and ignores transfers by port contract", async () => {
    database.sumCurrentBalance.mockResolvedValue(testDecimal("120"));
    database.summarizeFlow.mockResolvedValue([{ type: TransactionType.INCOME, amount: testDecimal("40") }, { type: TransactionType.EXPENSE, amount: testDecimal("20") }, { type: TransactionType.ADJUSTMENT, amount: testDecimal("10") }]);
    const result = score(await service.calculate(userId, { currency: "BRL" }));
    const netWorth = result.components.find(component => component.code === "netWorthTrend");
    expect(netWorth?.metrics.initialNetWorth).toBe("90"); expect(netWorth?.metrics.netImpact).toBe("30"); expect(netWorth?.score).toBe(100);
  });

  it("classifies scores using only the schema classifications", async () => {
    database.summarizeFlow.mockResolvedValue([{ type: TransactionType.INCOME, amount: testDecimal("100") }, { type: TransactionType.EXPENSE, amount: testDecimal("50") }]);
    database.findEmergencyFund.mockResolvedValue({ desiredMonths: 6, essentialMonthlyExpense: testDecimal("100"), currentAmount: testDecimal("600") });
    database.listGoals.mockResolvedValue([{ targetAmount: testDecimal("100"), currentAmount: testDecimal("100"), targetDate: null }]);
    database.sumCurrentBalance.mockResolvedValue(testDecimal("100"));
    const result = score(await service.calculate(userId, { currency: "BRL" }));
    expect(["CRITICAL", "ATTENTION", "GOOD", "EXCELLENT"]).toContain(result.classification);
    expect(result.classification).not.toBe("STABLE"); expect(result.classification).not.toBe("HEALTHY");
  });

  it("rejects an inverted period before issuing any database query", async () => {
    await expect(service.calculate(userId, { currency: "BRL", startDate: "2026-02-01", endDate: "2026-01-01" })).rejects.toMatchObject({ response: expect.objectContaining({ code: "INVALID_DATE_RANGE" }) });
    expect(database.summarizeFlow).not.toHaveBeenCalled();
  });
});
