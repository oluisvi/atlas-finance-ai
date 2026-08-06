import type { FinancialHealthDatabasePort } from "../modules/financial-health/financial-health-database.port.js";

type MockedMethod<T extends (...args: never[]) => unknown> = jest.MockedFunction<T>;
type Method<T extends keyof FinancialHealthDatabasePort> = FinancialHealthDatabasePort[T] extends (...args: never[]) => unknown ? MockedMethod<FinancialHealthDatabasePort[T]> : never;

export type FinancialHealthDatabaseMock = { [K in keyof FinancialHealthDatabasePort]: Method<K> };

export function createFinancialHealthDatabaseMock(): FinancialHealthDatabaseMock {
  return { listCurrencies: jest.fn(), summarizeFlow: jest.fn(), listGoals: jest.fn(), findEmergencyFund: jest.fn(), sumCurrentBalance: jest.fn(), listBudgetLimits: jest.fn(), summarizeBudgetSpending: jest.fn() };
}
