# Atlas Finance AI - API Design

## 1. Objetivo

Este documento define o contrato REST da API do Atlas Finance AI para o MVP, com base no PRD, no desenho de banco de dados e na arquitetura backend.

Este documento nao define controllers, services, repositories, implementacao, Prisma Client ou codigo. Ele descreve apenas os contratos HTTP, DTOs, autenticacao, paginacao, filtros, codigos de resposta e versionamento.

## 2. Principios do Contrato

- A API e RESTful e versionada.
- Todos os endpoints de produto sao escopados pelo usuario autenticado.
- O cliente nunca envia `user_id`; ele e inferido pelo access token.
- Dados financeiros retornados devem pertencer apenas ao usuario autenticado.
- Valores monetarios trafegam como string decimal para evitar perda de precisao.
- Datas financeiras usam `YYYY-MM-DD`.
- Timestamps usam ISO 8601 em UTC.
- Soft delete nao deve ser exposto como exclusao fisica.
- Endpoints de dashboard, score e insights podem retornar dados derivados e status de processamento.
- Endpoints administrativos nao fazem parte do MVP publico.

## 3. Versionamento da API

Base path:

`/api/v1`

Regras:

- Mudancas backward-compatible permanecem em `/api/v1`.
- Mudancas que removem campos, alteram semantica ou mudam formatos devem ir para nova versao.
- Campos novos podem ser adicionados sem nova versao.
- Campos depreciados devem permanecer por janela de compatibilidade antes de remocao.
- A versao tambem pode ser exposta no header `X-API-Version`.

Headers recomendados:

| Header | Obrigatorio | Descricao |
|---|---:|---|
| Authorization | Sim para endpoints protegidos | `Bearer <access_token>` |
| Content-Type | Sim para requests com body | `application/json` ou `multipart/form-data` |
| Accept | Nao | `application/json` |
| X-Request-Id | Nao | Correlation ID enviado pelo cliente |
| Idempotency-Key | Recomendado em operacoes financeiras | Chave unica por tentativa de criacao |

## 4. Autenticacao e Autorizacao

### 4.1 Modelo de Autenticacao

- Access token JWT de curta duracao.
- Refresh token rotacionavel.
- Refresh token armazenado e validado como hash no backend.
- Senhas armazenadas apenas como hash Argon2.
- Rate limiting aplicado em login, refresh token e recuperacao de senha.

### 4.2 Endpoints Publicos

Nao exigem `Authorization`:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/password/forgot`
- `POST /api/v1/auth/password/reset`
- `GET /api/v1/health`
- `GET /api/v1/health/readiness`
- `GET /api/v1/health/liveness`

### 4.3 Endpoints Protegidos

Todos os demais endpoints exigem:

`Authorization: Bearer <access_token>`

### 4.4 Autorizacao por Dono do Recurso

Recursos financeiros sao acessiveis somente pelo proprietario autenticado:

- Contas
- Categorias personalizadas
- Transacoes
- Transferencias
- Orcamentos
- Metas
- Reserva de emergencia
- Recorrencias
- Notificacoes
- Scores
- Insights
- Importacoes

Categorias globais padrao podem ser lidas por todos, mas nao alteradas por usuarios comuns.

## 5. Padroes de Resposta

### 5.1 Sucesso Simples

Formato:

| Campo | Tipo | Descricao |
|---|---|---|
| data | object | Objeto de resposta |
| meta | object | Metadados opcionais |

### 5.2 Lista Paginada

Formato:

| Campo | Tipo | Descricao |
|---|---|---|
| data | array | Lista de itens |
| pagination | object | Metadados de paginacao |
| filters | object | Filtros aplicados, quando util |

Pagination DTO:

| Campo | Tipo | Descricao |
|---|---|---|
| page | integer | Pagina atual |
| pageSize | integer | Tamanho da pagina |
| totalItems | integer | Total de itens |
| totalPages | integer | Total de paginas |
| hasNextPage | boolean | Indica se ha proxima pagina |
| hasPreviousPage | boolean | Indica se ha pagina anterior |

### 5.3 Erro Padrao

ErrorResponse DTO:

| Campo | Tipo | Descricao |
|---|---|---|
| error.code | string | Codigo estavel do erro |
| error.message | string | Mensagem segura para cliente |
| error.details | object | Detalhes opcionais de validacao |
| requestId | string | Correlation ID |
| timestamp | timestamp | Momento do erro |

Exemplos de `error.code`:

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `RESOURCE_NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `INVALID_REFRESH_TOKEN`
- `INSUFFICIENT_DATA`
- `IMPORT_PARSE_ERROR`
- `AI_SERVICE_UNAVAILABLE`
- `INTERNAL_ERROR`

## 6. Codigos HTTP

