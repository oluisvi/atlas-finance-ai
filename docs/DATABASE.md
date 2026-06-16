# Atlas Finance AI - Database Design

## 1. Objetivo

Este documento define a modelagem conceitual e lógica do banco de dados do Atlas Finance AI para o MVP, com preparação para evolução futura em Open Finance, mobile, desktop, investimentos avançados e dashboards mais sofisticados.

O documento não contém Prisma Schema, SQL ou código. A intenção é orientar arquitetura, engenharia backend, segurança, dados, produto e revisão técnica de uma fintech.

## 2. Premissas

- O banco transacional principal será PostgreSQL.
- O acesso ao banco será feito pela API backend, não diretamente pelo frontend ou pelo serviço de IA.
- Redis poderá ser usado para cache, rate limiting, filas leves e invalidação de dashboards, mas não será a fonte de verdade financeira.
- Todos os dados financeiros pertencem a um usuário.
- O MVP inicia com entrada manual de dados financeiros, mas a modelagem deve suportar importação CSV e OFX.
- Open Finance está fora do MVP, mas o modelo deve evitar decisões que dificultem essa evolução.
- Cartão de crédito, parcelamentos, empréstimos e investimentos avançados estão fora do MVP, mas alguns campos devem ser suficientemente extensíveis.
- Assinaturas aparecem no PRD do MVP e no Roadmap como V2. A modelagem recomenda manter suporte lógico desde o MVP, com ativação por feature flag ou entrega posterior.

## 3. Princípios de Modelagem

- Multi-tenant por usuário: toda entidade financeira deve conter `user_id`.
- Valores monetários devem usar tipo decimal com precisão fixa, nunca ponto flutuante.
- Datas financeiras devem ser separadas de timestamps técnicos.
- Exclusão lógica deve ser preferida para entidades financeiras e auditáveis.
- Eventos financeiros relevantes devem ser auditáveis.
- Dados derivados devem ser recalculáveis a partir dos dados transacionais.
- Agregações de dashboard devem ser materializadas ou pré-computadas quando o volume crescer.
- Dados enviados para IA devem ser minimizados e, sempre que possível, agregados ou anonimizados.

## 4. Convenções de Tipos de Dados

- `uuid`: identificador global.
- `string`: texto curto, com limite definido por campo.
- `text`: texto longo.
- `decimal(19,4)`: valor monetário ou quantitativo com precisão.
- `integer`: número inteiro.
- `boolean`: valor verdadeiro/falso.
- `date`: data civil sem horário.
- `timestamp`: data e hora com fuso.
- `jsonb`: estrutura flexível para metadados, diffs e payloads controlados.
- `enum`: conjunto fechado de valores de domínio.

## 5. Entidades do MVP

### 5.1 User

Representa a conta principal de acesso do usuário.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador do usuário |
| name | string(120) | Sim | Nome exibido no produto |
| email | string(254) | Sim | E-mail único para login |
| email_normalized | string(254) | Sim | E-mail normalizado para unicidade case-insensitive |
| password_hash | string(255) | Sim | Hash Argon2 da senha |
| status | enum | Sim | `active`, `pending_verification`, `locked`, `disabled`, `deleted` |
| email_verified_at | timestamp | Não | Data de verificação do e-mail |
| last_login_at | timestamp | Não | Último login bem-sucedido |
| failed_login_attempts | integer | Sim | Contador para proteção de conta |
| locked_until | timestamp | Não | Bloqueio temporário por segurança |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Última atualização |
| deleted_at | timestamp | Não | Exclusão lógica |

Regras:

- `email_normalized` deve ser único.
- `password_hash` nunca deve ser retornado em APIs.
- Exclusão de usuário deve acionar política de retenção, anonimização ou remoção conforme LGPD.

### 5.2 UserPreference

Preferências de apresentação e cálculo do usuário.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário proprietário |
| currency | string(3) | Sim | Moeda principal, inicialmente `BRL` |
| locale | string(10) | Sim | Exemplo: `pt-BR` |
| timezone | string(64) | Sim | Exemplo: `America/Sao_Paulo` |
| month_start_day | integer | Sim | Dia inicial do mês financeiro, padrão 1 |
| dashboard_period_default | enum | Sim | `current_month`, `last_30_days`, `current_year` |
| ai_insights_enabled | boolean | Sim | Permite geração de insights |
| email_notifications_enabled | boolean | Sim | Preferência de notificações por e-mail |
| in_app_notifications_enabled | boolean | Sim | Preferência de notificações no app |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |

Regras:

- Um usuário deve ter exatamente uma preferência ativa.
- `month_start_day` deve estar entre 1 e 28 para evitar inconsistência em meses curtos.

### 5.3 AuthSession

Representa uma sessão autenticada e controla refresh tokens.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador da sessão |
| user_id | uuid | Sim | Usuário autenticado |
| refresh_token_hash | string(255) | Sim | Hash do refresh token |
| device_id | string(120) | Não | Identificador lógico do dispositivo |
| user_agent | string(512) | Não | User agent resumido |
| ip_address | string(45) | Não | IPv4 ou IPv6 |
| status | enum | Sim | `active`, `revoked`, `expired`, `rotated` |
| expires_at | timestamp | Sim | Expiração do refresh token |
| revoked_at | timestamp | Não | Revogação |
| revoked_reason | string(120) | Não | Motivo da revogação |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |

Regras:

- Refresh tokens devem ser armazenados apenas como hash.
- Rotação de refresh token deve invalidar o token anterior.
- Reuso de refresh token rotacionado deve revogar a família da sessão.

