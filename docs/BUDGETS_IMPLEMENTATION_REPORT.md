# Budgets Implementation Report

## Scope

The Budgets module adds authenticated monthly budgets and category limits to Atlas Finance AI. It uses the existing Prisma 7 client and remote Supabase PostgreSQL database only; Supabase Auth, Edge Functions, Data API, RLS, schema changes and migrations are not part of this delivery.

## Entities And Rules

`MonthlyBudget` uses the existing `id`, `userId`, `month`, nullable `totalLimit`, `currency`, `status`, timestamps and `deletedAt`. The database unique constraint is `[userId, month]`, so only one budget may exist per user/month regardless of currency. Its statuses are `DRAFT`, `ACTIVE`, `CLOSED` and `DELETED`.

`BudgetCategoryLimit` uses `id`, `budgetId`, `userId`, `categoryId`, `limitAmount`, alert timestamps and timestamps. It is unique on `[budgetId, categoryId]`. The schema does not provide `deletedAt` on this entity, so individual limits are removed with the modeled physical delete; deleting a budget itself remains a soft delete.

Limits require a personal category owned by the user or an active global default category. Categories must support expenses (`EXPENSE` or `BOTH`). The client never provides a user identifier.

## Endpoints

All endpoints are under `/api/v1/budgets` and use `JwtAuthGuard` plus `CurrentUser`.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/budgets` | Create a monthly budget. |
| GET | `/budgets` | List owned active records with filters and pagination. |
| GET | `/budgets/current` | Read the current UTC-month budget. |
| GET | `/budgets/:id` | Read a budget with calculated category progress. |
| PATCH | `/budgets/:id` | Update total limit or status. |
| DELETE | `/budgets/:id` | Soft-delete a budget. |
| POST | `/budgets/:id/categories` | Add a category limit. |
| PATCH | `/budgets/:id/categories/:limitId` | Update a limit amount. |
| DELETE | `/budgets/:id/categories/:limitId` | Delete a limit per the schema's lifecycle. |

## Calculation And Alerts

The detailed budget read uses one PostgreSQL `groupBy` over `Transaction`: only the budget owner’s non-deleted, `CONFIRMED`, `EXPENSE` transactions in the budget month, matching category IDs and matching account currency. Income, transfers, pending records, foreign data and records outside the period are excluded. The list endpoint intentionally returns a summary, avoiding an aggregation per row.

Amounts enter and leave the HTTP contract as strings. The service validates positive fixed-decimal values again before persistence, then uses `Prisma.Decimal` for storage and arithmetic. There is no floating-point calculation. Per category, it returns limit, spent amount, remaining amount, two-decimal percentage, and `NORMAL` below 80%, `ALERT` from 80% to below 100%, or `EXCEEDED` from 100% onward.

The service also validates month (`1..12`), year (`2000..2100`), uppercase three-letter currency and supported budget status before persistence. This keeps budget creation protected even when a caller bypasses the HTTP DTO pipeline.

## Architecture, Security And Audit

`BudgetsDatabasePort` is a narrow internal persistence boundary and `BudgetsDatabaseAdapter` is its Prisma implementation. It preserves exact selected payloads while allowing strict Jest mocks without a real database.

Every resource lookup is constrained by authenticated `userId`; absent, deleted and foreign budgets/limits return the same `404`. Budget create/update/delete and limit create/update/delete produce sanitized audit records containing identifiers and event context, not tokens, credentials or full financial payloads.

## Pagination And Performance

List filters are year, month, currency, status, page, pageSize, sort field (`month` or `createdAt`) and sort order. Page size is bounded to 100, pagination has stable `id` tie-breaking, and list reads are performed as a paired record/count database transaction.

The existing `[userId, month, status]` index supports the principal lookup. At high scale, consider a partial index equivalent to `(user_id, month) WHERE deleted_at IS NULL` and an expense-oriented composite transaction index aligned with category, status, date and ownership filters. These are future migration decisions and were not changed here.

## Tests And Limitations

The isolated Jest coverage now verifies owned creation, duplicate conflict handling, DTO rejection of internal input, pagination/filter query construction, update and soft delete, positive category limits, category compatibility, invalid monetary formats, limit update/removal, IDOR-safe not-found behavior and every alert threshold from below 80% through above 100%. No tests contact Supabase.

Current limitations: there is no notification job using `alert80SentAt`/`alert100SentAt`, no idempotency key for mutations, and current-month resolution uses UTC because no user-timezone budget rule exists in the implemented domain.

## Smoke Test

The local NestJS API connected to the configured remote Supabase database and completed a controlled HTTP flow: registration and login (`201`/`200`), account/category/budget/limit/expense creation (`201`), detailed budget read (`200`), zero-limit rejection (`400`), filtered list (`200`), transaction soft delete (`204`) and budget soft delete (`204`). A limit of `100` and a confirmed expense of `80` returned `spentAmount = "80"`, `usedPercentage = "80.00"` and `status = "ALERT"`.

The Postman MCP available in this session has no localhost request executor, so the requests were issued directly to the local API. Tokens, passwords and connection strings were not recorded. The transaction and budget were cleaned through normal API endpoints; the account and category remain as controlled test data because related-history restrictions intentionally prevent their deletion.

A complete controlled flow subsequently confirmed the alert lifecycle with one category limit: a `50` expense returned `NORMAL` and `50.00%`; adding `30` returned `ALERT` and `80.00%`; adding `20` returned `EXCEEDED` and `100.00%`; adding `10` returned `EXCEEDED` and `110.00%`. Updating the limit from `100` to `200` recalculated the same `110` spent amount to `55.00%` and `NORMAL`. The filtered list returned `200`; a second controlled user received `404` for the budget; all smoke transactions were soft-deleted and the budget was soft-deleted through the API.
