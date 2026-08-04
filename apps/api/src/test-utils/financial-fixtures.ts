import { AccountStatus, AccountType, CategoryStatus, CategoryType, MonthlyBudgetStatus, Prisma, TransactionSource, TransactionStatus, TransactionType, TransferStatus, type Account, type BudgetCategoryLimit, type Category, type MonthlyBudget, type Transaction, type Transfer, type User } from "@prisma/client";

let sequence = 0;

export function testUuid(seed?: number): string {
  const value = seed ?? ++sequence;
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}

export function testDate(value = "2026-01-15T12:00:00.000Z"): Date {
  return new Date(value);
}

export function testDecimal(value = "0.0000"): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function createUser(overrides: Partial<User> = {}): User {
  const createdAt = testDate();
  return { id: testUuid(), name: "Test User", email: "user@example.test", emailNormalized: "user@example.test", passwordHash: "hash", status: "ACTIVE", emailVerifiedAt: null, lastLoginAt: null, failedLoginAttempts: 0, lockedUntil: null, createdAt, updatedAt: createdAt, deletedAt: null, ...overrides };
}

export function createAccount(overrides: Partial<Account> = {}): Account {
  const createdAt = testDate();
  return { id: testUuid(), userId: testUuid(1), name: "Main account", type: AccountType.CHECKING, currency: "BRL", initialBalance: testDecimal("100.0000"), currentBalance: testDecimal("100.0000"), includeInDashboard: true, color: null, icon: null, status: AccountStatus.ACTIVE, createdAt, updatedAt: createdAt, archivedAt: null, deletedAt: null, ...overrides };
}

export function createCategory(overrides: Partial<Category> = {}): Category {
  const createdAt = testDate();
  return { id: testUuid(), userId: testUuid(1), name: "General", type: CategoryType.EXPENSE, parentId: null, isDefault: false, isEssential: false, color: null, icon: null, sortOrder: 0, status: CategoryStatus.ACTIVE, createdAt, updatedAt: createdAt, deletedAt: null, ...overrides };
}

export function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  const createdAt = testDate();
  return { id: testUuid(), userId: testUuid(1), accountId: testUuid(2), categoryId: null, type: TransactionType.INCOME, status: TransactionStatus.CONFIRMED, description: "Test transaction", amount: testDecimal("10.0000"), transactionDate: testDate(), postedAt: null, source: TransactionSource.MANUAL, merchantName: null, notes: null, importItemId: null, recurringTransactionId: null, transferId: null, externalReference: null, fingerprint: null, metadata: null, createdAt, updatedAt: createdAt, deletedAt: null, ...overrides };
}

export function createTransfer(overrides: Partial<Transfer> = {}): Transfer {
  const createdAt = testDate();
  return { id: testUuid(), userId: testUuid(1), fromAccountId: testUuid(2), toAccountId: testUuid(3), amount: testDecimal("10.0000"), transferDate: testDate(), description: null, status: TransferStatus.CONFIRMED, createdAt, updatedAt: createdAt, deletedAt: null, ...overrides };
}

export function createMonthlyBudget(overrides: Partial<MonthlyBudget> = {}): MonthlyBudget {
  const createdAt = testDate();
  return { id: testUuid(), userId: testUuid(1), month: testDate("2026-01-01T00:00:00.000Z"), totalLimit: testDecimal("100.0000"), currency: "BRL", status: MonthlyBudgetStatus.ACTIVE, createdAt, updatedAt: createdAt, deletedAt: null, ...overrides };
}

export function createBudgetCategoryLimit(overrides: Partial<BudgetCategoryLimit> = {}): BudgetCategoryLimit {
  const createdAt = testDate();
  return { id: testUuid(), budgetId: testUuid(1), userId: testUuid(1), categoryId: testUuid(2), limitAmount: testDecimal("100.0000"), alert80SentAt: null, alert100SentAt: null, createdAt, updatedAt: createdAt, ...overrides };
}

export interface AuthenticatedFixture { id: string; sessionId: string; }
export function createAuthenticatedUser(overrides: Partial<AuthenticatedFixture> = {}): AuthenticatedFixture { return { id: testUuid(1), sessionId: testUuid(99), ...overrides }; }
