# Financial Health Score

`GET /api/v1/financial-health` calculates deterministic, read-only scores. A selected currency returns one score; without `currency`, it returns a list separated by account currency. No FX conversion or automatic score persistence is performed.

Weights are savings rate 25, budget control 20, emergency fund 25, goal progress 15 and net worth trend 15. Available components have their weights normalized to 100. Four or five available components are `SUFFICIENT`, two or three are `PARTIAL`, and zero or one produces `INSUFFICIENT` with no overall score.

Savings uses confirmed income/expense. Budget Control uses the same confirmed expense, category, month and account-currency predicate as Budgets; thresholds are 100, 75, 50, 25 and 0 as configured. Emergency Fund uses the existing `EMERGENCY_FUND` goal and `EmergencyFundPlan`. Goal progress uses active goals. Net worth derives initial balance as current balance less confirmed non-transfer period impact; income and adjustments increase impact, expense decreases it.

Classifications use only `CRITICAL`, `ATTENTION`, `GOOD` and `EXCELLENT`. Factors and recommendations are structured codes, never AI-generated narrative. The score entities remain available for future explicit snapshot/history jobs, but this endpoint does not persist.

Risk: the endpoint calculates live aggregates and should gain load tests and possibly cache invalidation when traffic justifies it. Future AI Insights may consume the structured factors and recommendations, not calculate the score.
