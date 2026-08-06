import { Prisma } from "@prisma/client";

export const FINANCIAL_HEALTH_WEIGHTS = Object.freeze({ savingsRate: 25, budgetControl: 20, emergencyFund: 25, goalProgress: 15, netWorthTrend: 15 });
export const FINANCIAL_HEALTH_WEIGHT_TOTAL = Object.values(FINANCIAL_HEALTH_WEIGHTS).reduce((total, weight) => total + weight, 0);
export function budgetControlScore(exceeded: number, alerts: number, usage: Prisma.Decimal): number { if (usage.greaterThanOrEqualTo(150)) return 0; if (exceeded > 1) return 25; if (exceeded === 1) return 50; return alerts > 0 ? 75 : 100; }
