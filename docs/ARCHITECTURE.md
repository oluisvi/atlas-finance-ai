# Atlas Finance AI - Architecture

## 1. Objetivo

Este documento define a arquitetura backend do Atlas Finance AI com base no PRD, na modelagem de dados e no schema Prisma.

O objetivo e orientar a implementacao futura da API em NestJS, do servico de IA em FastAPI, dos fluxos financeiros principais, dos jobs assíncronos, do uso de Redis e das integracoes internas. Este documento nao gera codigo, controllers, services ou implementacoes concretas.

## 2. Visao Geral da Arquitetura

O Atlas Finance AI sera composto por tres camadas principais:

- Frontend Web: Next.js, TypeScript, TailwindCSS, Shadcn UI, Zustand, TanStack Query e Recharts.
- Backend API: NestJS, TypeScript, Prisma, PostgreSQL e Redis.
- AI Service: Python, FastAPI e OpenAI API.

O backend NestJS e a fronteira principal de seguranca, autenticacao, regras financeiras, persistencia, auditoria, dashboards e orquestracao de jobs. O servico FastAPI nao deve acessar o banco diretamente; ele recebe payloads agregados e minimizados enviados pela API ou por workers controlados pelo backend.

## 3. Principios Arquiteturais

- A API NestJS e a unica camada autorizada a acessar PostgreSQL.
- O PostgreSQL e a fonte de verdade para usuarios, contas, transacoes, metas, orcamentos, scores, insights e auditoria.
- Redis e usado para cache, filas, locks, rate limiting e invalidação, nunca como fonte definitiva de dados financeiros.
- Dados derivados, como dashboard, score e insights, devem ser recalculaveis.
- Toda entidade financeira deve ser segregada por `user_id`.
- Operacoes financeiras relevantes devem ser auditadas.
- Dados enviados ao FastAPI devem ser agregados, minimizados e sem credenciais, tokens ou metadados sensiveis.
- Fluxos pesados ou recorrentes devem ser assíncronos e idempotentes.

## 4. Modulos NestJS

### 4.1 AppModule

Modulo raiz da API.

Responsabilidades:

- Compor os modulos da aplicacao.
- Configurar variaveis de ambiente.
- Aplicar configuracoes globais de validacao, serializacao, rate limiting e seguranca.
- Registrar providers globais compartilhados.

### 4.2 ConfigModule

Responsabilidades:

- Centralizar leitura e validacao de variaveis de ambiente.
- Expor configuracoes de banco, Redis, JWT, refresh token, FastAPI, OpenAI indireto, CORS e rate limiting.
- Separar configuracoes por ambiente: local, test, staging e production.

### 4.3 PrismaModule

Responsabilidades:

- Expor Prisma Client para repositorios e modulos de dominio.
- Gerenciar conexao com PostgreSQL.
- Padronizar transacoes de banco para operacoes financeiras atomicas.
- Suportar middlewares ou extensoes de soft delete, auditoria e filtros por usuario quando aplicavel.

### 4.4 RedisModule

Responsabilidades:

- Criar clientes Redis para cache, filas, locks e rate limiting.
- Padronizar chaves, TTLs e estrategias de invalidação.
- Disponibilizar abstracoes para modulos de Dashboard, Score, Insights, Jobs e Auth.

### 4.5 AuthModule

Responsabilidades:

- Cadastro, login, logout e refresh token.
- Hash de senha com Argon2.
- Emissao e validacao de JWT access token.
- Rotacao e revogacao de refresh tokens.
- Recuperacao de senha.
- Controle de sessoes em `AuthSession`.
- Auditoria de login, falha de login, logout e alteracao de senha.

Entidades principais:

- `User`
- `AuthSession`
- `PasswordResetToken`
- `AuditLog`

### 4.6 UsersModule

Responsabilidades:

- Gerenciar perfil do usuario.
- Gerenciar preferencias em `UserPreference`.
- Suportar configuracoes como moeda, locale, timezone, dia inicial do mes financeiro e preferencias de notificacao.
- Preparar fluxos futuros de exportacao e exclusao de dados.

Entidades principais:

- `User`
- `UserPreference`

### 4.7 AccountsModule

Responsabilidades:

- Criar, editar, arquivar e excluir logicamente contas financeiras.
- Manter saldo inicial e saldo atual.
- Recalcular saldo quando houver alteracoes em transacoes.
- Controlar contas que entram ou nao no dashboard.

