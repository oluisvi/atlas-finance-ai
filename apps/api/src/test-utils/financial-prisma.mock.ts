import type { Prisma } from "@prisma/client";
import type { FinancialDatabasePort, FinancialTransactionPort } from "../modules/financial/financial-database.port.js";

type MockedDelegateMethods<TDelegate, TMethod extends keyof TDelegate> = {
  [TKey in TMethod]: TDelegate[TKey] extends (...arguments_: never[]) => unknown
    ? jest.MockedFunction<TDelegate[TKey]>
    : never;
};
type AccountDelegate = Prisma.TransactionClient["account"];
type CategoryDelegate = Prisma.TransactionClient["category"];
type TransactionDelegate = Prisma.TransactionClient["transaction"];
type TransferDelegate = Prisma.TransactionClient["transfer"];

export interface FinancialTransactionClientMock extends FinancialTransactionPort {
  account: MockedDelegateMethods<AccountDelegate, "findFirst" | "findMany" | "update">;
  category: MockedDelegateMethods<CategoryDelegate, "findFirst">;
  transaction: MockedDelegateMethods<TransactionDelegate, "create" | "createMany" | "findFirst" | "findMany" | "count" | "update" | "updateMany">;
  transfer: MockedDelegateMethods<TransferDelegate, "create" | "findFirst" | "findMany" | "count" | "update">;
}

export interface FinancialPrismaMock extends FinancialTransactionClientMock {
  $transaction: FinancialDatabasePort["$transaction"];
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
  accountFindFirst: MockedDelegateMethods<AccountDelegate, "findFirst">["findFirst"];
  accountFindMany: MockedDelegateMethods<AccountDelegate, "findMany">["findMany"];
  accountUpdate: MockedDelegateMethods<AccountDelegate, "update">["update"];
  categoryFindFirst: MockedDelegateMethods<CategoryDelegate, "findFirst">["findFirst"];
  transactionCreate: MockedDelegateMethods<TransactionDelegate, "create">["create"];
  transactionFindFirst: MockedDelegateMethods<TransactionDelegate, "findFirst">["findFirst"];
  transactionFindMany: MockedDelegateMethods<TransactionDelegate, "findMany">["findMany"];
  transactionCount: MockedDelegateMethods<TransactionDelegate, "count">["count"];
  transactionUpdate: MockedDelegateMethods<TransactionDelegate, "update">["update"];
  transferCreate: MockedDelegateMethods<TransferDelegate, "create">["create"];
  transferFindFirst: MockedDelegateMethods<TransferDelegate, "findFirst">["findFirst"];
  transferFindMany: MockedDelegateMethods<TransferDelegate, "findMany">["findMany"];
  transferCount: MockedDelegateMethods<TransferDelegate, "count">["count"];
  transferUpdate: MockedDelegateMethods<TransferDelegate, "update">["update"];
};
