import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { ExportFormat } from "../exports.constants.js";
import type { ExportedFile, ExportRenderer, ExportRenderInput } from "./export-renderer.interface.js";

const name = (value: string, index: number): string => value.replaceAll("\\", "_").replaceAll("/", "_").replaceAll("*", "_").replaceAll("?", "_").replaceAll(":", "_").replaceAll("[", "_").replaceAll("]", "_").slice(0, 28) || `Report_${index + 1}`;
const safe = (value: string): string => /^[=+@]/.test(value) ? `'${value}` : value;
@Injectable()
export class XlsxExportRenderer implements ExportRenderer {
  readonly format = ExportFormat.XLSX;
  async render(input: ExportRenderInput): Promise<ExportedFile> {
    const workbook = new ExcelJS.Workbook(); workbook.creator = "Atlas Finance AI"; workbook.created = input.generatedAt;
    input.tables.forEach((table, index) => { const sheet = workbook.addWorksheet(name(table.title, index)); sheet.addRow(table.headers); sheet.getRow(1).font = { bold: true }; const rows = table.rows.length ? table.rows : [["No data found"]]; rows.forEach(row => sheet.addRow(row.map(safe))); sheet.columns.forEach(column => { column.width = 24; }); });
    const content = await workbook.xlsx.writeBuffer(); const buffer = Buffer.from(content);
    return { buffer, filename: `${input.filenameStem}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx", size: buffer.length };
  }
}