Entidades principais:

- `Account`
- `Transaction`
- `Transfer`
- `AccountBalanceSnapshot`

### 4.8 CategoriesModule

Responsabilidades:

- Gerenciar categorias padrao e categorias customizadas.
- Suportar categorias globais e categorias por usuario.
- Controlar categorias essenciais para reserva de emergencia.
- Suportar hierarquia opcional de categorias.

Entidades principais:

- `Category`

### 4.9 TransactionsModule

Responsabilidades:

- Criar receitas, despesas e ajustes.
- Editar e excluir logicamente transacoes.
- Aplicar regras de saldo.
- Atualizar ou invalidar agregados de dashboard.
- Disparar eventos de recalculo de orcamento, score e insights.
- Auditar alteracoes financeiras.

Entidades principais:

- `Transaction`
- `Account`
- `Category`
- `AuditLog`

### 4.10 TransfersModule

Responsabilidades:

- Registrar transferencias entre contas do mesmo usuario.
- Criar transacoes pareadas `transfer_out` e `transfer_in`.
- Garantir atomicidade da transferencia.
- Evitar que transferencias afetem receita, despesa, orcamento ou taxa de poupanca.

Entidades principais:

- `Transfer`
- `Transaction`
- `Account`

### 4.11 BudgetsModule

Responsabilidades:

- Criar e gerenciar orcamentos mensais.
- Gerenciar limites por categoria.
- Calcular consumo de orcamento.
- Disparar alertas de 80% e 100%.
- Fornecer dados para dashboard e score financeiro.

Entidades principais:

- `MonthlyBudget`
- `BudgetCategoryLimit`
- `Transaction`
- `Notification`

### 4.12 GoalsModule

Responsabilidades:

- Criar, editar, pausar, concluir, arquivar e excluir logicamente metas.
- Registrar contribuicoes, retiradas e ajustes.
- Calcular progresso de metas.
- Disparar notificacao quando meta for atingida.
- Fornecer dados para dashboard e score financeiro.

Entidades principais:

- `Goal`
- `GoalContribution`
- `Transaction`
- `Notification`

### 4.13 EmergencyFundModule

Responsabilidades:

- Gerenciar a reserva de emergencia como meta especial.
- Calcular despesa essencial mensal.
- Calcular reserva recomendada com base em meses desejados.
- Expor progresso e cobertura em meses.
- Alimentar o Financial Health Score.

Entidades principais:

- `EmergencyFundPlan`
- `Goal`
- `Category`
- `MonthlyCategorySummary`

### 4.14 RecurringTransactionsModule

Responsabilidades:

- Gerenciar regras de transacoes recorrentes.
- Suportar assinaturas simples via `is_subscription`.
- Gerar transacoes futuras ou vencidas de forma idempotente.
- Alimentar alertas de cobranca recorrente.

Entidades principais:

- `RecurringTransaction`
- `Transaction`
- `Notification`

### 4.15 DashboardModule

Responsabilidades:

- Expor dados consolidados para o dashboard principal.
- Combinar resumos financeiros, categorias, metas, reserva, score, insights e alertas.
- Ler preferencialmente tabelas agregadas e cache.
- Invalidar cache quando eventos financeiros relevantes ocorrerem.

Entidades principais:

- `MonthlyFinancialSummary`
- `MonthlyCategorySummary`
- `AccountBalanceSnapshot`
- `FinancialScore`
- `FinancialInsight`
- `Notification`
- `Goal`
- `EmergencyFundPlan`

### 4.16 FinancialScoreModule

Responsabilidades:

- Calcular o Financial Health Score.
- Versionar a formula de calculo.
- Persistir snapshots em `FinancialScore`.
- Persistir explicabilidade por componente em `FinancialScoreComponent`.
- Disparar notificacoes e eventos para insights quando o score mudar de forma relevante.

Entidades principais:

- `FinancialScore`
- `FinancialScoreComponent`
- `MonthlyFinancialSummary`
- `MonthlyCategorySummary`
- `MonthlyBudget`
- `BudgetCategoryLimit`
- `Goal`
- `EmergencyFundPlan`
- `AccountBalanceSnapshot`

### 4.17 InsightsModule

Responsabilidades:

- Orquestrar geracao de insights financeiros.
- Executar regras deterministicas locais.
- Criar payloads agregados para FastAPI.
- Persistir execucoes em `InsightGenerationRun`.
- Persistir insights em `FinancialInsight`.
- Deduplicar insights por tipo, periodo e dados de origem.
- Notificar usuarios quando houver insight relevante.

