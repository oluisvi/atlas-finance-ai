/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */

import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import { AuditService } from "../audit/audit.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { UsersService } from "../users/users.service.js";
import { AuthService } from "./auth.service.js";

type StoredUser = {
  createdAt: Date;
  deletedAt: Date | null;
  email: string;
  emailNormalized: string;
  emailVerifiedAt: Date | null;
  failedLoginAttempts: number;
  id: string;
  lastLoginAt: Date | null;
  lockedUntil: Date | null;
  name: string;
  passwordHash: string;
  status: string;
  updatedAt: Date;
};

function createHarness() {
  const users = new Map<string, StoredUser>();
  const sessions = new Map<string, any>();
  const publicUser = (user: StoredUser) => ({
    createdAt: user.createdAt,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    id: user.id,
    name: user.name,
    status: user.status,
    updatedAt: user.updatedAt
  });
  const prisma = {
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    authSession: {
      create: jest.fn().mockImplementation(({ data }) => {
        const session = { ...data, createdAt: new Date(), revokedAt: null, updatedAt: new Date() };
        sessions.set(data.id, session);
        return Promise.resolve(session);
      }),
      findUnique: jest.fn().mockImplementation(({ include, select, where }) => {
        const session = sessions.get(where.id);
        if (!session) return Promise.resolve(null);
        if (include?.user) return Promise.resolve({ ...session, user: users.get(session.userId) });
        if (select) return Promise.resolve({ revokedAt: session.revokedAt, status: session.status, userId: session.userId });
        return Promise.resolve(session);
      }),
      update: jest.fn().mockImplementation(({ data, where }) => {
        const session = sessions.get(where.id);
        Object.assign(session, data, { updatedAt: new Date() });
        return Promise.resolve(session);
      }),
      updateMany: jest.fn().mockImplementation(({ data, where }) => {
        const session = sessions.get(where.id);
        if (session && session.userId === where.userId && session.status === where.status) {
          Object.assign(session, data, { updatedAt: new Date() });
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      })
    },
    user: {
      create: jest.fn().mockImplementation(({ data }) => {
        const now = new Date();
        const user: StoredUser = {
          createdAt: now,
          deletedAt: null,
          email: data.email,
          emailNormalized: data.emailNormalized,
          emailVerifiedAt: null,
          failedLoginAttempts: 0,
          id: crypto.randomUUID(),
          lastLoginAt: null,
          lockedUntil: null,
          name: data.name,
          passwordHash: data.passwordHash,
          status: data.status,
          updatedAt: now
        };
        users.set(user.id, user);
        return Promise.resolve(publicUser(user));
      }),
      findFirst: jest.fn().mockImplementation(({ where, select }) => {
        const user = [...users.values()].find((candidate) =>
          (where.emailNormalized === undefined || candidate.emailNormalized === where.emailNormalized) &&
          (where.id === undefined || candidate.id === where.id) &&
          candidate.deletedAt === where.deletedAt
        );
        return Promise.resolve(user ? (select ? publicUser(user) : user) : null);
      }),
      update: jest.fn().mockImplementation(({ data, where }) => {
        const user = users.get(where.id)!;
        if (data.failedLoginAttempts?.increment) user.failedLoginAttempts += data.failedLoginAttempts.increment;
        if (data.failedLoginAttempts === 0) user.failedLoginAttempts = 0;
        if (data.lastLoginAt) user.lastLoginAt = data.lastLoginAt;
        return Promise.resolve(user);
      })
    }
  };
  const config = {
    get: jest.fn((key: string) => ({
      "auth.accessSecret": "test-access-secret-that-is-long-enough-for-validation",
      "auth.accessTtl": "15m",
      "auth.audience": "atlas-finance-ai-test",
      "auth.issuer": "atlas-finance-ai-test",
      "auth.refreshSecret": "test-refresh-secret-that-is-long-enough-for-validation",
      "auth.refreshTtl": "30d"
    })[key])
  };
  const usersService = new UsersService(prisma as unknown as PrismaService);
  const auditService = new AuditService(prisma as unknown as PrismaService);
  const service = new AuthService(
    config as unknown as ConfigService<any, true>,
    new JwtService(),
    prisma as unknown as PrismaService,
    usersService,
    auditService
  );
  return { prisma, service, sessions, users };
}

describe("AuthService", () => {
  const registration = { email: "User@Example.com", name: "Atlas User", password: "a-strong-password" };

  it("registers a user without exposing or persisting a plain password", async () => {
    const { service, users } = createHarness();
    const result = await service.register(registration, {});

    expect(result.user).not.toHaveProperty("passwordHash");
    expect([...users.values()][0]!.passwordHash).not.toBe(registration.password);
  });

  it("rejects duplicate registration and invalid login without revealing account details", async () => {
    const { service } = createHarness();
    await service.register(registration, {});
    await expect(service.register(registration, {})).rejects.toMatchObject({ status: 409 });
    await expect(service.login({ email: registration.email, password: "wrong-password" }, {})).rejects.toMatchObject({ status: 401 });
  });

  it("issues tokens and stores only a refresh token hash", async () => {
    const { service, sessions } = createHarness();
    await service.register(registration, {});
    const result = await service.login({ email: registration.email, password: registration.password }, {});
    const session = [...sessions.values()][0]!;

    expect(result.tokens.accessToken).toBeTruthy();
    expect(session.refreshTokenHash).not.toBe(result.tokens.refreshToken);
    expect(session.refreshTokenHash).not.toContain(result.tokens.refreshToken);
  });

  it("rotates refresh tokens and rejects their reuse", async () => {
    const { service } = createHarness();
    await service.register(registration, {});
    const login = await service.login({ email: registration.email, password: registration.password }, {});
    const refreshed = await service.refresh(login.tokens.refreshToken, {});

    expect(refreshed.tokens.refreshToken).not.toBe(login.tokens.refreshToken);
    await expect(service.refresh(login.tokens.refreshToken, {})).rejects.toMatchObject({ status: 401 });
  });

  it("revokes the current session on logout and prevents later access", async () => {
    const { service } = createHarness();
    await service.register(registration, {});
    const login = await service.login({ email: registration.email, password: registration.password }, {});
    const authenticated = await service.validateAccessToken(login.tokens.accessToken);

    await service.logout(authenticated, {});
    await expect(service.validateAccessToken(login.tokens.accessToken)).rejects.toMatchObject({ status: 401 });
    await expect(service.validateAccessToken("")).rejects.toMatchObject({ status: 401 });
  });

  it("rejects an otherwise valid access token after the user is disabled or deleted", async () => {
    const { service, users } = createHarness();
    await service.register(registration, {});
    const login = await service.login({ email: registration.email, password: registration.password }, {});
    const user = [...users.values()][0]!;
    user.status = "DISABLED";
    await expect(service.validateAccessToken(login.tokens.accessToken)).rejects.toMatchObject({ status: 401 });
    user.status = "ACTIVE";
    user.deletedAt = new Date();
    await expect(service.validateAccessToken(login.tokens.accessToken)).rejects.toMatchObject({ status: 401 });
  });
});
