# Atlas Finance AI - Database Review

**Project ref:** `mzqipbkktbpdcasfvzny`  
**Schema:** `20260624000100_init_supabase_schema`  
**Updated:** 2026-08-04  
**Scope:** Revisao pos-migration no Supabase remoto. Recomendacoes apenas; nenhuma alteracao automatica no schema.

---

## 1. Metodo

Foram analisados:

- `docs/PRD.md`
- `docs/DATABASE.md`
- `docs/ARCHITECTURE.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260624000100_init_supabase_schema/migration.sql`
- Catalogo remoto do Supabase via MCP
- Supabase Security Advisor
- Supabase Performance Advisor

Validacoes executadas:

- `npm.cmd run prisma:validate`
- `npm.cmd run db:expected-catalog`
- Consultas no catalogo remoto para tabelas, enums, indices, FKs, campos monetarios e RLS.

---

## 2. Resultado Geral

| Area | Resultado |
|---|---|
| Tabelas | OK: 25 tabelas criadas |
| Enums | OK: 39 enums, todos utilizados |
| Foreign keys | OK: 49 FKs |
| Integridade referencial | OK: `ON DELETE RESTRICT` preserva historico financeiro |
| Campos monetarios | OK: `DECIMAL`, sem float |
| Soft delete | OK nas entidades core |
| Indices | Bom para MVP, com melhorias futuras recomendadas |
| RLS | Desligado conforme pedido, mas reportado pelo Supabase como risco se Data API for exposta |
| Prisma Migrate | Atencao: `_prisma_migrations` nao existe no banco remoto |

Veredicto: o banco esta estruturalmente pronto para desenvolvimento do backend NestJS, mas o historico Prisma precisa ser reconciliado antes de usar `prisma migrate deploy` contra este projeto remoto.

---

## 3. Indices Ausentes ou Melhoraveis

O Performance Advisor do Supabase indicou foreign keys sem covering index:

| Tabela | FK | Observacao |
|---|---|---|
| `budget_category_limits` | `category_id` | Existe indice `(user_id, category_id)`, mas a FK nao e prefixo do indice |
| `goal_contributions` | `goal_id` | Existe indice `(user_id, goal_id, contribution_date)`, mas a FK nao e prefixo |
| `import_batches` | `account_id` | Existe unique `(user_id, account_id, file_hash)`, mas a FK nao e prefixo |
| `import_items` | `account_id` | Nao ha indice dedicado |
| `monthly_category_summaries` | `category_id` | Existe indice `(user_id, category_id, month)`, mas a FK nao e prefixo |
| `transactions` | `account_id` | Existe indice `(user_id, account_id, transaction_date)`, mas a FK nao e prefixo |
| `transactions` | `category_id` | Existe indice `(user_id, category_id, transaction_date)`, mas a FK nao e prefixo |

Importante: esses avisos nao significam ausencia total de indices uteis para as queries principais do produto. Eles indicam que, para operacoes iniciadas pela FK isolada, principalmente joins/deletes/validacoes referenciais pelo lado da FK, o Postgres pode nao usar um indice cujo primeiro campo e `user_id`.

Recomendacao futura, nao aplicada:

```sql
CREATE INDEX CONCURRENTLY budget_category_limits_category_id_idx
  ON budget_category_limits (category_id);

CREATE INDEX CONCURRENTLY goal_contributions_goal_id_idx
  ON goal_contributions (goal_id);

CREATE INDEX CONCURRENTLY import_batches_account_id_idx
  ON import_batches (account_id);

CREATE INDEX CONCURRENTLY import_items_account_id_idx
  ON import_items (account_id);

CREATE INDEX CONCURRENTLY monthly_category_summaries_category_id_idx
  ON monthly_category_summaries (category_id);

CREATE INDEX CONCURRENTLY transactions_account_id_idx
  ON transactions (account_id);

CREATE INDEX CONCURRENTLY transactions_category_id_idx
  ON transactions (category_id);
```

Prioridade: media antes de alta escala; baixa para o MVP vazio.

---

## 4. Indices Unused

O Supabase Advisor marcou muitos indices como unused.

