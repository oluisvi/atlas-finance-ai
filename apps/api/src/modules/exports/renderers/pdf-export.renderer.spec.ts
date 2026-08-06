import { ExportReportType } from "../exports.constants.js";
import { PdfExportRenderer } from "./pdf-export.renderer.js";
describe("PdfExportRenderer", () => { it("generates a non-empty PDF", async () => { const file = await new PdfExportRenderer().render({ reportType: ExportReportType.SUMMARY, filenameStem: "atlas-summary", generatedAt: new Date(), currency: null, tables: [{ title: "summary", headers: ["value"], rows: [["No data found"]] }] }); expect(file.buffer.subarray(0, 4).toString()).toBe("%PDF"); expect(file.size).toBeGreaterThan(0); }); });
