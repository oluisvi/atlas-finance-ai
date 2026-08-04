import { Inject, Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";

import type { AppConfiguration } from "../../config/app-config.types.js";
import { AuditService } from "../audit/audit.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { UsersService } from "../users/users.service.js";
import type { PublicUser } from "../users/user.types.js";
import type { AuthenticatedUser, RequestMetadata, TokenPair } from "./auth.types.js";
import type { LoginDto } from "./dto/login.dto.js";
import type { RegisterDto } from "./dto/register.dto.js";

type TokenKind = "access" | "refresh";

interface TokenPayload {
  sub: string;
  sid: string;
  typ: TokenKind;
}

const USER_STATUS_ACTIVE = "ACTIVE";
const SESSION_ACTIVE = "ACTIVE";
const SESSION_REVOKED = "REVOKED";
const SESSION_ROTATED = "ROTATED";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function durationToMilliseconds(value: string): number {
  const matched = /^(\d+)([smhd])$/.exec(value);
  if (!matched) {
    throw new Error("Invalid JWT duration");
  }

  const amount = Number.parseInt(matched[1]!, 10);
  const unit = matched[2]!;
  const multipliers: Record<string, number> = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000 };
  return amount * multipliers[unit]!;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<AppConfiguration, true>,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  async register(dto: RegisterDto, metadata: RequestMetadata): Promise<{ user: PublicUser }> {
    const emailNormalized = normalizeEmail(dto.email);
    const existingUser = await this.usersService.findActiveByEmail(emailNormalized);

    if (existingUser) {
      throw new ConflictException({
        code: "AUTH_REGISTRATION_UNAVAILABLE",
        message: "Unable to register with provided credentials"
      });
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email: emailNormalized,
          emailNormalized,
          name: dto.name.trim(),
          passwordHash,
          preference: { create: {} },
          status: USER_STATUS_ACTIVE
        },
        select: {
          createdAt: true,
          email: true,
          emailVerifiedAt: true,
          id: true,
          name: true,
          status: true,
          updatedAt: true
        }
      });
    } catch {
      throw new ConflictException({
        code: "AUTH_REGISTRATION_UNAVAILABLE",
        message: "Unable to register with provided credentials"
      });
    }

    await this.auditService.record({
      action: "auth.register",
      actorUserId: user.id,
      entityId: user.id,
      entityType: "user",
      eventType: "ENTITY_CREATED",
      ipAddress: metadata.ipAddress,
      riskLevel: "LOW",
      userAgent: metadata.userAgent,
      userId: user.id
    });

    return { user };
  }

  async login(dto: LoginDto, metadata: RequestMetadata): Promise<{ tokens: TokenPair; user: PublicUser }> {
    const emailNormalized = normalizeEmail(dto.email);
    const user = await this.usersService.findActiveByEmail(emailNormalized);
    const credentialsValid = user ? await argon2.verify(user.passwordHash, dto.password) : false;

    if (!user || !credentialsValid || user.status !== USER_STATUS_ACTIVE || user.lockedUntil && user.lockedUntil > new Date()) {
      if (user) {
        await this.prisma.user.update({
          data: { failedLoginAttempts: { increment: 1 } },
          where: { id: user.id }
        });
      }
      await this.auditService.record({
        action: "auth.login.failed",
        eventType: "LOGIN_FAILED",
        ipAddress: metadata.ipAddress,
        metadata: { reason: "invalid_credentials" },
        riskLevel: "MEDIUM",
        userAgent: metadata.userAgent,
        userId: user?.id
      });
      throw this.invalidCredentials();
    }

    const sessionId = randomUUID();
    const tokens = await this.createTokenPair(user.id, sessionId);
    await this.prisma.$transaction([
      this.prisma.authSession.create({
        data: {
          expiresAt: this.refreshExpiration(),
          id: sessionId,
          ipAddress: metadata.ipAddress,
          refreshTokenHash: await this.hashRefreshToken(tokens.refreshToken),
          status: SESSION_ACTIVE,
          userAgent: metadata.userAgent,
          userId: user.id
        }
      }),
      this.prisma.user.update({
        data: { failedLoginAttempts: 0, lastLoginAt: new Date() },
        where: { id: user.id }
      })
    ]);

    const publicUser = await this.usersService.findPublicById(user.id);
    if (!publicUser) {
      throw this.invalidCredentials();
    }
    await this.auditService.record({
      action: "auth.login.success",
      actorUserId: user.id,
      entityId: sessionId,
      entityType: "auth_session",
      eventType: "LOGIN_SUCCESS",
      ipAddress: metadata.ipAddress,
      riskLevel: "LOW",
      userAgent: metadata.userAgent,
      userId: user.id
    });
    return { tokens, user: publicUser };
  }

  async refresh(refreshToken: string, metadata: RequestMetadata): Promise<{ tokens: TokenPair; user: PublicUser }> {
    const payload = await this.verifyToken(refreshToken, "refresh");
    const session = await this.prisma.authSession.findUnique({
      include: { user: true },
      where: { id: payload.sid }
    });
    const now = new Date();

    if (!session || session.userId !== payload.sub || session.status !== SESSION_ACTIVE || session.revokedAt || session.expiresAt <= now || session.user.deletedAt || session.user.status !== USER_STATUS_ACTIVE) {
      if (session?.status === SESSION_ROTATED) {
        await this.prisma.authSession.update({
          data: { revokedAt: now, revokedReason: "refresh_token_reuse_detected", status: SESSION_REVOKED },
          where: { id: session.id }
        });
        await this.auditService.record({
          action: "auth.refresh.reuse_detected",
          entityId: session.id,
          entityType: "auth_session",
          eventType: "SECURITY_EVENT",
          ipAddress: metadata.ipAddress,
          riskLevel: "HIGH",
          userAgent: metadata.userAgent,
          userId: session.userId
        });
      }
      throw this.invalidToken();
    }

    const refreshTokenValid = await argon2.verify(session.refreshTokenHash, refreshToken);
    if (!refreshTokenValid) {
      await this.prisma.authSession.update({
        data: { revokedAt: now, revokedReason: "refresh_token_mismatch", status: SESSION_REVOKED },
        where: { id: session.id }
      });
      throw this.invalidToken();
    }

    const newSessionId = randomUUID();
    const tokens = await this.createTokenPair(session.userId, newSessionId);
    await this.prisma.$transaction([
      this.prisma.authSession.update({
        data: { revokedAt: now, revokedReason: "refresh_token_rotated", status: SESSION_ROTATED },
        where: { id: session.id }
      }),
      this.prisma.authSession.create({
        data: {
          expiresAt: this.refreshExpiration(),
          id: newSessionId,
          ipAddress: metadata.ipAddress,
          refreshTokenHash: await this.hashRefreshToken(tokens.refreshToken),
          status: SESSION_ACTIVE,
          userAgent: metadata.userAgent,
          userId: session.userId
        }
      })
    ]);

    const user = await this.usersService.findPublicById(session.userId);
    if (!user) {
      throw this.invalidToken();
    }
    await this.auditService.record({
      action: "auth.refresh.rotated",
      actorUserId: user.id,
      entityId: newSessionId,
      entityType: "auth_session",
      eventType: "SECURITY_EVENT",
      ipAddress: metadata.ipAddress,
      riskLevel: "LOW",
      userAgent: metadata.userAgent,
      userId: user.id
    });
    return { tokens, user };
  }

  async logout(authenticatedUser: AuthenticatedUser, metadata: RequestMetadata): Promise<void> {
    await this.prisma.authSession.updateMany({
      data: { revokedAt: new Date(), revokedReason: "logout", status: SESSION_REVOKED },
      where: { id: authenticatedUser.sessionId, status: SESSION_ACTIVE, userId: authenticatedUser.id }
    });
    await this.auditService.record({
      action: "auth.logout",
      actorUserId: authenticatedUser.id,
      entityId: authenticatedUser.sessionId,
      entityType: "auth_session",
      eventType: "LOGOUT",
      ipAddress: metadata.ipAddress,
      riskLevel: "LOW",
      userAgent: metadata.userAgent,
      userId: authenticatedUser.id
    });
  }

  async me(authenticatedUser: AuthenticatedUser): Promise<PublicUser> {
    const user = await this.usersService.findPublicById(authenticatedUser.id);
    if (!user || user.status !== USER_STATUS_ACTIVE) {
      throw this.invalidToken();
    }
    return user;
  }

  async validateAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const payload = await this.verifyToken(accessToken, "access");
    const session = await this.prisma.authSession.findUnique({
      select: { revokedAt: true, status: true, userId: true },
      where: { id: payload.sid }
    });
    if (!session || session.userId !== payload.sub || session.status !== SESSION_ACTIVE || session.revokedAt) {
      throw this.invalidToken();
    }
    return { id: payload.sub, sessionId: payload.sid };
  }

  private async createTokenPair(userId: string, sessionId: string): Promise<TokenPair> {
    const accessToken = await this.signToken({ sid: sessionId, sub: userId, typ: "access" }, "access");
    const refreshToken = await this.signToken({ sid: sessionId, sub: userId, typ: "refresh" }, "refresh");
    return { accessToken, refreshToken, tokenType: "Bearer" };
  }

  private async signToken(payload: TokenPayload, kind: TokenKind): Promise<string> {
    return this.jwtService.signAsync(payload, {
      audience: this.config.get("auth.audience", { infer: true }),
      expiresIn: kind === "access" ? this.config.get("auth.accessTtl", { infer: true }) : this.config.get("auth.refreshTtl", { infer: true }),
      issuer: this.config.get("auth.issuer", { infer: true }),
      secret: kind === "access" ? this.config.get("auth.accessSecret", { infer: true }) : this.config.get("auth.refreshSecret", { infer: true })
    });
  }

  private async verifyToken(token: string, kind: TokenKind): Promise<TokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        audience: this.config.get("auth.audience", { infer: true }),
        issuer: this.config.get("auth.issuer", { infer: true }),
        secret: kind === "access" ? this.config.get("auth.accessSecret", { infer: true }) : this.config.get("auth.refreshSecret", { infer: true })
      });
      if (payload.typ !== kind || !payload.sub || !payload.sid) {
        throw new Error("Invalid token payload");
      }
      return payload;
    } catch {
      throw this.invalidToken();
    }
  }

  private refreshExpiration(): Date {
    return new Date(Date.now() + durationToMilliseconds(this.config.get("auth.refreshTtl", { infer: true })));
  }

  private hashRefreshToken(token: string): Promise<string> {
    return argon2.hash(token, { type: argon2.argon2id });
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({ code: "AUTH_INVALID_CREDENTIALS", message: "Invalid credentials" });
  }

  private invalidToken(): UnauthorizedException {
    return new UnauthorizedException({ code: "AUTH_INVALID_TOKEN", message: "Invalid or expired token" });
  }
}
