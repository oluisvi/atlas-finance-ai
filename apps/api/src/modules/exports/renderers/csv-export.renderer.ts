import { Injectable } from "@nestjs/common";
import { ExportFormat } from "../exports.constants.js";
import type { ExportedFile, ExportRenderer, ExportRenderInput } from "./export-renderer.interface.js";

function cell(value: string): string { const safe = /^[=+@]/.test(value) ? `'${value}` : value; return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; }
@Injectable()
export class CsvExportRenderer implements ExportRenderer {
  readonly format = ExportFormat.CSV;
  render(input: ExportRenderInput): Promise<ExportedFile> {
    const lines = input.tables.flatMap((table, index) => [index === 0 ? table.title : `\r\n${table.title}`, table.headers.map(cell).join(","), ...(table.rows.length ? table.rows.map(row => row.map(cell).join(",")) : ["No data found"])]);
    const buffer = Buffer.from(`\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
    return Promise.resolve({ buffer, filename: `${input.filenameStem}.csv`, contentType: "text/csv; charset=utf-8", extension: "csv", size: buffer.length });
  }
}
