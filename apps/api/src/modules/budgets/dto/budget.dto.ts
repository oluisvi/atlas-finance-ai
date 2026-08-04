import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from "class-validator";

const money = /^(?!0(?:\.0{1,4})?$)\d{1,15}(?:\.\d{1,4})?$/;
export enum BudgetStatusDto { DRAFT = "DRAFT", ACTIVE = "ACTIVE", CLOSED = "CLOSED" }
export enum BudgetSortByDto { MONTH = "month", CREATED_AT = "createdAt" }
export enum SortOrderDto { ASC = "asc", DESC = "desc" }

export class CreateBudgetDto {
  @IsInt() @Min(1) @Max(12) month!: number;
  @IsInt() @Min(2000) @Max(2100) year!: number;
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsString() @Matches(money) totalLimit?: string;
  @IsOptional() @IsEnum(BudgetStatusDto) status?: BudgetStatusDto;
}
export class UpdateBudgetDto {
  @IsOptional() @IsString() @Matches(money) totalLimit?: string | null;
  @IsOptional() @IsEnum(BudgetStatusDto) status?: BudgetStatusDto;
}
export class CreateBudgetCategoryLimitDto { @IsUUID() categoryId!: string; @IsString() @Matches(money) limitAmount!: string; }
export class UpdateBudgetCategoryLimitDto { @IsString() @Matches(money) limitAmount!: string; }
export class ListBudgetsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) month?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year?: number;
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsEnum(BudgetStatusDto) status?: BudgetStatusDto;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsEnum(BudgetSortByDto) sortBy: BudgetSortByDto = BudgetSortByDto.MONTH;
  @IsOptional() @IsEnum(SortOrderDto) sortOrder: SortOrderDto = SortOrderDto.DESC;
}
