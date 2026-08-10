# Atlas Finance AI API V1

The stable frontend contract is exposed under `/api/v1`. Interactive documentation is available at `/api/docs` and the OpenAPI 3 JSON document at `/api/docs-json` whenever Swagger is enabled. `SWAGGER_ENABLED` defaults to enabled outside production and disabled in production.

## Core conventions

- Authentication uses `Authorization: Bearer <access_token>`. Register, login, refresh, health, liveness, and readiness are public. Refresh credentials are sent only to `POST /api/v1/auth/refresh`; a 401 requires refreshing or signing in again.
- Money is always a decimal JSON string such as `"1250.5000"`, never a floating-point JSON number. Consumers must use decimal-safe arithmetic.
- Currency uses the domain currency enum. Values in different currencies are grouped separately and are never converted automatically.
- Timestamps are ISO 8601 UTC `date-time` values. Calendar-only fields use `YYYY-MM-DD` (`date`).
- Paginated collections return `data` and `meta: { page, pageSize, total, totalPages }`; pages start at 1 and page size is at most 100. Endpoint-specific sort fields and filters are enumerated in OpenAPI.
- Errors use `{ statusCode, code, message, method, path, requestId, timestamp }`. Validation can return a message array. Common statuses are 400, 401, 404, 409, 413, 415, 429, and sanitized 500.
- Responses expose `X-Request-Id`. Clients may send `X-Request-Id`; retain it for support and tracing. Financial responses use private/no-store cache policy.
- Rate limiting can return 429. Clients should back off and retry without relying on an internal threshold.

## Files

`POST /api/v1/imports/upload` accepts `multipart/form-data` with `file`, `accountId`, and `sourceType`. CSV, OFX, and QFX filename extensions are supported by the import parser, files are limited to 10 MB, and raw file contents are not returned. Duplicate files can return 409.

`GET /api/v1/exports/reports/{reportType}` returns a binary CSV, XLSX, or PDF response with the corresponding content type and `Content-Disposition`. It is not base64-wrapped JSON.

## Security and versioning

Strict validation rejects unknown input fields. CORS uses an explicit allowlist, security headers are enabled, errors are sanitized, and examples contain artificial data only. Swagger UI does not persist authorization. Breaking contract changes require a new API version or a planned compatibility migration; additive V1 changes remain possible.

## Frontend Integration Contract

Use the deployment origin plus `/api/v1`. Sign in, retain the short-lived access token securely, send it as Bearer authentication, and use the refresh endpoint when access expires. Treat 401 as an authentication-state transition and 429 as a retryable back-pressure response. Parse money with a decimal library, keep currency buckets separate, preserve nullable percentages and historical values, consume `data/meta` pagination, and surface the returned error `code` while recording `X-Request-Id`. Upload files as multipart and download exports as binary blobs using their response content type.

The OpenAPI operation IDs are deterministic and unique, making this document suitable as the source for a future generated TypeScript client.
