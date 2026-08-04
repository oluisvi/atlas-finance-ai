import { IsBoolean, IsEnum, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";

export enum AccountTypeDto { CHECKING = "CHECKING", DIGITAL = "DIGITAL", WALLET = "WALLET", INVESTMENT = "INVESTMENT", CARD = "CARD" }

const decimalPattern = /^-?\d{1,15}(?:\.\d{1,4})?$/;

export class CreateAccountDto {
  @IsOptional() @IsString() @MaxLength(20) color?: string;
  @IsOptional() @IsBoolean() includeInDashboard?: boolean;
  @IsOptional() @IsString() @MaxLength(60) icon?: string;
  @IsOptional() @IsString() @Matches(decimalPattern) initialBalance?: string;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsEnum(AccountTypeDto) type!: AccountTypeDto;
}
