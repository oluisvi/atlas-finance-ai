# Insights Part 2 — Core deterministic detectors

## Result

Part 2 adds five deterministic, non-AI detectors behind a shared per-user, per-currency context. `InsightContextService` reuses `DashboardService` for consolidated budgets and cash flow, `FinancialHealthService` for the established score/classification rules, and a bounded Prisma read for currencies, goals, and emergency-fund plans not exposed by those consolidated contracts. Detectors never access Prisma, persist records, audit, mutate balances, create transactions, or call HTTP endpoints.

The pipeline is: authenticated user and period → available currencies → one shared context per currency → selected detectors → bounded detected results → fingerprint → atomic create/update/skip → completed generation run → minimal audit. A detector failure fails the run before persistence. Normal missing data returns an empty result.

## Detectors and schema mapping

- Budget: `BUDGET_APPROACHING_LIMIT`, `BUDGET_EXCEEDED`, and `MULTIPLE_BUDGETS_EXCEEDED`, mapped to `BUDGET_RISK`. Approaching/exceeded conflicts are mutually exclusive per budget.
- Cash flow: `NEGATIVE_CASH_FLOW`, `CASH_FLOW_IMPROVED`, `EXPENSES_INCREASED`, `INCOME_DECREASED`, `SAVINGS_RATE_DROPPED`, and `SAVINGS_RATE_IMPROVED`, mapped to `CASHFLOW_SUMMARY`. Transfers remain neutral because the reused dashboard predicate includes only income, expense, and adjustment.
- Emergency fund: `EMERGENCY_FUND_MISSING`, `EMERGENCY_FUND_LOW`, and `EMERGENCY_FUND_COMPLETED`, mapped to `GOAL_PROJECTION`. It uses real `EMERGENCY_FUND` goals and their plans.
- Goals: `GOAL_OVERDUE`, `GOAL_NEAR_COMPLETION`, `GOAL_COMPLETED`, and `MULTIPLE_GOALS_AT_RISK`, mapped to `GOAL_PROJECTION`. Emergency-fund goals are excluded. Completed and overdue conditions suppress near-completion for the same goal.
- Financial health: `FINANCIAL_HEALTH_CRITICAL` and `FINANCIAL_HEALTH_EXCELLENT`, mapped to `SCORE_RECOMMENDATION`, using the real `CRITICAL`, `ATTENTION`, `GOOD`, and `EXCELLENT` classifications.

The real severities are `INFO`, `OPPORTUNITY`, `WARNING`, and `CRITICAL`. Positive completion/improvement conditions use `OPPORTUNITY`; risk conditions use `WARNING`; grouped or critical conditions use `CRITICAL`.

## Product thresholds

Initial centralized thresholds are: budget approaching 80%, budget critical 150%, expense increase 20%, income decrease 20%, savings-rate change 10 percentage points, cash-flow improvement 20%, emergency-fund low below 50%, goal near completion 80%, grouped goal risk from two goals, maximum 50 insights per run, 4,096-character metadata budget, and maximum detection period of 366 days. These are deterministic initial product rules, not universal financial advice.

## Safety, data quality, and performance

Money remains `Prisma.Decimal` throughout detector calculations and is serialized to strings only in metadata. There is no `parseFloat`, monetary `toNumber`, currency conversion, or cross-currency aggregation. Percent calculations explicitly handle zero baselines and never emit `NaN` or `Infinity`. Metadata passes through the existing deterministic sanitizer and contains no user ID, fingerprint, transactions, personal data, or complete report payload.

Comparative cash-flow insights require reliable prior-period data. Financial-health insights require a non-null score and sufficient data. Missing emergency-fund configuration yields `MISSING`, not `LOW`. Empty budgets and goals produce no false positives. Contexts are built once per currency, detectors operate over bounded aggregates, ID arrays are limited, and persistence caps each generation at 50 results.

`GOAL_STAGNANT` is unavailable because the current consolidated context does not establish a trustworthy contribution-inactivity window. `BUDGET_RECOVERY` and `EMERGENCY_FUND_PROGRESS` require historical condition lifecycle. Financial score dropped/improved is deferred until comparable persisted score history and currency semantics are established.

## Persistence and runtime validation

Each detector code, currency, period, and related entity participates in the stable fingerprint. Repeated generation skips equivalent records, threshold changes update metadata/severity while preserving `SEEN`/`DISMISSED`, and currencies/users/entities remain isolated. Runtime smoke exposed JSONB key-order differences causing false updates; canonical sanitization is now applied to both stored and candidate metadata before equality comparison, with a regression test.

The authenticated smoke ran on port 3021 with two artificial users and controlled BRL/USD records. Health and readiness returned 200. The BRL run created ten insights covering budgets, negative cash flow, low emergency fund, overdue/near goals, and critical financial health. Immediate repeat skipped all ten. Increasing controlled spending updated six affected insights without duplicates. USD generation produced only USD metadata, User B received 404 for User A's insight, and a CASH_FLOW-only run with insufficient data created zero insights. Four completed runs, persistence, and audit records were verified. All controlled financial records, insights, runs, sessions, and temporary files were removed; technical users were soft-deleted and audit history preserved.

The final validation has eight Insights suites with 83 tests and a global result of 31 suites with 231 tests. Prisma validation/generation, typecheck, lint, build, and diff checks pass.

## Risks and future scope

The JSON fingerprint still has no dedicated unique constraint, leaving the documented extreme-concurrency window. A future reviewed migration should add a dedicated fingerprint identity and indexes for `(user_id, source, period_start, period_end)`, common list filters, goal currency/type/status, and budget month/currency/status. Part 3 is documented in `INSIGHTS_ADVANCED_LIFECYCLE_IMPLEMENTATION_REPORT.md`; historical detectors without trustworthy snapshots remain deferred. Part 4 may evaluate AI explanations only after deterministic evidence and safety contracts are stable.
