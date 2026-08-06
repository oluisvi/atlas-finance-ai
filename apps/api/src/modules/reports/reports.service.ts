import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DashboardService } from "../dashboard/dashboard.service.js";
import { CashFlowGroupDto } from "../dashboard/dto/dashboard.dto.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { ReportsQueryDto } from "./dto/reports.dto.js";

type DashboardReportsPort = {
  overview(userId: string, query: ReportsQueryDto): Promise<{ period: unknown; income: string; expenses: string; netCashFlow: string }>;
  cashFlow(userId: string, query: unknown): Promise<unknown>;
  categories(userId: string, query: ReportsQueryDto): Promise<unknown>;
  budgets(userId: string, query: ReportsQueryDto): Promise<unknown>;
  goals(userId: string, query: ReportsQueryDto): Promise<unknown>;
  accounts(userId: string, query: ReportsQueryDto): Promise<unknown>;
  recurring(userId: string, query: ReportsQueryDto): Promise<unknown>;
};

type ReportAccount = { id: string; name: string; type: string; currency: string; currentBalance: Prisma.Decimal };
type ReportTransaction = { type: string; amount: Prisma.Decimal; transactionDate: Date; accountId: string };
type ReportsReadPort = {
  account: { findMany(input: unknown): Promise<ReportAccount[]> };
  transaction: { findMany(input: unknown): Promise<ReportTransaction[]> };
};
type Period = { start: Date; end: Date };
type TimelinePoint = { date: string; netWorth: string; netImpact: string };

const zero = (): Prisma.Decimal => new Prisma.Decimal(0);
const money = (value: Prisma.Decimal): string => value.toString();
const percent = (numerator: Prisma.Decimal, denominator: Prisma.Decimal): string | null =>
  denominator.isZero() ? null : numerator.dividedBy(denominator.abs()).mul(100).toFixed(2);
