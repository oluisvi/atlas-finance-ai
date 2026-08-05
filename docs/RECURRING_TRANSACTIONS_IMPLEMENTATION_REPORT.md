# Recurring Transactions Implementation Report

## Entidade e API

O módulo usa exclusivamente `RecurringTransaction` e o vínculo já existente `Transaction.recurringTransactionId`. O schema oferece `WEEKLY`, `MONTHLY` e `YEARLY`; não há intervalo configurável nem entidade de ocorrência. Foram implementados `POST/GET/PATCH/DELETE /api/v1/recurring-transactions`, consulta individual e os comandos `pause`, `resume`, `cancel` e `run`.

Todos os endpoints exigem JWT e usam o usuário de `CurrentUser`. Leituras e mutações incluem `id`, `userId` e `deletedAt: null`; recursos de terceiros retornam `404`.

## Frequência e execução

Datas são tratadas como datas UTC. Semanal soma sete dias. Mensal e anual preservam o dia da data inicial, limitando-o ao último dia válido do mês: por exemplo, 31 de janeiro gera 29 de fevereiro em 2028 e 28 em ano não bissexto. Na retomada, ocorrências vencidas não são recuperadas: a próxima data é recalculada para a primeira ocorrência atual ou futura.

`run` requer uma recorrência ativa e vencida, revalida conta/categoria/moeda, cria uma `Transaction` confirmada com fonte `RECURRING`, aplica o delta de saldo e avança `nextOccurrenceDate` em uma única transação Prisma. Valores são `Prisma.Decimal` internamente e strings nas respostas.

## Idempotência

Não existe no schema uma chave única por ocorrência. A implementação usa uma reivindicação otimista atômica: `updateMany` exige a combinação de recorrência, usuário, estado `ACTIVE` e `nextOccurrenceDate` original. Somente a transação que altera exatamente uma linha cria a transação financeira; as demais recebem `409`. Como tudo está na mesma transação, falhas revertem reivindicação, transação e saldo.

Uma migration futura deve adicionar uma entidade/constraint única de ocorrência, por exemplo `(recurring_transaction_id, scheduled_date)`, para auditoria individual e proteção persistente independente da linha de agenda.

## Estados, auditoria e exclusão

Pausa preserva a próxima ocorrência. Retomada só aceita `PAUSED`; cancelamento muda para `ENDED`; exclusão lógica usa `DELETED` e `deletedAt`. Nenhuma dessas operações altera transações históricas ou saldo. Eventos de criação, atualização, pausa, retomada, cancelamento, execução e exclusão são enviados ao `AuditService` sem payloads sensíveis.

## Testes, smoke e riscos

A suíte unitária usa mocks e fixtures financeiros tipados. Ela cobre entradas decimais inválidas, referências, filtros, autorização, progressão mensal em ano bissexto, execução, saldo, concorrência/duplicidade, pausa, retomada, cancelamento e soft delete.

O smoke local executa a API NestJS conectada ao Supabase remoto com usuário controlado: health/readiness, conta, categoria, recorrência, execução, bloqueio de repetição, pausa, retomada, atualização, IDOR, cancelamento e soft delete. Os recursos financeiros criados são removidos logicamente; o usuário e auditoria temporários permanecem porque não há endpoint de remoção administrativa.

Os índices existentes cobrem `userId/status`, `userId/nextOccurrenceDate`, `accountId`, `categoryId` e `deletedAt`. Em alta escala, avaliar um índice parcial composto em `(user_id, status, next_occurrence_date) WHERE deleted_at IS NULL` e uma constraint de ocorrência única. Nenhuma migration foi criada nesta etapa. Um scheduler futuro deve localizar recorrências `ACTIVE` vencidas e chamar o mesmo método interno de processamento sob locks/filas, sem duplicar regras.
