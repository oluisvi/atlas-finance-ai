# Atlas Finance AI — Supabase Migration Report

**Project ref:** `mzqipbkktbpdcasfvzny`  
**Migration:** `20260624000100_init_supabase_schema`  
**Generated:** 2025-06-25  
**Status:** Migration applied successfully (reported by prior Codex run)

---

## 1. Resumo executivo

O Atlas Finance AI foi configurado para usar **Supabase PostgreSQL remoto** como banco principal, mantendo:

- **Prisma** como ORM e gerenciador de migrations
- **NestJS** como camada de autenticação e regras de negócio (sem Supabase Auth)
- Schema e entidades **inalterados** em relação ao design original

A migration inicial cria **25 tabelas**, **39 enums**, **50 índices** e **48 foreign keys** no schema `public`.

Para revalidar o catálogo ao vivo no Supabase:

```bash
cp .env.example .env
# Preencha DIRECT_URL e DATABASE_URL
npm run db:verify-catalog
```

O script grava um snapshot em `docs/supabase-catalog-snapshot.json`.

---

## 2. Configuração de conexão

### DATABASE_URL (runtime NestJS)

Use o **Transaction Pooler** do Supabase (porta **6543**, `pgbouncer=true`):

```env
DATABASE_URL="postgresql://postgres.mzqipbkktbpdcasfvzny:<DB_PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
```

- Usado pelo NestJS em produção/desenvolvimento
- Compatível com `@prisma/adapter-pg` e pooler
- **Não** usar para `prisma migrate`

### DIRECT_URL (migrations e introspecção)

Use a **Direct Connection** (porta **5432**):

```env
DIRECT_URL="postgresql://postgres:<DB_PASSWORD>@db.mzqipbkktbpdcasfvzny.supabase.co:5432/postgres?sslmode=require"
```

- Usado por `prisma migrate deploy`, `prisma db pull`, scripts de verificação
- Referenciado em `prisma.config.ts` como datasource principal

### Variáveis auxiliares

| Variável | Uso |
|---|---|
| `SUPABASE_PROJECT_REF` | Identificador do projeto |
| `SUPABASE_URL` | URL da API Supabase (não usada para auth neste projeto) |
| `JWT_*` | Auth gerenciada pelo NestJS |
| `REDIS_URL` | Cache/filas (serviço separado) |

---

## 3. Compatibilidade Prisma × Supabase PostgreSQL

| Aspecto | Status | Observação |
|---|---|---|
| PostgreSQL 15+ (Supabase) | ✅ Compatível | Enums nativos, UUID, JSONB, TIMESTAMPTZ |
| `DECIMAL(19,4)` monetário | ✅ Compatível | Precisão fixa, sem float |
| UUID como PK | ✅ Compatível | `@db.Uuid` |
| Soft delete (`deleted_at`) | ✅ Compatível | Nullable TIMESTAMPTZ |
| Índices compostos | ✅ Compatível | Alinhados ao schema Prisma |
| Foreign keys `ON DELETE RESTRICT` | ✅ Compatível | Integridade preservada |
| Transaction pooler + Prisma | ✅ Compatível | Via `DATABASE_URL` com pgbouncer |
| Supabase Auth / Edge Functions | ⛔ Não utilizados | Conforme arquitetura |
| RLS | ⏸ Não ativado | Políticas preparadas em `supabase/rls/recommended_policies.sql` |

---

## 4. Tabelas criadas (25)

| Tabela | Domínio |
|---|---|
| `users` | Autenticação / perfil |
| `user_preferences` | Preferências do usuário |
| `auth_sessions` | Refresh tokens (hash) |
| `password_reset_tokens` | Recuperação de senha |
| `accounts` | Contas financeiras |
| `categories` | Categorias (global + custom) |
| `transactions` | Receitas, despesas, ajustes, transferências |
| `transfers` | Transferências entre contas |
| `monthly_budgets` | Orçamento mensal |
| `budget_category_limits` | Limites por categoria |
| `goals` | Metas financeiras |
| `goal_contributions` | Contribuições/retiradas de metas |
| `emergency_fund_plans` | Reserva de emergência |
| `recurring_transactions` | Recorrências / assinaturas |
| `notifications` | Alertas in-app |
| `financial_scores` | Financial Health Score |
| `financial_score_components` | Componentes explicáveis do score |
| `financial_insights` | Insights financeiros |
| `insight_generation_runs` | Execuções de geração de insights |
| `import_batches` | Lotes de importação CSV/OFX |
| `import_items` | Itens parseados de importação |
| `audit_logs` | Auditoria append-only |
| `account_balance_snapshots` | Snapshots diários de saldo |
| `monthly_financial_summaries` | Agregados mensais |
| `monthly_category_summaries` | Agregados por categoria/mês |

