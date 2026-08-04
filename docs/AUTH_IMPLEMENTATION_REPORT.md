# Authentication Implementation Report

## Scope

The Atlas Finance AI backend now provides first-party authentication through NestJS, Prisma and the remote Supabase PostgreSQL database. Supabase is used only as PostgreSQL infrastructure. Supabase Auth, Edge Functions, Row Level Security activation, migrations and financial-domain changes are outside this implementation.

## Implemented Architecture

`AuthModule` owns the HTTP contract, credentials flow, JWT issuance, refresh token rotation, session revocation and access-token validation. `UsersModule` centralizes retrieval of public user data and active users. `AuditModule` records authentication events through the existing `AuditLog` entity. The modules use the existing Prisma client and do not modify `prisma/schema.prisma`.

JWTs carry only the user identifier (`sub`), the session identifier (`sid`) and the intended token type (`typ`). The access-token guard verifies issuer, audience, signature and expiration, then checks the session in PostgreSQL. Consequently, a revoked session invalidates its access token immediately, even if the JWT itself has not expired.

## Endpoints

| Method | Endpoint | Behavior |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Validates input, hashes the password with Argon2id, creates an active user and default preference, and returns public user data. |
| POST | `/api/v1/auth/login` | Validates generic credentials, creates a session, stores only the refresh-token hash, and returns the token pair plus public user data. |
| POST | `/api/v1/auth/refresh` | Verifies the refresh JWT and its session hash, rotates the session and returns a new token pair. |
| POST | `/api/v1/auth/logout` | Requires a bearer access token and revokes its current session. |
| GET | `/api/v1/auth/me` | Requires a bearer access token and returns only public authenticated-user data. |

## Authentication Flow

1. Registration normalizes the e-mail, checks for an active non-deleted duplicate and uses Argon2id before persistence.
2. Login uses a generic invalid-credentials response, resets failed-attempt state on success, creates an `AuthSession`, and writes an audit event.
3. The refresh token is signed with a separate secret and has a separate TTL. Its raw value exists only in the API response and incoming request body.
4. Refresh verifies the JWT claims, session state, expiration and Argon2 hash. The consumed session is marked `ROTATED`; a new session with a new identifier and new hashed refresh token is created atomically.
5. Reuse of a rotated refresh token revokes that old session with `refresh_token_reuse_detected`, writes a high-risk audit event and returns `401`.
6. Logout marks the session as `REVOKED`. The guard validates a session for each protected request, so subsequent use of its access token fails.

## Security Decisions

- Passwords and refresh tokens are hashed with Argon2id; neither raw value is stored or logged.
- Access and refresh JWTs use different secrets, explicit issuer and audience validation, expiration and token-type validation.
- Access TTL and refresh TTL are environment-configured through `JWT_ACCESS_TTL` and `JWT_REFRESH_TTL`.
- Login failure does not disclose whether a user exists.
- User responses omit `passwordHash`, `emailNormalized`, failed-login counters, lock state and session data.
- Authentication events are recorded through `AuditLog` without passwords, tokens or credentials in metadata.
- Global DTO validation rejects unknown fields and malformed request values.

## Environment Variables

The `.env.example` now defines safe placeholders and defaults for:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `JWT_ISSUER`
- `JWT_AUDIENCE`

Both secrets are required to be non-placeholder values with at least 32 characters. Durations must use an integer followed by `s`, `m`, `h` or `d`.

## Test Coverage

The authentication test suite covers valid registration, duplicate registration, valid login, invalid login, password non-exposure, refresh-token hash persistence, refresh rotation, refresh-token reuse, logout, authenticated token validation and access rejection after session revocation or token absence.

## Limitations And Next Steps

- Password-reset, e-mail-verification and account-lockout thresholds remain future flows already anticipated by the schema and product documentation.
- HTTP rate limiting and Redis-backed login throttling should be added before public production exposure.
- Session management across devices and administrative session revocation can be added as authenticated account-management endpoints.
- RLS remains intentionally disabled because NestJS/Prisma owns authorization in this stage. Future RLS policies must be aligned with the application identity model before activation.