| Codigo | Uso |
|---:|---|
| 200 | Consulta, atualizacao ou acao concluida com resposta |
| 201 | Recurso criado |
| 202 | Operacao aceita para processamento assíncrono |
| 204 | Operacao concluida sem corpo de resposta |
| 400 | Request invalido ou regra de negocio violada |
| 401 | Ausencia ou invalidade de credenciais |
| 403 | Usuario autenticado sem permissao |
| 404 | Recurso inexistente ou nao pertencente ao usuario |
| 409 | Conflito de estado ou duplicidade |
| 422 | Erro semantico de validacao |
| 429 | Rate limit excedido |
| 500 | Erro interno inesperado |
| 502 | Falha em servico externo/interno, como FastAPI |
| 503 | Servico temporariamente indisponivel |

## 7. Paginacao, Ordenacao e Filtros

### 7.1 Paginacao Padrao

Query params:

| Parametro | Tipo | Default | Limite | Descricao |
|---|---|---:|---:|---|
| page | integer | 1 | >= 1 | Numero da pagina |
| pageSize | integer | 20 | 1-100 | Itens por pagina |

### 7.2 Ordenacao Padrao

Query params:

| Parametro | Tipo | Exemplo | Descricao |
|---|---|---|---|
| sortBy | string | `createdAt` | Campo permitido por endpoint |
| sortOrder | enum | `asc`, `desc` | Direcao |

Default geral:

- `sortBy=createdAt`
- `sortOrder=desc`

### 7.3 Filtros Comuns

| Parametro | Tipo | Descricao |
|---|---|---|
| search | string | Busca textual simples |
| status | string | Status do recurso |
| from | date | Inicio do periodo |
| to | date | Fim do periodo |
| includeDeleted | boolean | Apenas para fluxos internos ou auditoria autorizada |

## 8. DTOs Compartilhados

### 8.1 Money

| Campo | Tipo | Exemplo |
|---|---|---|
| amount | decimal string | `"1234.56"` |
| currency | string | `"BRL"` |

### 8.2 DateRange

| Campo | Tipo | Exemplo |
|---|---|---|
| from | date | `2026-06-01` |
| to | date | `2026-06-30` |

### 8.3 EntityReference

| Campo | Tipo | Descricao |
|---|---|---|
| id | uuid | Identificador |
| type | string | Tipo da entidade |
| label | string | Nome exibivel |

### 8.4 AuditMetadata

| Campo | Tipo | Descricao |
|---|---|---|
| createdAt | timestamp | Criacao |
| updatedAt | timestamp | Atualizacao |
| deletedAt | timestamp nullable | Exclusao logica |

## 9. Modulos e Endpoints

## 9.1 AuthModule

### Endpoints

| Metodo | Endpoint | Auth | Descricao |
|---|---|---:|---|
| POST | `/api/v1/auth/register` | Nao | Cadastra usuario |
| POST | `/api/v1/auth/login` | Nao | Autentica usuario |
| POST | `/api/v1/auth/refresh` | Nao | Rotaciona refresh token |
| POST | `/api/v1/auth/logout` | Sim | Revoga sessao atual |
| POST | `/api/v1/auth/logout-all` | Sim | Revoga todas as sessoes |
| POST | `/api/v1/auth/password/forgot` | Nao | Solicita recuperacao |
| POST | `/api/v1/auth/password/reset` | Nao | Redefine senha |
| GET | `/api/v1/auth/sessions` | Sim | Lista sessoes do usuario |
| DELETE | `/api/v1/auth/sessions/{sessionId}` | Sim | Revoga sessao especifica |

### RegisterRequest DTO

| Campo | Tipo | Obrigatorio | Regras |
|---|---|---:|---|
| name | string | Sim | 2 a 120 caracteres |
| email | string | Sim | E-mail valido |
| password | string | Sim | Politica minima de senha |

### AuthResponse DTO

| Campo | Tipo | Descricao |
|---|---|---|
| user | UserProfileResponse | Usuario autenticado |
| accessToken | string | JWT de curta duracao |
| refreshToken | string | Token rotacionavel, se nao for cookie httpOnly |
| expiresIn | integer | Segundos ate expirar |

### LoginRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| email | string | Sim |
| password | string | Sim |

### RefreshTokenRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| refreshToken | string | Sim, quando nao estiver em cookie httpOnly |

### ForgotPasswordRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| email | string | Sim |

Resposta deve ser neutra para nao revelar se o e-mail existe.

### ResetPasswordRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| token | string | Sim |
| password | string | Sim |

### SessionResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| deviceId | string nullable |
| userAgent | string nullable |
| ipAddress | string masked nullable |
| status | enum |
| expiresAt | timestamp |
| createdAt | timestamp |

### Codigos

- 200: login, refresh, logout concluido.
- 201: cadastro concluido.
- 204: sessao revogada.
- 400/422: payload invalido.
- 401: credenciais invalidas.
- 409: e-mail ja cadastrado.
- 429: rate limit.

## 9.2 UsersModule