### 5.4 PasswordResetToken

Controla recuperação de senha.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário |
| token_hash | string(255) | Sim | Hash do token |
| expires_at | timestamp | Sim | Expiração |
| used_at | timestamp | Não | Uso do token |
| requested_ip | string(45) | Não | IP de solicitação |
| created_at | timestamp | Sim | Criação |

Regras:

- Token deve ser de uso único.
- Novo pedido pode invalidar tokens anteriores não usados.
- Respostas públicas não devem revelar se o e-mail existe.

### 5.5 Account

Conta financeira cadastrada manualmente pelo usuário.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador da conta |
| user_id | uuid | Sim | Usuário proprietário |
| name | string(120) | Sim | Nome da conta |
| type | enum | Sim | `checking`, `digital`, `wallet`, `investment`, `card` |
| currency | string(3) | Sim | Moeda, inicialmente `BRL` |
| initial_balance | decimal(19,4) | Sim | Saldo inicial informado |
| current_balance | decimal(19,4) | Sim | Saldo atual derivado ou mantido por projeção |
| include_in_dashboard | boolean | Sim | Se entra no saldo total |
| color | string(20) | Não | Cor para UI |
| icon | string(60) | Não | Ícone lógico para UI |
| status | enum | Sim | `active`, `archived`, `deleted` |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |
| archived_at | timestamp | Não | Arquivamento |
| deleted_at | timestamp | Não | Exclusão lógica |

Regras:

- O usuário pode ter múltiplas contas.
- Não deve existir transação ativa apontando para conta fisicamente excluída.
- `current_balance` deve ser recalculável a partir de `initial_balance` e transações confirmadas.
- Conta arquivada não aceita novas transações manuais, salvo reativação.

### 5.6 Category

Categoria de classificação de receitas e despesas.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Não | Nulo para categoria global padrão |
| name | string(80) | Sim | Nome da categoria |
| type | enum | Sim | `income`, `expense`, `both` |
| parent_id | uuid | Não | Categoria pai |
| is_default | boolean | Sim | Categoria padrão do sistema |
| is_essential | boolean | Sim | Usada no cálculo da reserva de emergência |
| color | string(20) | Não | Cor para dashboards |
| icon | string(60) | Não | Ícone lógico |
| sort_order | integer | Sim | Ordenação |
| status | enum | Sim | `active`, `archived`, `deleted` |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |
| deleted_at | timestamp | Não | Exclusão lógica |

Regras:

- Categorias padrão não pertencem a um usuário específico.
- Categorias do usuário não podem duplicar nome e tipo dentro do mesmo usuário.
- Categoria usada em transações não deve ser removida fisicamente.
- Subcategorias devem herdar o usuário da categoria pai quando personalizadas.

Categorias padrão recomendadas:

- Alimentação
- Transporte
- Compras
- Moradia
- Saúde
- Educação
- Lazer
- Assinaturas
- Investimentos
- Outros

### 5.7 Transaction

Representa receitas, despesas e movimentações financeiras do usuário.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário proprietário |
| account_id | uuid | Sim | Conta impactada |
| category_id | uuid | Não | Categoria da transação |
| type | enum | Sim | `income`, `expense`, `transfer_in`, `transfer_out`, `adjustment` |
| status | enum | Sim | `pending`, `confirmed`, `ignored`, `deleted` |
| description | string(180) | Sim | Descrição exibida |
| amount | decimal(19,4) | Sim | Valor sempre positivo |
| transaction_date | date | Sim | Data financeira |
| posted_at | timestamp | Não | Data/hora de lançamento no sistema externo ou importação |
| source | enum | Sim | `manual`, `csv`, `ofx`, `recurring`, `system` |
| merchant_name | string(160) | Não | Nome do estabelecimento/favorecido |
| notes | text | Não | Observações do usuário |
| import_item_id | uuid | Não | Item de importação de origem |
| recurring_transaction_id | uuid | Não | Regra recorrente que gerou a transação |
| transfer_id | uuid | Não | Grupo de transferência |
| external_reference | string(180) | Não | Referência externa, quando houver |
| fingerprint | string(128) | Não | Hash para deduplicação |
| metadata | jsonb | Não | Metadados controlados |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |
| deleted_at | timestamp | Não | Exclusão lógica |

Regras:

- `amount` deve ser maior que zero.
- Receitas e despesas confirmadas afetam dashboards e score.
- Transferências devem gerar duas transações pareadas: `transfer_out` e `transfer_in`.
- Transferências não devem afetar receita, despesa ou taxa de poupança.
- Transações excluídas logicamente não entram em agregações.
- Transações importadas devem poder ser revisadas antes de confirmação.

### 5.8 Transfer

Agrupa duas transações que representam movimentação entre contas do mesmo usuário.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário proprietário |
| from_account_id | uuid | Sim | Conta de origem |
| to_account_id | uuid | Sim | Conta de destino |
| amount | decimal(19,4) | Sim | Valor transferido |
| transfer_date | date | Sim | Data financeira |
| description | string(180) | Não | Descrição |
| status | enum | Sim | `confirmed`, `deleted` |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |
| deleted_at | timestamp | Não | Exclusão lógica |

Regras:

- `from_account_id` e `to_account_id` devem ser diferentes.
- As duas contas devem pertencer ao mesmo usuário.
- Deve existir exatamente uma transação `transfer_out` e uma `transfer_in` para cada transferência confirmada.

### 5.9 MonthlyBudget