Entidades principais:

- `InsightGenerationRun`
- `FinancialInsight`
- `MonthlyFinancialSummary`
- `MonthlyCategorySummary`
- `FinancialScore`
- `Goal`
- `RecurringTransaction`

### 4.18 AiGatewayModule

Responsabilidades:

- Encapsular comunicacao HTTP com o servico FastAPI.
- Aplicar timeouts, retries controlados e circuit breaker.
- Assinar ou autenticar chamadas internas.
- Sanitizar payloads enviados e respostas recebidas.
- Normalizar erros do AI Service para o dominio da API.

Este modulo nao deve conter regras financeiras centrais. Ele e um adaptador de integracao.

### 4.19 NotificationsModule

Responsabilidades:

- Criar notificacoes in-app.
- Preparar envio futuro por e-mail e push.
- Controlar status de notificacoes.
- Evitar duplicidade de alertas financeiros.

Entidades principais:

- `Notification`

### 4.20 ImportsModule

Responsabilidades:

- Gerenciar importacao CSV e OFX.
- Criar `ImportBatch`.
- Parsear linhas em `ImportItem`.
- Calcular fingerprint de deduplicacao.
- Sugerir categoria quando possivel.
- Criar transacoes confirmadas apos revisao.
- Auditar importacoes.

Entidades principais:

- `ImportBatch`
- `ImportItem`
- `Transaction`
- `Category`
- `AuditLog`

### 4.21 AuditModule

Responsabilidades:

- Registrar eventos de seguranca e eventos financeiros relevantes.
- Sanitizar `before`, `after` e `metadata`.
- Garantir comportamento append-only.
- Expor consultas internas para investigacao e suporte autorizado.

Entidades principais:

- `AuditLog`

### 4.22 JobsModule

Responsabilidades:

- Registrar filas e jobs agendados.
- Executar tarefas assíncronas e recorrentes.
- Garantir idempotencia, retries, backoff e controle de concorrencia.
- Usar Redis para filas, locks e status de execucao.

### 4.23 HealthModule

Responsabilidades:

- Expor health checks da API.
- Verificar conectividade com PostgreSQL, Redis e FastAPI.
- Diferenciar readiness e liveness.

## 5. Fluxo de Autenticacao

### 5.1 Cadastro

1. Usuario envia nome, e-mail e senha.
2. API normaliza e-mail em `email_normalized`.
3. API valida unicidade.
4. Senha e transformada em hash com Argon2.
5. Registro `User` e criado com status inicial apropriado.
6. Registro `UserPreference` e criado com preferencias padrao.
7. Evento `entity_created` e registrado em auditoria.
8. Opcionalmente, fluxo de verificacao de e-mail e iniciado.

### 5.2 Login

1. Usuario envia e-mail e senha.
2. API aplica rate limiting por IP, e-mail normalizado e combinacao IP+e-mail.
3. API busca usuario por `email_normalized`.
4. API verifica status da conta, bloqueios e senha com Argon2.
5. Em caso de falha, incrementa contador de falhas e registra `login_failed`.
6. Em caso de sucesso, cria `AuthSession` com hash do refresh token.
7. API emite access token JWT de curta duracao.
8. API retorna access token e refresh token conforme estrategia segura do cliente.
9. Registra `login_success` em auditoria.

### 5.3 Refresh Token

1. Cliente envia refresh token.
2. API calcula hash e busca `AuthSession` ativa.
3. API valida expiracao e status.
4. API rotaciona refresh token.
5. Sessao anterior e marcada como `rotated`.
6. Nova sessao ou novo hash de refresh token e persistido.
7. Novo access token e emitido.
8. Reuso de token rotacionado deve revogar a familia de sessoes.

### 5.4 Logout

1. Cliente solicita logout.
2. API identifica a sessao.
3. `AuthSession` e marcada como `revoked`.
4. Cache de sessao, se houver, e invalidado.
5. Evento `logout` e registrado em auditoria.

### 5.5 Recuperacao de Senha

1. Usuario solicita recuperacao por e-mail.
2. API responde de forma neutra, sem revelar existencia do e-mail.
3. Se usuario existir, cria `PasswordResetToken` com hash e expiracao.
4. Token anterior pode ser invalidado por regra de negocio.
5. Ao usar token valido, senha e atualizada com novo hash Argon2.
6. Sessoes existentes podem ser revogadas.
7. Eventos `password_reset_requested` e `password_changed` sao auditados.