### Endpoints

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/users/me` | Retorna perfil autenticado |
| PATCH | `/api/v1/users/me` | Atualiza perfil |
| GET | `/api/v1/users/me/preferences` | Retorna preferencias |
| PATCH | `/api/v1/users/me/preferences` | Atualiza preferencias |
| DELETE | `/api/v1/users/me` | Solicita exclusao logica da conta |

### UserProfileResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| name | string |
| email | string |
| status | enum |
| emailVerifiedAt | timestamp nullable |
| createdAt | timestamp |
| updatedAt | timestamp |

### UpdateUserProfileRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| name | string | Nao |

### UserPreferenceResponse DTO

| Campo | Tipo |
|---|---|
| currency | string |
| locale | string |
| timezone | string |
| monthStartDay | integer |
| dashboardPeriodDefault | enum |
| aiInsightsEnabled | boolean |
| emailNotificationsEnabled | boolean |
| inAppNotificationsEnabled | boolean |

### UpdateUserPreferenceRequest DTO

Mesmos campos de `UserPreferenceResponse`, todos opcionais.

### Codigos

- 200: consulta ou atualizacao.
- 204: exclusao solicitada.
- 401: nao autenticado.
- 422: preferencia invalida.

## 9.3 AccountsModule

### Endpoints

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/accounts` | Lista contas |
| POST | `/api/v1/accounts` | Cria conta |
| GET | `/api/v1/accounts/{accountId}` | Detalha conta |
| PATCH | `/api/v1/accounts/{accountId}` | Atualiza conta |
| DELETE | `/api/v1/accounts/{accountId}` | Exclui logicamente conta |
| POST | `/api/v1/accounts/{accountId}/archive` | Arquiva conta |
| POST | `/api/v1/accounts/{accountId}/restore` | Restaura conta arquivada |
| GET | `/api/v1/accounts/{accountId}/balance-history` | Historico de saldo |

### Filtros

| Parametro | Tipo | Descricao |
|---|---|---|
| status | enum | `active`, `archived` |
| type | enum | `checking`, `digital`, `wallet`, `investment`, `card` |
| includeInDashboard | boolean | Filtra contas exibidas no dashboard |

### CreateAccountRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| name | string | Sim |
| type | enum | Sim |
| initialBalance | decimal string | Sim |
| currency | string | Nao |
| includeInDashboard | boolean | Nao |
| color | string | Nao |
| icon | string | Nao |

### UpdateAccountRequest DTO

Todos os campos de criacao sao opcionais, exceto `initialBalance`, que so pode ser alterado se regra de negocio permitir ajuste auditado.

### AccountResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| name | string |
| type | enum |
| currency | string |
| initialBalance | decimal string |
| currentBalance | decimal string |
| includeInDashboard | boolean |
| color | string nullable |
| icon | string nullable |
| status | enum |
| archivedAt | timestamp nullable |
| createdAt | timestamp |
| updatedAt | timestamp |

### BalanceHistoryResponse DTO

| Campo | Tipo |
|---|---|
| accountId | uuid |
| points | array of BalancePoint |

BalancePoint:

| Campo | Tipo |
|---|---|
| date | date |
| balance | decimal string |

### Codigos

- 200: consulta ou atualizacao.
- 201: conta criada.
- 204: exclusao logica.
- 404: conta inexistente.
- 409: conta arquivada ou estado conflitante.
- 422: valor monetario invalido.

## 9.4 CategoriesModule

### Endpoints

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/categories` | Lista categorias padrao e do usuario |
| POST | `/api/v1/categories` | Cria categoria customizada |
| GET | `/api/v1/categories/{categoryId}` | Detalha categoria |
| PATCH | `/api/v1/categories/{categoryId}` | Atualiza categoria customizada |
| DELETE | `/api/v1/categories/{categoryId}` | Exclui logicamente categoria customizada |

### Filtros

| Parametro | Tipo |
|---|---|
| type | `income`, `expense`, `both` |
| status | `active`, `archived` |
| isDefault | boolean |
| isEssential | boolean |
| parentId | uuid |

### CreateCategoryRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| name | string | Sim |
| type | enum | Sim |
| parentId | uuid | Nao |
| isEssential | boolean | Nao |
| color | string | Nao |
| icon | string | Nao |
| sortOrder | integer | Nao |

### CategoryResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| name | string |
| type | enum |
| parentId | uuid nullable |
| isDefault | boolean |
| isEssential | boolean |
| color | string nullable |
| icon | string nullable |
| sortOrder | integer |
| status | enum |
| createdAt | timestamp |
| updatedAt | timestamp |

### Codigos

- 200: consulta ou atualizacao.
- 201: categoria criada.
- 204: exclusao logica.
- 403: tentativa de alterar categoria global.
- 409: categoria duplicada.

## 9.5 TransactionsModule

### Endpoints

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/transactions` | Lista transacoes |
| POST | `/api/v1/transactions` | Cria receita, despesa ou ajuste |
| GET | `/api/v1/transactions/{transactionId}` | Detalha transacao |
| PATCH | `/api/v1/transactions/{transactionId}` | Atualiza transacao |
| DELETE | `/api/v1/transactions/{transactionId}` | Exclui logicamente transacao |

### Filtros

| Parametro | Tipo | Descricao |
|---|---|---|
| from | date | Inicio |
| to | date | Fim |
| type | enum | `income`, `expense`, `adjustment`, `transfer_in`, `transfer_out` |
| status | enum | `pending`, `confirmed`, `ignored` |
| accountId | uuid | Conta |
| categoryId | uuid | Categoria |
| source | enum | `manual`, `csv`, `ofx`, `recurring`, `system` |
| minAmount | decimal string | Valor minimo |
| maxAmount | decimal string | Valor maximo |
| search | string | Descricao ou merchant |

