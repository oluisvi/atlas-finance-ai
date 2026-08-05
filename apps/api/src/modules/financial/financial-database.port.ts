import type { Prisma } from "@prisma/client";

type AccountDelegate = Prisma.TransactionClient["account"];
type CategoryDelegate = Prisma.TransactionClient["category"];
type TransactionDelegate = Prisma.TransactionClient["transaction"];
type TransferDelegate = Prisma.TransactionClient["transfer"];
type GoalDelegate = Prisma.TransactionClient["goal"];
type GoalContributionDelegate = Prisma.TransactionClient["goalContribution"];
type RecurringTransactionDelegate = Prisma.TransactionClient["recurringTransaction"];

export interface FinancialTransactionPort {
  account: Pick<AccountDelegate, "findFirst" | "findMany" | "update">;
  category: Pick<CategoryDelegate, "findFirst">;
  transaction: Pick<TransactionDelegate, "create" | "createMany" | "findFirst" | "findMany" | "count" | "update" | "updateMany">;
  transfer: Pick<TransferDelegate, "create" | "findFirst" | "findMany" | "count" | "update">;
  goal: Pick<GoalDelegate, "create" | "findFirst" | "findMany" | "count" | "update">;
  goalContribution: Pick<GoalContributionDelegate, "create" | "findFirst" | "findMany" | "update">;
  recurringTransaction: Pick<RecurringTransactionDelegate, "create" | "findFirst" | "findMany" | "count" | "update" | "updateMany">;
}

export interface FinancialDatabasePort extends FinancialTransactionPort {
  $transaction<T>(callback: (transaction: FinancialTransactionPort) => Promise<T>): Promise<T>;
  $transaction<TFirst, TSecond>(operations: readonly [Prisma.PrismaPromise<TFirst>, Prisma.PrismaPromise<TSecond>]): Promise<[TFirst, TSecond]>;
  $transaction<P extends readonly Prisma.PrismaPromise<unknown>[]>(operations: P): Promise<{ [K in keyof P]: Awaited<P[K]> }>;
}

export const FINANCIAL_DATABASE = Symbol("FINANCIAL_DATABASE");