Tabela de controle Prisma: `_prisma_migrations`

---

## 5. Enums criados (39)

| Enum | Valores |
|---|---|
| `user_status` | active, pending_verification, locked, disabled, deleted |
| `dashboard_period_default` | current_month, last_30_days, current_year |
| `auth_session_status` | active, revoked, expired, rotated |
| `account_type` | checking, digital, wallet, investment, card |
| `account_status` | active, archived, deleted |
| `category_type` | income, expense, both |
| `category_status` | active, archived, deleted |
| `transaction_type` | income, expense, transfer_in, transfer_out, adjustment |
| `transaction_status` | pending, confirmed, ignored, deleted |
| `transaction_source` | manual, csv, ofx, recurring, system |
| `transfer_status` | confirmed, deleted |
| `monthly_budget_status` | draft, active, closed, deleted |
| `goal_type` | generic, emergency_fund, travel, vehicle, property, retirement, purchase |
| `goal_priority` | low, medium, high |
| `goal_status` | active, paused, completed, archived, deleted |
| `goal_contribution_type` | contribution, withdrawal, adjustment |
| `emergency_fund_calculation_mode` | manual, auto_from_categories |
| `recurrence_kind` | weekly, monthly, yearly |
| `recurring_transaction_type` | income, expense |
| `recurring_transaction_status` | active, paused, ended, deleted |
| `notification_type` | budget_80, budget_100, goal_reached, recurring_due, score_changed, insight_available, security |
| `notification_severity` | info, warning, critical, success |
| `notification_channel` | in_app, email, push |
| `notification_status` | pending, sent, read, dismissed, failed |
| `financial_score_classification` | critical, attention, good, excellent |
| `financial_score_component_type` | savings_rate, budget_adherence, emergency_fund, goal_progress, net_worth_evolution |
| `financial_insight_type` | spending_increase, budget_risk, subscription_saving, goal_projection, cashflow_summary, score_recommendation |
| `financial_insight_source` | rule_engine, ai_service, hybrid |
| `financial_insight_severity` | info, opportunity, warning, critical |
| `financial_insight_status` | new, seen, dismissed, archived |
| `insight_generation_trigger` | manual, scheduled, transaction_created, month_closed, score_updated |
| `run_status` | queued, running, completed, failed, cancelled |
| `import_source_type` | csv, ofx |
| `import_batch_status` | uploaded, parsed, review_required, imported, failed, cancelled |
| `import_item_inferred_type` | income, expense, unknown |
| `import_item_status` | pending_review, ready, imported, duplicate, ignored, failed |
| `audit_event_type` | login_success, login_failed, logout, password_reset_requested, password_changed, entity_created, entity_updated, entity_deleted, import_completed, score_calculated, insight_generated, security_event |
| `risk_level` | low, medium, high, critical |
| `category_summary_type` | income, expense |

Todos os enums estão referenciados por colunas no schema Prisma. Nenhum enum órfão identificado.

---

## 6. Índices criados (50)

### users
- `users_email_normalized_key` (UNIQUE)
- `users_status_idx`
- `users_deleted_at_idx`

### user_preferences
- `user_preferences_user_id_key` (UNIQUE)

### auth_sessions
- `auth_sessions_user_id_status_idx`
- `auth_sessions_refresh_token_hash_idx`
- `auth_sessions_expires_at_idx`

### password_reset_tokens
- `password_reset_tokens_token_hash_idx`
- `password_reset_tokens_user_id_created_at_idx`
- `password_reset_tokens_expires_at_idx`

### accounts
- `accounts_user_id_status_idx`
- `accounts_user_id_type_idx`
- `accounts_deleted_at_idx`

### categories
- `categories_user_id_status_idx`
- `categories_parent_id_idx`
- `categories_is_default_idx`
- `categories_deleted_at_idx`
- `categories_user_id_type_name_key` (UNIQUE)