Ordenacao permitida:

- `transactionDate`
- `amount`
- `createdAt`
- `updatedAt`

### CreateTransactionRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| accountId | uuid | Sim |
| categoryId | uuid | Nao para ajustes, recomendado para receitas/despesas |
| type | enum | Sim: `income`, `expense`, `adjustment` |
| description | string | Sim |
| amount | decimal string | Sim |
| transactionDate | date | Sim |
| status | enum | Nao, default `confirmed` |
| merchantName | string | Nao |
| notes | string | Nao |
| externalReference | string | Nao |

### UpdateTransactionRequest DTO

Campos editaveis:

| Campo | Tipo |
|---|---|
| accountId | uuid |
| categoryId | uuid nullable |
| description | string |
| amount | decimal string |
| transactionDate | date |
| status | enum |
| merchantName | string nullable |
| notes | string nullable |

### TransactionResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| account | EntityReference |
| category | EntityReference nullable |
| type | enum |
| status | enum |
| description | string |
| amount | decimal string |
| currency | string |
| transactionDate | date |
| postedAt | timestamp nullable |
| source | enum |
| merchantName | string nullable |
| notes | string nullable |
| transferId | uuid nullable |
| recurringTransactionId | uuid nullable |
| importItemId | uuid nullable |
| createdAt | timestamp |
| updatedAt | timestamp |

### Codigos

- 200: consulta ou atualizacao.
- 201: transacao criada.
- 204: exclusao logica.
- 400: tipo de transacao nao permitido para endpoint.
- 404: conta, categoria ou transacao inexistente.
- 409: recurso em estado nao editavel.
- 422: valor, data ou categoria invalida.

## 9.6 TransfersModule

### Endpoints

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/transfers` | Lista transferencias |
| POST | `/api/v1/transfers` | Cria transferencia entre contas |
| GET | `/api/v1/transfers/{transferId}` | Detalha transferencia |
| PATCH | `/api/v1/transfers/{transferId}` | Atualiza transferencia |
| DELETE | `/api/v1/transfers/{transferId}` | Exclui logicamente transferencia |

### Filtros

| Parametro | Tipo |
|---|---|
| from | date |
| to | date |
| fromAccountId | uuid |
| toAccountId | uuid |
| status | enum |

### CreateTransferRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| fromAccountId | uuid | Sim |
| toAccountId | uuid | Sim |
| amount | decimal string | Sim |
| transferDate | date | Sim |
| description | string | Nao |

### TransferResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| fromAccount | EntityReference |
| toAccount | EntityReference |
| amount | decimal string |
| currency | string |
| transferDate | date |
| description | string nullable |
| status | enum |
| transactions | array of EntityReference |
| createdAt | timestamp |
| updatedAt | timestamp |

### Codigos

- 201: transferencia criada.
- 400: conta origem igual a destino.
- 404: conta ou transferencia inexistente.
- 409: transferencia em estado conflitante.
- 422: valor invalido.

## 9.7 BudgetsModule

### Endpoints

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/budgets` | Lista orcamentos |
| POST | `/api/v1/budgets` | Cria orcamento mensal |
| GET | `/api/v1/budgets/{budgetId}` | Detalha orcamento |
| PATCH | `/api/v1/budgets/{budgetId}` | Atualiza orcamento |
| DELETE | `/api/v1/budgets/{budgetId}` | Exclui logicamente orcamento |
| PUT | `/api/v1/budgets/{budgetId}/category-limits` | Substitui limites por categoria |
| GET | `/api/v1/budgets/{budgetId}/progress` | Retorna progresso do orcamento |

### Filtros

| Parametro | Tipo |
|---|---|
| month | date, primeiro dia do mes |
| status | enum |

### CreateBudgetRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| month | date | Sim |
| totalLimit | decimal string | Nao |
| currency | string | Nao |
| status | enum | Nao |
| categoryLimits | array | Nao |

CategoryLimitInput:

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| categoryId | uuid | Sim |
| limitAmount | decimal string | Sim |

### BudgetResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| month | date |
| totalLimit | decimal string nullable |
| currency | string |
| status | enum |
| categoryLimits | array of BudgetCategoryLimitResponse |
| createdAt | timestamp |
| updatedAt | timestamp |

BudgetCategoryLimitResponse:

| Campo | Tipo |
|---|---|
| id | uuid |
| category | EntityReference |
| limitAmount | decimal string |
| spentAmount | decimal string nullable |
| usagePercent | decimal string nullable |
| alert80SentAt | timestamp nullable |
| alert100SentAt | timestamp nullable |

### BudgetProgressResponse DTO

| Campo | Tipo |
|---|---|
| budgetId | uuid |
| month | date |
| totalLimit | decimal string nullable |
| totalSpent | decimal string |
| totalUsagePercent | decimal string nullable |
| categories | array of BudgetCategoryLimitResponse |

