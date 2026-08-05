# Goals Implementation Report

## Escopo entregue

O `GoalsModule` implementa metas financeiras isoladas por usuário, com criação, listagem paginada, consulta, atualização, exclusão lógica e gerenciamento de contribuições. A API está protegida pelo `JwtAuthGuard` e obtém o usuário exclusivamente do token autenticado.

## Endpoints

- `POST /api/v1/goals`
- `GET /api/v1/goals`
- `GET /api/v1/goals/:id`
- `PATCH /api/v1/goals/:id`
- `DELETE /api/v1/goals/:id`
- `POST /api/v1/goals/:id/contributions`
- `GET /api/v1/goals/:id/contributions`
- `DELETE /api/v1/goals/:id/contributions/:contributionId`

As listagens usam paginação (`page`, `pageSize`), filtros por tipo, prioridade, status, moeda, data-alvo e nome, e ordenação estável com desempate por `id`.

## Regras e precisão

Valores monetários entram como strings decimais estritas, são convertidos para `Prisma.Decimal` e saem como strings. Não há uso de `number` nem ponto flutuante em cálculos financeiros. A contribuição, sua remoção e a alteração de `currentAmount` ocorrem dentro da mesma transação interativa.

`WITHDRAWAL` reduz o saldo da meta e não pode torná-lo negativo. `CONTRIBUTION` e `ADJUSTMENT` positivo aumentam o saldo. Contribuições são permitidas somente para metas `ACTIVE`. O percentual de progresso pode exceder 100%; `remainingAmount` é limitado a zero apenas na apresentação.

Uma meta não é concluída automaticamente ao alcançar o alvo: a transição para `COMPLETED` é explícita, preservando o fluxo de negócio definido. Transições irreversíveis para estados ativos são bloqueadas para metas concluídas ou arquivadas. A exclusão lógica marca a meta como `DELETED` e preenche `deletedAt`.

## Auditoria e segurança

Criação, alteração e exclusão de metas e contribuições geram eventos no `AuditService`. Consultas sempre incluem `userId` e `deletedAt: null`; recursos inexistentes, excluídos ou pertencentes a outro usuário retornam o mesmo `404`. Nenhum identificador de usuário é aceito do cliente.

## Testes e validação

`goals.service.spec.ts` possui 17 testes unitários tipados, sem acesso ao Supabase real. Eles cobrem criação, validação monetária, paginação, escopo do usuário, busca, transições, soft delete, contribuições, saque insuficiente, estado pausado e reversão de contribuição.

O smoke test local autenticado usa o backend NestJS com Prisma e Supabase remoto: registra usuário de teste, cria meta, adiciona duas contribuições, atualiza o alvo, valida listagem, remove uma contribuição e faz soft delete da meta. A meta de teste foi removida logicamente. Como a API ainda não disponibiliza exclusão administrativa de usuário ou sessões, o usuário temporário, sua sessão e seus eventos de auditoria permanecem no ambiente remoto; não foram registradas credenciais.

## Limitações e próximos passos

- Notificações de meta atingida permanecem fora deste módulo e exigem o módulo de notificações.
- Não há vínculo de conta na contribuição porque o schema atual não possui esse relacionamento.
- Para maior seletividade em consultas por usuário e exclusão lógica, considerar futuramente um índice composto em `goals(user_id, deleted_at, status, target_date)`; não foi alterado schema nem criada migration nesta etapa.
