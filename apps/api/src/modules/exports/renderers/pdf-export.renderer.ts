import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { ExportFormat } from "../exports.constants.js";
import type { ExportedFile, ExportRenderer, ExportRenderInput } from "./export-renderer.interface.js";
@Injectable()
export class PdfExportRenderer implements ExportRenderer {
  readonly format = ExportFormat.PDF;
  async render(input: ExportRenderInput): Promise<ExportedFile> { return new Promise((resolve, reject) => { const document = new PDFDocument({ margin: 48, size: "A4" }); const chunks: Buffer[] = []; document.on("data", (chunk: Buffer) => chunks.push(chunk)); document.on("error", reject); document.on("end", () => { const buffer = Buffer.concat(chunks); resolve({ buffer, filename: `${input.filenameStem}.pdf`, contentType: "application/pdf", extension: "pdf", size: buffer.length }); }); document.fontSize(18).text("Atlas Finance AI"); document.fontSize(12).text(input.reportType); document.text(`Generated: ${input.generatedAt.toISOString().slice(0, 10)} | Currency: ${input.currency ?? "Multiple"}`); input.tables.forEach(table => { document.moveDown().fontSize(14).text(table.title); document.fontSize(9).text(table.headers.join(" | ")); const rows = table.rows.length ? table.rows : [["No data found"]]; rows.forEach(row => { if (document.y > 740) document.addPage(); document.text(row.join(" | ")); }); }); document.moveDown().fontSize(8).text("Informational financial report."); document.end(); }); }
}
