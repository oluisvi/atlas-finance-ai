import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export enum AccountStatusDto { ACTIVE = "ACTIVE", ARCHIVED = "ARCHIVED" }

export class UpdateAccountDto {
  @IsOptional() @IsString() @MaxLength(20) color?: string | null;
  @IsOptional() @IsBoolean() includeInDashboard?: boolean;
  @IsOptional() @IsString() @MaxLength(60) icon?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsEnum(AccountStatusDto) status?: AccountStatusDto;
}