### Codigos

- 201: orcamento criado.
- 200: consulta ou atualizacao.
- 204: exclusao logica.
- 409: orcamento duplicado no mes.
- 422: categoria invalida ou limite negativo.

## 9.8 GoalsModule

### Endpoints

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/goals` | Lista metas |
| POST | `/api/v1/goals` | Cria meta |
| GET | `/api/v1/goals/{goalId}` | Detalha meta |
| PATCH | `/api/v1/goals/{goalId}` | Atualiza meta |
| DELETE | `/api/v1/goals/{goalId}` | Exclui logicamente meta |
| POST | `/api/v1/goals/{goalId}/complete` | Marca meta como concluida |
| GET | `/api/v1/goals/{goalId}/contributions` | Lista contribuicoes |
| POST | `/api/v1/goals/{goalId}/contributions` | Cria contribuicao |
| DELETE | `/api/v1/goals/{goalId}/contributions/{contributionId}` | Exclui contribuicao |

### Filtros

| Parametro | Tipo |
|---|---|
| type | enum |
| status | enum |
| priority | enum |

### CreateGoalRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| name | string | Sim |
| type | enum | Nao |
| targetAmount | decimal string | Sim |
| currentAmount | decimal string | Nao |
| targetDate | date | Nao |
| currency | string | Nao |
| priority | enum | Nao |

### GoalResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| name | string |
| type | enum |
| targetAmount | decimal string |
| currentAmount | decimal string |
| progressPercent | decimal string |
| targetDate | date nullable |
| currency | string |
| priority | enum |
| status | enum |
| completedAt | timestamp nullable |
| createdAt | timestamp |
| updatedAt | timestamp |

### CreateGoalContributionRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| type | enum | Sim: `contribution`, `withdrawal`, `adjustment` |
| amount | decimal string | Sim |
| contributionDate | date | Sim |
| transactionId | uuid | Nao |
| notes | string | Nao |

### GoalContributionResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| goalId | uuid |
| transactionId | uuid nullable |
| type | enum |
| amount | decimal string |
| contributionDate | date |
| notes | string nullable |
| createdAt | timestamp |
| updatedAt | timestamp |

### Codigos

- 201: meta ou contribuicao criada.
- 200: consulta ou atualizacao.
- 204: exclusao logica.
- 409: meta ja concluida ou arquivada.
- 422: valor alvo, contribuicao ou data invalida.

## 9.9 EmergencyFundModule

### Endpoints

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/emergency-fund` | Retorna plano da reserva |
| PUT | `/api/v1/emergency-fund` | Cria ou atualiza plano |
| POST | `/api/v1/emergency-fund/recalculate` | Recalcula despesa essencial |

### UpsertEmergencyFundRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| goalId | uuid | Nao, se a API puder criar meta especial automaticamente |
| desiredMonths | integer | Sim |
| essentialMonthlyExpense | decimal string | Nao |
| calculationMode | enum | Sim: `manual`, `auto_from_categories` |

### EmergencyFundResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| goal | GoalResponse |
| desiredMonths | integer |
| essentialMonthlyExpense | decimal string nullable |
| recommendedAmount | decimal string |
| currentAmount | decimal string |
| coverageMonths | decimal string |
| progressPercent | decimal string |
| calculationMode | enum |
| lastCalculatedAt | timestamp nullable |

### Codigos

- 200: consulta, atualizacao ou recalculo.
- 201: plano criado.
- 202: recalculo aceito assíncronamente.
- 422: meses desejados fora do limite.

## 9.10 RecurringTransactionsModule

### Endpoints

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/recurring-transactions` | Lista recorrencias |
| POST | `/api/v1/recurring-transactions` | Cria recorrencia |
| GET | `/api/v1/recurring-transactions/{recurringTransactionId}` | Detalha recorrencia |
| PATCH | `/api/v1/recurring-transactions/{recurringTransactionId}` | Atualiza recorrencia |
| DELETE | `/api/v1/recurring-transactions/{recurringTransactionId}` | Exclui logicamente recorrencia |
| POST | `/api/v1/recurring-transactions/{recurringTransactionId}/pause` | Pausa recorrencia |
| POST | `/api/v1/recurring-transactions/{recurringTransactionId}/resume` | Reativa recorrencia |

### Filtros

| Parametro | Tipo |
|---|---|
| type | enum |
| status | enum |
| isSubscription | boolean |
| accountId | uuid |
| categoryId | uuid |
| nextFrom | date |
| nextTo | date |

### CreateRecurringTransactionRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| accountId | uuid | Sim |
| categoryId | uuid | Nao |
| type | enum | Sim: `income`, `expense` |
| recurrenceKind | enum | Sim: `weekly`, `monthly`, `yearly` |
| name | string | Sim |
| description | string | Nao |
| amount | decimal string | Sim |
| currency | string | Nao |
| startDate | date | Sim |
| endDate | date | Nao |
| nextOccurrenceDate | date | Sim |
| isSubscription | boolean | Nao |
| providerName | string | Nao |

### RecurringTransactionResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| account | EntityReference |
| category | EntityReference nullable |
| type | enum |
| recurrenceKind | enum |
| name | string |
| description | string nullable |
| amount | decimal string |
| currency | string |
| startDate | date |
| endDate | date nullable |
| nextOccurrenceDate | date |
| lastGeneratedAt | timestamp nullable |
| isSubscription | boolean |
| providerName | string nullable |
| status | enum |
| createdAt | timestamp |
| updatedAt | timestamp |

### Codigos

- 201: recorrencia criada.
- 200: consulta ou atualizacao.
- 204: exclusao logica.
- 409: recorrencia pausada, encerrada ou excluida.

## 9.11 DashboardModule

### Endpoints

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/dashboard` | Retorna dashboard consolidado |
| POST | `/api/v1/dashboard/rebuild` | Solicita rebuild dos agregados do dashboard |