Define o orçamento de um mês financeiro.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário |
| month | date | Sim | Primeiro dia do mês orçamentário |
| total_limit | decimal(19,4) | Não | Limite total opcional |
| currency | string(3) | Sim | Moeda |
| status | enum | Sim | `draft`, `active`, `closed`, `deleted` |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |
| deleted_at | timestamp | Não | Exclusão lógica |

Regras:

- Deve existir no máximo um orçamento ativo por usuário e mês.
- O mês deve ser normalizado para o primeiro dia do período financeiro.

### 5.10 BudgetCategoryLimit

Limite mensal por categoria.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| budget_id | uuid | Sim | Orçamento mensal |
| user_id | uuid | Sim | Usuário |
| category_id | uuid | Sim | Categoria de despesa |
| limit_amount | decimal(19,4) | Sim | Limite definido |
| alert_80_sent_at | timestamp | Não | Controle de alerta de 80% |
| alert_100_sent_at | timestamp | Não | Controle de alerta de 100% |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |

Regras:

- `limit_amount` deve ser maior ou igual a zero.
- Uma categoria só pode aparecer uma vez por orçamento.
- Apenas categorias de despesa ou `both` devem ser aceitas.

### 5.11 Goal

Representa metas financeiras do usuário.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário |
| name | string(120) | Sim | Nome da meta |
| type | enum | Sim | `generic`, `emergency_fund`, `travel`, `vehicle`, `property`, `retirement`, `purchase` |
| target_amount | decimal(19,4) | Sim | Valor alvo |
| current_amount | decimal(19,4) | Sim | Valor atual informado ou derivado |
| target_date | date | Não | Data alvo |
| currency | string(3) | Sim | Moeda |
| priority | enum | Sim | `low`, `medium`, `high` |
| status | enum | Sim | `active`, `paused`, `completed`, `archived`, `deleted` |
| completed_at | timestamp | Não | Conclusão |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |
| deleted_at | timestamp | Não | Exclusão lógica |

Regras:

- `target_amount` deve ser maior que zero.
- `current_amount` não deve ser negativo.
- Progresso deve ser limitado a 100% para exibição, mas o valor real pode exceder a meta.
- Uma reserva de emergência pode ser modelada como `Goal` com tipo `emergency_fund` e detalhes em `EmergencyFundPlan`.

### 5.12 GoalContribution

Registra aportes, ajustes ou retiradas de uma meta.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário |
| goal_id | uuid | Sim | Meta |
| transaction_id | uuid | Não | Transação relacionada |
| type | enum | Sim | `contribution`, `withdrawal`, `adjustment` |
| amount | decimal(19,4) | Sim | Valor positivo |
| contribution_date | date | Sim | Data financeira |
| notes | text | Não | Observações |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |
| deleted_at | timestamp | Não | Exclusão lógica |

Regras:

- A soma líquida das contribuições pode alimentar `Goal.current_amount`.
- Retiradas não podem deixar a meta negativa, salvo ajuste administrativo explícito.

### 5.13 EmergencyFundPlan

Configuração específica da reserva de emergência.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário |
| goal_id | uuid | Sim | Meta associada |
| desired_months | integer | Sim | Quantidade desejada de meses, ex.: 6 |
| essential_monthly_expense | decimal(19,4) | Não | Despesa essencial mensal usada no cálculo |
| calculation_mode | enum | Sim | `manual`, `auto_from_categories` |
| last_calculated_at | timestamp | Não | Último cálculo |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |

Regras:

- `desired_months` deve estar entre 1 e 24.
- Quando automático, `essential_monthly_expense` deve ser calculado com base em categorias essenciais.
- Reserva recomendada = meses desejados x despesa essencial mensal.

### 5.14 RecurringTransaction

Regra para geração de transações recorrentes e assinaturas simples.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário |
| account_id | uuid | Sim | Conta padrão |
| category_id | uuid | Não | Categoria padrão |
| type | enum | Sim | `income`, `expense` |
| recurrence_kind | enum | Sim | `weekly`, `monthly`, `yearly` |
| name | string(120) | Sim | Nome da recorrência |
| description | string(180) | Não | Descrição da transação gerada |
| amount | decimal(19,4) | Sim | Valor esperado |
| currency | string(3) | Sim | Moeda |
| start_date | date | Sim | Início |
| end_date | date | Não | Fim |
| next_occurrence_date | date | Sim | Próxima ocorrência |
| last_generated_at | timestamp | Não | Última geração |
| is_subscription | boolean | Sim | Marca assinaturas |
| provider_name | string(120) | Não | Ex.: Netflix, Spotify |
| status | enum | Sim | `active`, `paused`, `ended`, `deleted` |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |
| deleted_at | timestamp | Não | Exclusão lógica |

Regras:

- `amount` deve ser maior que zero.
- Recorrências ativas devem gerar transações idempotentes.
- Assinaturas são recorrências de despesa com `is_subscription = true`.
- Se assinaturas forem adiadas para V2, esta entidade pode permanecer inativa no MVP.

### 5.15 Notification

Notificações e alertas financeiros.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário |
| type | enum | Sim | `budget_80`, `budget_100`, `goal_reached`, `recurring_due`, `score_changed`, `insight_available`, `security` |
| severity | enum | Sim | `info`, `warning`, `critical`, `success` |
| title | string(140) | Sim | Título |
| message | text | Sim | Mensagem |
| related_entity_type | string(80) | Não | Entidade relacionada |
| related_entity_id | uuid | Não | ID relacionado |
| channel | enum | Sim | `in_app`, `email`, `push` |
| status | enum | Sim | `pending`, `sent`, `read`, `dismissed`, `failed` |
| scheduled_for | timestamp | Não | Agendamento |
| sent_at | timestamp | Não | Envio |
| read_at | timestamp | Não | Leitura |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |

Regras:

- Alertas de orçamento devem evitar duplicidade por orçamento, categoria e threshold.
- Notificações de segurança não devem conter dados sensíveis.

### 5.16 FinancialScore

Snapshot do Financial Health Score em determinado período.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário |
| period_start | date | Sim | Início do período |
| period_end | date | Sim | Fim do período |
| score | integer | Sim | Pontuação entre 0 e 100 |
| classification | enum | Sim | `critical`, `attention`, `good`, `excellent` |
| savings_rate | decimal(9,4) | Não | Taxa de poupança |
| expense_ratio | decimal(9,4) | Não | Despesa sobre renda |
| emergency_fund_months | decimal(9,4) | Não | Meses cobertos |
| budget_adherence_rate | decimal(9,4) | Não | Aderência ao orçamento |
| goal_progress_rate | decimal(9,4) | Não | Progresso agregado de metas |
| net_worth_delta | decimal(19,4) | Não | Variação patrimonial no período |
| recommendations | jsonb | Não | Recomendações estruturadas |
| calculation_version | string(40) | Sim | Versão da fórmula |
| calculated_at | timestamp | Sim | Momento do cálculo |
| created_at | timestamp | Sim | Criação |

Regras:

- O score deve estar entre 0 e 100.
- Classificações: 0-39 crítico, 40-59 atenção, 60-79 bom, 80-100 excelente.
- Fórmula deve ser versionada para permitir auditoria e mudanças futuras.

### 5.17 FinancialScoreComponent

Detalhamento explicável do score.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| financial_score_id | uuid | Sim | Score pai |
| user_id | uuid | Sim | Usuário |
| component | enum | Sim | `savings_rate`, `budget_adherence`, `emergency_fund`, `goal_progress`, `net_worth_evolution` |
| raw_value | decimal(19,4) | Não | Valor original |
| normalized_score | integer | Sim | Nota do componente |
| weight | decimal(9,4) | Sim | Peso na fórmula |
| explanation | text | Não | Explicação para o usuário |
| created_at | timestamp | Sim | Criação |

Regras:

- Soma dos pesos por score deve fechar em 1.0 ou 100%, conforme padrão escolhido.
- Cada componente deve ser auditável e explicável.

### 5.18 FinancialInsight

Insight financeiro gerado por regras ou IA.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário |
| type | enum | Sim | `spending_increase`, `budget_risk`, `subscription_saving`, `goal_projection`, `cashflow_summary`, `score_recommendation` |
| source | enum | Sim | `rule_engine`, `ai_service`, `hybrid` |
| period_start | date | Sim | Início do período analisado |
| period_end | date | Sim | Fim do período analisado |
| title | string(160) | Sim | Título |
| body | text | Sim | Texto do insight |
| severity | enum | Sim | `info`, `opportunity`, `warning`, `critical` |
| confidence | decimal(5,4) | Não | Confiança de 0 a 1 |
| data_points | jsonb | Não | Dados agregados que sustentam o insight |
| action_label | string(80) | Não | Chamada para ação |
| status | enum | Sim | `new`, `seen`, `dismissed`, `archived` |
| generated_by_run_id | uuid | Não | Execução de geração |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |

Regras:

- Insight não deve conter dado bancário sensível desnecessário.
- Insights devem ser deduplicados por tipo, período e assinatura dos dados.
- Conteúdo gerado por IA deve ser armazenado com metadados suficientes para auditoria.

### 5.19 InsightGenerationRun

Registra execuções do motor de insights.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário |
| trigger | enum | Sim | `manual`, `scheduled`, `transaction_created`, `month_closed`, `score_updated` |
| period_start | date | Sim | Início analisado |
| period_end | date | Sim | Fim analisado |
| status | enum | Sim | `queued`, `running`, `completed`, `failed`, `cancelled` |
| input_summary | jsonb | Não | Dados agregados enviados ao motor |
| model_provider | string(80) | Não | Provedor usado, quando IA |
| model_name | string(120) | Não | Modelo usado, quando IA |
| prompt_version | string(40) | Não | Versão do prompt/template |
| token_input_count | integer | Não | Tokens de entrada |
| token_output_count | integer | Não | Tokens de saída |
| error_code | string(80) | Não | Código de erro |
| error_message | text | Não | Erro sanitizado |
| started_at | timestamp | Não | Início |
| finished_at | timestamp | Não | Fim |
| created_at | timestamp | Sim | Criação |

Regras:

- `input_summary` deve conter apenas dados necessários e preferencialmente agregados.
- Erros não devem gravar prompts completos com PII sem sanitização.

### 5.20 ImportBatch

Representa uma importação CSV ou OFX.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário |
| account_id | uuid | Sim | Conta destino |
| source_type | enum | Sim | `csv`, `ofx` |
| original_file_name | string(255) | Sim | Nome original do arquivo |
| file_hash | string(128) | Sim | Hash para deduplicação |
| file_size_bytes | integer | Sim | Tamanho |
| status | enum | Sim | `uploaded`, `parsed`, `review_required`, `imported`, `failed`, `cancelled` |
| total_rows | integer | Não | Total lido |
| parsed_rows | integer | Não | Linhas parseadas |
| imported_rows | integer | Não | Linhas importadas |
| duplicate_rows | integer | Não | Duplicadas detectadas |
| failed_rows | integer | Não | Falhas |
| parser_version | string(40) | Não | Versão do parser |
| metadata | jsonb | Não | Informações do arquivo |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |
| completed_at | timestamp | Não | Finalização |