## 6. Fluxo de Dashboard

### 6.1 Objetivo

O dashboard deve entregar uma visao consolidada de:

- Receita total.
- Despesa total.
- Saldo atual.
- Financial Health Score.
- Progresso de metas.
- Reserva de emergencia.
- Categorias de gastos.
- Assinaturas.
- Alertas.
- Insights da IA.

### 6.2 Estrategia de Leitura

1. Cliente solicita dashboard com periodo.
2. API valida usuario autenticado e preferencias.
3. `DashboardModule` tenta ler cache Redis.
4. Em cache hit, retorna resposta consolidada.
5. Em cache miss, busca dados em tabelas agregadas:
   - `MonthlyFinancialSummary`
   - `MonthlyCategorySummary`
   - `AccountBalanceSnapshot`
   - `FinancialScore`
   - `FinancialInsight`
   - `Notification`
   - `Goal`
   - `EmergencyFundPlan`
6. Se agregados estiverem ausentes ou vencidos, API pode:
   - retornar dados parciais com indicador de recalculo em andamento; ou
   - acionar job de rebuild do dashboard; ou
   - recalcular sincronicamente apenas em cenarios pequenos.
7. Resposta consolidada e armazenada no Redis com TTL curto.

### 6.3 Invalidacao

Eventos que invalidam dashboard:

- Criacao, edicao ou exclusao logica de transacao.
- Criacao ou alteracao de transferencia.
- Criacao ou alteracao de conta.
- Alteracao de categoria relevante.
- Criacao ou alteracao de orcamento.
- Criacao, contribuicao ou conclusao de meta.
- Recalculo de score.
- Novo insight financeiro.
- Nova notificacao relevante.

### 6.4 Agregados

O dashboard nao deve somar todas as transacoes brutas a cada request em producao. O caminho preferencial e ler agregados mensais e snapshots:

- `MonthlyFinancialSummary`: totais de receita, despesa, fluxo liquido, saldo consolidado e quantidade de transacoes.
- `MonthlyCategorySummary`: totais por categoria.
- `AccountBalanceSnapshot`: saldos historicos por conta.

## 7. Fluxo de Financial Health Score

### 7.1 Gatilhos

O score pode ser calculado por:

- Job mensal de fechamento.
- Job diario para o mes corrente.
- Evento de transacao criada, editada ou excluida.
- Evento de orcamento alterado.
- Evento de meta alterada.
- Solicitação manual do usuario.

### 7.2 Pipeline

1. `FinancialScoreModule` recebe pedido de calculo para usuario e periodo.
2. Tenta adquirir lock Redis por `user_id`, periodo e versao da formula.
3. Carrega dados agregados:
   - receitas e despesas do periodo;
   - aderencia ao orcamento;
   - progresso de metas;
   - reserva de emergencia;
   - evolucao patrimonial.
4. Se agregados estiverem ausentes, solicita rebuild parcial.
5. Calcula componentes normalizados.
6. Aplica pesos versionados.
7. Classifica o score:
   - 0-39: critico;
   - 40-59: atencao;
   - 60-79: bom;
   - 80-100: excelente.
8. Persiste `FinancialScore`.
9. Persiste `FinancialScoreComponent`.
10. Invalida caches de dashboard e score.
11. Dispara evento para geracao de insight quando houver mudanca relevante.

### 7.3 Componentes

Pesos iniciais recomendados:

| Componente | Peso |
|---|---:|
| Taxa de poupanca | 25% |
| Cumprimento de orcamento | 20% |
| Reserva de emergencia | 25% |
| Progresso de metas | 15% |
| Evolucao patrimonial | 15% |

### 7.4 Cuidados

- Usuarios sem dados suficientes devem receber estado incompleto, nao score enganoso.
- Transferencias devem ser excluidas de receita, despesa e taxa de poupanca.
- Meses sem renda exigem tratamento especifico para evitar divisao por zero.
- A formula deve ser versionada em `calculation_version`.
- Cada componente deve ser explicavel ao usuario.

## 8. Fluxo de Geracao de Insights

### 8.1 Objetivo

A IA financeira nao sera chatbot generico. Ela deve operar como motor de insights financeiros, combinando regras deterministicas e geracao assistida por IA.

