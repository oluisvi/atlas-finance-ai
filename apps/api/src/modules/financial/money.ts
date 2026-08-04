import { Prisma } from "@prisma/client";

export type DatabaseTransaction = Prisma.TransactionClient;
export type BalanceDirection = "increment" | "decrement";

export function balanceDirection(type: "INCOME" | "EXPENSE" | "ADJUSTMENT" | "TRANSFER_IN" | "TRANSFER_OUT", reverse = false): BalanceDirection {
  const increasesBalance = type === "INCOME" || type === "ADJUSTMENT" || type === "TRANSFER_IN";
  return increasesBalance !== reverse ? "increment" : "decrement";
}

export async function applyBalanceDelta(
  transaction: DatabaseTransaction,
  accountId: string,
  type: "INCOME" | "EXPENSE" | "ADJUSTMENT" | "TRANSFER_IN" | "TRANSFER_OUT",
  amount: Prisma.Decimal,
  reverse = false
): Promise<void> {
  const direction = balanceDirection(type, reverse);
  await transaction.account.update({
    data: { currentBalance: { [direction]: amount } },
    where: { id: accountId }
  });
}

export function serializeDecimal(value: Prisma.Decimal): string {
  return value.toString();
}
