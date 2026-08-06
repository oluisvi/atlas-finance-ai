# Reports Module

## Scope

`ReportsModule` exposes eleven JWT-protected endpoints under `/api/v1/reports`. Nine reports delegate to the established `DashboardService`, preserving its predicates and presentation. `net-worth` and `yearly` now perform dedicated read-only calculations through Prisma.

## Net Worth

The report selects only accounts owned by the authenticated user where `deletedAt` is null and account status is not `DELETED`. Archived accounts remain included, matching Dashboard account-balance behavior. Results are grouped by account currency and never converted or combined across currencies.

For each currency, current net worth is the sum of `currentBalance`. Confirmed, non-deleted `INCOME`, `EXPENSE`, and `ADJUSTMENT` transactions in the requested period determine the net impact. Expenses are negative; income and adjustments are positive, matching `financial/money.ts`. Transfer legs are excluded and therefore neutral. Estimated initial net worth is `currentNetWorth - netImpact`; percentage values are null when their denominator is zero.

The timeline is reconstructed backwards from current balances using date-grouped confirmed transaction impacts. It contains an explicit point at the requested end date and does not repeat the current balance for each prior date. Monetary and percentage values are serialized as strings.

## Yearly

`yearly` accepts `startYear` and `endYear` (or derives the bounds from date parameters), limits the span to eleven calendar years, and emits chronological rows independently for every currency represented by the selected accounts. Each row includes income, expenses, net result, transaction count, savings rate, estimated year-end net worth, and the year-over-year net-worth variation.

Year-end net worth is reconstructed from current account balances by subtracting confirmed non-transfer impacts that occurred after the target year end. Historical goal completion and historical recurring activity cannot be reconstructed reliably from the current schema, so `completedGoals` and `activeRecurringAtYearEnd` are explicitly returned as `null` rather than inferred.

## Validation and Coverage

The Reports service suite covers Dashboard delegation, net-worth calculations, decimal string serialization, reconstructed timeline behavior, account participation, currency separation, transfer exclusion, zero denominators, account ownership blocking, annual rollups, zero-data years, savings rates, year-end reconstruction, and invalid annual ranges. The controller suite verifies forwarding of the authenticated user and report query parameters for the two dedicated endpoints.

The latest targeted validation passed: typecheck, Reports controller/service tests (2 suites, 8 tests), lint, and build.

## Performance and Risks

The implementation uses existing `accounts(user_id, status)` and transaction indexes covering user, account, status, and date. At high transaction volume, annual and timeline reports should use `AccountBalanceSnapshot` as an authoritative historical checkpoint and may benefit from a composite partial index over confirmed, non-deleted transactions by user, account, and date. Current historical reconstruction assumes current balances and active account records are retained; deleted accounts removed from the model cannot be reconstructed without snapshots. Reports remain read-only, are not persisted, and have no cache.
