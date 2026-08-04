import type { Request } from "express";

export interface AuthenticatedUser {
  id: string;
  sessionId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
}

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export type AuthenticatedRequest = Request & { authUser?: AuthenticatedUser };
