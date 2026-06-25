# Atlas Finance AI — Database Review

**Project ref:** `mzqipbkktbpdcasfvzny`  
**Schema version:** `20260624000100_init_supabase_schema`  
**Generated:** 2025-06-25  
**Escopo:** Revisão pós-migration — recomendações apenas (schema **não alterado**)

---

## 1. Metodologia

Esta revisão analisa:

- `prisma/schema.prisma`
- `prisma/migrations/20260624000100_init_supabase_schema/migration.sql`
- `docs/DATABASE.md` e `docs/ARCHITECTURE.md`

Para validação ao vivo no Supabase remoto:

```bash
cp .env.example .env
# Preencha DIRECT_URL
npm run db:verify-catalog
```

O script detecta FKs sem índice, status RLS, colunas monetárias e soft delete no catálogo real.

---

## 2. Veredicto geral

| Critério | Avaliação |
|---|---|
| Integridade referencial | ✅ Excelente — 48 FKs, todas RESTRICT |
| Campos monetários | ✅ Correto — DECIMAL fixo, sem float |
| Soft delete | ✅ Consistente nas entidades financeiras core |
| Índices de consulta | ✅ Bem planejados para dashboard e listagens |
| Multi-tenant (`user_id`) | ✅ Presente em todas as entidades financeiras |
| Enums | ✅ Todos utilizados — nenhum órfão |
| Preparação Supabase | ✅ Compatível — RLS preparado mas desligado |
| Gargalos potenciais | ⚠️ Baixo risco no MVP; ver seção 6 |

**Conclusão:** O banco está **pronto para desenvolvimento do backend NestJS**. As recomendações abaixo são melhorias incrementais, não correções urgentes.

---

## 3. Índices

### 3.1 Índices presentes e adequados

O schema cobre bem os padrões de acesso documentados na arquitetura:

| Padrão de query | Índice correspondente |
|---|---|
| Transações por usuário + período | `transactions_user_id_transaction_date_idx` |
| Transações por conta + período | `transactions_user_id_account_id_transaction_date_idx` |
| Transações por categoria + período | `transactions_user_id_category_id_transaction_date_idx` |
| Dashboard mensal | `monthly_financial_summaries_user_id_month_key` |
| Resumo por categoria | `monthly_category_summaries_user_id_category_id_month_type_key` |
| Login / refresh token | `auth_sessions_refresh_token_hash_idx` |
| Jobs de recorrência | `recurring_transactions_user_id_next_occurrence_date_idx` |
| Deduplicação import | `import_items_import_batch_id_fingerprint_key` |

### 3.2 Índices ausentes (recomendação futura)

| Tabela | Coluna FK | Motivo | Prioridade |
|---|---|---|---|
| `import_items` | `account_id` | FK sem índice dedicado; JOINs por conta na revisão de importação | Média |
| `import_batches` | `account_id` | Listagem de imports por conta (sem filtro user+account+hash) | Baixa |
| `budget_category_limits` | `budget_id` | Coberto pelo UNIQUE `(budget_id, category_id)` — OK para lookup por budget | — |

**Recomendação (não aplicar agora):**

```sql
-- Quando volume de importação crescer:
CREATE INDEX CONCURRENTLY import_items_account_id_idx
  ON import_items (account_id);

CREATE INDEX CONCURRENTLY import_batches_account_id_idx
  ON import_batches (account_id);
```

### 3.3 Índices parciais para soft delete

Consultas de produto filtram `deleted_at IS NULL`. Com volume alto, índices parciais reduzem tamanho e melhoram cache hit:

```sql
-- Exemplo futuro (transactions):
CREATE INDEX CONCURRENTLY transactions_active_user_date_idx
  ON transactions (user_id, transaction_date DESC)
  WHERE deleted_at IS NULL AND status = 'confirmed';
```

**Prioridade:** Baixa no MVP; revisitar acima de ~100k transações/usuário.

### 3.4 Índices compostos redundantes

`transactions` possui 5 índices compostos com prefixo `user_id`. PostgreSQL pode usar o índice mais específico; os demais ocupam espaço.

| Índice | Redundância potencial |
|---|---|
| `transactions_user_id_transaction_date_idx` | Prefixo de índices mais específicos |
| `transactions_user_id_status_transaction_date_idx` | Útil para filtros por status |

**Recomendação:** Manter no MVP; reavaliar com `EXPLAIN ANALYZE` em produção antes de remover qualquer índice.

---

## 4. Foreign keys

### 4.1 Cobertura

Todas as relações Prisma possuem FK explícita na migration. Destaques positivos:

- **Transferências:** `transfers` → `accounts` (from/to) + `transactions.transfer_id`
- **Importação circular:** `transactions.import_item_id` ↔ `import_items` com UNIQUE
- **Metas:** `goal_contributions.transaction_id` opcional mas com FK
- **Auditoria:** `audit_logs.user_id` e `actor_user_id` → `users`

### 4.2 Integridade referencial — pontos de atenção

| Cenário | Comportamento atual | Recomendação de aplicação |
|---|---|---|
| Excluir usuário com dados financeiros | `ON DELETE RESTRICT` bloqueia | Implementar soft delete em cascata lógica no NestJS |
| Excluir conta com transações | RESTRICT | Arquivar conta + soft delete transações antes |
| Categoria global (`user_id` NULL) | FK permite NULL | Seed de categorias padrão com `user_id = NULL`, `is_default = true` |
| Transferência entre contas | Duas transações + 1 transfer | Usar transação Prisma atômica |

### 4.3 FKs ausentes (nenhuma crítica)

Não foram identificadas relações Prisma sem FK correspondente na migration.

---

## 5. Enums

### 5.1 Utilização

Todos os 39 enums possuem pelo menos uma coluna referenciada. Nenhum enum não utilizado.

### 5.2 Enums com valores "futuros"

| Enum | Valor | Contexto |
|---|---|---|
| `account_type` | `card` | Cartão fora do MVP — extensibilidade OK |
| `notification_channel` | `email`, `push` | Canais futuros — OK |
| `goal_type` | `retirement`, `property` | Metas avançadas — OK |

**Recomendação:** Documentar no NestJS quais valores são expostos no MVP via DTO validation (whitelist).

### 5.3 Evolução de enums no PostgreSQL

Adicionar valores a enums existentes no Supabase:

```sql
ALTER TYPE transaction_source ADD VALUE IF NOT EXISTS 'open_finance';
```

Prisma exige migration correspondente. Evitar remover/renomear valores em produção.

---

## 6. Performance — gargalos potenciais

### 6.1 Tabela `transactions` (hot path)

Maior volume esperado. Mitigações já previstas na arquitetura:

- Agregados em `monthly_financial_summaries` e `monthly_category_summaries`
- Dashboard lê agregados, não soma transações brutas
- Índices compostos por `user_id` + dimensões

**Risco MVP:** Baixo.  
**Risco escala:** Médio sem jobs de agregação.

### 6.2 Tabela `audit_logs` (append-only)

Crescimento contínuo. Jobs documentados (`AuditRetentionJob`) devem:

- Particionar ou arquivar logs > 12–24 meses
- Considerar particionamento por `created_at` (mensal) no V2

### 6.3 JSONB (`transactions.metadata`, `audit_logs.before/after`)

Sem índices GIN no MVP — correto. Se consultas JSON forem necessárias:

```sql
CREATE INDEX CONCURRENTLY audit_logs_metadata_gin_idx
  ON audit_logs USING GIN (metadata jsonb_path_ops);
```

**Prioridade:** Baixa.

### 6.4 Connection pooling (Supabase)

| Conexão | Uso | Limite |
|---|---|---|
| Pooler (6543) | NestJS runtime | `connection_limit=1` por instância Prisma |
| Direct (5432) | Migrations, scripts | Evitar no runtime |

**Recomendação:** No NestJS, usar `@prisma/adapter-pg` + pooler; escalar horizontalmente com limite conservador de conexões.

### 6.5 Jobs concorrentes

Locks Redis documentados para evitar:

- Duplo cálculo de score
- Dupla geração de transações recorrentes
- Rebuild concorrente de agregados

Esses locks são responsabilidade da aplicação, não do banco.

---

## 7. Campos monetários

### 7.1 Padrão adotado

| Tipo | Uso | Avaliação |
|---|---|---|
| `DECIMAL(19,4)` | Valores em BRL/contas | ✅ Adequado até trilhões com 4 casas |
| `DECIMAL(9,4)` | Taxas e percentuais | ✅ Adequado |
| `DECIMAL(5,4)` | Confidence (0–1) | ✅ Adequado |

### 7.2 Recomendações de aplicação (NestJS)

1. Trafegar valores como **string decimal** na API (conforme API_DESIGN.md)
2. Usar `Prisma.Decimal` ou biblioteca decimal no backend — nunca `Number()` para persistência
3. Arredondamentos de exibição (2 casas) apenas na camada de apresentação
4. Validação: `amount > 0` para receitas/despesas; transferências exigem `from ≠ to`

### 7.3 CHECK constraints (futuro)

Não presentes no schema atual. Opcionais para reforço:

