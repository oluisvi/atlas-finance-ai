import type { Prisma } from "@prisma/client";
import type { FinancialDatabasePort, FinancialTransactionPort } from "../modules/financial/financial-database.port.js";

type DelegateMethod<TDelegate, TMethod extends keyof TDelegate> = TDelegate[TMethod] extends (...arguments_: infer TArguments) => infer TResult ? jest.Mock<TResult, TArguments> : never;
type AccountDelegate = Prisma.TransactionClient["account"];
type CategoryDelegate = Prisma.TransactionClient["category"];
type TransactionDelegate = Prisma.TransactionClient["transaction"];
type TransferDelegate = Prisma.TransactionClient["transfer"];

export interface FinancialTransactionClientMock extends FinancialTransactionPort {
  account: Pick<AccountDelegate, "findFirst" | "findMany" | "update">;
  category: Pick<CategoryDelegate, "findFirst">;
  transaction: Pick<TransactionDelegate, "create" | "createMany" | "findFirst" | "findMany" | "count" | "update" | "updateMany">;
  transfer: Pick<TransferDelegate, "create" | "findFirst" | "findMany" | "count" | "update">;
}

export interface FinancialPrismaMock extends FinancialDatabasePort {
  transactionCalls: number;
}

export function createFinancialPrismaMock(): FinancialPrismaMock {
  const client: FinancialTransactionClientMock = {
    account: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    category: { findFirst: jest.fn() },
    transaction: { create: jest.fn(), createMany: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    transfer: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() }
  };
  let transactionCalls = 0;
  function transaction<T>(callback: (transaction: FinancialTransactionPort) => Promise<T>): Promise<T>;
  function transaction<TFirst, TSecond>(operations: readonly [Prisma.PrismaPromise<TFirst>, Prisma.PrismaPromise<TSecond>]): Promise<[TFirst, TSecond]>;
  function transaction<P extends readonly Prisma.PrismaPromise<unknown>[]>(operations: P): Promise<{ [K in keyof P]: Awaited<P[K]> }>;
  function transaction<T>(argument: ((transaction: FinancialTransactionPort) => Promise<T>) | readonly Prisma.PrismaPromise<unknown>[]): Promise<T | unknown[]> {
    transactionCalls += 1;
    return typeof argument === "function" ? argument(client) : Promise.all(argument);
  }
  return {
    ...client,
    get transactionCalls(): number { return transactionCalls; },
    $transaction: transaction
  };
}

export type FinancialDelegateMocks = {
  accountFindFirst: DelegateMethod<AccountDelegate, "findFirst">;
  accountFindMany: DelegateMethod<AccountDelegate, "findMany">;
  accountUpdate: DelegateMethod<AccountDelegate, "update">;
  categoryFindFirst: DelegateMethod<CategoryDelegate, "findFirst">;
  transactionCreate: DelegateMethod<TransactionDelegate, "create">;
  transactionFindFirst: DelegateMethod<TransactionDelegate, "findFirst">;
  transactionFindMany: DelegateMethod<TransactionDelegate, "findMany">;
  transactionCount: DelegateMethod<TransactionDelegate, "count">;
  transactionUpdate: DelegateMethod<TransactionDelegate, "update">;
  transferCreate: DelegateMethod<TransferDelegate, "create">;
  transferFindFirst: DelegateMethod<TransferDelegate, "findFirst">;
  transferFindMany: DelegateMethod<TransferDelegate, "findMany">;
  transferCount: DelegateMethod<TransferDelegate, "count">;
  transferUpdate: DelegateMethod<TransferDelegate, "update">;
};
