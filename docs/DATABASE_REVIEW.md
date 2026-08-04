# Atlas Finance AI - Database Review

**Project ref:** `mzqipbkktbpdcasfvzny`
**Schema base:** `20260624000100_init_supabase_schema`
**Updated:** 2026-08-04
**Escopo:** Revisao tecnica pos-migration. Nenhuma alteracao automatica no schema.

---

## 1. Metodo

Esta revisao considera:

- `docs/PRD.md`
- `docs/DATABASE.md`
- `docs/ARCHITECTURE.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260624000100_init_supabase_schema/migration.sql`
- `docs/expected-catalog-from-migration.json`

Nesta sessao, as ferramentas Supabase de consulta de catalogo retornaram `INVALID_ARGUMENT`, apesar do projeto aparecer como `ACTIVE_HEALTHY`. O script local `npm run db:verify-catalog` tambem falhou por DNS (`ENOTFOUND db.mzqipbkktbpdcasfvzny.supabase.co`). Assim, a revisao abaixo usa a migration aplicada e o snapshot local esperado como base tecnica.

---

## 2. Veredicto Geral

| Criterio | Avaliacao |
|---|---|
| Entidades MVP | Completo: 25 tabelas |
| Enums | Completo: 39 enums |
| FKs | Completo: 49 FKs |
| Integridade referencial | Forte: `ON DELETE RESTRICT` |
| Campos monetarios | Adequado: `DECIMAL`, sem float |
| Soft delete | Consistente nas entidades core |
| Dashboards | Bem suportados por tabelas agregadas |
| IA/insights | Bem suportados por runs + insights persistidos |
| RLS | Preparado em SQL, nao ativado |
| Risco principal | Alinhamento operacional de verificacao/migrations Prisma |

Conclusao: o modelo esta pronto para desenvolvimento do backend NestJS, com recomendacoes de performance e governanca para fases seguintes.

---

## 3. Indices

### 3.1 Cobertura adequada para MVP

Os indices existentes cobrem os fluxos principais:

| Fluxo | Indices relevantes |
|---|---|
| Login | `users_email_normalized_key` |
| Sessoes | `auth_sessions_refresh_token_hash_idx`, `auth_sessions_user_id_status_idx` |
| Contas | `accounts_user_id_status_idx`, `accounts_user_id_type_idx` |
| Transacoes | indices por `user_id`, `transaction_date`, `type`, `status`, `account_id`, `category_id` |
| Orcamentos | `monthly_budgets_user_id_month_key`, `budget_category_limits_budget_id_category_id_key` |
| Metas | `goals_user_id_status_idx`, `goal_contributions_user_id_goal_id_contribution_date_idx` |
| Score | `financial_scores_user_id_period_start_period_end_calculatio_key` |
| Insights | `financial_insights_user_id_status_created_at_idx` |
| Importacao | `import_batches_user_id_account_id_file_hash_key`, `import_items_import_batch_id_fingerprint_key` |
| Auditoria | `audit_logs_user_id_created_at_idx`, `audit_logs_event_type_created_at_idx` |
| Dashboards | `monthly_financial_summaries_user_id_month_key`, `monthly_category_summaries_user_id_category_id_month_type_key` |

### 3.2 Indices recomendados no futuro

O snapshot aponta `import_items.account_id` como FK sem indice dedicado. Por experiencia com advisors Supabase/Postgres, tambem vale monitorar FKs em que a coluna nao e o primeiro campo de um indice composto.

Recomendacoes futuras, nao aplicadas:

```sql
CREATE INDEX CONCURRENTLY import_items_account_id_idx
  ON import_items (account_id);

CREATE INDEX CONCURRENTLY import_batches_account_id_idx
  ON import_batches (account_id);

CREATE INDEX CONCURRENTLY transactions_account_id_idx
  ON transactions (account_id);

CREATE INDEX CONCURRENTLY transactions_category_id_idx
  ON transactions (category_id);

CREATE INDEX CONCURRENTLY goal_contributions_goal_id_idx
  ON goal_contributions (goal_id);
```

Nao aplicar agora sem carga real; priorizar apos `EXPLAIN ANALYZE` e metricas de uso.

---

## 4. Foreign Keys e Integridade

Todas as relacoes principais do MVP possuem FK:

- Usuario para preferencias, sessoes, contas, transacoes, orcamentos, metas, imports, auditoria e agregados.
- Conta para transacoes, transferencias, recorrencias, imports e snapshots.
- Categoria para transacoes, limites, recorrencias, imports sugeridos e agregados.
- Orcamento mensal para limites por categoria.
- Meta para contribuicoes e plano de emergencia.
- Import batch para import items.
- Score para score components.
- Insight generation run para insights.

`ON DELETE RESTRICT` e adequado porque evita perda acidental de historico financeiro. A delecao deve ser logica e controlada pelo NestJS.

---

## 5. Enums

Os 39 enums modelam estados e tipos de dominio de forma consistente.

Pontos positivos:

- Estados de soft delete tambem existem nos enums principais.
- Importacao CSV/OFX tem enums separados para batch e item.
- Score e insights possuem enums proprios para classificacao, componente, severidade, status e origem.

Pontos de atencao:

