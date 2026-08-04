# Atlas Finance AI - Supabase Migration Report

**Project ref:** `mzqipbkktbpdcasfvzny`
**Database:** Supabase PostgreSQL remoto
**Migration base:** `20260624000100_init_supabase_schema`
**Updated:** 2026-08-04
**Status:** Migration inicial informada como aplicada com sucesso no Supabase.

---

## 1. Resumo Executivo

O Atlas Finance AI esta configurado para usar Supabase PostgreSQL remoto como banco principal, mantendo:

- Prisma como ORM e ferramenta de migration.
- NestJS como backend e camada de autenticacao/autorizacao.
- Auth propria da aplicacao, sem Supabase Auth.
- Sem Supabase Edge Functions.
- Sem mudanca de entidades ou regras financeiras.

Esta revisao final nao executou migrations, nao alterou schema e nao ativou RLS. A inspecao foi feita a partir da migration Prisma versionada e do snapshot de catalogo esperado em `docs/expected-catalog-from-migration.json`. Nesta retomada, as consultas MCP `list_tables`/`execute_sql` retornaram `INVALID_ARGUMENT`, e o script local `npm run db:verify-catalog` falhou por DNS (`ENOTFOUND db.mzqipbkktbpdcasfvzny.supabase.co`). Por isso, este relatorio registra o catalogo criado pela migration e a limitacao operacional da verificacao ao vivo nesta sessao.

---

## 2. Catalogo Inspecionado

| Item | Quantidade |
|---|---:|
| Tabelas do MVP | 25 |
| Enums | 39 |
| Indices e unique constraints esperados pela migration | 84 |
| Foreign keys | 49 |
| Tabelas com soft delete | 9 |
| Campos monetarios/numericos | 28 |

---

## 3. Tabelas Criadas

| Tabela | Dominio |
|---|---|
| `users` | Usuario, credenciais e perfil |
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
| `emergency_fund_plans` | Reserva de emergencia |
| `recurring_transactions` | Recorrencias e assinaturas |
| `notifications` | Notificacoes |
| `financial_scores` | Financial Health Score |
| `financial_score_components` | Componentes explicaveis do score |
| `financial_insights` | Insights financeiros |
| `insight_generation_runs` | Execucoes de geracao de insights |
| `import_batches` | Lotes CSV/OFX |
| `import_items` | Itens importados |
| `audit_logs` | Auditoria append-only |
| `account_balance_snapshots` | Snapshots de saldo |
| `monthly_financial_summaries` | Agregados mensais |
| `monthly_category_summaries` | Agregados mensais por categoria |

---

## 4. Enums Criados

Foram identificados 39 enums, todos definidos na migration:

`account_status`, `account_type`, `audit_event_type`, `auth_session_status`, `category_status`, `category_summary_type`, `category_type`, `dashboard_period_default`, `emergency_fund_calculation_mode`, `financial_insight_severity`, `financial_insight_source`, `financial_insight_status`, `financial_insight_type`, `financial_score_classification`, `financial_score_component_type`, `goal_contribution_type`, `goal_priority`, `goal_status`, `goal_type`, `import_batch_status`, `import_item_inferred_type`, `import_item_status`, `import_source_type`, `insight_generation_trigger`, `monthly_budget_status`, `notification_channel`, `notification_severity`, `notification_status`, `notification_type`, `recurrence_kind`, `recurring_transaction_status`, `recurring_transaction_type`, `risk_level`, `run_status`, `transaction_source`, `transaction_status`, `transaction_type`, `transfer_status`, `user_status`.

Nenhum enum orfao foi identificado no schema/migration.

---

## 5. Indices

A migration cria indices para os principais caminhos do MVP:

- Login e unicidade de usuario: `users_email_normalized_key`.
- Sessoes e tokens: `auth_sessions_refresh_token_hash_idx`, `password_reset_tokens_token_hash_idx`.
- Contas por usuario/status/tipo.
- Categorias por usuario/status, hierarquia e defaults.
- Transacoes por usuario, data, tipo, status, conta e categoria.
- Transferencias por usuario/data e contas origem/destino.
- Orcamentos por usuario/mes/status.
- Metas por usuario/status/tipo.
- Recorrencias por usuario/status/proxima ocorrencia.
- Score por usuario/periodo/versao.
- Insights por usuario/status/tipo/periodo.
- Importacoes por hash, fingerprint, batch e status.
- Auditoria por usuario, ator, evento e entidade.
- Agregados por usuario/mes e categoria/mes.

