import { Transform } from "class-transformer";
import { IsISO8601, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from "class-validator";

export class ReportsQueryDto {
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  startDate?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(2000)
  @Max(2100)
  startYear?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(2000)
  @Max(2100)
  endYear?: number;
}