### 8.2 Gatilhos

- Fechamento mensal.
- Novo score calculado.
- Mudanca relevante de gasto por categoria.
- Risco de ultrapassar orcamento.
- Criacao ou alteracao de meta.
- Job agendado diario/semanal.
- Solicitação manual do usuario.

### 8.3 Pipeline

1. `InsightsModule` cria `InsightGenerationRun` com status `queued`.
2. Worker assume a execucao e muda status para `running`.
3. API coleta dados agregados e minimizados.
4. Regras deterministicas detectam padroes basicos:
   - aumento de gasto por categoria;
   - risco de orcamento;
   - economia potencial com recorrencias;
   - projecao de meta;
   - recomendacao associada ao score.
5. Quando IA for necessaria, `AiGatewayModule` envia payload ao FastAPI.
6. FastAPI retorna insights estruturados, nunca comandos de banco.
7. API valida e sanitiza resposta.
8. API deduplica insights por usuario, tipo, periodo e assinatura dos dados.
9. API persiste `FinancialInsight`.
10. `InsightGenerationRun` e finalizado como `completed` ou `failed`.
11. Notificacao `insight_available` pode ser criada.
12. Cache de dashboard e invalidado.

### 8.4 Dados Permitidos para FastAPI

Preferir:

- Totais por categoria.
- Comparativos percentuais.
- Orcamento planejado versus realizado.
- Progresso agregado de metas.
- Score e componentes explicaveis.
- Recorrencias e assinaturas sem dados sensiveis desnecessarios.

Evitar:

- E-mail.
- Nome completo.
- Tokens.
- IP.
- User agent.
- Descricoes sensiveis brutas quando agregacao for suficiente.
- Qualquer credencial bancaria.

### 8.5 Persistencia

- `InsightGenerationRun` registra a execucao, status, periodo, trigger, modelo, versao de prompt, tokens e erros sanitizados.
- `FinancialInsight` registra o insight final exibivel ao usuario.
- `data_points` deve guardar apenas dados agregados que sustentam o insight.

## 9. Jobs Agendados

### 9.1 ProcessRecurringTransactionsJob

Frequencia sugerida: diario.

Responsabilidades:

- Buscar `RecurringTransaction` ativa com `next_occurrence_date` vencida.
- Gerar `Transaction` idempotente.
- Atualizar `last_generated_at` e `next_occurrence_date`.
- Criar notificacao `recurring_due` quando aplicavel.
- Invalidar dashboard e agregados do periodo.

### 9.2 RecalculateAccountBalancesJob

Frequencia sugerida: sob demanda e verificacao diaria.

Responsabilidades:

- Recalcular saldos a partir de saldo inicial e transacoes confirmadas.
- Corrigir divergencias controladas.
- Criar auditoria ou alerta interno quando houver inconsistencia.

### 9.3 BuildMonthlyFinancialSummariesJob

Frequencia sugerida: incremental por evento e consolidacao diaria.

Responsabilidades:

- Atualizar `MonthlyFinancialSummary`.
- Atualizar `MonthlyCategorySummary`.
- Operar por usuario e periodo.
- Ser idempotente.

### 9.4 CreateAccountBalanceSnapshotsJob

Frequencia sugerida: diario, ao final do dia no timezone do usuario.

Responsabilidades:

- Criar snapshot de saldo por conta.
- Alimentar evolucao patrimonial e score.

### 9.5 CalculateFinancialScoreJob

Frequencia sugerida: diario para mes corrente e mensal no fechamento.

Responsabilidades:

- Calcular score.
- Persistir componentes.
- Invalidar caches.
- Disparar geracao de insights quando relevante.

### 9.6 GenerateInsightsJob

Frequencia sugerida: diario/semanal e fechamento mensal.

Responsabilidades:

- Processar execucoes pendentes de `InsightGenerationRun`.
- Aplicar regras deterministicas.
- Chamar FastAPI quando necessario.
- Persistir insights e notificacoes.

### 9.7 BudgetAlertsJob

Frequencia sugerida: incremental por evento e verificacao diaria.

Responsabilidades:

- Verificar consumo por categoria.
- Criar alertas de 80% e 100%.
- Prevenir duplicidade usando campos `alert_80_sent_at` e `alert_100_sent_at`.

### 9.8 CleanupAuthTokensJob

Frequencia sugerida: diario.

Responsabilidades:

