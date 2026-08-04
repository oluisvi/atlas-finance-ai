import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(120)
  @MinLength(2)
  name!: string;

  @IsString()
  @MaxLength(128)
  @MinLength(8)
  password!: string;
}
