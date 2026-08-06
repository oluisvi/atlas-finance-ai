import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Length, Max, Min } from "class-validator";
import { ExportFormat, ExportReportType } from "../exports.constants.js";

export class ExportReportDto {
  @IsEnum(ExportFormat) format!: ExportFormat;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsUUID() accountId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() endDate?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(12) month?: number;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(2000) @Max(2100) year?: number;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(2000) @Max(2100) startYear?: number;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(2000) @Max(2100) endYear?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsEnum(["DAY", "MONTH"]) groupBy?: "DAY" | "MONTH";
}

export { ExportReportType };