- Expirar sessoes antigas.
- Remover ou arquivar tokens de recuperacao vencidos conforme politica de retencao.
- Gerar metricas de seguranca.

### 9.9 ImportProcessingJob

Frequencia sugerida: sob demanda.

Responsabilidades:

- Processar lotes CSV/OFX.
- Parsear `ImportItem`.
- Detectar duplicidades.
- Sugerir categorias.
- Marcar lote como `parsed`, `review_required`, `imported` ou `failed`.

### 9.10 AuditRetentionJob

Frequencia sugerida: mensal.

Responsabilidades:

- Aplicar politica de retencao de auditoria.
- Arquivar logs antigos quando necessario.
- Preservar eventos financeiros e de seguranca conforme LGPD e politica interna.

## 10. Uso do Redis

### 10.1 Cache

Chaves recomendadas:

- `dashboard:{userId}:{period}`.
- `score:latest:{userId}`.
- `budget-progress:{userId}:{month}`.
- `category-summary:{userId}:{month}`.
- `user-preferences:{userId}`.

TTLs sugeridos:

- Dashboard: curto, entre 1 e 5 minutos.
- Score latest: medio, com invalidação por evento.
- Preferencias: medio, com invalidação em atualizacao.
- Orçamento e categorias: curto ou medio, conforme frequencia de uso.

### 10.2 Filas

Redis pode sustentar filas para:

- Recalculo de agregados.
- Geracao de score.
- Geracao de insights.
- Processamento de importacao.
- Envio de notificacoes.
- Criacao de snapshots.

### 10.3 Locks

Locks distribuidos devem evitar:

- Dois jobs calculando o mesmo score simultaneamente.
- Duas importacoes do mesmo arquivo sendo confirmadas ao mesmo tempo.
- Geração duplicada de transacoes recorrentes.
- Rebuild concorrente dos mesmos agregados.

### 10.4 Rate Limiting

Rate limiting deve cobrir:

- Login.
- Recuperacao de senha.
- Refresh token.
- Importacao de arquivos.
- Geracao manual de insights.
- Endpoints de dashboard de alto custo.

### 10.5 Invalidacao

A invalidacao deve ser orientada por eventos de dominio:

- `transaction.changed`
- `transfer.created`
- `budget.changed`
- `goal.changed`
- `score.calculated`
- `insight.created`
- `notification.created`
- `preferences.changed`

## 11. Integracao com FastAPI

### 11.1 Papel do FastAPI

O FastAPI e responsavel por:

- Gerar textos de insights financeiros.
- Resumir dados agregados.
- Sugerir recomendacoes explicaveis.
- Apoiar projecoes simples com base em payloads enviados pelo backend.

O FastAPI nao deve:

- Acessar PostgreSQL diretamente.
- Ler Redis diretamente.
- Executar mutacoes financeiras.
- Autenticar usuarios finais.
- Receber tokens JWT de usuario.
- Armazenar credenciais ou dados sensiveis desnecessarios.

### 11.2 Contrato de Integracao

O NestJS deve enviar:

- `user_context` minimizado, sem PII direta.
- Periodo analisado.
- Resumos mensais.
- Resumos por categoria.
- Dados de orcamento.
- Dados de metas.
- Componentes do score.
- Preferencias relevantes, como idioma e moeda.

O FastAPI deve retornar:

- Lista de insights estruturados.
- Tipo do insight.
- Titulo.
- Corpo.
- Severidade.
- Confiança, quando aplicavel.
- Dados de apoio ou referencias aos dados agregados.

### 11.3 Confiabilidade

O `AiGatewayModule` deve aplicar:

- Timeout curto e configuravel.
- Retry limitado apenas para falhas transientes.
- Circuit breaker para indisponibilidade do FastAPI.
- Fallback para insights determinísticos quando IA estiver indisponivel.
- Registro de erro sanitizado em `InsightGenerationRun`.

### 11.4 Seguranca Interna

Chamadas NestJS -> FastAPI devem usar:

- Rede privada quando possivel.
- Token interno de servico ou assinatura HMAC.
- Controle de origem.
- Logs sem payload financeiro completo.
- Correlation ID para rastreabilidade.

## 12. Eventos de Dominio

Eventos internos recomendados:

- `user.registered`
- `auth.login_succeeded`
- `auth.login_failed`
- `account.created`
- `account.updated`
- `transaction.created`
- `transaction.updated`
- `transaction.deleted`
- `transfer.created`
- `budget.changed`
- `goal.changed`
- `emergency_fund.changed`
- `summary.rebuilt`
- `score.calculated`
- `insight.generated`
- `import.completed`