Regras:

- O arquivo original pode ser descartado após parsing, conforme política de retenção.
- `file_hash` deve ajudar a alertar reimportações.
- Importação deve ser idempotente.

### 5.21 ImportItem

Linha ou lançamento extraído de arquivo CSV/OFX antes de virar transação confirmada.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| import_batch_id | uuid | Sim | Lote de importação |
| user_id | uuid | Sim | Usuário |
| account_id | uuid | Sim | Conta destino |
| row_number | integer | Não | Linha no arquivo |
| external_id | string(180) | Não | ID do OFX ou referência externa |
| raw_description | string(255) | Sim | Descrição original |
| normalized_description | string(255) | Não | Descrição normalizada |
| amount | decimal(19,4) | Sim | Valor com sinal original ou normalizado |
| inferred_type | enum | Sim | `income`, `expense`, `unknown` |
| transaction_date | date | Sim | Data financeira |
| posted_at | timestamp | Não | Data/hora de postagem |
| suggested_category_id | uuid | Não | Categoria sugerida |
| matched_transaction_id | uuid | Não | Transação existente compatível |
| status | enum | Sim | `pending_review`, `ready`, `imported`, `duplicate`, `ignored`, `failed` |
| fingerprint | string(128) | Sim | Hash de deduplicação |
| raw_payload | jsonb | Não | Dados brutos minimizados |
| error_message | text | Não | Erro sanitizado |
| created_at | timestamp | Sim | Criação |
| updated_at | timestamp | Sim | Atualização |

Regras:

- O usuário deve revisar itens ambíguos antes da criação de transações.
- Fingerprint deve considerar usuário, conta, data, valor e descrição normalizada.
- Itens duplicados não devem gerar transações por padrão.

### 5.22 AuditLog

Registro de eventos de segurança e alterações relevantes.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Não | Usuário afetado |
| actor_user_id | uuid | Não | Usuário que executou a ação |
| event_type | enum | Sim | `login_success`, `login_failed`, `logout`, `password_reset_requested`, `password_changed`, `entity_created`, `entity_updated`, `entity_deleted`, `import_completed`, `score_calculated`, `insight_generated`, `security_event` |
| entity_type | string(80) | Não | Entidade afetada |
| entity_id | uuid | Não | ID da entidade |
| action | string(80) | Sim | Ação executada |
| ip_address | string(45) | Não | IP |
| user_agent | string(512) | Não | User agent resumido |
| before | jsonb | Não | Estado anterior sanitizado |
| after | jsonb | Não | Estado posterior sanitizado |
| metadata | jsonb | Não | Metadados adicionais |
| risk_level | enum | Sim | `low`, `medium`, `high`, `critical` |
| created_at | timestamp | Sim | Criação |

Regras:

- Auditoria deve ser append-only.
- Dados sensíveis como senha, tokens e segredos nunca devem aparecer em `before`, `after` ou `metadata`.
- Alterações financeiras devem registrar pelo menos entidade, ação, ator e timestamp.

## 6. Entidades Derivadas e Agregadas

As entidades abaixo são recomendadas para performance e consistência de dashboard. Elas podem ser materializadas em tabelas, views materializadas ou cache persistente, conforme decisão de arquitetura.

### 6.1 AccountBalanceSnapshot

Snapshot diário ou mensal de saldo por conta.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário |
| account_id | uuid | Sim | Conta |
| snapshot_date | date | Sim | Data do snapshot |
| balance | decimal(19,4) | Sim | Saldo na data |
| created_at | timestamp | Sim | Criação |

Uso:

- Evolução patrimonial.
- Dashboard de saldo histórico.
- Cálculo de variação patrimonial no Financial Health Score.

### 6.2 MonthlyFinancialSummary

Resumo mensal por usuário.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário |
| month | date | Sim | Mês de referência |
| total_income | decimal(19,4) | Sim | Receitas confirmadas |
| total_expense | decimal(19,4) | Sim | Despesas confirmadas |
| net_cashflow | decimal(19,4) | Sim | Receita menos despesa |
| savings_rate | decimal(9,4) | Não | Fluxo líquido sobre receita |
| total_balance | decimal(19,4) | Sim | Saldo consolidado |
| transaction_count | integer | Sim | Quantidade de transações |
| calculated_at | timestamp | Sim | Momento do cálculo |

Uso:

- Cards de receita, despesa e saldo.
- Comparativos mês contra mês.
- Base para insights e score.

### 6.3 MonthlyCategorySummary

Resumo mensal por categoria.

Atributos:

| Campo | Tipo sugerido | Obrigatório | Descrição |
|---|---:|---:|---|
| id | uuid | Sim | Identificador |
| user_id | uuid | Sim | Usuário |
| category_id | uuid | Sim | Categoria |
| month | date | Sim | Mês |
| type | enum | Sim | `income`, `expense` |
| total_amount | decimal(19,4) | Sim | Soma no período |
| transaction_count | integer | Sim | Quantidade |
| calculated_at | timestamp | Sim | Momento do cálculo |

Uso:

- Gráficos de categorias.
- Alertas de orçamento.
- Insights de aumento de gasto.

## 7. Relacionamentos e Cardinalidade

