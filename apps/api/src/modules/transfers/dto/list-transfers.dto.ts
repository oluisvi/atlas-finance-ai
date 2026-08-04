import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
export enum TransferSortByDto { TRANSFER_DATE = "transferDate", CREATED_AT = "createdAt", AMOUNT = "amount" }
export enum SortOrderDto { ASC = "asc", DESC = "desc" }
export class ListTransfersDto { @IsOptional() @IsUUID() sourceAccountId?: string; @IsOptional() @IsUUID() destinationAccountId?: string; @IsOptional() @IsDateString() startDate?: string; @IsOptional() @IsDateString() endDate?: string; @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1; @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20; @IsOptional() @IsEnum(TransferSortByDto) sortBy: TransferSortByDto = TransferSortByDto.TRANSFER_DATE; @IsOptional() @IsEnum(SortOrderDto) sortOrder: SortOrderDto = SortOrderDto.DESC; }