Conclusao: isso e esperado porque o banco esta sem dados e sem trafego de aplicacao. Nao remover indices agora.

Recomendacao:

- Reavaliar apos dados reais e carga do backend.
- Usar `pg_stat_statements` e `EXPLAIN ANALYZE`.
- Remover indices somente com evidencia de custo de escrita/armazenamento superior ao ganho de leitura.

---

## 5. Foreign Keys

Nao foram encontradas relacoes Prisma sem FK correspondente no banco.

O uso de `ON DELETE RESTRICT` esta correto para fintech:

- Evita perda acidental de historico financeiro.
- Obriga soft delete ou arquivamento controlado.
- Mantem trilha de auditoria e consistencia de agregados.

Recomendacao:

- Implementar delecao logica no NestJS.
- Usar transacoes Prisma atomicas para transferencias, importacoes e recalculos.
- Evitar deletes fisicos em entidades financeiras core.

---

## 6. Enums

Todos os 39 enums estao em uso por pelo menos uma coluna.

Nao foram encontrados enums orfaos.

Pontos de atencao:

- `account_type.card` existe antes do modulo de cartao estar no MVP. Isso e aceitavel como extensibilidade.
- Canais `email` e `push` em `notification_channel` podem depender de infraestrutura futura.
- Valores novos em enums PostgreSQL devem ser adicionados por migration Prisma, nunca manualmente sem versionamento.

---

## 7. Campos Monetarios

Foram verificados 28 campos numericos.

Padrao aprovado:

- `DECIMAL(19,4)` para dinheiro e saldos.
- `DECIMAL(9,4)` para percentuais e metricas do score.
- `DECIMAL(5,4)` para confidence.

Riscos evitados:

- Nao ha `float`.
- Nao ha `double precision`.
- Nao ha tipo `money`.

Recomendacao para o backend:

- Trafegar valores monetarios como string decimal nas APIs.
- Usar `Prisma.Decimal` ou biblioteca decimal.
- Nao converter valores financeiros persistentes com `Number()`.

---

## 8. Soft Delete

Tabelas core com `deleted_at`:

- `users`
- `accounts`
- `categories`
- `transactions`
- `transfers`
- `monthly_budgets`
- `goals`
- `goal_contributions`
- `recurring_transactions`

Recomendacoes:

- Criar extensao/middleware Prisma para aplicar `deleted_at IS NULL` por padrao nas leituras.
- Garantir que agregados sejam invalidados/recalculados apos soft delete.
- Avaliar indices parciais no futuro:

```sql
CREATE INDEX CONCURRENTLY transactions_active_user_date_idx
  ON transactions (user_id, transaction_date DESC)
  WHERE deleted_at IS NULL AND status = 'confirmed';
```

---

## 9. Unique Constraints e Soft Delete

Algumas uniques podem bloquear recriacao de entidades deletadas logicamente:

- `categories_user_id_type_name_key`
- `monthly_budgets_user_id_month_key`
- `monthly_financial_summaries_user_id_month_key`
- `monthly_category_summaries_user_id_category_id_month_type_key`

Para entidades editaveis pelo usuario, especialmente `categories` e `monthly_budgets`, avaliar partial unique indexes em migration futura:

```sql
CREATE UNIQUE INDEX categories_user_type_name_active_key
  ON categories (user_id, type, name)
  WHERE deleted_at IS NULL;
```

Nao aplicar agora sem ajustar Prisma e fluxo do backend.

---

## 10. Performance para Dashboards

O modelo esta adequado para MVP porque usa tabelas agregadas:

- `monthly_financial_summaries`
- `monthly_category_summaries`
- `account_balance_snapshots`
- `financial_scores`
- `financial_score_components`

Recomendacoes:

- Dashboard deve ler agregados sempre que possivel.
- `transactions` deve ser usada para drill-down e reconstrucao.
- Jobs de agregacao devem rodar apos criacao, edicao, importacao e soft delete de transacoes.
- Usar Redis para locks de recalculo por usuario/mes.

---

## 11. Financial Health Score

Persistencia adequada:

