import { IsDateString, IsOptional, IsString, Matches } from "class-validator";
const currency = /^[A-Z]{3}$/;
export class FinancialHealthDto { @IsOptional() @IsDateString() startDate?: string; @IsOptional() @IsDateString() endDate?: string; @IsOptional() @IsString() @Matches(currency) currency?: string; }