Esses eventos podem ser inicialmente internos ao processo NestJS. Conforme o sistema crescer, podem migrar para filas/event bus com Redis ou outra infraestrutura.

## 13. Auditoria

Eventos obrigatorios:

- Login bem-sucedido e falho.
- Logout.
- Recuperacao e alteracao de senha.
- Criacao, edicao e exclusao logica de contas.
- Criacao, edicao e exclusao logica de transacoes.
- Criacao e alteracao de transferencias.
- Criacao e alteracao de orcamentos.
- Criacao, alteracao e conclusao de metas.
- Importacao CSV/OFX.
- Calculo de score.
- Geracao de insights.
- Eventos de seguranca.

Regras:

- Auditoria deve ser append-only.
- Campos sensiveis devem ser mascarados ou omitidos.
- `before` e `after` devem conter apenas dados necessarios para rastreabilidade.
- Logs de auditoria nao substituem logs tecnicos e vice-versa.

## 14. Soft Delete

Entidades financeiras usam `deleted_at` como estrategia padrao de exclusao logica:

- `User`
- `Account`
- `Category`
- `Transaction`
- `Transfer`
- `MonthlyBudget`
- `Goal`
- `GoalContribution`
- `RecurringTransaction`

Regras:

- Queries de produto devem filtrar `deleted_at = null`.
- Exclusao logica deve invalidar agregados e cache.
- Exclusao logica de entidades financeiras deve ser auditada.
- Dados derivados podem ser recalculados apos exclusao.

## 15. Observabilidade

### 15.1 Logs

Logs devem conter:

- Correlation ID.
- User ID quando seguro e necessario.
- Modulo.
- Operacao.
- Status.
- Tempo de execucao.

Nao devem conter:

- Senhas.
- Tokens.
- Refresh tokens.
- Payloads financeiros completos.
- Arquivos importados completos.

### 15.2 Metricas

Metricas recomendadas:

- Latencia de endpoints de dashboard.
- Tempo de calculo de score.
- Tempo de geracao de insights.
- Taxa de erro do FastAPI.
- Cache hit/miss de dashboard.
- Jobs processados, falhos e reprocessados.
- Tentativas de login falhas.
- Volume de transacoes por usuario e periodo.

### 15.3 Tracing

Fluxos que devem ter tracing:

- Login.
- Criacao de transacao.
- Dashboard.
- Recalculo de agregados.
- Calculo de score.
- Geracao de insights.
- Importacao CSV/OFX.

## 16. Fronteiras de Responsabilidade

### NestJS

- Autenticacao e autorizacao.
- Regras financeiras.
- Persistencia transacional.
- Auditoria.
- Agregados.
- Dashboard.
- Jobs.
- Orquestracao de IA.
- Integracao segura com FastAPI.

### FastAPI

- Processamento de linguagem natural para insights.
- Resumos financeiros baseados em payloads agregados.
- Formatacao assistida de recomendacoes.
- Retorno estruturado para a API.

### PostgreSQL

- Fonte de verdade.
- Relacionamentos.
- Integridade transacional.
- Historico financeiro.
- Auditoria persistente.

### Redis

- Cache.
- Filas.
- Locks.
- Rate limiting.
- Controle temporario de execucao.

## 17. Consideracoes de Escalabilidade

- Dashboard deve depender de agregados e cache, nao de queries pesadas sobre transacoes brutas.
- Jobs devem operar por usuario e periodo.
- Reprocessamentos devem ser idempotentes.
- Score e insights devem ser assíncronos quando possivel.
- FastAPI deve ser escalado independentemente do NestJS.
- Redis deve ser tratado como infraestrutura volatil.
- PostgreSQL deve permanecer como fonte de verdade e receber indices alinhados ao schema Prisma.

## 18. Resumo Executivo

A arquitetura proposta organiza o Atlas Finance AI em uma API NestJS modular, um banco PostgreSQL transacional, Redis para performance e orquestracao assíncrona, e FastAPI como servico especializado de IA.

O desenho preserva seguranca, auditabilidade e escalabilidade. O ponto central e separar dados financeiros transacionais de dados derivados: contas, transacoes, metas e orcamentos sao a base confiavel; dashboard, score e insights sao projecoes recalculaveis, cacheaveis e versionadas.
