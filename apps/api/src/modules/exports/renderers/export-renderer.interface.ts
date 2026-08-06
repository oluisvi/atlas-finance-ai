import type { ExportFormat, ExportReportType } from "../exports.constants.js";

export interface ExportTable { title: string; headers: string[]; rows: string[][]; }
export interface ExportRenderInput { reportType: ExportReportType; filenameStem: string; generatedAt: Date; currency: string | null; tables: ExportTable[]; }
export interface ExportedFile { buffer: Buffer; filename: string; contentType: string; extension: string; size: number; }
export interface ExportRenderer { readonly format: ExportFormat; render(input: ExportRenderInput): Promise<ExportedFile>; }
