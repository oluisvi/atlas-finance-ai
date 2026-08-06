export const EXPORT_MAX_ROWS = 10_000;
export const EXPORT_MAX_PDF_ROWS = 2_000;
export const EXPORT_CSV_BOM = "\uFEFF";

export enum ExportFormat { CSV = "csv", XLSX = "xlsx", PDF = "pdf" }
export enum ExportReportType { SUMMARY = "summary", CASH_FLOW = "cash-flow", INCOME_EXPENSE = "income-expense", CATEGORIES = "categories", NET_WORTH = "net-worth", GOALS = "goals", BUDGETS = "budgets", ACCOUNTS = "accounts", RECURRING = "recurring", MONTHLY = "monthly", YEARLY = "yearly" }
