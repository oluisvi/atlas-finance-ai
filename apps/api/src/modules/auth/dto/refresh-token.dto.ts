import { IsString, MaxLength, MinLength } from "class-validator";

export class RefreshTokenDto {
  @IsString()
  @MaxLength(4096)
  @MinLength(1)
  refreshToken!: string;
}
