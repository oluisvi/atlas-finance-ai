import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from "class-validator";
import { CategoryTypeDto } from "./create-category.dto.js";
export enum CategoryStatusDto { ACTIVE = "ACTIVE", ARCHIVED = "ARCHIVED" }
export class UpdateCategoryDto { @IsOptional() @IsString() @MaxLength(20) color?: string | null; @IsOptional() @IsString() @MaxLength(60) icon?: string | null; @IsOptional() @IsBoolean() isEssential?: boolean; @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string; @IsOptional() @IsUUID("4") parentId?: string | null; @IsOptional() @IsInt() @Min(0) sortOrder?: number; @IsOptional() @IsEnum(CategoryStatusDto) status?: CategoryStatusDto; @IsOptional() @IsEnum(CategoryTypeDto) type?: CategoryTypeDto; }
