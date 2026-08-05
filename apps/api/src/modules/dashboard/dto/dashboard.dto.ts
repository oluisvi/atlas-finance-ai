import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from "class-validator";
export enum CashFlowGroupDto { DAY = "day", MONTH = "month" }
export enum DashboardTransactionTypeDto { INCOME = "INCOME", EXPENSE = "EXPENSE", ADJUSTMENT = "ADJUSTMENT" }
const currency = /^[A-Z]{3}$/;
export class DashboardPeriodDto { @IsOptional() @IsDateString() startDate?: string; @IsOptional() @IsDateString() endDate?: string; @IsOptional() @IsString() @Matches(currency) currency?: string; @IsOptional() @IsUUID() accountId?: string; }
export class CashFlowDto extends DashboardPeriodDto { @IsOptional() @IsEnum(CashFlowGroupDto) groupBy?: CashFlowGroupDto; }
export class RecentTransactionsDto { @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number; @IsOptional() @IsUUID() accountId?: string; @IsOptional() @IsEnum(DashboardTransactionTypeDto) type?: DashboardTransactionTypeDto; @IsOptional() @IsString() @Matches(currency) currency?: string; }
