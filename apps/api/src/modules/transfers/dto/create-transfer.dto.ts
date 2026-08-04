import { IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
const money = /^\d{1,15}(?:\.\d{1,4})?$/;
export class CreateTransferDto { @IsUUID() fromAccountId!: string; @IsUUID() toAccountId!: string; @IsString() @Matches(money) amount!: string; @IsISO8601({strict:true}) transferDate!: string; @IsOptional() @IsString() @MaxLength(180) description?: string; }