const impactOf = (transaction: ReportTransaction): Prisma.Decimal =>
  transaction.type === "EXPENSE" ? transaction.amount.negated() : transaction.amount;

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardReportsPort,
    @Inject(PrismaService) private readonly prisma: ReportsReadPort
  ) {}

  summary(userId: string, query: ReportsQueryDto) { return this.dashboard.overview(userId, query); }
  cashFlow(userId: string, query: ReportsQueryDto) { return this.dashboard.cashFlow(userId, { ...query, groupBy: CashFlowGroupDto.DAY }); }
  incomeExpense(userId: string, query: ReportsQueryDto) { return this.dashboard.overview(userId, query).then(value => ({ period: value.period, data: [{ income: value.income, expense: value.expenses, difference: value.netCashFlow }] })); }
  categories(userId: string, query: ReportsQueryDto) { return this.dashboard.categories(userId, query); }
  budgets(userId: string, query: ReportsQueryDto) { return this.dashboard.budgets(userId, query); }
  goals(userId: string, query: ReportsQueryDto) { return this.dashboard.goals(userId, query); }
  accounts(userId: string, query: ReportsQueryDto) { return this.dashboard.accounts(userId, query); }
  recurring(userId: string, query: ReportsQueryDto) { return this.dashboard.recurring(userId, query); }
  monthly(userId: string, query: ReportsQueryDto) { return this.dashboard.cashFlow(userId, { ...query, groupBy: CashFlowGroupDto.MONTH }); }

  async netWorth(userId: string, query: ReportsQueryDto) {
    const period = this.period(query);
    const accounts = await this.accountsFor(userId, query);
    const transactions = await this.transactionsFor(userId, period, accounts);
    const data = this.byCurrency(accounts, query.currency).map(({ currency, accounts: currencyAccounts }) => {
      const currencyTransactions = transactions.filter(transaction => currencyAccounts.some(account => account.id === transaction.accountId));
      const current = currencyAccounts.reduce((sum, account) => sum.plus(account.currentBalance), zero());
      const netImpact = currencyTransactions.reduce((sum, transaction) => sum.plus(impactOf(transaction)), zero());
      const initial = current.minus(netImpact);
      return {
        currency,
        currentNetWorth: money(current),
        estimatedInitialNetWorth: money(initial),
        netChange: money(netImpact),
        variationPercentage: percent(netImpact, initial),
        accounts: currencyAccounts.map(account => ({
          accountId: account.id,
          accountName: account.name,
          accountType: account.type,
          balance: money(account.currentBalance),
          participationPercentage: percent(account.currentBalance, current)
        })),
        timeline: this.timeline(period, current, currencyTransactions)
      };
    });
    return { period: { startDate: period.start, endDate: period.end, currency: query.currency ?? null }, data };
  }

  async yearly(userId: string, query: ReportsQueryDto) {
    const { startYear, endYear } = this.years(query);
    const accounts = await this.accountsFor(userId, query);
    const range: Period = { start: new Date(Date.UTC(startYear, 0, 1)), end: new Date(Date.UTC(endYear, 11, 31, 23, 59, 59, 999)) };
    const transactions = await this.transactionsFor(userId, range, accounts);
    const data = this.byCurrency(accounts, query.currency).flatMap(({ currency, accounts: currencyAccounts }) => {
      const accountIds = new Set(currencyAccounts.map(account => account.id));
      const currencyTransactions = transactions.filter(transaction => accountIds.has(transaction.accountId));
      const current = currencyAccounts.reduce((sum, account) => sum.plus(account.currentBalance), zero());
      return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index).map(year => {
        const values = currencyTransactions.filter(transaction => transaction.transactionDate.getUTCFullYear() === year);
        const income = values.filter(transaction => transaction.type !== "EXPENSE").reduce((sum, transaction) => sum.plus(transaction.amount), zero());
        const expenses = values.filter(transaction => transaction.type === "EXPENSE").reduce((sum, transaction) => sum.plus(transaction.amount), zero());
        const net = income.minus(expenses);
        const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
        const laterImpact = currencyTransactions.filter(transaction => transaction.transactionDate > endOfYear).reduce((sum, transaction) => sum.plus(impactOf(transaction)), zero());
        const endingNetWorth = current.minus(laterImpact);
        const priorEnd = new Date(Date.UTC(year - 1, 11, 31, 23, 59, 59, 999));
        const priorLaterImpact = currencyTransactions.filter(transaction => transaction.transactionDate > priorEnd).reduce((sum, transaction) => sum.plus(impactOf(transaction)), zero());
        const previousEndingNetWorth = current.minus(priorLaterImpact);
        return {
          year,
          currency,
          income: money(income),
          expenses: money(expenses),
          net: money(net),
          transactionsCount: values.length,
          savingsRate: percent(net, income),
          endingNetWorth: money(endingNetWorth),
          netWorthVariation: percent(endingNetWorth.minus(previousEndingNetWorth), previousEndingNetWorth),
          completedGoals: null,
          activeRecurringAtYearEnd: null
        };
      });
    });
    return { startYear, endYear, currency: query.currency ?? null, data };
  }

  private async accountsFor(userId: string, query: ReportsQueryDto): Promise<ReportAccount[]> {
    const accounts = await this.prisma.account.findMany({ where: { userId, deletedAt: null, status: { not: "DELETED" }, id: query.accountId, currency: query.currency }, select: { id: true, name: true, type: true, currency: true, currentBalance: true } });
    if (query.accountId && accounts.length === 0) throw new NotFoundException({ code: "ACCOUNT_NOT_FOUND", message: "Account not found" });
    return accounts;
  }

  private async transactionsFor(userId: string, period: Period, accounts: readonly ReportAccount[]): Promise<ReportTransaction[]> {
    if (accounts.length === 0) return [];
    return this.prisma.transaction.findMany({ where: { userId, deletedAt: null, status: "CONFIRMED", accountId: { in: accounts.map(account => account.id) }, transactionDate: { gte: period.start, lte: period.end }, type: { in: ["INCOME", "EXPENSE", "ADJUSTMENT"] } }, select: { type: true, amount: true, transactionDate: true, accountId: true } });
  }

  private byCurrency(accounts: readonly ReportAccount[], selectedCurrency?: string): { currency: string; accounts: ReportAccount[] }[] {
    const currencies = selectedCurrency ? [selectedCurrency] : [...new Set(accounts.map(account => account.currency))].sort();
    return currencies.map(currency => ({ currency, accounts: accounts.filter(account => account.currency === currency) }));
  }

  private timeline(period: Period, current: Prisma.Decimal, transactions: readonly ReportTransaction[]): TimelinePoint[] {
    const impacts = new Map<string, Prisma.Decimal>();
    for (const transaction of transactions) {
      const date = transaction.transactionDate.toISOString().slice(0, 10);
      impacts.set(date, (impacts.get(date) ?? zero()).plus(impactOf(transaction)));
    }
    const endDate = period.end.toISOString().slice(0, 10);
    if (!impacts.has(endDate)) impacts.set(endDate, zero());
    let reconstructed = current;
    const descending = [...impacts.entries()].sort(([left], [right]) => right.localeCompare(left));
    const result: TimelinePoint[] = [];
    for (const [date, impact] of descending) {
      result.push({ date, netWorth: money(reconstructed), netImpact: money(impact) });
      reconstructed = reconstructed.minus(impact);
    }
    return result.reverse();
  }

  private years(query: ReportsQueryDto): { startYear: number; endYear: number } {
    const currentYear = new Date().getUTCFullYear();
    const startYear = query.startYear === undefined ? (query.startDate ? new Date(query.startDate).getUTCFullYear() : currentYear - 4) : Number(query.startYear);
    const endYear = query.endYear === undefined ? (query.endDate ? new Date(query.endDate).getUTCFullYear() : currentYear) : Number(query.endYear);
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear || endYear - startYear > 10) throw new BadRequestException({ code: "INVALID_YEAR_RANGE", message: "Invalid year range" });
    return { startYear, endYear };
  }

  private period(query: ReportsQueryDto): Period {
    const now = new Date();
    const start = query.startDate ? new Date(query.startDate) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = query.endDate ? this.endOfDay(query.endDate) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) throw new BadRequestException({ code: "INVALID_DATE_RANGE", message: "Invalid date range" });
    return { start, end };
  }

  private endOfDay(value: string): Date {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
    return date;
  }
}