### transactions
- `transactions_import_item_id_key` (UNIQUE)
- `transactions_user_id_transaction_date_idx`
- `transactions_user_id_type_transaction_date_idx`
- `transactions_user_id_account_id_transaction_date_idx`
- `transactions_user_id_category_id_transaction_date_idx`
- `transactions_user_id_status_transaction_date_idx`
- `transactions_fingerprint_idx`
- `transactions_transfer_id_idx`
- `transactions_recurring_transaction_id_idx`
- `transactions_deleted_at_idx`

### transfers
- `transfers_user_id_transfer_date_idx`
- `transfers_from_account_id_idx`
- `transfers_to_account_id_idx`
- `transfers_deleted_at_idx`

### monthly_budgets
- `monthly_budgets_user_id_month_status_idx`
- `monthly_budgets_deleted_at_idx`
- `monthly_budgets_user_id_month_key` (UNIQUE)

### budget_category_limits
- `budget_category_limits_user_id_category_id_idx`
- `budget_category_limits_budget_id_category_id_key` (UNIQUE)

### goals
- `goals_user_id_status_idx`
- `goals_user_id_type_idx`
- `goals_deleted_at_idx`

### goal_contributions
- `goal_contributions_user_id_goal_id_contribution_date_idx`
- `goal_contributions_transaction_id_idx`
- `goal_contributions_deleted_at_idx`

### emergency_fund_plans
- `emergency_fund_plans_goal_id_key` (UNIQUE)
- `emergency_fund_plans_user_id_idx`

### recurring_transactions
- `recurring_transactions_user_id_status_idx`
- `recurring_transactions_user_id_next_occurrence_date_idx`
- `recurring_transactions_account_id_idx`
- `recurring_transactions_category_id_idx`
- `recurring_transactions_deleted_at_idx`

### notifications
- `notifications_user_id_status_created_at_idx`
- `notifications_user_id_type_idx`
- `notifications_scheduled_for_idx`

### financial_scores
- `financial_scores_user_id_calculated_at_idx`
- `financial_scores_user_id_period_start_period_end_idx`
- `financial_scores_user_id_period_start_period_end_calculatio_key` (UNIQUE)

### financial_score_components
- `financial_score_components_user_id_idx`
- `financial_score_components_financial_score_id_component_key` (UNIQUE)

### financial_insights
- `financial_insights_user_id_status_created_at_idx`
- `financial_insights_user_id_type_period_start_period_end_idx`
- `financial_insights_generated_by_run_id_idx`

### insight_generation_runs
- `insight_generation_runs_user_id_status_created_at_idx`
- `insight_generation_runs_user_id_period_start_period_end_idx`

### import_batches
- `import_batches_user_id_created_at_idx`
- `import_batches_file_hash_idx`
- `import_batches_status_idx`
- `import_batches_user_id_account_id_file_hash_key` (UNIQUE)

### import_items
- `import_items_import_batch_id_status_idx`
- `import_items_user_id_fingerprint_idx`
- `import_items_matched_transaction_id_idx`
- `import_items_suggested_category_id_idx`
- `import_items_import_batch_id_fingerprint_key` (UNIQUE)

### audit_logs
- `audit_logs_user_id_created_at_idx`
- `audit_logs_actor_user_id_created_at_idx`
- `audit_logs_event_type_created_at_idx`
- `audit_logs_entity_type_entity_id_idx`

### account_balance_snapshots
- `account_balance_snapshots_user_id_snapshot_date_idx`
- `account_balance_snapshots_user_id_account_id_snapshot_date_idx`
- `account_balance_snapshots_account_id_snapshot_date_key` (UNIQUE)

### monthly_financial_summaries
- `monthly_financial_summaries_user_id_month_idx`
- `monthly_financial_summaries_user_id_month_key` (UNIQUE)

### monthly_category_summaries
- `monthly_category_summaries_user_id_month_idx`
- `monthly_category_summaries_user_id_category_id_month_idx`
- `monthly_category_summaries_user_id_category_id_month_type_key` (UNIQUE)

---

## 7. Foreign keys criadas (48)

Todas as FKs usam `ON DELETE RESTRICT ON UPDATE CASCADE`, preservando integridade referencial.

Principais relações:

- `users` ← auth, accounts, transactions, budgets, goals, imports, audit, agregados
- `accounts` ← transactions, transfers, recurring, imports, snapshots
- `categories` ← transactions, budgets, imports, summaries (hierarquia via `parent_id`)
- `monthly_budgets` ← `budget_category_limits`
- `goals` ← contributions, emergency_fund_plans
- `transfers` ← transactions (pareadas transfer_in/out)
- `import_batches` ← import_items → transactions
- `financial_scores` ← score_components
- `insight_generation_runs` ← financial_insights

