export const AUTH_RATE_LIMITS = {
  login: { limit: 5, ttl: 60_000 },
  refresh: { limit: 20, ttl: 60_000 },
  register: { limit: 5, ttl: 60_000 }
} as const;

export const HEAVY_RATE_LIMIT = { limit: 10, ttl: 60_000 } as const;
