# InsightsModule V1 — relatório consolidado

## Status e arquitetura

O InsightsModule V1 está concluído como um motor determinístico, autenticado e persistido. `InsightsController` expõe o contrato HTTP; `InsightsService` coordena contexto, detectores, fingerprint, deduplicação, persistência, lifecycle, generation runs e auditoria; `InsightContextService` agrega somente os dados necessários; detectores são puros e não acessam Prisma; `InsightsDatabasePort` mantém a unidade transacional testável.

As entidades reais são `FinancialInsight` e `InsightGenerationRun`. O schema não contém entidade ou coluna para feedback, rating, helpful/unhelpful, reação, comentário ou motivo de dismiss. Portanto, nenhum endpoint ou armazenamento improvisado de feedback foi criado. Feedback exige uma evolução futura de schema revisada.

## Contrato público

Todos os endpoints usam `JwtAuthGuard`, `CurrentUser`, DTO whitelist e validação:

- `GET /api/v1/insights`: paginação de 1 a 100, ordenação estável com ID como desempate e filtros por moeda, código, tipo, severidade, status, source, read e datas.
- `GET /api/v1/insights/:id`: detalhe pertencente ao usuário; ausente ou terceiro retorna 404 seguro.
- `POST /api/v1/insights/generate`: geração manual, opcionalmente por período, moeda e subset de detectores.
- `PATCH /api/v1/insights/:id/read`: transição idempotente de `NEW` para `SEEN`.
- `PATCH /api/v1/insights/:id/dismiss`: transição idempotente para `DISMISSED`.

Responses não expõem `userId`, fingerprint, marcadores internos de lifecycle, stack, erros Prisma, tokens ou credenciais. `runId` permanece na resposta de geração porque identifica a execução explicitamente criada pelo contrato.

## Contexto, detectores e regras

O contexto é montado uma vez por usuário/moeda/período e compartilhado. São reutilizados `DashboardService`, `ReportsService` e `FinancialHealthService`, com leituras Prisma mínimas para metas e moedas. Não há conversão cambial. Transações precisam estar confirmadas; soft-deleted são ignoradas; transferências são neutras no patrimônio; valores monetários usam `Prisma.Decimal` e metadata monetária usa strings.

Os 26 sinais determinísticos cobrem:

- Budget: aproximação/excesso de limite e múltiplos excessos.
- Cash Flow: fluxo negativo/melhorado, aumento de despesas, queda de renda e mudança da taxa de poupança.
- Emergency Fund: ausente, baixa e concluída.
- Goals: vencida, próxima da conclusão, concluída e múltiplas em risco.
- Financial Health: crítico e excelente.
- Net Worth: crescimento, queda e concentração por conta.
- Category: spike, concentração e mudança da principal categoria.
- Recurring: pressão mensal e próximas ocorrências.

Thresholds e limites ficam centralizados em `insights.constants.ts`. Condições incompatíveis não coexistem; condições complementares podem coexistir. Baseline zero é explícito, empates são estáveis e ausência de histórico confiável retorna vazio. Nenhum cálculo monetário usa `parseFloat`, `toNumber`, operadores numéricos JS ou `Math.*`.

## Fingerprint, deduplicação e lifecycle

O fingerprint v1 é SHA-256 de usuário, código, moeda, período, tipo de entidade e ID da entidade. Campos passam por normalização Unicode NFC; metadata volátil não participa. Usuário, moeda, período, condição ou entidade diferentes produzem identidades diferentes. `null` e escopo opcional vazio são semanticamente equivalentes.

A primeira ocorrência cria; metadata, severidade ou texto realmente diferentes atualizam; conteúdo canonicamente igual é skipped. Uma segunda geração não duplica. O estado de leitura/dismiss é preservado durante updates.

Como o schema não possui `RESOLVED`/`resolvedAt`, `ARCHIVED` é o equivalente de resolução. Somente `NEW` e `SEEN` da mesma origem, usuário, período, moeda e códigos executados podem ser arquivados. Não há resolução se o detector falha, se não foi solicitado ou se a saída foi truncada em 50. O status anterior e instante de resolução ficam em metadata interna removida do presenter.

Quando a condição retorna na mesma identidade, o registro é reativado: `SEEN` volta como `SEEN` e `NEW` volta como `NEW`; metadata de resolução é limpa e severidade/evidência são atualizadas. `DISMISSED` não é resolvido nem reativado silenciosamente no mesmo período. Novo período ou moeda cria identidade independente.

## Generation runs, atomicidade e concorrência

O run é criado como `RUNNING` antes da detecção. Create/update/skip, reativação, resolução e conclusão ficam na transação interativa. O summary registra `created`, `updated`, `skipped`, `resolved` e `reactivated` no `inputSummary`, pois não existem colunas dedicadas. Falha de detector ou persistência deixa o run `FAILED`, com mensagem genérica, sem persistência parcial nem auditoria de sucesso.