- `financial_scores` guarda score final, classificacao, periodo, versao e metricas.
- `financial_score_components` guarda componentes explicaveis, peso e score normalizado.

Recomendacoes:

- Manter `calculation_version` obrigatoria.
- Nunca sobrescrever scores historicos sem motivo; criar nova linha por versao/periodo.
- Usar transacao para gravar score e componentes juntos.
- Cachear ultimo score no Redis para dashboard.

---

## 12. Insights de IA

Persistencia adequada:

- `insight_generation_runs` registra execucao, modelo, prompt, tokens e erro.
- `financial_insights` registra insights gerados e estado de leitura.

Recomendacoes:

- Nunca enviar dados sensiveis desnecessarios ao servico de IA.
- Guardar `prompt_version`.
- Guardar `input_summary` minimizado.
- Usar jobs assicronos e idempotencia por usuario/periodo.

---

## 13. Auditoria

`audit_logs` esta correto como append-only.

Recomendacoes:

- Nao usar soft delete em auditoria.
- Nao permitir update/delete pelo backend comum.
- Retencao e arquivamento devem ser jobs separados.
- Avaliar particionamento por `created_at` quando crescer.

---

## 14. CSV e OFX

O modelo cobre importacao com:

- `import_batches`
- `import_items`
- `transactions.import_item_id`
- fingerprints e hash de arquivo
- status por batch e item

Recomendacoes:

- Deduplicacao por `import_batch_id + fingerprint`.
- Hash de arquivo por usuario/conta.
- Revisao manual antes de consolidar itens ambigos.
- Importacao deve criar transacoes em transacao atomica.

---

## 15. RLS e Seguranca

Estado atual:

- RLS desligado em todas as 25 tabelas.
- Isso foi solicitado explicitamente.
- Supabase Advisor marca como erro porque `public` pode ser exposto via Data API.

Para manter seguro enquanto RLS esta desligado:

- Nao usar Supabase client direto no frontend para essas tabelas.
- Nao expor `service_role`.
- Fazer todo acesso via NestJS.
- Controlar segredos em backend/CI.

Politicas futuras estao em:

```text
supabase/rls/recommended_policies.sql
```

Como a auth e NestJS, o padrao futuro recomendado e setar contexto por transacao:

```sql
SET LOCAL app.current_user_id = '<authenticated-user-uuid>';
```

---

## 16. Prisma Migration History

Problema observado:

- O schema remoto existe.
- A tabela `_prisma_migrations` nao existe.
- A migration foi aplicada por MCP/Supabase, nao por `prisma migrate deploy`.

Impacto:

- Um futuro `prisma migrate deploy` pode tentar aplicar novamente a migration inicial e falhar por objetos ja existentes.

Recomendacoes:

1. Preferivel em ambiente limpo: recriar o banco e aplicar `prisma migrate deploy` via `DIRECT_URL`.
2. Se manter o schema atual: usar `prisma migrate resolve --applied 20260624000100_init_supabase_schema` com `DIRECT_URL`, depois validar.
3. Documentar essa decisao antes do primeiro pipeline CI/CD.

---

## 17. Prioridades

Alta antes do backend avançar:

- Resolver/alinhar `_prisma_migrations`.
- Garantir secrets corretos de `DATABASE_URL` e `DIRECT_URL`.
- Implementar soft delete default no Prisma/NestJS.

Media:

- Avaliar covering indexes para FKs apontadas pelo Supabase Advisor.
- Planejar partial unique indexes para entidades com soft delete.
- Implementar seed de categorias padrao.

Baixa:

- Indices parciais para tabelas grandes.
- Particionamento de `audit_logs`.
- GIN indexes em JSONB apenas se houver consultas por JSON.

---

## 18. Conclusao

O schema esta coerente com o PRD, DATABASE.md e ARCHITECTURE.md, e o catalogo remoto confirma que as entidades principais existem no Supabase.

O unico ponto que impede considerar a operacao 100% fechada para CI/CD e o historico do Prisma Migrate: `_prisma_migrations` precisa ser alinhada. Para desenvolvimento NestJS imediato, o banco esta utilizavel; para pipeline de migrations, falta essa reconciliacao.