```sql
-- Exemplo futuro:
ALTER TABLE transactions ADD CONSTRAINT transactions_amount_positive
  CHECK (amount > 0);
```

Implementar via migration separada após validação de regras no NestJS.

---

## 8. Soft delete

### 8.1 Entidades com `deleted_at`

users, accounts, categories, transactions, transfers, monthly_budgets, goals, goal_contributions, recurring_transactions

### 8.2 Consistência

| Aspecto | Status |
|---|---|
| Índice em `deleted_at` | ✅ Nas tabelas principais |
| Filtro padrão `deleted_at IS NULL` | ⏭ Implementar no Prisma middleware/extension |
| Invalidação de agregados pós-delete | ⏭ Implementar no NestJS (eventos de domínio) |
| UNIQUE constraints com soft delete | ⚠️ Ver seção 8.3 |

### 8.3 UNIQUE + soft delete

Exemplo: `categories_user_id_type_name_key` impede recriar categoria com mesmo nome após soft delete.

**Opções futuras (escolher uma):**

1. **Partial unique index** (recomendado):

```sql
-- Substituir UNIQUE atual por:
CREATE UNIQUE INDEX categories_user_type_name_active_key
  ON categories (user_id, type, name)
  WHERE deleted_at IS NULL;
```

2. Renomear categoria deletada internamente (`name + '_deleted_' + id`)

**Prioridade:** Média — impacta UX ao recriar categorias.

Mesma lógica aplica-se a `monthly_budgets_user_id_month_key` se orçamentos deletados forem recriados no mesmo mês.

---

## 9. Segurança e RLS

### 9.1 Estado atual

- RLS **desligado** em todas as tabelas
- Autorização 100% via NestJS (correto para arquitetura atual)
- Políticas preparadas em `supabase/rls/recommended_policies.sql`

### 9.2 Quando ativar RLS

Ativar apenas se:

- Frontend acessar PostgREST/Supabase client diretamente, ou
- Exposição pública do banco sem API intermediária

Para NestJS-only: RLS é **opcional** (defense in depth).

### 9.3 Credenciais Supabase

- Nunca expor `service_role` no frontend
- `DATABASE_URL` e `DIRECT_URL` apenas no backend/CI secrets
- Rotacionar senha do banco se vazamento suspeito

---

## 10. Seeds e dados iniciais pendentes

| Item | Status | Recomendação |
|---|---|---|
| Categorias padrão (Alimentação, Transporte, etc.) | ⏭ Pendente | `prisma/seed.ts` com `user_id = NULL`, `is_default = true` |
| Migration lock | ✅ Criado | `prisma/migrations/migration_lock.toml` |
| Extensões PostgreSQL | N/A | `uuid-ossp` não necessário — UUID gerado pela aplicação |

---

## 11. Checklist de validação ao vivo

Após configurar `.env`, confirmar:

- [ ] `_prisma_migrations` contém `20260624000100_init_supabase_schema`
- [ ] 25 tabelas em `public`
- [ ] 39 enums
- [ ] RLS desligado em todas as tabelas
- [ ] Nenhuma FK órfã (`fkWithoutIndex` vazio ou apenas casos conhecidos)
- [ ] Conexão pooler (6543) funciona com Prisma Client
- [ ] Conexão direct (5432) funciona com `prisma migrate deploy`

---

## 12. Resumo de recomendações por prioridade

### Alta (antes de produção)

1. Implementar Prisma extension/middleware para filtrar `deleted_at IS NULL`
2. Garantir transações atômicas em transferências e importações
3. Seed de categorias padrão
4. Secrets management para `DATABASE_URL` / `DIRECT_URL`

### Média (primeiros meses pós-MVP)

1. Partial unique indexes para categorias e orçamentos com soft delete
2. Índice em `import_items.account_id`
3. Job de retenção de `audit_logs`
4. Monitoramento com `pg_stat_statements` no Supabase

### Baixa (escala)

1. Índices parciais `WHERE deleted_at IS NULL`
2. Particionamento de `audit_logs` e possivelmente `transactions`
3. CHECK constraints de valores positivos
4. Índices GIN em JSONB se necessário

---

## 13. Conclusão

O schema Prisma migrado para Supabase está **estruturalmente sólido**, alinhado ao PRD e à arquitetura NestJS. Não há inconsistências críticas de integridade, tipos monetários ou modelagem multi-tenant.

As melhorias sugeridas neste documento devem ser implementadas **deliberadamente via novas migrations**, após validação no NestJS — conforme solicitado, **nenhuma alteração automática foi feita no schema**.
