import { ExportReportType } from "../exports.constants.js";
import { XlsxExportRenderer } from "./xlsx-export.renderer.js";
describe("XlsxExportRenderer", () => { it("creates a non-empty XLSX workbook buffer", async () => { const file = await new XlsxExportRenderer().render({ reportType: ExportReportType.YEARLY, filenameStem: "atlas-yearly", generatedAt: new Date(), currency: "BRL", tables: [{ title: "yearly", headers: ["description"], rows: [["=unsafe"]] }] }); expect(file.buffer.subarray(0, 2).toString()).toBe("PK"); expect(file.size).toBeGreaterThan(0); }); });
