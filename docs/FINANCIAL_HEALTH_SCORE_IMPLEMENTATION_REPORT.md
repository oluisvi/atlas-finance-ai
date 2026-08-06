# Financial Health Score

`GET /api/v1/financial-health` calculates deterministic, read-only scores. A selected currency returns one score; without `currency`, it returns a list separated by account currency. No FX conversion or automatic score persistence is performed.

Weights are savings rate 25, budget control 20, emergency fund 25, goal progress 15 and net worth trend 15. Available components have their weights normalized to 100. Four or five available components are `SUFFICIENT`, two or three are `PARTIAL`, and zero or one produces `INSUFFICIENT` with no overall score.

Savings uses confirmed income/expense. Budget Control uses the same confirmed expense, category, month and account-currency predicate as Budgets; thresholds are 100, 75, 50, 25 and 0 as configured. Emergency Fund uses the existing `EMERGENCY_FUND` goal and `EmergencyFundPlan`. Goal progress uses active goals. Net worth derives initial balance as current balance less confirmed non-transfer period impact; income and adjustments increase impact, expense decreases it.

Classifications use only `CRITICAL`, `ATTENTION`, `GOOD` and `EXCELLENT`. Factors and recommendations are structured codes, never AI-generated narrative. The score entities remain available for future explicit snapshot/history jobs, but this endpoint does not persist.

## Read Port And Testing

The service reads through `FinancialHealthDatabasePort`, implemented by `FinancialHealthDatabaseAdapter`. The port exposes only seven score-oriented read operations: currencies, confirmed cash flow, active non-emergency goals, emergency fund plan, current balance, budget limits, and confirmed category spending. `FinancialHealthDatabaseMock` provides strict Jest mocks for precisely those operations, so the test suite has no Supabase dependency and no permissive Prisma-client mock.

The dedicated suite contains 21 tests across constants, service and controller. It covers explicit insufficient data, authenticated-user scoping, BRL/USD separation, Decimal-based savings/goal/net-worth values, budget use at 79%, 80%, 100%, 120% and 150%, multiple exceeded limits, emergency-fund coverage, transfer exclusion by the read predicate, schema classifications, invalid periods and controller delegation.

## Smoke And Validation

The final local smoke started NestJS against the configured remote Supabase PostgreSQL instance. `GET /api/v1/health`, `GET /api/v1/health/readiness`, and authenticated `GET /api/v1/financial-health` requests with and without `currency` all returned HTTP 200. Tokens, credentials and connection strings were not recorded. A controlled smoke user was created only to authenticate the protected endpoint; no financial records were inserted.

The smoke identified one infrastructure defect: the new Prisma adapter needed the project's explicit `@Inject(PrismaService)` token. It was corrected before the successful rerun. No financial rule, schema, migration, RLS policy, Supabase Auth integration or score persistence was changed.

## Remaining Risks

The endpoint calculates live aggregates. Add load tests and cache invalidation only once production traffic justifies them. Future AI Insights may consume the structured factors and recommendation codes, but must not recalculate or overwrite the deterministic score.
