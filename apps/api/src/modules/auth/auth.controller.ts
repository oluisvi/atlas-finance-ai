import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";

import { CurrentUser } from "./decorators/current-user.decorator.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshTokenDto } from "./dto/refresh-token.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedUser, RequestMetadata } from "./auth.types.js";

function requestMetadata(request: Request): RequestMetadata {
  const forwardedFor = request.headers["x-forwarded-for"];
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0]?.trim() ?? request.ip;
  const userAgent = request.get("user-agent");
  return { ipAddress, userAgent };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(dto, requestMetadata(request));
  }

  @HttpCode(200)
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, requestMetadata(request));
  }

  @HttpCode(200)
  @Post("refresh")
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(dto.refreshToken, requestMetadata(request));
  }

  @HttpCode(200)
  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    await this.authService.logout(user, requestMetadata(request));
    return { success: true };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return { user: await this.authService.me(user) };
  }
}
