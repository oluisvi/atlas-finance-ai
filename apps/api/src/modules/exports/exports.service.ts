import { BadRequestException, Inject, Injectable, PayloadTooLargeException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service.js";
import { ReportsService } from "../reports/reports.service.js";
import { ExportFormat, ExportReportType, EXPORT_MAX_PDF_ROWS, EXPORT_MAX_ROWS } from "./exports.constants.js";
import type { ExportReportDto } from "./dto/export-report.dto.js";
import type { ExportedFile, ExportRenderer, ExportTable } from "./renderers/export-renderer.interface.js";
import { CsvExportRenderer } from "./renderers/csv-export.renderer.js";
import { PdfExportRenderer } from "./renderers/pdf-export.renderer.js";
import { XlsxExportRenderer } from "./renderers/xlsx-export.renderer.js";

type ReportsPort = { summary(userId: string, query: object): Promise<unknown>; cashFlow(userId: string, query: object): Promise<unknown>; incomeExpense(userId: string, query: object): Promise<unknown>; categories(userId: string, query: object): Promise<unknown>; netWorth(userId: string, query: object): Promise<unknown>; goals(userId: string, query: object): Promise<unknown>; budgets(userId: string, query: object): Promise<unknown>; accounts(userId: string, query: object): Promise<unknown>; recurring(userId: string, query: object): Promise<unknown>; monthly(userId: string, query: object): Promise<unknown>; yearly(userId: string, query: object): Promise<unknown>; };
type AuditPort = Pick<AuditService, "record">;
type ReportData = unknown;

const text = (value: unknown): string => value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
const sanitize = (value: string): string => value.replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 120);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

@Injectable()
export class ExportsService {
  private readonly renderers: Map<ExportFormat, ExportRenderer>;
  constructor(@Inject(ReportsService) private readonly reports: ReportsPort, @Inject(AuditService) private readonly audit: AuditPort, @Inject(CsvExportRenderer) csv: CsvExportRenderer, @Inject(XlsxExportRenderer) xlsx: XlsxExportRenderer, @Inject(PdfExportRenderer) pdf: PdfExportRenderer) { this.renderers = new Map<ExportFormat, ExportRenderer>(); this.renderers.set(csv.format, csv); this.renderers.set(xlsx.format, xlsx); this.renderers.set(pdf.format, pdf); }

  async export(userId: string, reportType: ExportReportType, dto: ExportReportDto): Promise<ExportedFile> {
    this.validate(dto); const report = await this.resolve(userId, reportType, dto); const tables = this.tables(reportType, report); const rows = tables.reduce((total, table) => total + table.rows.length, 0); const max = dto.format === ExportFormat.PDF ? EXPORT_MAX_PDF_ROWS : EXPORT_MAX_ROWS; if (rows > max) throw new PayloadTooLargeException({ code: "EXPORT_LIMIT_EXCEEDED", message: "Use smaller filters for this export" });
    const renderer = this.renderers.get(dto.format); if (!renderer) throw new BadRequestException({ code: "UNSUPPORTED_EXPORT_FORMAT", message: "Unsupported export format" });
    const file = await renderer.render({ reportType, filenameStem: this.filename(reportType, dto), generatedAt: new Date(), currency: dto.currency ?? null, tables });
    await this.audit.record({ action: "reports.export", actorUserId: userId, entityType: "report", eventType: "ENTITY_CREATED", metadata: { reportType, format: dto.format, currency: dto.currency ?? null, rowCount: rows, size: file.size }, userId }); return file;
  }

  private async resolve(userId: string, reportType: ExportReportType, dto: ExportReportDto): Promise<ReportData> {
    const query = { accountId: dto.accountId, categoryId: dto.categoryId, currency: dto.currency, startDate: dto.startDate, endDate: dto.endDate, startYear: dto.startYear, endYear: dto.endYear };
    switch (reportType) { case ExportReportType.SUMMARY: return this.reports.summary(userId, query); case ExportReportType.CASH_FLOW: return this.reports.cashFlow(userId, query); case ExportReportType.INCOME_EXPENSE: return this.reports.incomeExpense(userId, query); case ExportReportType.CATEGORIES: return this.reports.categories(userId, query); case ExportReportType.NET_WORTH: return this.reports.netWorth(userId, query); case ExportReportType.GOALS: return this.reports.goals(userId, query); case ExportReportType.BUDGETS: return this.reports.budgets(userId, query); case ExportReportType.ACCOUNTS: return this.reports.accounts(userId, query); case ExportReportType.RECURRING: return this.reports.recurring(userId, query); case ExportReportType.MONTHLY: return this.reports.monthly(userId, query); case ExportReportType.YEARLY: return this.reports.yearly(userId, query); }
  }

  private tables(reportType: ExportReportType, report: ReportData): ExportTable[] { const root: unknown = report; const entries = isRecord(root) && Array.isArray(root.data) ? root.data : [root]; const records: Record<string, unknown>[] = entries.map(value => isRecord(value) ? value : { value }); const keys = [...new Set(records.flatMap(record => Object.keys(record).filter(key => typeof record[key] !== "object" || record[key] instanceof Date)))]; return [{ title: reportType, headers: keys.length ? keys : ["value"], rows: records.map(record => (keys.length ? keys : ["value"]).map(key => text(record[key]))) }]; }
  private filename(reportType: ExportReportType, dto: ExportReportDto): string { return sanitize(["atlas", reportType, dto.startYear ?? dto.year ?? dto.startDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10), dto.endYear ?? dto.endDate?.slice(0, 10), dto.currency].filter(Boolean).join("-")); }
  private validate(dto: ExportReportDto): void { if (dto.startDate && dto.endDate && new Date(dto.startDate) > new Date(dto.endDate)) throw new BadRequestException({ code: "INVALID_DATE_RANGE", message: "Invalid date range" }); const start = dto.startYear === undefined ? undefined : Number(dto.startYear), end = dto.endYear === undefined ? undefined : Number(dto.endYear); if ((start !== undefined && !Number.isInteger(start)) || (end !== undefined && !Number.isInteger(end)) || (start !== undefined && end !== undefined && (start > end || end - start > 10))) throw new BadRequestException({ code: "INVALID_YEAR_RANGE", message: "Invalid year range" }); }
}
