# Insights Parte 3 — detectores avançados e lifecycle

## Resultado

A Parte 3 adiciona os detectores determinísticos `NET_WORTH`, `CATEGORY` e `RECURRING` ao pipeline persistido existente. O mesmo `InsightsService` monta um contexto agregado por usuário, moeda e período, executa apenas os detectores selecionados, limita a geração a 50 resultados e persiste criação, atualização, reativação, resolução e conclusão do run na mesma transação.

## Contexto e serviços reutilizados

`InsightContextService` reutiliza `ReportsService.netWorth`, `DashboardService.overview`, `budgets`, `categories` e `recurring`, além de `FinancialHealthService.calculate`. Metas e moedas usam leituras Prisma mínimas. Cada serviço agregado é chamado uma vez por contexto/moeda, e o contexto é compartilhado pelos detectores. Não são carregadas transações completas nem há conversão cambial. Se a saída alcançar o limite de 50, a persistência continua limitada, mas a resolução é suprimida para não arquivar condições verdadeiras que ficaram fora do corte.

O contexto avançado contém patrimônio atual, patrimônio inicial estimado, variação e distribuição limitada por conta; categorias atuais e do período anterior; fluxo, renda e despesas; recorrências ativas, frequência, valor e próxima ocorrência; períodos atual/anterior e indicadores de suficiência. Valores monetários continuam em `Prisma.Decimal` durante cálculos e são serializados como string em metadata.

## Detectores e thresholds

- Net Worth: `NET_WORTH_GROWING` (crescimento >= 5%), `NET_WORTH_DECLINING` (queda >= 5%; crítica >= 20%) e `ACCOUNT_CONCENTRATION_HIGH` (participação >= 70%). Crescimento é `OPPORTUNITY`, queda é `WARNING`/`CRITICAL` e concentração é informativa. Transferências permanecem neutras porque a fórmula patrimonial reutilizada considera apenas impactos financeiros aplicáveis.
- Category: `CATEGORY_SPENDING_SPIKE` (aumento >= 30%, com baseline zero explícito), `CATEGORY_CONCENTRATION_HIGH` (>= 50%) e `TOP_EXPENSE_CATEGORY_CHANGED`. Empates usam valor e depois ID para desempate estável. Spike e concentração podem coexistir.
- Recurring: `RECURRING_EXPENSE_HIGH` (>= 30% da renda; crítica >= 60%) e `UPCOMING_RECURRING_PRESSURE`, em janela de 30 dias. Impactos mensais são `WEEKLY × 52 ÷ 12`, `MONTHLY` direto e `YEARLY ÷ 12`, sempre com Decimal. Renda zero/ausente não produz Infinity.

`NET_WORTH_STABLE` não foi habilitado porque seria emitido repetidamente sem ação útil. `UNUSUAL_CATEGORY_SPENDING` exige no mínimo três períodos históricos confiáveis, que o contexto atual não reconstrói. `RECURRING_EXPENSE_INCREASED` também não foi criado porque `updatedAt` não é histórico financeiro. `POSSIBLE_UNUSED_SUBSCRIPTION` permanece indisponível por não existir telemetria de uso.

## Histórico reavaliado

`BUDGET_RECOVERY`, `EMERGENCY_FUND_PROGRESS`, `GOAL_STAGNANT`, `FINANCIAL_SCORE_DROPPED` e `FINANCIAL_SCORE_IMPROVED` continuam indisponíveis. Insights anteriores não substituem snapshots dos valores, contribuições não garantem baseline comparável, e scores persistidos podem usar versões de cálculo diferentes. Nenhuma comparação foi inferida de `updatedAt`.

## Resolução, reativação e estado do usuário

O schema real não possui `RESOLVED` nem `resolvedAt`; sem alterar `schema.prisma`, `ARCHIVED` é o equivalente de resolução. A resolução guarda internamente `lifecyclePreviousStatus` e `lifecycleResolvedAt` em `dataPoints`; essas chaves e o fingerprint são removidos da resposta pública. Apenas insights `NEW` ou `SEEN` do mesmo usuário, origem `RULE_ENGINE`, período exato, moeda e códigos dos detectores efetivamente executados podem ser resolvidos.

Se a mesma identidade lógica reaparece no mesmo período/moeda, o registro `ARCHIVED` é atualizado e reativado sem duplicata. Um registro anteriormente `SEEN` volta como `SEEN`; os demais voltam como `NEW`. Severidade, texto, metadata e run são atualizados. Um novo período ou outra moeda possui outra identidade e cria ocorrência independente.

`DISMISSED` expressa escolha do usuário, não desaparecimento da condição: ele não participa da resolução automática e não é reativado silenciosamente no mesmo período. No período seguinte, a identidade distinta pode gerar novo insight. O summary do run contém `created`, `updated`, `skipped`, `resolved` e `reactivated`.

## Atomicidade, concorrência e auditoria

Upserts, reativações, resolução filtrada e conclusão do generation run ficam dentro da transação interativa. Falhas rejeitam a unidade inteira; a transição do run para falha ocorre após o rollback. O retry de P2002 refaz a transação e consulta a identidade antes de criar. Auditoria de sucesso ocorre somente após commit e não inventa eventos para resoluções.

Permanece a janela residual já documentada: o fingerprint JSON não tem unique constraint dedicada. Índices futuros recomendados, após revisão de schema, são uma identidade única materializada para `(user, fingerprint)` e índices para `(user_id, source, period_start, period_end, status)`, além de uma estratégia indexável para moeda/código hoje armazenados em JSONB.

## Testes e smoke autenticado

As 11 suítes exclusivas de Insights passaram com 113 testes; a bateria global passou com 34 suítes e 261 testes. As suítes avançadas cobrem thresholds, baseline zero, empates, Decimal, ausência de NaN/Infinity, normalização weekly/monthly/yearly, moedas, dados insuficientes e metadata segura. Os testes do service cobrem resolução, reativação, preservação de `SEEN`, exclusão de `DISMISSED`, escopo usuário/moeda/período/detector, corte seguro em 50 e rollback.

O smoke autenticado iniciou a API local na porta 3022 e validou health/readiness 200 com dois usuários técnicos e dados artificiais. A primeira execução detectou os sete códigos avançados esperados; a repetição não criou duplicatas. A remoção controlada das condições resolveu seis insights, preservou um dismiss, e a restauração reativou seis usando os mesmos IDs e restaurou `SEEN`. Uma execução USD sem dados retornou vazia e o usuário B recebeu 404 ao acessar insight do usuário A. Registros financeiros, insights, runs e sessões foram removidos; usuários técnicos foram soft-deleted e nenhum token, senha, fingerprint ou dado financeiro real foi registrado.

O smoke revelou dois problemas apenas no utilitário temporário de verificação (nomes incorretos dos campos de período e múltiplos comandos em prepared statement); ambos foram corrigidos antes da execução aprovada e o arquivo temporário foi removido. Nenhum bug funcional adicional foi encontrado.

## Segurança, limitações e Parte 4

Detectores não acessam Prisma, não persistem e não alteram saldos. Metadata é limitada e sanitizada; respostas não expõem `userId`, fingerprint, marcadores internos, nomes de conta ou descrições de recorrência. Soft-deleted e transações não confirmadas são ignorados pelos serviços agregadores. Moedas não são misturadas.

Esta fase não altera schema, migrations ou RLS e não usa Supabase Auth, IA, Redis, scheduler, notificações ou frontend. A Parte 4 pode avaliar explicações assistidas por IA somente depois de contratos de evidência, privacidade, custos e fallback determinístico, e pode propor a migration de identidade/indexação em revisão separada.
