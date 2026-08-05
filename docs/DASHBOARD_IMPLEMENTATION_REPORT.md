# Dashboard Implementation Report

## Objetivo e endpoints

O `DashboardModule` fornece endpoints independentes para `overview`, `cash-flow`, `categories`, `accounts`, `budgets`, `goals`, `recurring` e `recent-transactions`. Todos exigem JWT, derivam o usuário de `CurrentUser` e são somente leitura; não criam eventos de auditoria nem persistem agregados.

## Regras de cálculo

O overview usa o mês UTC atual por padrão, ou o intervalo ISO informado. Considera somente transações `CONFIRMED`, não removidas, dos tipos `INCOME`, `EXPENSE` e `ADJUSTMENT`; transferências e transações pendentes/ignoradas ficam fora do fluxo. Ajustes seguem a regra existente de incremento e entram como receita no indicador de fluxo.

Receitas, despesas e fluxo são calculados com `Prisma.Decimal`; valores públicos são strings. A comparação anterior usa um intervalo de mesma duração. Quando a base anterior é zero, a variação é `null`, nunca `NaN` ou `Infinity`.

Não há soma entre moedas diferentes: saldos são agrupados por moeda e filtros de moeda são aplicados via conta. Datas usam UTC. Cash flow usa uma query parametrizada Prisma para agrupamento mensal ou diário, preservando isolamento por `user_id` e sem concatenar entradas do cliente.

## Consultas e performance

O overview executa agregações e contagens independentes em paralelo. Categorias usam `groupBy` e uma busca única das categorias correspondentes, evitando N+1. Contas, metas, recorrências e transações recentes usam `select` enxuto e limites definidos.

Índices existentes em transações por usuário/data, contas por usuário/status e recorrências por usuário/próxima ocorrência são aproveitados. Em alto volume, avaliar índices parciais para `transactions(user_id, transaction_date) WHERE deleted_at IS NULL AND status = 'confirmed'` e `accounts(user_id, currency) WHERE deleted_at IS NULL`. Redis pode futuramente armazenar respostas curtas por usuário/período, com invalidação após mutações financeiras.

## Limitações

O resumo de budgets retorna os limites configurados, sem reproduzir o cálculo de consumo do módulo de Budgets. O schema não fornece agregação temporal materializada atualizada por cada mutação; por isso o cash flow usa consulta agregada diretamente no PostgreSQL. Nenhuma migration, RLS ou alteração de schema foi realizada.