### Query Params

| Parametro | Tipo | Default |
|---|---|---|
| period | enum | `current_month` |
| from | date | Opcional |
| to | date | Opcional |

`period` permitido:

- `current_month`
- `last_30_days`
- `current_year`
- `custom`

Quando `period=custom`, `from` e `to` sao obrigatorios.

### DashboardResponse DTO

| Campo | Tipo |
|---|---|
| period | DateRange |
| currency | string |
| totals | DashboardTotals |
| score | FinancialScoreSummaryResponse nullable |
| goals | DashboardGoalsSummary |
| emergencyFund | EmergencyFundSummary nullable |
| categories | array of CategorySpendingSummary |
| subscriptions | DashboardSubscriptionsSummary |
| alerts | array of NotificationResponse |
| insights | array of FinancialInsightResponse |
| dataStatus | enum: `fresh`, `stale`, `rebuilding`, `partial` |
| generatedAt | timestamp |

DashboardTotals:

| Campo | Tipo |
|---|---|
| totalIncome | decimal string |
| totalExpense | decimal string |
| balance | decimal string |
| netCashflow | decimal string |
| transactionCount | integer |

### RebuildDashboardRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| from | date | Nao |
| to | date | Nao |
| force | boolean | Nao |

### Codigos

- 200: dashboard retornado.
- 202: rebuild aceito.
- 400: periodo customizado invalido.
- 401: nao autenticado.

## 9.12 FinancialScoreModule

### Endpoints

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/financial-score/latest` | Retorna ultimo score |
| GET | `/api/v1/financial-score/history` | Lista historico de score |
| GET | `/api/v1/financial-score/{scoreId}` | Detalha score |
| POST | `/api/v1/financial-score/recalculate` | Solicita recalculo |

### Filtros

| Parametro | Tipo |
|---|---|
| from | date |
| to | date |
| classification | enum |
| calculationVersion | string |

### FinancialScoreSummaryResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| periodStart | date |
| periodEnd | date |
| score | integer |
| classification | enum |
| calculatedAt | timestamp |

### FinancialScoreDetailResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| periodStart | date |
| periodEnd | date |
| score | integer |
| classification | enum |
| savingsRate | decimal string nullable |
| expenseRatio | decimal string nullable |
| emergencyFundMonths | decimal string nullable |
| budgetAdherenceRate | decimal string nullable |
| goalProgressRate | decimal string nullable |
| netWorthDelta | decimal string nullable |
| recommendations | array |
| calculationVersion | string |
| calculatedAt | timestamp |
| components | array of FinancialScoreComponentResponse |

FinancialScoreComponentResponse:

| Campo | Tipo |
|---|---|
| component | enum |
| rawValue | decimal string nullable |
| normalizedScore | integer |
| weight | decimal string |
| explanation | string nullable |

### RecalculateFinancialScoreRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| periodStart | date | Sim |
| periodEnd | date | Sim |
| force | boolean | Nao |

### Codigos

- 200: score retornado.
- 202: recalculo aceito.
- 404: score inexistente.
- 422: periodo invalido.

## 9.13 InsightsModule

### Endpoints

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/insights` | Lista insights |
| GET | `/api/v1/insights/{insightId}` | Detalha insight |
| PATCH | `/api/v1/insights/{insightId}` | Atualiza status do insight |
| POST | `/api/v1/insights/generate` | Solicita geracao de insights |
| GET | `/api/v1/insights/runs` | Lista execucoes de geracao |
| GET | `/api/v1/insights/runs/{runId}` | Detalha execucao |

### Filtros

| Parametro | Tipo |
|---|---|
| from | date |
| to | date |
| type | enum |
| source | enum |
| severity | enum |
| status | enum |

### FinancialInsightResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| type | enum |
| source | enum |
| periodStart | date |
| periodEnd | date |
| title | string |
| body | string |
| severity | enum |
| confidence | decimal string nullable |
| dataPoints | object nullable |
| actionLabel | string nullable |
| status | enum |
| generatedByRunId | uuid nullable |
| createdAt | timestamp |
| updatedAt | timestamp |

### UpdateInsightRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| status | enum: `seen`, `dismissed`, `archived` | Sim |

### GenerateInsightsRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| periodStart | date | Sim |
| periodEnd | date | Sim |
| trigger | enum | Nao |
| force | boolean | Nao |

### InsightGenerationRunResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| trigger | enum |
| periodStart | date |
| periodEnd | date |
| status | enum |
| modelProvider | string nullable |
| modelName | string nullable |
| promptVersion | string nullable |
| tokenInputCount | integer nullable |
| tokenOutputCount | integer nullable |
| errorCode | string nullable |
| errorMessage | string nullable |
| startedAt | timestamp nullable |
| finishedAt | timestamp nullable |
| createdAt | timestamp |

### Codigos

- 200: consulta ou status atualizado.
- 202: geracao aceita.
- 404: insight ou run inexistente.
- 409: run ja em execucao para mesmo periodo.
- 502/503: indisponibilidade do FastAPI quando a geracao for sincrona.

## 9.14 NotificationsModule

### Endpoints

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/notifications` | Lista notificacoes |
| GET | `/api/v1/notifications/{notificationId}` | Detalha notificacao |
| PATCH | `/api/v1/notifications/{notificationId}` | Atualiza status |
| POST | `/api/v1/notifications/mark-all-read` | Marca todas como lidas |

### Filtros

| Parametro | Tipo |
|---|---|
| type | enum |
| severity | enum |
| status | enum |
| channel | enum |
| from | date |
| to | date |

### NotificationResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| type | enum |
| severity | enum |
| title | string |
| message | string |
| relatedEntityType | string nullable |
| relatedEntityId | uuid nullable |
| channel | enum |
| status | enum |
| scheduledFor | timestamp nullable |
| sentAt | timestamp nullable |
| readAt | timestamp nullable |
| createdAt | timestamp |
| updatedAt | timestamp |

### UpdateNotificationRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| status | enum: `read`, `dismissed` | Sim |

### Codigos

- 200: consulta ou atualizacao.
- 204: todas marcadas como lidas, se sem corpo.
- 404: notificacao inexistente.

## 9.15 ImportsModule

### Endpoints

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/imports` | Lista lotes de importacao |
| POST | `/api/v1/imports` | Envia arquivo CSV/OFX |
| GET | `/api/v1/imports/{importBatchId}` | Detalha lote |
| GET | `/api/v1/imports/{importBatchId}/items` | Lista itens parseados |
| PATCH | `/api/v1/imports/{importBatchId}/items/{itemId}` | Atualiza item importado |
| POST | `/api/v1/imports/{importBatchId}/confirm` | Confirma importacao |
| POST | `/api/v1/imports/{importBatchId}/cancel` | Cancela importacao |

### Filtros de Lote

| Parametro | Tipo |
|---|---|
| sourceType | enum: `csv`, `ofx` |
| status | enum |
| accountId | uuid |
| from | date |
| to | date |

### UploadImportRequest DTO

Content-Type: `multipart/form-data`

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| accountId | uuid | Sim |
| sourceType | enum: `csv`, `ofx` | Sim |
| file | file | Sim |
| columnMapping | object | Apenas CSV quando necessario |

### ImportBatchResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| account | EntityReference |
| sourceType | enum |
| originalFileName | string |
| fileSizeBytes | integer |
| status | enum |
| totalRows | integer nullable |
| parsedRows | integer nullable |
| importedRows | integer nullable |
| duplicateRows | integer nullable |
| failedRows | integer nullable |
| parserVersion | string nullable |
| createdAt | timestamp |
| updatedAt | timestamp |
| completedAt | timestamp nullable |

### ImportItemResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| rowNumber | integer nullable |
| externalId | string nullable |
| rawDescription | string |
| normalizedDescription | string nullable |
| amount | decimal string |
| inferredType | enum |
| transactionDate | date |
| postedAt | timestamp nullable |
| suggestedCategory | EntityReference nullable |
| matchedTransactionId | uuid nullable |
| status | enum |
| errorMessage | string nullable |
| createdAt | timestamp |
| updatedAt | timestamp |

### UpdateImportItemRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| normalizedDescription | string | Nao |
| inferredType | enum | Nao |
| suggestedCategoryId | uuid | Nao |
| status | enum: `ready`, `ignored` | Nao |

### ConfirmImportRequest DTO

| Campo | Tipo | Obrigatorio |
|---|---|---:|
| importItemIds | array of uuid | Nao, default todos `ready` |
| ignoreDuplicates | boolean | Nao |

### Codigos

- 201: lote criado.
- 202: arquivo aceito para processamento.
- 200: consulta, item atualizado ou confirmacao concluida.
- 400: formato de arquivo invalido.
- 409: arquivo duplicado ou lote em estado invalido.
- 422: mapeamento CSV invalido.

## 9.16 AuditModule

### Endpoints