| Origem | Cardinalidade | Destino | Observação |
|---|---:|---|---|
| User | 1:1 | UserPreference | Preferências do usuário |
| User | 1:N | AuthSession | Sessões autenticadas |
| User | 1:N | PasswordResetToken | Tokens de recuperação |
| User | 1:N | Account | Contas financeiras |
| User | 1:N | Category | Categorias personalizadas |
| Category | 1:N | Category | Hierarquia opcional |
| User | 1:N | Transaction | Transações |
| Account | 1:N | Transaction | Conta impactada |
| Category | 1:N | Transaction | Categoria opcional |
| User | 1:N | Transfer | Transferências |
| Transfer | 1:2 | Transaction | Saída e entrada pareadas |
| User | 1:N | MonthlyBudget | Orçamentos mensais |
| MonthlyBudget | 1:N | BudgetCategoryLimit | Limites por categoria |
| Category | 1:N | BudgetCategoryLimit | Categoria orçada |
| User | 1:N | Goal | Metas |
| Goal | 1:N | GoalContribution | Aportes e ajustes |
| Goal | 1:0..1 | EmergencyFundPlan | Reserva de emergência |
| User | 1:N | RecurringTransaction | Recorrências |
| RecurringTransaction | 1:N | Transaction | Transações geradas |
| User | 1:N | Notification | Alertas |
| User | 1:N | FinancialScore | Histórico de score |
| FinancialScore | 1:N | FinancialScoreComponent | Detalhamento |
| User | 1:N | FinancialInsight | Insights |
| InsightGenerationRun | 1:N | FinancialInsight | Insights gerados |
| User | 1:N | ImportBatch | Lotes importados |
| ImportBatch | 1:N | ImportItem | Itens parseados |
| ImportItem | 0..1:1 | Transaction | Transação criada |
| User | 1:N | AuditLog | Eventos auditados |

## 8. Regras de Negócio Transversais

### 8.1 Valores Monetários

- Valores monetários devem ser armazenados em decimal fixo.
- `amount` de transações deve ser positivo; o sentido financeiro vem do `type`.
- Moeda padrão é `BRL`, mas o modelo deve preservar campo de moeda para evolução.

### 8.2 Saldo de Contas

- Saldo atual pode ser armazenado para performance, mas deve ser recalculável.
- Transações `income` aumentam saldo.
- Transações `expense` reduzem saldo.
- `transfer_out` reduz saldo da origem.
- `transfer_in` aumenta saldo do destino.
- Transações `pending`, `ignored` e `deleted` não devem afetar saldo consolidado.

### 8.3 Orçamentos

- Orçamentos consideram apenas despesas confirmadas.
- Transferências não consomem orçamento.
- Alerta de 80% deve disparar uma vez por categoria e orçamento.
- Alerta de 100% deve disparar uma vez por categoria e orçamento, salvo regra futura de recorrência.

### 8.4 Metas

- Metas ativas entram no dashboard e no score.
- Metas concluídas preservam histórico.
- Reserva de emergência deve ser tratada como meta especial.
- Acompanhamento de meta pode ser manual ou vinculado a contribuições/transações.

### 8.5 Importação

- Itens importados devem passar por deduplicação.
- Itens ambíguos devem ficar em revisão.
- Importações devem ser reversíveis ou auditáveis.
- O usuário deve poder ignorar uma linha importada.

### 8.6 IA

- IA não deve ser chatbot genérico no MVP.
- Insights devem ser baseados em dados financeiros agregados.
- Recomendações devem ser explicáveis e não devem prometer retorno financeiro.
- Dados enviados a provedores externos devem ser minimizados.

## 9. Constraints Recomendadas

### 9.1 Unicidade

- `User.email_normalized` único.
- `UserPreference.user_id` único.
- `MonthlyBudget.user_id + month` único para orçamento ativo.
- `BudgetCategoryLimit.budget_id + category_id` único.
- `Category.user_id + type + name` único para categorias personalizadas ativas.
- `Transfer.id` deve agrupar exatamente duas transações pareadas.
- `ImportBatch.user_id + account_id + file_hash` deve evitar reimportação acidental.
- `ImportItem.import_batch_id + fingerprint` deve evitar duplicidade dentro do lote.
- `FinancialScore.user_id + period_start + period_end + calculation_version` deve evitar duplicidade de cálculo.

### 9.2 Integridade Referencial

- Toda entidade financeira deve referenciar `user_id`.
- `Transaction.account_id` deve pertencer ao mesmo `user_id` da transação.
- `Transaction.category_id`, quando preenchido, deve ser global ou pertencer ao mesmo usuário.
- `BudgetCategoryLimit.category_id` deve ser categoria de despesa ou `both`.
- `GoalContribution.goal_id` deve pertencer ao mesmo usuário.
- `EmergencyFundPlan.goal_id` deve apontar para meta do tipo `emergency_fund`.

### 9.3 Checks de Domínio

- Valores monetários de limites, metas, transações e recorrências devem ser maiores ou iguais a zero conforme contexto.
- `FinancialScore.score` entre 0 e 100.
- Percentuais normalizados entre 0 e 1 quando representarem razão.
- `month_start_day` entre 1 e 28.
- `desired_months` da reserva entre 1 e 24.
- Datas finais não podem ser anteriores a datas iniciais.

### 9.4 Exclusão Lógica

- Entidades financeiras devem usar `deleted_at`.
- Exclusão física deve ser restrita a dados temporários, tokens expirados e arquivos importados conforme retenção.
- Dados agregados podem ser recalculados após exclusão lógica.

## 10. Índices Recomendados

### 10.1 Autenticação e Segurança

- `User.email_normalized`.
- `AuthSession.user_id + status`.
- `AuthSession.refresh_token_hash`.
- `PasswordResetToken.token_hash`.
- `AuditLog.user_id + created_at`.
- `AuditLog.event_type + created_at`.