- `account_type.card` e extensao futura, mas nao quebra o MVP.
- `notification_channel.email` e `push` dependem de infraestrutura posterior.
- Remocao/renomeacao de enums em Postgres e custosa; evoluir sempre via migration controlada.

---

## 6. Campos Monetarios

O uso de `DECIMAL(19,4)` para valores monetarios e adequado para fintech.

Boas praticas recomendadas no backend:

- Receber/enviar dinheiro como string decimal nos DTOs.
- Usar `Prisma.Decimal` ou biblioteca decimal.
- Evitar `Number()` para persistencia financeira.
- Arredondar apenas para exibicao.
- Validar sinal e regras de negocio na camada de dominio.

Nao foram identificados tipos imprecisos para dinheiro.

---

## 7. Soft Delete

Soft delete esta presente em:

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

- Implementar filtro padrao `deleted_at IS NULL` no Prisma/NestJS.
- Invalidar agregados e score quando uma entidade financeira sofrer soft delete.
- Avaliar indices parciais quando o volume crescer.

Risco conhecido:

- Unique constraints em entidades com soft delete podem impedir recriacao apos exclusao logica. Exemplo: `categories_user_id_type_name_key` e `monthly_budgets_user_id_month_key`.

---

## 8. Dashboards e Performance

O modelo evita depender de agregacao pesada em `transactions` para cada request de dashboard.

Tabelas de suporte:

- `monthly_financial_summaries`
- `monthly_category_summaries`
- `account_balance_snapshots`
- `financial_scores`
- `financial_score_components`

Recomendacoes:

- Dashboard deve consultar agregados por padrao.
- Drill-down deve consultar `transactions`.
- Jobs devem recalcular agregados por usuario/mes.
- Redis deve coordenar locks para evitar recalculo concorrente.
- Se `transactions` crescer muito, avaliar particionamento por data ou usuario apenas em fase posterior.

---

## 9. Financial Health Score

Persistencia esta adequada:

- `financial_scores` guarda score, classificacao, periodo e versao.
- `financial_score_components` guarda score normalizado, peso, valor bruto e explicacao.

Recomendacoes:

- Sempre preencher `calculation_version`.
- Persistir score e componentes na mesma transacao.
- Manter historico por periodo/versao.
- Cachear ultimo score no Redis para dashboard.

---

## 10. Insights de IA

Persistencia esta adequada:

- `insight_generation_runs` rastreia trigger, periodo, status, modelo, prompt, tokens e erros.
- `financial_insights` guarda titulo, corpo, severidade, confidence, dados de suporte e status.

Recomendacoes:

- Minimizar dados enviados para o servico FastAPI/IA.
- Versionar prompts.
- Gerar insights por job assincrono.
- Evitar duplicidade por usuario/periodo/tipo.

---

## 11. Auditoria

`audit_logs` esta correto como append-only:

- `before`, `after` e `metadata` em JSONB.
- Indices por usuario, ator, evento e entidade.
- Sem soft delete.

Recomendacoes:

- Nao permitir updates/deletes por services comuns.
- Definir politica de retencao antes de producao.
- Avaliar particionamento por `created_at` quando crescer.

---

## 12. CSV e OFX

O desenho suporta importacao robusta:

- `import_batches` controla arquivo, hash, conta, usuario e status.
- `import_items` controla cada linha, fingerprint, categoria sugerida, match e payload bruto.
- `transactions.import_item_id` cria rastreabilidade entre import e transacao final.

Recomendacoes:

- Usar transacao atomica ao confirmar importacao.
- Deduplicar por hash de arquivo e fingerprint.
- Manter revisao manual para itens ambiguos.

---

## 13. RLS

RLS nao foi ativado.

Foi criado SQL recomendado em:

```text
supabase/rls/recommended_policies.sql
```

Como a autenticacao e NestJS, o padrao recomendado nao usa `auth.uid()`. O backend deve setar:

```sql
select set_config('app.current_user_id', '<authenticated-user-uuid>', true);
```

As politicas cobrem:

- `users`
- `accounts`
- `transactions`
- `goals`
- `monthly_budgets`
- `budget_category_limits`

---

## 14. Gargalos Potenciais

| Area | Risco | Mitigacao |
|---|---|---|
| `transactions` | Crescimento rapido e queries por periodo | Indices compostos, agregados mensais, possivel particionamento futuro |
| Imports | Volume grande de `import_items` | Indice futuro em `account_id`, processamento em lote |
| Auditoria | Crescimento append-only | Retencao, arquivamento, particionamento futuro |
| Soft delete | Indices cheios de registros deletados | Indices parciais futuros |
| Unique + soft delete | Recriacao bloqueada | Partial unique indexes futuros |
| RLS futuro | Politicas podem causar custo por linha | Usar contexto de sessao e indices em `user_id` |

---

## 15. Conclusao

O modelo do banco esta coerente com o PRD, DATABASE.md e ARCHITECTURE.md. As entidades, relacionamentos, enums, campos monetarios, soft delete e agregados atendem ao MVP.

Nenhuma mudanca de schema foi aplicada nesta etapa. As recomendacoes devem ser tratadas como backlog tecnico para migrations futuras, apos validacao de carga real e implementacao do backend NestJS.