Ponto observado: `import_items.account_id` aparece no snapshot como FK sem indice dedicado. Alem disso, alguns indices compostos colocam `user_id` antes da coluna de FK; isso e bom para consultas multi-tenant do produto, mas pode nao ser ideal para operacoes que partem da FK isolada.

---

## 6. Foreign Keys e Integridade Referencial

Foram identificadas 49 foreign keys. O padrao da migration e:

```sql
ON DELETE RESTRICT ON UPDATE CASCADE
```

Esse desenho e adequado para fintech porque impede delecoes fisicas acidentais de dados financeiros historicos. A aplicacao deve implementar soft delete/arquivamento e transacoes atomicas para:

- Contas com transacoes.
- Transferencias entre contas.
- Importacoes CSV/OFX.
- Recalculo de agregados e score.

Nao foram identificadas relacoes conceituais do MVP sem FK correspondente na migration.

---

## 7. Campos Monetarios

Foram identificados 28 campos numericos.

Padroes usados:

- `DECIMAL(19,4)` para valores financeiros e saldos.
- `DECIMAL(9,4)` para percentuais e metricas de score.
- `DECIMAL(5,4)` para confidence de insight.

Tabelas com campos monetarios/numericos:

- `accounts`
- `transactions`
- `transfers`
- `monthly_budgets`
- `budget_category_limits`
- `goals`
- `goal_contributions`
- `emergency_fund_plans`
- `recurring_transactions`
- `financial_scores`
- `financial_score_components`
- `financial_insights`
- `import_items`
- `account_balance_snapshots`
- `monthly_financial_summaries`
- `monthly_category_summaries`

Nenhum campo monetario usa `float`, `double precision` ou `money`.

---

## 8. Soft Delete

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

Esse padrao cobre as entidades principais sujeitas a exclusao logica. Tabelas de auditoria, imports, snapshots e agregados nao usam soft delete por design.

---

## 9. RLS

RLS nao foi ativado, conforme solicitado.

Foram geradas politicas recomendadas, nao aplicadas, em:

```text
supabase/rls/recommended_policies.sql
```

Escopo coberto:

- User: `users`
- Account: `accounts`
- Transaction: `transactions`
- Goal: `goals`
- Budget: `monthly_budgets` e `budget_category_limits`

Como o projeto nao usa Supabase Auth, as politicas recomendadas usam contexto de aplicacao:

```sql
select set_config('app.current_user_id', '<authenticated-user-uuid>', true);
```

---

## 10. Problemas Encontrados

| Severidade | Problema | Impacto | Recomendacao |
|---|---|---|---|
| Alta operacional | Verificacao ao vivo falhou nesta sessao por MCP/DNS | Nao foi possivel gerar novo snapshot remoto hoje | Reexecutar `npm run db:verify-catalog` em ambiente com DNS/`DIRECT_URL` funcionando |
| Media | RLS desligado em tabelas `public` | Seguro apenas se acesso ao banco ocorrer via NestJS | Nao expor Data API/keys ao frontend; ativar RLS futuramente com testes |
| Media | `import_items.account_id` sem indice dedicado | Pode afetar joins/listagens por conta em importacoes | Avaliar indice em migration futura |
| Media | Unique constraints com soft delete | Pode bloquear recriacao de categoria/orcamento deletado logicamente | Avaliar partial unique indexes futuramente |
| Baixa | UUID sem default DB-side | Inserts fora do Prisma precisam informar UUID | Aceitavel se Prisma/NestJS forem a unica escrita |

---

## 11. Recomendacoes

Antes do desenvolvimento backend:

- Manter `.env` fora do git.
- Configurar `DATABASE_URL` com Transaction Pooler.
- Configurar `DIRECT_URL` com Direct Connection.
- Validar `prisma validate`.

Antes do primeiro pipeline de migrations:

- Garantir que o historico Prisma esteja alinhado com o schema remoto.
- Se `_prisma_migrations` ainda nao existir no remoto, usar estrategia controlada de `prisma migrate resolve --applied` ou reaplicar em banco limpo via `prisma migrate deploy`.

Antes de producao:

- Decidir se Data API do Supabase ficara inacessivel ou protegida.
- Ativar RLS apenas com as politicas testadas.
- Implementar filtro default de `deleted_at IS NULL` no Prisma/NestJS.
- Usar Redis para locks de jobs de dashboard, score e insights.
