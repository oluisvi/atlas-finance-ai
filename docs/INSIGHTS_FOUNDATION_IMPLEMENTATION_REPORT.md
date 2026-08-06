# Insights Foundation — implementation report

## Scope completed

The persisted Insights foundation now uses a narrow `InsightsDatabasePort`, a Prisma-backed adapter, and a typed Jest database mock. The real `InsightsService` is covered by 31 service tests; together with the fingerprint and controller suites, Insights has 34 exclusive tests.

Generation creates a `RUNNING` `InsightGenerationRun` with the authenticated user, manual trigger, rule-engine origin, normalized currency, requested period, start timestamp, and deterministic engine version. A successful interactive transaction creates or deduplicates the `FinancialInsight`, then completes the run with finish timestamp and supported counters. Failures leave no committed partial insight, mark the run `FAILED` when possible, store only a stable error code and sanitized message, and never emit a false success audit.

The first generation persists real Prisma enums for type, source, severity, status, and trigger. It stores a versioned SHA-256 fingerprint in `dataPoints`; the fingerprint includes user, insight code, currency, period, and related-entity scope. It is never returned by list, detail, generation, read, or dismiss responses.

Repeated generation searches by the full current logical scope and either creates, updates changed metadata/severity, or skips an equivalent record. User lifecycle state (`SEEN` or `DISMISSED`) is preserved. The response reports created, updated, and skipped counts. User, currency, period, code, and related-entity inputs remain independent fingerprint scopes.

Prisma `P2002` is recognized without unsafe casts. A concurrent create is retried through a fresh transaction, resolves the winner as deduplication, and produces one audit per successful generation call. The regression suite also runs two equivalent generations concurrently with `Promise.allSettled`.

List supports default and explicit pagination, rejects invalid pages/sizes, filters by currency, code, type, severity, status, source, read state, and date range, and supports stable sorting by creation date, period start, or severity with an ID tiebreaker. Both list queries carry `userId`; totals and total pages are returned. Detail, read, and dismiss always query by `id + userId`, return the same safe 404 for missing and third-party records, and therefore prevent IDOR. Read and dismiss are idempotent; read does not dismiss, and dismiss preserves the record as history.

Metadata sanitization is deterministic, depth- and size-bounded, removes `undefined`, rejects buffers and non-plain objects, and strips keys associated with tokens, passwords, secrets, connection strings, Prisma objects, balances, transactions, and full payloads. Public responses omit `userId`, fingerprint, and internal persistence fields. Audit metadata contains only the run identity, outcome, trigger, currency, period, and minimal counters, uses the real `AuditEventType.INSIGHT_GENERATED`, and contains no insight body, fingerprint, balance, transactions, token, or connection string.

## Bugs found and corrected

- The service depended directly on the full `PrismaService`, which prevented narrow typed transaction mocking. It now uses the database port and adapter.
- Generation previously performed insight lookup/create/update and run completion as separate non-atomic operations. They now execute in one interactive transaction.
- Failed generations could leave a `RUNNING` run and unsanitized failure handling. Runs are now transitioned safely to `FAILED` without stack traces or credentials.
- Deduplication previously reset status to `NEW`, losing read/dismiss state. Existing lifecycle status is now preserved.
- Concurrent `P2002` errors previously escaped. They now trigger a safe lookup/update retry.
- Listing omitted currency, code, source, and read-state filters and did not validate pagination inside the service. These are implemented.
- Public `dataPoints` previously exposed the internal fingerprint. Response presentation now removes it consistently.
- Read/dismiss performed an ownership check followed by an unscoped mutation and repeated mutations. They now mutate only the already-owned ID and avoid redundant updates.
- The authenticated runtime smoke exposed missing `sortBy`/`sortOrder` query support and pagination values arriving in a representation rejected by the service guard. The DTO now whitelists constrained sorting values, the service normalizes page values at its boundary, and two regression tests cover both behaviors.
- Real audit inspection showed the original minimal event lacked the required operational context. Audit metadata now includes the safe trigger, currency, period, and created/updated/skipped counters.

## Authenticated runtime smoke

The final smoke ran against a locally started NestJS process on port `3020`, with no dependency-injection errors. `GET /api/v1/health` and `GET /api/v1/health/readiness` both returned HTTP 200 and readiness confirmed the PostgreSQL connection.

Two artificial technical users were registered and authenticated through the project's real auth endpoints; Supabase Auth was not used. User A generated an insight for a fixed BRL period. The HTTP response returned a run ID and a created summary without fingerprint, user ID, deleted marker, stack trace, or sensitive metadata. Controlled database inspection confirmed one rule-engine `FinancialInsight`, an internal fingerprint, a correct owner, and three completed manual `InsightGenerationRun` records after initial, repeated, and immediate repeated generation.

List, filtered list, stable sorting, pagination, detail, read, repeated read, dismiss, and repeated dismiss all returned the expected safe responses. Invalid page and oversized page size returned HTTP 400. Repeated generation retained exactly one logical insight, returned a non-created outcome, preserved `DISMISSED`, and produced no HTTP 500. User B received safe HTTP 404 responses for User A's detail, read, and dismiss URLs; User B's own list returned HTTP 200 with an empty data set and valid pagination. A further controlled empty-user check confirmed that the current foundation contract permits generation without financial records and returned HTTP 201 with a sanitized deterministic foundation insight.

Database inspection confirmed three `INSIGHT_GENERATED` audit events for the three successful runs. Each contained the run ID, manual trigger, BRL currency, period, outcome counters, and no fingerprint, credential, connection string, balance, or transaction payload.

Cleanup removed all smoke insights, generation runs, and auth sessions. Eleven artificial users accumulated across the successful run, empty-user generation, and runtime-diagnosis retries were soft-deleted; their audit trail was preserved. Temporary scripts and local API logs were removed, and the port-3020 API process was stopped.

## Final validation

- Insights tests: 34 passing (`31` service, `2` fingerprint, `1` controller).
- Global Jest result: 26 suites and 182 tests passing in approximately 25 seconds.
- `prisma:validate`, `prisma:generate`, typecheck, lint, build, and `git diff --check` pass.
- `schema.prisma`, migrations, and RLS are unchanged.

## Atomicity, rollback, and retry

The adapter delegates interactive transactions to Prisma. Any failure during existing-insight lookup, insight creation/update, or run completion rejects the transaction, so Prisma rolls back all writes in that unit; rollback is not simulated with manual deletion. The run failure transition occurs outside the failed transaction. Retrying after lookup/create/update/completion failure is safe because the fingerprint lookup finds an already committed logical insight and does not reset user lifecycle state. Success auditing occurs only after the transaction commits.

## Residual risk and next stage

The current schema has no dedicated unique constraint for the JSON-stored fingerprint. Application retry handles observable `P2002` and ordinary concurrent winners, but the database cannot guarantee that two transactions which both see no row will never commit two logical duplicates. Before scheduled or high-volume generation, a future reviewed migration should add a dedicated fingerprint column with a composite unique index covering owner and logical scope, plus query indexes for `(user_id, source, period_start, period_end)` and common list ordering/filter combinations. This stage intentionally did not change `schema.prisma`, create migrations, add AI, Redis, notifications, or a scheduler.

Part 1 is closed. The next implementation stage is the main deterministic financial detectors; this report does not claim those detectors already exist.

Part 2 subsequently integrated the persistent foundation with five core deterministic detectors. Its architecture, rules, tests, and authenticated smoke are recorded in `INSIGHTS_CORE_DETECTORS_IMPLEMENTATION_REPORT.md`.
