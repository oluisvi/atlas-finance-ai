# Atlas Finance AI - Supabase Migration Report

**Project ref:** `mzqipbkktbpdcasfvzny`  
**Project name:** Atlas Finance AI  
**Database:** Supabase PostgreSQL remoto  
**Postgres engine:** 17  
**Schema source:** `prisma/schema.prisma` + `prisma/migrations/20260624000100_init_supabase_schema/migration.sql`  
**Updated:** 2026-08-04  
**Status:** Schema aplicado e verificado no Supabase remoto via MCP.

---

## 1. Executive Summary

O Atlas Finance AI foi adaptado para usar Supabase PostgreSQL remoto como banco principal, mantendo:

- Prisma como ORM e ferramenta de migrations.
- NestJS como camada de autenticacao, autorizacao e regras de negocio.
- Auth propria da aplicacao, sem Supabase Auth.
- Sem Supabase Edge Functions.
- Sem alteracao de entidades ou regras financeiras.

O catalogo remoto foi verificado com sucesso:

| Item | Resultado ao vivo |
|---|---:|
| Tabelas em `public` | 25 |
| Enums em `public` | 39 |
| Foreign keys | 49 |
| Indices totais Postgres | 109 |
| Primary key indexes | 25 |
| Unique indexes | 14 |
| Non-unique indexes | 70 |
| Tabelas com RLS ligado | 0 |
| Tabelas com RLS desligado | 25 |

Observacao critica: o schema foi aplicado no Supabase via MCP, nao via `prisma migrate deploy`. Portanto, a tabela `_prisma_migrations` nao existe no banco remoto no momento da verificacao. Antes de usar Prisma Migrate em CI/producao, e necessario alinhar o historico de migrations do Prisma com o estado real do banco.

---

## 2. Arquivos Gerados ou Atualizados

| Arquivo | Finalidade |
|---|---|
| `.env.example` | Exemplo de variaveis para Supabase remoto, Prisma, JWT, Redis e FastAPI |
| `prisma.config.ts` | Configuracao Prisma 7 usando `DIRECT_URL`/`DATABASE_URL` |
| `package.json` | Scripts Prisma e scripts de verificacao |
| `package-lock.json` | Lockfile das dependencias instaladas |
| `prisma/migrations/20260624000100_init_supabase_schema/migration.sql` | Migration inicial gerada pelo Prisma |
| `prisma/migrations/migration_lock.toml` | Lock de provider Prisma |
| `supabase/config.toml` | Config local apontando para o projeto Supabase remoto |
| `supabase/rls/recommended_policies.sql` | Politicas RLS recomendadas, nao aplicadas |
| `docs/expected-catalog-from-migration.json` | Catalogo esperado extraido da migration |
| `docs/SUPABASE_SETUP.md` | Instrucoes operacionais de conexao e setup |
| `docs/SUPABASE_MIGRATION_REPORT.md` | Este relatorio |
| `docs/DATABASE_REVIEW.md` | Revisao tecnica pos-migration |

---

## 3. Connection Strategy

### `DATABASE_URL`

Usada pelo runtime NestJS/Prisma Client.

```env
DATABASE_URL="postgresql://postgres.mzqipbkktbpdcasfvzny:<DB_PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
```

Recomendacao:

- Usar o Transaction Pooler do Supabase.
- Manter `connection_limit` conservador por instancia da API.
- Nao usar esta URL para migrations.

### `DIRECT_URL`

Usada para migrations, introspeccao e verificacoes administrativas.

```env
DIRECT_URL="postgresql://postgres:<DB_PASSWORD>@db.mzqipbkktbpdcasfvzny.supabase.co:5432/postgres?sslmode=require"
```

Recomendacao:

- Usar em `prisma migrate deploy`.
- Guardar apenas em `.env`, secrets de CI/CD ou cofre de segredos.
- Nunca expor no frontend.

---

## 4. Prisma Compatibility