### 10.2 Transações

- `Transaction.user_id + transaction_date`.
- `Transaction.user_id + type + transaction_date`.
- `Transaction.user_id + account_id + transaction_date`.
- `Transaction.user_id + category_id + transaction_date`.
- `Transaction.user_id + status + transaction_date`.
- `Transaction.fingerprint`.
- `Transaction.import_item_id`.
- `Transaction.transfer_id`.

### 10.3 Dashboard

- `MonthlyFinancialSummary.user_id + month`.
- `MonthlyCategorySummary.user_id + month`.
- `MonthlyCategorySummary.user_id + category_id + month`.
- `AccountBalanceSnapshot.user_id + snapshot_date`.
- `AccountBalanceSnapshot.user_id + account_id + snapshot_date`.

### 10.4 Orçamento e Metas

- `MonthlyBudget.user_id + month + status`.
- `BudgetCategoryLimit.user_id + category_id`.
- `Goal.user_id + status`.
- `GoalContribution.user_id + goal_id + contribution_date`.

### 10.5 Importação

- `ImportBatch.user_id + created_at`.
- `ImportBatch.file_hash`.
- `ImportItem.import_batch_id + status`.
- `ImportItem.user_id + fingerprint`.
- `ImportItem.matched_transaction_id`.

### 10.6 IA e Score

- `FinancialScore.user_id + calculated_at`.
- `FinancialScore.user_id + period_start + period_end`.
- `FinancialInsight.user_id + status + created_at`.
- `FinancialInsight.user_id + type + period_start + period_end`.
- `InsightGenerationRun.user_id + status + created_at`.

## 11. Estratégias de Performance para Dashboards

### 11.1 Leituras Agregadas

Dashboards não devem depender, em escala, de somar todas as transações brutas em cada request. A recomendação é usar agregados por mês, categoria e conta.

Agregações recomendadas:

- Receita total por mês.
- Despesa total por mês.
- Saldo consolidado atual.
- Despesa por categoria.
- Progresso de orçamento por categoria.
- Evolução patrimonial mensal.
- Progresso de metas.
- Últimos insights e alertas.

### 11.2 Atualização de Agregados

Estratégias possíveis:

- Atualização síncrona para pequenos contadores críticos, como saldo da conta.
- Atualização assíncrona por job para resumos mensais e categoria.
- Reprocessamento incremental quando transação é criada, editada, confirmada ou excluída.
- Rebuild completo por usuário em caso de inconsistência detectada.

### 11.3 Cache

Redis pode armazenar:

- Resumo do dashboard principal por usuário e período.
- Último Financial Health Score.
- Progresso de orçamento do mês atual.
- Lista de categorias mais usadas.

Regras de invalidação:

- Criar/editar/excluir transação invalida dashboard, orçamento, saldo e score do período afetado.
- Alterar orçamento invalida progresso de orçamento.
- Alterar meta invalida dashboard e score.
- Alterar categoria invalida agregados visuais e relatórios por categoria.

### 11.4 Paginação e Filtros

- Listas de transações devem ser paginadas.
- Filtros por período, conta, categoria, tipo e status devem usar índices compostos.
- Busca textual em descrição e merchant pode evoluir para índice textual se necessário.

## 12. Estratégias para Cálculo do Financial Health Score

### 12.1 Periodicidade

- Calcular no fechamento mensal.
- Recalcular sob demanda quando houver alteração relevante no mês corrente.
- Guardar snapshots históricos para comparação.

### 12.2 Componentes Recomendados

| Componente | Peso inicial sugerido | Fonte |
|---|---:|---|
| Taxa de poupança | 25% | Receitas, despesas e transferências excluídas |
| Cumprimento de orçamento | 20% | BudgetCategoryLimit e despesas por categoria |
| Reserva de emergência | 25% | EmergencyFundPlan, metas e despesas essenciais |
| Progresso de metas | 15% | Goal e GoalContribution |
| Evolução patrimonial | 15% | AccountBalanceSnapshot e saldos |

Os pesos devem ser versionados em `calculation_version`.

### 12.3 Classificação

- 0 a 39: crítico.
- 40 a 59: atenção.
- 60 a 79: bom.
- 80 a 100: excelente.

### 12.4 Explicabilidade

Cada cálculo deve gerar componentes em `FinancialScoreComponent` com:

- Valor bruto.
- Valor normalizado.
- Peso aplicado.
- Explicação textual curta.

### 12.5 Cuidados

- Usuários sem dados suficientes devem receber estado de score incompleto, não nota enganosa.
- Meses sem renda devem ter tratamento específico para evitar divisão por zero.
- Transferências não devem inflar receita ou despesa.
- Ajustes manuais devem ser identificados para não distorcer indicadores.

## 13. Estratégias para Geração de Insights de IA

### 13.1 Pipeline Recomendado

1. Coletar dados agregados do usuário.
2. Aplicar regras determinísticas para detectar padrões.
3. Gerar payload minimizado para IA apenas quando necessário.
4. Criar insight estruturado.
5. Deduplicar por tipo, período e assinatura dos dados.
6. Persistir `InsightGenerationRun` e `FinancialInsight`.
7. Notificar usuário quando houver insight relevante.

### 13.2 Dados Permitidos para IA

Preferir:

- Totais por categoria.
- Variações percentuais.
- Metas e progresso agregado.
- Orçamento planejado versus realizado.
- Assinaturas por nome genérico ou categoria.

Evitar:

- E-mail.
- Nome completo.
- Descrições extremamente sensíveis.
- Dados brutos de extrato quando uma agregação resolver.
- Tokens, identificadores de sessão, IPs e metadados de segurança.

