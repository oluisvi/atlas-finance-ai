import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

export enum GoalTypeDto { GENERIC = "GENERIC", EMERGENCY_FUND = "EMERGENCY_FUND", TRAVEL = "TRAVEL", VEHICLE = "VEHICLE", PROPERTY = "PROPERTY", RETIREMENT = "RETIREMENT", PURCHASE = "PURCHASE" }
export enum GoalPriorityDto { LOW = "LOW", MEDIUM = "MEDIUM", HIGH = "HIGH" }
export enum GoalStatusDto { ACTIVE = "ACTIVE", PAUSED = "PAUSED", COMPLETED = "COMPLETED", ARCHIVED = "ARCHIVED" }
export enum GoalContributionTypeDto { CONTRIBUTION = "CONTRIBUTION", WITHDRAWAL = "WITHDRAWAL", ADJUSTMENT = "ADJUSTMENT" }
export enum GoalSortByDto { CREATED_AT = "createdAt", TARGET_DATE = "targetDate", TARGET_AMOUNT = "targetAmount", PRIORITY = "priority" }
export enum SortOrderDto { ASC = "asc", DESC = "desc" }

const money = /^(?!0(?:\.0{1,4})?$)\d{1,15}(?:\.\d{1,4})?$/;
const currency = /^[A-Z]{3}$/;

export class CreateGoalDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsEnum(GoalTypeDto) type?: GoalTypeDto;
  @IsString() @Matches(money) targetAmount!: string;
  @IsOptional() @IsDateString() targetDate?: string;
  @IsOptional() @IsString() @Matches(currency) currency?: string;
  @IsOptional() @IsEnum(GoalPriorityDto) priority?: GoalPriorityDto;
}
export class UpdateGoalDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsEnum(GoalTypeDto) type?: GoalTypeDto;
  @IsOptional() @IsString() @Matches(money) targetAmount?: string;
  @IsOptional() @IsDateString() targetDate?: string | null;
  @IsOptional() @IsString() @Matches(currency) currency?: string;
  @IsOptional() @IsEnum(GoalPriorityDto) priority?: GoalPriorityDto;
  @IsOptional() @IsEnum(GoalStatusDto) status?: GoalStatusDto;
}
export class CreateGoalContributionDto {
  @IsEnum(GoalContributionTypeDto) type!: GoalContributionTypeDto;
  @IsString() @Matches(money) amount!: string;
  @IsDateString() contributionDate!: string;
  @IsOptional() @IsString() notes?: string;
}
export class ListGoalsDto {
  @IsOptional() @IsEnum(GoalTypeDto) type?: GoalTypeDto;
  @IsOptional() @IsEnum(GoalPriorityDto) priority?: GoalPriorityDto;
  @IsOptional() @IsEnum(GoalStatusDto) status?: GoalStatusDto;
  @IsOptional() @IsString() @Matches(currency) currency?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsEnum(GoalSortByDto) sortBy?: GoalSortByDto;
  @IsOptional() @IsEnum(SortOrderDto) sortOrder?: SortOrderDto;
}
