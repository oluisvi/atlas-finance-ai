import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { ReportsModule } from "../reports/reports.module.js";
import { ExportsController } from "./exports.controller.js";
import { ExportsService } from "./exports.service.js";
import { CsvExportRenderer } from "./renderers/csv-export.renderer.js";
import { PdfExportRenderer } from "./renderers/pdf-export.renderer.js";
import { XlsxExportRenderer } from "./renderers/xlsx-export.renderer.js";
@Module({ imports: [AuthModule, AuditModule, ReportsModule], controllers: [ExportsController], providers: [ExportsService, CsvExportRenderer, XlsxExportRenderer, PdfExportRenderer] }) export class ExportsModule {}
