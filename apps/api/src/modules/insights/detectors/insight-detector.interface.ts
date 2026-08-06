import { FinancialInsightSeverity, FinancialInsightSource, FinancialInsightType, Prisma } from "@prisma/client";

export type DetectionPeriod = { start: Date; end: Date };
export type BudgetSnapshot = { budgetId: string; categoryId: string; currency: string; limit: Prisma.Decimal; spent: Prisma.Decimal; active: boolean };
export type CashFlowSnapshot = { income: Prisma.Decimal; expenses: Prisma.Decimal; net: Prisma.Decimal; hasData: boolean };
export type GoalSnapshot = { id: string; type: string; currency: string; current: Prisma.Decimal; target: Prisma.Decimal; targetDate: Date | null; status: string; deleted: boolean; planId: string | null };
export type HealthSnapshot = { score: number | null; classification: string | null; dataQuality: string; components: readonly { code: string; score: number | null; available: boolean }[] };
export type NetWorthSnapshot={current:Prisma.Decimal;initial:Prisma.Decimal;change:Prisma.Decimal;accounts:readonly {id:string;type:string;balance:Prisma.Decimal;participation:Prisma.Decimal|null}[];hasData:boolean};
export type CategorySnapshot={categoryId:string|null;amount:Prisma.Decimal;percentage:Prisma.Decimal|null};
export type RecurringSnapshot={id:string;currency:string;type:string;kind:string;amount:Prisma.Decimal;nextOccurrence:Date;active:boolean;deleted:boolean};
export interface InsightDetectionContext { userId: string; currency: string; period: DetectionPeriod; previousPeriod: DetectionPeriod; budgets: readonly BudgetSnapshot[]; cashFlow: CashFlowSnapshot; previousCashFlow: CashFlowSnapshot | null; goals: readonly GoalSnapshot[]; financialHealth: HealthSnapshot | null; netWorth:NetWorthSnapshot|null; categories:readonly CategorySnapshot[]; previousCategories:readonly CategorySnapshot[]; recurring:readonly RecurringSnapshot[]; generatedAt: Date; }
export interface DetectedInsight { code: string; type: FinancialInsightType; severity: FinancialInsightSeverity; title: string; message: string; metadata: Record<string, unknown>; currency: string; periodStart: Date; periodEnd: Date; relatedEntityType: string | null; relatedEntityId: string | null; source: FinancialInsightSource; }
export interface InsightDetector { readonly id: string; readonly supportedTypes: readonly FinancialInsightType[]; detect(context: InsightDetectionContext): Promise<readonly DetectedInsight[]>; }
export const detected = (context: InsightDetectionContext, input: Omit<DetectedInsight, "currency" | "periodStart" | "periodEnd" | "source">): DetectedInsight => ({ ...input, currency: context.currency, periodStart: context.period.start, periodEnd: context.period.end, source: FinancialInsightSource.RULE_ENGINE });
export const percentage = (value: Prisma.Decimal, total: Prisma.Decimal): Prisma.Decimal | null => total.isZero() ? null : value.dividedBy(total).mul(100);
