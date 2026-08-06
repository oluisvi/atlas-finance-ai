import type { Prisma } from "@prisma/client";
type Client = Prisma.TransactionClient;
export interface FinancialHealthDatabasePort { transaction: Pick<Client["transaction"], "groupBy">; goal: Pick<Client["goal"], "findMany">; emergencyFundPlan: Pick<Client["emergencyFundPlan"], "findFirst">; account: Pick<Client["account"], "aggregate" | "findMany">; monthlyBudget: Pick<Client["monthlyBudget"], "findMany">; }
export const FINANCIAL_HEALTH_DATABASE = Symbol("FINANCIAL_HEALTH_DATABASE");