As transações de persistência usam isolamento `Serializable`. P2002, P2034 e o `TransactionWriteConflict` exposto pelo driver adapter acionam um retry transacional e nova consulta de identidade. Testes controlados cobrem runs equivalentes, criação e reativação concorrentes. A proteção continua best-effort porque o fingerprint vive em JSONB sem unique constraint dedicada; uma janela extrema permanece até migration futura revisada.

## Metadata, segurança e auditoria

A sanitização é determinística e limita 4 níveis, 4.096 caracteres e arrays de 50 itens. Chaves sensíveis, Buffer, Date, BigInt, Decimal bruto, objetos Prisma e números não finitos são removidos. Objetos têm chaves ordenadas para impedir updates por ordem JSON. Payloads completos, transações, connection strings, tokens e senhas são bloqueados.

Autorização nunca aceita `userId` do cliente. Listagem, detalhe, read, dismiss, geração, contexto, persistência, resolução e reativação são sempre escopados pelo usuário autenticado. UUIDs, enums, paginação, sort, moeda, campos desconhecidos e datas são validados. IDOR retorna o mesmo 404 de recurso ausente.

`INSIGHT_GENERATED` deriva do enum Prisma e é gravado apenas depois do commit, com metadata mínima e contadores de outcome. O schema não oferece eventos semanticamente específicos para read/dismiss; nenhum enum foi inventado.

## Performance e limites

Contextos e relatórios são reutilizados por moeda. Listagem usa query limitada e count na mesma transação, sem carregar relações. Metadata e arrays são limitados. Persistência consulta por identidade por candidato e resolução carrega o conjunto filtrado; este é aceitável no teto de 50, mas a unique identity e indexação JSONB continuam recomendadas. Não há Redis, cache, workers ou scheduler.

Índices futuros recomendados, sem alteração nesta fase:

- identidade materializada e unique para `(user_id, fingerprint)`;
- `(user_id, source, period_start, period_end, status)` para lifecycle;
- `(user_id, status, created_at, id)` e combinações dos filtros frequentes;
- coluna/indexação revisada para moeda e código hoje presentes em JSONB.

## Histórico deliberadamente fora da V1

- `BUDGET_RECOVERY`: falta snapshot confiável do uso anterior do mesmo budget.
- `EMERGENCY_FUND_PROGRESS`: falta snapshot comparável do valor/meta anterior.
- `GOAL_STAGNANT`: falta uma garantia histórica uniforme de contribuições e baseline.
- `FINANCIAL_SCORE_DROPPED` e `FINANCIAL_SCORE_IMPROVED`: faltam scores comparáveis com mesma versão e moeda garantidas no pipeline.
- `RECURRING_EXPENSE_INCREASED`: `updatedAt` não reconstrói o compromisso mensal anterior.
- `UNUSUAL_CATEGORY_SPENDING`: faltam ao menos três snapshots periódicos equivalentes por categoria.

Esses itens não são bugs. Uma evolução futura precisa de snapshots ou eventos versionados. `POSSIBLE_UNUSED_SUBSCRIPTION` também não é inferido sem telemetria real de uso.

## Testes, smoke e fechamento

As 11 suítes de Insights, com 121 testes, cobrem fingerprint, controller, service, oito detectores, data quality, Decimal, metadata hostil, lifecycle, resolução, reativação, dedup, P2002/P2034, concorrência, IDOR, auditoria e truncation safety. A bateria global passou com 34 suítes e 269 testes, cobrindo Auth, contas, categorias, transações, transferências, budgets, goals, recurring, dashboard, Financial Health, imports, reports, exports e Insights.

O smoke consolidado autenticado utilizou dois usuários técnicos e dados BRL/USD artificiais. Health/readiness retornaram 200; Budget e os sete sinais avançados esperados foram detectados. Foram validados persistência e dez runs concluídos, listagem/filtros/detalhe, read/dismiss, dedup, update, seis resoluções e seis reativações, restauração de `SEEN`, preservação de dismiss, subset de detectores, dados insuficientes, duas gerações concorrentes sem HTTP 500 ou duplicata, isolamento USD, IDOR 404, token ausente/inválido 401, UUID inválido 400, tentativa de injeção de userId sem efeito de autorização, auditoria e ausência de campos internos. Dados controlados foram removidos, usuários técnicos foram soft-deleted e o script temporário foi excluído.

Bugs históricos relevantes corrigidos: comparação JSONB dependente da ordem de chaves, resolução fora do conjunto truncado, aceitação de números não finitos na metadata, ausência de validação do intervalo invertido na listagem e write conflict do driver adapter inicialmente não reconhecido pelo retry concorrente.

O InsightsModule está fechado para o backend V1. O Atlas 2.0 pode adicionar explicações por IA, feedback persistido, snapshots históricos e a migration de identidade/indexação, mantendo o motor determinístico como evidência e fallback.