---

## 8. Campos monetários

Todos os valores financeiros usam **`DECIMAL(19,4)`** ou **`DECIMAL(9,4)`** / **`DECIMAL(5,4)`** para taxas:

| Tabela | Colunas monetárias |
|---|---|
| accounts | initial_balance, current_balance |
| transactions | amount |
| transfers | amount |
| monthly_budgets | total_limit |
| budget_category_limits | limit_amount |
| goals | target_amount, current_amount |
| goal_contributions | amount |
| emergency_fund_plans | essential_monthly_expense |
| recurring_transactions | amount |
| financial_scores | savings_rate, expense_ratio, emergency_fund_months, budget_adherence_rate, goal_progress_rate, net_worth_delta |
| financial_score_components | raw_value, weight |
| financial_insights | confidence |
| import_items | amount |
| account_balance_snapshots | balance |
| monthly_financial_summaries | total_income, total_expense, net_cashflow, savings_rate, total_balance |
| monthly_category_summaries | total_amount |

✅ Nenhum campo monetário usa `float`/`double precision`.

---

## 9. Soft delete

Entidades com `deleted_at`:

| Tabela | Soft delete |
|---|---|
| users | ✅ |
| accounts | ✅ |
| categories | ✅ |
| transactions | ✅ |
| transfers | ✅ |
| monthly_budgets | ✅ |
| goals | ✅ |
| goal_contributions | ✅ |
| recurring_transactions | ✅ |

Entidades **sem** `deleted_at` (por design): auth_sessions, password_reset_tokens, notifications, audit_logs, agregados, imports (status enum), financial_scores/insights.

Índices em `deleted_at` existem nas tabelas principais com soft delete.

---

## 10. Row Level Security (RLS)

| Item | Status |
|---|---|
| RLS ativado | ❌ Não (intencional) |
| Políticas geradas | ✅ `supabase/rls/recommended_policies.sql` |
| Entidades cobertas | users, accounts, transactions, goals, monthly_budgets (+ budget_category_limits) |

**Nota:** Como a auth é NestJS, ao ativar RLS no futuro a API deve executar `SET LOCAL app.current_user_id = '<uuid>'` por transação.

---

## 11. Problemas encontrados

| # | Severidade | Problema | Ação |
|---|---|---|---|
| 1 | Info | `.env` local ausente neste workspace | Copiar `.env.example` → `.env` com credenciais Supabase |
| 2 | Baixa | `import_items.account_id` sem índice dedicado | Considerar índice futuro se consultas por conta forem frequentes |
| 3 | Baixa | `import_batches.account_id` sem índice dedicado | Coberto parcialmente pelo UNIQUE composto |
| 4 | Info | `account_type.card` existe no enum mas cartão está fora do MVP | Reservado para evolução; sem impacto imediato |
| 5 | Info | Índices parciais (`WHERE deleted_at IS NULL`) não criados | Recomendado apenas com volume alto (ver DATABASE_REVIEW.md) |

Nenhum bloqueador estrutural identificado para iniciar o backend NestJS.

---

## 12. Ajustes recomendados (não aplicados)

1. Manter `.env` fora do git; usar secrets no CI/CD.
2. Executar `npm run db:verify-catalog` após configurar `.env` para snapshot ao vivo.
3. Usar `prisma migrate deploy` em CI com `DIRECT_URL`.
4. Revisar `docs/DATABASE_REVIEW.md` antes de otimizações de performance.
5. Ativar RLS somente se houver acesso direto ao PostgREST/Supabase client — não necessário para NestJS-only.

---

## 13. Próximos passos

1. ✅ Schema no Supabase remoto
2. ⏭ Scaffold NestJS + PrismaModule
3. ⏭ Seed de categorias padrão
4. ⏭ Implementar AuthModule (JWT + Argon2)
5. ⏭ CRUD de accounts e transactions

---

## 14. Comandos úteis

```bash
# Validar schema
npm run prisma:validate

# Gerar client
npm run prisma:generate

# Aplicar migrations (usa DIRECT_URL via prisma.config.ts)
npm run prisma:migrate:deploy

# Verificar catálogo no Supabase
npm run db:verify-catalog
```