### 13.3 Tipos de Insight MVP

- Aumento anormal de gasto por categoria.
- Risco de ultrapassar orçamento.
- Economia potencial com assinaturas.
- Projeção de conclusão de meta.
- Resumo mensal de caixa.
- Recomendações relacionadas ao score.

### 13.4 Governança

- Versionar prompts e regras.
- Guardar modelo e provedor usados.
- Registrar custo estimado por execução.
- Permitir que usuário desative insights.
- Não gerar recomendação de investimento personalizada no MVP.

## 14. Estratégias para Auditoria

### 14.1 Eventos Auditáveis

- Login bem-sucedido e falho.
- Logout.
- Solicitação e conclusão de recuperação de senha.
- Criação, edição e exclusão lógica de contas.
- Criação, edição e exclusão lógica de transações.
- Criação, edição e exclusão lógica de orçamento.
- Criação, edição e conclusão de metas.
- Importação CSV/OFX.
- Cálculo de score.
- Geração de insight.
- Eventos de segurança.

### 14.2 Estrutura de Auditoria

- Auditoria deve ser append-only.
- Deve registrar ator, usuário afetado, entidade, ação, IP, user agent e timestamp.
- `before` e `after` devem ser sanitizados.
- Dados sensíveis devem ser mascarados ou omitidos.

### 14.3 Retenção

- Logs de segurança devem ter retenção compatível com política interna e LGPD.
- Logs de auditoria financeira devem ser preservados enquanto a conta estiver ativa, salvo solicitação legalmente válida de exclusão.
- Em exclusão de conta, avaliar anonimização versus remoção conforme base legal.

## 15. Estratégias para Importação CSV e OFX

### 15.1 CSV

CSV exige mapeamento flexível porque bancos e planilhas variam formato.

Campos mínimos esperados:

- Data.
- Descrição.
- Valor.

Campos opcionais:

- Tipo.
- Categoria.
- Saldo.
- Identificador externo.

Estratégias:

- Permitir mapeamento de colunas.
- Detectar separador, encoding e formato decimal.
- Normalizar valores negativos como despesa e positivos como receita quando tipo não vier explícito.
- Gerar prévia antes de confirmar.
- Persistir erros por linha em `ImportItem`.

### 15.2 OFX

OFX tende a trazer estrutura mais confiável.

Campos úteis:

- Data de lançamento.
- Valor.
- Descrição.
- ID da instituição.
- FITID ou identificador da transação.

Estratégias:

- Usar identificador externo para deduplicação quando presente.
- Normalizar descrições.
- Associar tudo à conta escolhida pelo usuário no upload.
- Não armazenar credenciais bancárias.
- Não tratar OFX como Open Finance.

### 15.3 Deduplicação

Fingerprint recomendado:

- `user_id`.
- `account_id`.
- `transaction_date`.
- `amount`.
- Descrição normalizada.
- Identificador externo, quando houver.

Regras:

- Duplicata exata deve ser marcada como `duplicate`.
- Duplicata provável deve ir para revisão.
- Usuário deve poder importar mesmo com alerta, se confirmar.

### 15.4 Segurança na Importação

- Validar tamanho máximo de arquivo.
- Validar extensão e conteúdo real.
- Não executar fórmulas de CSV.
- Sanitizar descrições.
- Remover ou expirar arquivo original após processamento.
- Auditar lote importado, quantidade de linhas e resultado.

## 16. Considerações de Escalabilidade

- Particionamento por data em `Transaction` pode ser avaliado quando houver volume alto.
- Sharding não é necessário para o MVP.
- Índices devem ser monitorados por uso real, não apenas criados antecipadamente.
- Jobs de agregação devem ser idempotentes.
- Reprocessamentos devem operar por usuário e período.
- Dashboards devem ter contratos de leitura estáveis para permitir cache.
- Entidades de auditoria podem crescer rapidamente e devem ter estratégia de retenção e arquivamento.

## 17. Considerações de Segurança e Privacidade

- Dados financeiros são sensíveis mesmo sem credenciais bancárias.
- Tokens e senhas devem ser armazenados apenas como hash.
- Logs técnicos não devem conter payloads financeiros completos.
- Metadados enviados para IA devem ser mínimos.
- O sistema deve suportar exportação e exclusão de dados do usuário.
- Acesso administrativo futuro deve ser segregado, auditado e minimizado.
- Backups devem ser criptografados e testados periodicamente.

## 18. Pontos de Atenção para Próximas Versões

- Open Finance exigirá consentimentos, instituições, contas externas, escopos, validade de consentimento e trilhas regulatórias.
- Cartão de crédito exigirá fatura, ciclo de fechamento, vencimento, limite, parcelas e pagamento de fatura.
- Investimentos exigirão posição, produto, classe de ativo, rentabilidade, preço, quantidade e impostos.
- Mobile e desktop podem demandar sincronização offline e resolução de conflitos.
- Multiusuário familiar exigirá compartilhamento de contas, permissões e papéis.

## 19. Resumo Executivo

A modelagem proposta cobre o MVP com autenticação, contas, categorias, transações, transferências, orçamento, metas, reserva de emergência, score financeiro, insights, notificações, auditoria e importação CSV/OFX.

O desenho prioriza segurança, auditabilidade, performance de dashboard e capacidade de evolução. O ponto arquitetural mais importante é separar dados transacionais de dados derivados: transações, contas, metas e orçamentos são a fonte de verdade; dashboards, score e insights são projeções recalculáveis e versionadas.