| Aspecto | Status | Nota |
|---|---|---|
| PostgreSQL remoto | OK | Supabase Postgres 17 |
| UUID como PK | OK | Todas as PKs usam `UUID`; geracao fica no Prisma/app |
| Enums nativos | OK | 39 enums criados e todos utilizados |
| JSONB | OK | Usado para metadata, audit e payloads |
| TIMESTAMPTZ | OK | Timestamps padronizados |
| DATE | OK | Datas financeiras sem hora |
| Decimal monetario | OK | `DECIMAL(19,4)` para valores financeiros |
| Pooler | OK | Runtime deve usar `DATABASE_URL` pooler |
| Direct connection | OK | Migrations devem usar `DIRECT_URL` |
| Supabase Auth | Nao usado | Conforme arquitetura |
| Edge Functions | Nao usado | Conforme arquitetura |
| RLS | Preparado, nao ativado | Conforme pedido |

Risco operacional: como a aplicacao do DDL foi feita pelo MCP, o catalogo existe, mas o historico Prisma ainda precisa ser reconciliado antes do primeiro `prisma migrate deploy` contra este banco.

---

## 5. Tabelas Criadas

As 25 tabelas verificadas em `public`:

| Tabela | Dominio |
|---|---|
| `users` | Usuario, login e perfil |
| `user_preferences` | Preferencias do usuario |
| `auth_sessions` | Sessoes e refresh tokens |
| `password_reset_tokens` | Recuperacao de senha |
| `accounts` | Contas financeiras |
| `categories` | Categorias globais e customizadas |
| `transactions` | Receitas, despesas, ajustes e transferencias |
| `transfers` | Transferencias entre contas |
| `monthly_budgets` | Orcamentos mensais |
| `budget_category_limits` | Limites por categoria |
| `goals` | Metas financeiras |
| `goal_contributions` | Contribuicoes de metas |
| `emergency_fund_plans` | Plano de reserva de emergencia |
| `recurring_transactions` | Transacoes recorrentes |
| `notifications` | Notificacoes |
| `financial_scores` | Financial Health Score |
| `financial_score_components` | Componentes do score |
| `financial_insights` | Insights financeiros |
| `insight_generation_runs` | Execucoes de IA |
| `import_batches` | Lotes de importacao CSV/OFX |
| `import_items` | Itens importados |
| `audit_logs` | Auditoria |
| `account_balance_snapshots` | Snapshots de saldo |
| `monthly_financial_summaries` | Agregados mensais |
| `monthly_category_summaries` | Agregados mensais por categoria |

---

## 6. Enums Criados

Foram verificados 39 enums, todos com pelo menos uma coluna usando o tipo:

`account_status`, `account_type`, `audit_event_type`, `auth_session_status`, `category_status`, `category_summary_type`, `category_type`, `dashboard_period_default`, `emergency_fund_calculation_mode`, `financial_insight_severity`, `financial_insight_source`, `financial_insight_status`, `financial_insight_type`, `financial_score_classification`, `financial_score_component_type`, `goal_contribution_type`, `goal_priority`, `goal_status`, `goal_type`, `import_batch_status`, `import_item_inferred_type`, `import_item_status`, `import_source_type`, `insight_generation_trigger`, `monthly_budget_status`, `notification_channel`, `notification_severity`, `notification_status`, `notification_type`, `recurrence_kind`, `recurring_transaction_status`, `recurring_transaction_type`, `risk_level`, `run_status`, `transaction_source`, `transaction_status`, `transaction_type`, `transfer_status`, `user_status`.

Nenhum enum orfao foi identificado.

---

## 7. Indices Criados

O Postgres reporta 109 indices no total:

- 25 indices de primary key.
- 14 indices unique.
- 70 indices non-unique.

A migration Prisma tambem reporta 84 indices/constraints de aplicacao esperados, pois essa contagem agrupa indices explicitos e unique constraints do arquivo SQL.

Os indices mais importantes para o MVP cobrem:

- Login por `users.email_normalized`.
- Listagens por `user_id`.
- Transacoes por usuario, tipo, status, conta, categoria e periodo.
- Dashboards por agregados mensais.
- Score financeiro por usuario e periodo.
- Insights por usuario, tipo, status e periodo.
- Importacao por batch, fingerprint e hash de arquivo.
- Auditoria por usuario, ator, evento e entidade.

---

## 8. Foreign Keys

Foram verificadas 49 foreign keys. Todas usam:

```sql
ON DELETE RESTRICT ON UPDATE CASCADE
```

Esse comportamento esta alinhado ao modelo financeiro: delecoes fisicas nao devem propagar perda de historico financeiro. O backend NestJS deve implementar arquivamento ou soft delete em cascata logica quando necessario.

---

## 9. Campos Monetarios

Foram verificados 28 campos `numeric`.

Padrao:

- Valores financeiros: `DECIMAL(19,4)`.
- Taxas e percentuais: `DECIMAL(9,4)`.
- Confidence de insight: `DECIMAL(5,4)`.

Nenhum campo monetario usa `float`, `double precision` ou `money`.

---

## 10. Soft Delete

Tabelas com `deleted_at`:

- `users`
- `accounts`
- `categories`
- `transactions`
- `transfers`
- `monthly_budgets`
- `goals`
- `goal_contributions`
- `recurring_transactions`

Tabelas sem `deleted_at` usam status, historico append-only ou representam agregados/referencias operacionais.

---

## 11. RLS

RLS nao foi ativado, conforme solicitado.

Estado ao vivo:

- 0 tabelas com RLS ligado.
- 25 tabelas com RLS desligado.

O Supabase Advisor classifica isso como erro de seguranca porque tabelas em `public` podem ser expostas via PostgREST/Data API dependendo das configuracoes do projeto. Como a arquitetura definida usa NestJS + Prisma e nao Supabase Auth, a recomendacao e:

1. Nao usar anon key/service role no frontend.
2. Manter acesso ao banco exclusivamente pelo backend.
3. Ativar RLS futuramente apenas com politicas baseadas no contexto da aplicacao.

Politicas recomendadas foram geradas em:

```text
supabase/rls/recommended_policies.sql
```

As politicas usam o padrao futuro:

```sql
SET LOCAL app.current_user_id = '<authenticated-user-uuid>';
```

---

## 12. Problemas Encontrados

| Severidade | Problema | Impacto | Acao recomendada |
|---|---|---|---|
| Alta operacional | `_prisma_migrations` nao existe no remoto | `prisma migrate deploy` pode tentar reaplicar objetos ja existentes | Alinhar historico Prisma antes do primeiro deploy via CI |
| Media | RLS desligado em `public` | Seguro apenas se acesso direto via Supabase Data API nao for usado | Manter acesso via NestJS ou ativar RLS futuramente |
| Media | Advisors indicam FKs sem covering index | Pode afetar joins/deletes por FK em escala | Avaliar indices adicionais em migration futura |
| Baixa | Indices ainda aparecem como unused | Banco esta vazio; isso e esperado no MVP | Reavaliar apos trafego real |
| Baixa | UUID sem default DB-side | Inserts fora do Prisma exigem UUID explicito | Aceitavel se Prisma for a unica camada de escrita |

---

## 13. Recomendacoes

Antes do commit:

- Commitar os arquivos locais de configuracao, migration e docs.
- Nao commitar `.env`.
- Registrar que o schema remoto esta criado, mas a tabela `_prisma_migrations` precisa ser reconciliada.

Antes do primeiro deploy backend:

- Preencher `DATABASE_URL` e `DIRECT_URL` em secrets.
- Rodar `prisma validate`.
- Decidir a estrategia de alinhamento do Prisma Migrate:
  - recriar o banco via `prisma migrate deploy`, ou
  - marcar a migration como aplicada com `prisma migrate resolve --applied`, usando `DIRECT_URL`.

Antes de producao:

- Revisar exposicao da Data API no Supabase.
- Ativar RLS somente com politicas completas e testadas.
- Implementar filtro padrao de `deleted_at IS NULL` no Prisma/NestJS.

