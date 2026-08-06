# Imports Module Implementation Report

## Scope

`ImportsModule` adds authenticated, in-memory CSV and OFX/QFX statement ingestion backed by the existing `ImportBatch` and `ImportItem` entities. Supabase remains only the remote PostgreSQL database. No schema, migration, RLS policy, Supabase Auth, Storage, Edge Function or financial rule changed.

## Flow And Endpoints

The current flow is `POST /api/v1/imports/upload`, review through `GET /api/v1/imports/:id` and `GET /api/v1/imports/:id/items`, optional `PATCH /api/v1/imports/:id/mapping`, then `POST /api/v1/imports/:id/confirm` or `POST /api/v1/imports/:id/cancel`. `GET /api/v1/imports` lists owned batches using stable ordering and pagination.

Uploads use the authenticated account only, have a 10 MB and 10,000-row limit, sanitize the supplied file name, reject unsupported extensions, reject empty bodies and never persist the original bytes or a local path. CSV requires date, description and amount headers in this initial generic mode; OFX rejects DTD/entity declarations and requires valid transaction content. Monetary values are created as `Prisma.Decimal`, stored as absolute amounts and classified as income or expense from the sign.

## Review, Deduplication And Atomicity

Mapping metadata is restricted to the declared columns/date format and is saved to batch metadata only after required mapping fields are present. Batch and item queries are scoped by authenticated `userId`; item responses serialize amounts as strings and omit raw payload, ownership and internal fields.

Fingerprints are SHA-256 with a version marker, normalized description, fixed decimal amount, transaction date and external identifier (including OFX `FITID` when present). Confirmation accepts only `REVIEW_REQUIRED` batches. It atomically creates confirmed CSV/OFX transactions, updates account balances, links items, marks persisted duplicates and completes the batch. A repeated confirmation conflicts rather than applying balance deltas again.

## Security And Audit

All routes use `JwtAuthGuard` and `CurrentUser`. Accounts, batches and items are found by their owner; foreign resources are not exposed. Audit events record mapping updates, cancellation and completion metadata without statement contents, tokens, passwords or connection strings.

## Smoke

The local API was started on port 3001 because port 3000 was occupied by an unrelated pre-existing process. Health and readiness returned HTTP 200. A controlled authenticated user uploaded a two-row CSV to its own account and confirmed the batch: two transactions were created, two items were returned by the item list, and no duplicates were reported. No credentials, tokens, headers or connection strings were logged.

## Remaining Work And Risks

The generic CSV parser intentionally requires canonical headers and does not yet reparse persisted input after a mapping change; quoted-field CSV, configurable date/decimal formats, per-line recovery, robust OFX XML variants, batch/item test suites and a full OFX/deduplication smoke remain follow-up work. The batch schema lacks a dedicated mapping column and a user/account/fingerprint unique constraint for cross-batch idempotency; a future reviewed migration should add purpose-built metadata/index support if high-volume imports are required.

## Duplicate Upload Regression

The smoke test exposed PostgreSQL unique-constraint error `P2002` for a second upload with the same `userId`, account and file hash. `ImportsService` now converts that database error into HTTP 409 with `IMPORT_FILE_ALREADY_UPLOADED`; it does not create a second batch, transaction or balance change. The corrected CSV duplicate smoke returned 409, while CSV and OFX first uploads each completed successfully and foreign-user batch access returned 404.

The full validation run passed Prisma validation/generation, typecheck, 17 Jest suites with 136 tests, lint, build and `git diff --check`. The P2002 behavior has real HTTP smoke coverage; adding a direct unit regression for the Prisma error object remains advisable because the existing service suite currently focuses on confirmation, not upload creation.
