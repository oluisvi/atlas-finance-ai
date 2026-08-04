import type { BudgetsDatabasePort } from "../modules/budgets/budgets-database.port.js";

type Mocked<T extends (...arguments_: never[]) => unknown> = jest.MockedFunction<T>;
export type BudgetsPrismaMock = { [K in keyof BudgetsDatabasePort]: BudgetsDatabasePort[K] extends (...arguments_: never[]) => unknown ? Mocked<BudgetsDatabasePort[K]> : never };

export function createBudgetsPrismaMock(): BudgetsPrismaMock {
  return {
    createBudget: jest.fn(), findBudget: jest.fn(), findCurrentBudget: jest.fn(), listBudgets: jest.fn(), updateBudget: jest.fn(), createLimit: jest.fn(), findLimit: jest.fn(), updateLimit: jest.fn(), deleteLimit: jest.fn(), findExpenseCategory: jest.fn(), groupExpenseSpending: jest.fn()
  };
}
