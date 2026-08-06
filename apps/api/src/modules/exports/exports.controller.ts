import { Controller, Get, Inject, Param, Query, Res, UseGuards, ValidationPipe } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { ExportReportType } from "./exports.constants.js";
import { ExportReportDto } from "./dto/export-report.dto.js";
import { ExportsService } from "./exports.service.js";
@Controller("exports") @UseGuards(JwtAuthGuard)
export class ExportsController { constructor(@Inject(ExportsService) private readonly service: ExportsService) {} @Get("reports/:reportType") async report(@CurrentUser() user: AuthenticatedUser, @Param("reportType") reportType: ExportReportType, @Query(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })) dto: ExportReportDto, @Res() response: Response): Promise<void> { if (!Object.values(ExportReportType).includes(reportType)) throw new Error("Invalid report type"); const file = await this.service.export(user.id, reportType, dto); response.setHeader("Content-Type", file.contentType); response.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`); response.setHeader("Content-Length", file.size); response.setHeader("Cache-Control", "private, no-store"); response.setHeader("X-Content-Type-Options", "nosniff"); response.end(file.buffer); } }
