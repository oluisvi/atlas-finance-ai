# Dashboard Implementation Report

## Implementacao

O Dashboard possui endpoints de leitura independentes para overview, cash flow, categorias, contas, budgets, metas, recorrencias e transacoes recentes. Todos usam JWT e `CurrentUser`; consultas nunca recebem `userId` do cliente e aplicam o escopo do usuario.

Valores financeiros usam `Prisma.Decimal` e sao serializados como strings. Datas e periodos usam UTC. O overview usa o mes UTC atual por padrao; cash flow usa seis meses e agrupamento mensal por padrao. Transferencias, pendentes, ignoradas e registros soft-deleted nao entram em receita, despesa ou consumo de budget.

## Budgets

O resumo calcula consumo real com a mesma predicate do `BudgetsModule`: `EXPENSE`, `CONFIRMED`, `deletedAt: null`, usuario autenticado, categoria limitada, mes do budget e moeda da conta. Cada limite retorna `limitAmount`, `spentAmount`, `remainingAmount`, `usagePercentage` e o status `NORMAL` abaixo de 80%, `ALERT` de 80% ate abaixo de 100%, ou `EXCEEDED` a partir de 100%.

Os totais sao agrupados por moeda e incluem orcado, consumido, restante e contagens de limites normal, alerta e excedido. Nao ha conversao cambial, `NaN` ou `Infinity`.

## Testes, smoke e riscos

`dashboard.service.spec.ts` cobre classificacao Decimal em todas as fronteiras de consumo e denominador zero. A suite completa cobre os modulos de origem; futuras extensoes devem adicionar um adapter de leitura tipado para isolar tambem os agregados completos do Dashboard.

O smoke autenticado valida health/readiness e todos os endpoints. O smoke final de budgets cria conta, categoria, despesas, budget e limite e confirma os valores agregados, sem registrar credenciais.

Os indices atuais de transacao por usuario/data e de recorrencia por usuario/proxima ocorrencia atendem aos filtros. Em volume alto, avaliar indices parciais para transacoes confirmadas nao removidas por usuario/data e cache Redis com invalidacao apos mutacoes financeiras. Nenhuma migration, RLS ou alteracao de schema foi realizada.
