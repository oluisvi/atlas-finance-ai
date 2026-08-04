# Accounts And Categories Implementation Report

## Scope

This delivery adds authenticated NestJS modules for financial accounts and categories. It uses the existing Prisma 7 client against Supabase PostgreSQL, without Supabase Auth, Edge Functions, Data API, RLS activation, schema edits or migrations.

## Existing Entities Used

`Account` is user-owned and uses `id`, `userId`, `name`, `type`, `currency`, `initialBalance`, `currentBalance`, `includeInDashboard`, `color`, `icon`, `status`, `archivedAt`, `createdAt`, `updatedAt` and `deletedAt`. It is related to transactions, transfers, recurring transactions, imports and balance snapshots.

`Category` uses `id`, optional `userId`, `name`, `type`, `parentId`, `isDefault`, `isEssential`, `color`, `icon`, `sortOrder`, `status`, timestamps and `deletedAt`. A null `userId` and `isDefault = true` identify a global category. It is related to transactions, budgets, recurring transactions, imports and category summaries.

The implementation uses the existing `AccountType`, `AccountStatus`, `CategoryType` and `CategoryStatus` database enums through validated DTO values. The schema unique constraint for categories is `[userId, type, name]`.

## Architecture And Endpoints

`AccountsModule` and `CategoriesModule` each contain a controller, service, DTOs, response types and isolated service tests. Controllers depend only on their services. Services use `PrismaService` and `AuditService`.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| POST | `/api/v1/accounts` | Create an account for the authenticated user. |
| GET | `/api/v1/accounts` | List the authenticated user's non-deleted accounts. |
| GET | `/api/v1/accounts/:id` | Read an owned non-deleted account. |
| PATCH | `/api/v1/accounts/:id` | Update editable account metadata and active/archive status. |
| DELETE | `/api/v1/accounts/:id` | Soft-delete an unused account. |
| POST | `/api/v1/categories` | Create a personal category for the authenticated user. |
| GET | `/api/v1/categories` | List personal categories and active global default categories. |
| GET | `/api/v1/categories/:id` | Read an allowed personal or global default category. |
| PATCH | `/api/v1/categories/:id` | Update an owned personal category. |
| DELETE | `/api/v1/categories/:id` | Soft-delete an unused personal category. |

No pagination was added to accounts or categories. The expected per-user account/category cardinality is small and the PRD does not require pagination. Queries have stable ordering and select only response fields.

## Authorization And Isolation

All endpoints use the existing `JwtAuthGuard` and `CurrentUser` decorator. The client never supplies an authorization `userId`. Account reads and mutations use `id + userId + deletedAt` in their data-access predicate. Personal category writes use the same ownership restriction; global categories are only returned by reads and cannot be changed or removed.

Parent categories must be owned by the same user, including updates. This prevents cross-user hierarchy references. Unavailable, deleted and foreign resources return the same `404` response, preventing IDOR information disclosure.

## Financial Data Handling

Account monetary values are accepted as decimal strings with up to 15 whole digits and four fractional digits, matching `DECIMAL(19,4)`. They remain strings when passed to Prisma and are serialized to strings in responses. No floating-point calculation or silent conversion is performed.

At creation, `currentBalance` is initialized from `initialBalance`. The API does not expose updates to either balance, preserving the future transaction-derived balance model. Currency accepts the schema-compatible three-character code and is stored uppercased. No exchange conversion is implemented.

## Lifecycle And Integrity

Account archiving is available through `PATCH` using `ARCHIVED`; it sets `archivedAt`. Deletion is soft delete: `status = DELETED` and `deletedAt` is set. A deletion is rejected when transactions, transfers, recurrence rules, imports or balance snapshots exist.

Category deletion is also soft delete. It is rejected when subcategories, transactions, budget limits, recurrence rules, import references or category summaries exist. No cascading or physical deletion is performed.

## Categories

The schema supports global default categories, but this change deliberately does not create seeds or automatic defaults. The list combines active, non-deleted personal categories with active, non-deleted global defaults. Personal categories support their modeled type, hierarchy, essential flag, visual metadata and ordering. The database unique constraint is mapped to a safe `409 CATEGORY_DUPLICATE` response.

## Audit

Creation, update and soft deletion of accounts and categories create sanitized append-only audit events. Event metadata does not include balances, tokens, credentials or database details. Consistent with the existing `AuditService`, an audit write failure does not block the primary operation.

## Tests And Validation

Isolated Jest tests do not access Supabase. They cover account creation and decimal serialization, user-scoped listing, IDOR prevention, safe update fields, soft delete and in-use deletion rejection. Category tests cover personal creation, combined global/personal listing, foreign/global mutation rejection, soft deletion and linked-record deletion rejection. Existing authentication tests remain green.

Executed successfully:

- `npm run prisma:validate`
- `npm run prisma:generate`
- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Smoke Test

The environment prevented launching the API as a managed background process, so no real Supabase smoke records were created. Health/readiness and the real connection were previously validated in the backend foundation stage.

Manual smoke-test procedure: create a controlled test user, call login, create/list/read/update/delete one account and one category using its bearer access token, verify the records use that user's UUID in Supabase, and remove only those test records through the API. Do not use personal data or SQL destructive commands.

## Limitations, Risks And Next Steps

- The schema unique constraint includes soft-deleted categories, so recreating an identically named category after deletion can remain blocked. A partial unique index is a future migration decision.
- Account deletion becomes increasingly restrictive as future linked modules are added; archiving should be the usual lifecycle transition.
- There is no default category seed in this delivery because no seed strategy was implemented in the existing project.
- Swagger is not currently configured. Add OpenAPI documentation when the project has an approved API-documentation module.
- Add Redis-backed rate limiting and dashboard cache invalidation when the transaction module is introduced.