Endpoints de auditoria devem ser restritos. Para o MVP, a exposicao ao usuario final deve ser limitada ou omitida. Quando habilitado:

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/v1/audit-logs` | Lista eventos auditaveis do proprio usuario |
| GET | `/api/v1/audit-logs/{auditLogId}` | Detalha evento |

### Filtros

| Parametro | Tipo |
|---|---|
| eventType | enum |
| entityType | string |
| entityId | uuid |
| riskLevel | enum |
| from | date |
| to | date |

### AuditLogResponse DTO

| Campo | Tipo |
|---|---|
| id | uuid |
| eventType | enum |
| entityType | string nullable |
| entityId | uuid nullable |
| action | string |
| riskLevel | enum |
| metadata | object nullable |
| createdAt | timestamp |

Campos `before`, `after`, IP e user agent nao devem ser expostos ao usuario final no MVP, salvo tela de seguranca cuidadosamente desenhada.

### Codigos

- 200: consulta.
- 403: auditoria nao disponivel para perfil atual.
- 404: evento inexistente.

## 9.17 HealthModule

### Endpoints

| Metodo | Endpoint | Auth | Descricao |
|---|---|---:|---|
| GET | `/api/v1/health` | Nao | Status geral |
| GET | `/api/v1/health/liveness` | Nao | Processo vivo |
| GET | `/api/v1/health/readiness` | Nao | Dependencias prontas |

### HealthResponse DTO

| Campo | Tipo |
|---|---|
| status | enum: `ok`, `degraded`, `down` |
| timestamp | timestamp |
| services | object |

Services:

| Campo | Tipo |
|---|---|
| database | enum |
| redis | enum |
| aiService | enum |

### Codigos

- 200: ok.
- 503: dependencia critica indisponivel.

## 10. Contratos Internos com FastAPI

Os endpoints abaixo sao internos, nao publicos ao frontend. Devem usar autenticacao de servico, rede privada e correlation ID.

Base sugerida:

`POST /internal/v1/ai/insights/generate`

### GenerateAiInsightsRequest DTO

| Campo | Tipo | Descricao |
|---|---|---|
| runId | uuid | Execucao registrada no NestJS |
| userContext | object | Contexto minimizado, sem PII direta |
| period | DateRange | Periodo analisado |
| locale | string | Idioma |
| currency | string | Moeda |
| monthlySummary | object | Totais agregados |
| categorySummaries | array | Totais por categoria |
| budgetSummary | object nullable | Planejado versus realizado |
| goalSummaries | array | Metas agregadas |
| score | object nullable | Score e componentes |

### GenerateAiInsightsResponse DTO

| Campo | Tipo |
|---|---|
| insights | array of AiInsightCandidate |
| modelProvider | string |
| modelName | string |
| promptVersion | string |
| tokenInputCount | integer nullable |
| tokenOutputCount | integer nullable |

AiInsightCandidate:

| Campo | Tipo |
|---|---|
| type | enum |
| title | string |
| body | string |
| severity | enum |
| confidence | decimal string nullable |
| dataPoints | object nullable |
| actionLabel | string nullable |

## 11. Regras de Seguranca do Contrato

- Nunca retornar `passwordHash`, `refreshTokenHash` ou tokens em endpoints de listagem.
- Nunca aceitar `userId` em requests de recursos financeiros.
- Retornar 404 para recurso inexistente ou pertencente a outro usuario.
- Mascarar IP em sessoes e auditoria exposta ao usuario.
- Sanitizar descricoes importadas antes de retornar.
- Aplicar rate limiting em autenticacao, importacao e geracao manual de insights.
- Usar `Idempotency-Key` em criacao de transacoes, transferencias, importacoes e recorrencias.

## 12. Resumo dos Modulos Publicos

| Modulo | Base path | Protegido |
|---|---|---:|
| AuthModule | `/api/v1/auth` | Parcial |
| UsersModule | `/api/v1/users/me` | Sim |
| AccountsModule | `/api/v1/accounts` | Sim |
| CategoriesModule | `/api/v1/categories` | Sim |
| TransactionsModule | `/api/v1/transactions` | Sim |
| TransfersModule | `/api/v1/transfers` | Sim |
| BudgetsModule | `/api/v1/budgets` | Sim |
| GoalsModule | `/api/v1/goals` | Sim |
| EmergencyFundModule | `/api/v1/emergency-fund` | Sim |
| RecurringTransactionsModule | `/api/v1/recurring-transactions` | Sim |
| DashboardModule | `/api/v1/dashboard` | Sim |
| FinancialScoreModule | `/api/v1/financial-score` | Sim |
| InsightsModule | `/api/v1/insights` | Sim |
| NotificationsModule | `/api/v1/notifications` | Sim |
| ImportsModule | `/api/v1/imports` | Sim |
| AuditModule | `/api/v1/audit-logs` | Sim, restrito |
| HealthModule | `/api/v1/health` | Nao |

## 13. Criterios de Aceite do Contrato

- Todos os endpoints protegidos exigem JWT valido.
- Todas as respostas financeiras sao escopadas ao usuario autenticado.
- Listagens usam paginacao padrao.
- Filtros de data usam `from` e `to`.
- Valores monetarios usam string decimal.
- Criacao de recursos financeiros suporta idempotencia.
- Erros usam `ErrorResponse`.
- Operacoes assíncronas retornam 202 e identificador de acompanhamento quando aplicavel.
- O contrato nao expoe detalhes internos do Prisma, do banco ou do FastAPI.

