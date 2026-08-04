import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service.js";
import type { FinancialDatabasePort, FinancialTransactionPort } from "./financial-database.port.js";

function toFinancialTransactionPort(transaction: Prisma.TransactionClient): FinancialTransactionPort {
  return {
    account: transaction.account,
    category: transaction.category,
    transaction: transaction.transaction,
    transfer: transaction.transfer
  };
}

@Injectable()
export class FinancialDatabaseAdapter implements FinancialDatabasePort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  get account(): FinancialTransactionPort["account"] { return this.prisma.account; }
  get category(): FinancialTransactionPort["category"] { return this.prisma.category; }
  get transaction(): FinancialTransactionPort["transaction"] { return this.prisma.transaction; }
  get transfer(): FinancialTransactionPort["transfer"] { return this.prisma.transfer; }
  $transaction<T>(callback: (transaction: FinancialTransactionPort) => Promise<T>): Promise<T>;
  $transaction<TFirst, TSecond>(operations: readonly [Prisma.PrismaPromise<TFirst>, Prisma.PrismaPromise<TSecond>]): Promise<[TFirst, TSecond]>;
  $transaction<P extends readonly Prisma.PrismaPromise<unknown>[]>(operations: P): Promise<{ [K in keyof P]: Awaited<P[K]> }>;
  $transaction<T>(argument: ((transaction: FinancialTransactionPort) => Promise<T>) | readonly Prisma.PrismaPromise<unknown>[]): Promise<T | unknown[]> {
    if (typeof argument === "function") return this.prisma.$transaction(async transaction => argument(toFinancialTransactionPort(transaction)));
    return this.prisma.$transaction([...argument]);
  }
}
