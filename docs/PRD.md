# Atlas Finance AI - MVP V1

## Objetivo

Atlas Finance AI é uma plataforma de gestão financeira pessoal com inteligência artificial focada em ajudar usuários a controlar gastos, criar metas financeiras e tomar melhores decisões financeiras através de análises inteligentes.

O MVP deve ser construído com arquitetura escalável e segura, preparada para futuras integrações com Open Finance.

Inicialmente todas as informações financeiras serão inseridas manualmente pelo usuário.

---

# Funcionalidades do MVP

## Autenticação

* Cadastro
* Login
* Logout
* Recuperação de senha
* Refresh Token
* JWT Authentication

---

## Contas Financeiras

O usuário pode cadastrar múltiplas contas.

Tipos:

* Conta Corrente
* Conta Digital
* Carteira
* Conta Investimento

Campos:

* Nome
* Tipo
* Saldo Inicial
* Saldo Atual

---

## Receitas

Campos:

* Descrição
* Valor
* Data
* Conta

Exemplos:

* Salário
* Freelance
* Comissão
* Dividendos

---

## Despesas

Campos:

* Descrição
* Valor
* Data
* Categoria
* Conta

---

## Transferências

Permitir movimentação entre contas sem gerar receita ou despesa.

Exemplo:

Nubank → Itaú

R$500

---

## Categorias

Categorias padrão:

* Alimentação
* Transporte
* Compras
* Moradia
* Saúde
* Educação
* Lazer
* Assinaturas
* Investimentos
* Outros

Usuário pode criar categorias próprias.

---

## Orçamento Mensal

Usuário define limites de gastos por categoria.

Exemplo:

Alimentação:
R$800

Lazer:
R$300

Assinaturas:
R$150

---

## Alertas Financeiros

Gerar alertas:

* Ao atingir 80% do orçamento
* Ao atingir 100% do orçamento
* Ao atingir metas financeiras

---

## Assinaturas

Cadastrar serviços recorrentes.

Exemplos:

* Netflix
* Spotify
* Prime Video
* Google One

Campos:

* Nome
* Valor
* Periodicidade
* Próxima cobrança

Exibir custo mensal e anual.

---

## Metas Financeiras

Exemplos:

* Reserva de emergência
* Viagem
* Notebook
* Carro

Campos:

* Nome
* Valor alvo
* Valor atual
* Data alvo

Exibir progresso.

---

## Reserva de Emergência

Meta específica baseada em meses de despesas.

Exemplo:

Meta:
6 meses de despesas essenciais

Despesas essenciais:
R$2.500

Reserva recomendada:
R$15.000

---

## Financial Health Score

Pontuação financeira entre 0 e 100.

Componentes:

* Taxa de poupança
* Cumprimento de orçamento
* Reserva de emergência
* Evolução patrimonial
* Cumprimento de metas

Exibir:

* Score
* Classificação
* Recomendações

Classificações:

0-39 Crítico

40-59 Atenção

60-79 Bom

80-100 Excelente

---

## Dashboard Principal

Widgets:

* Receita Total
* Despesa Total
* Saldo Atual
* Financial Health Score
* Progresso das Metas
* Reserva de Emergência
* Categorias de Gastos
* Assinaturas
* Alertas

---

## IA Financeira

Não será chatbot.

Será um motor de insights.

Exemplos:

"Você gastou 15% mais com alimentação este mês."

"Seu maior gasto foi delivery."

"Você pode economizar R$2.400 por ano reduzindo assinaturas."

"Mantendo este ritmo você alcançará sua meta em 14 meses."

---

## Importação de Extratos

Suporte para:

* CSV
* OFX

Objetivo:

Permitir importação manual antes da futura integração Open Finance.

---

# Segurança

Implementar:

* JWT
* Refresh Token
* Argon2
* Rate Limiting
* Helmet
* HTTPS
* Validação de entrada
* Auditoria de login
* Auditoria de alterações

---

# Stack

Frontend:

* Next.js
* TypeScript
* Tailwind
* Shadcn UI

Backend:

* NestJS
* Prisma
* PostgreSQL
* Redis

IA:

* Python
* FastAPI
* OpenAI

Infra:

* Docker

---

# Fora do MVP

Não implementar nesta fase:

* Open Finance
* Cartão de crédito
* Parcelamentos
* Empréstimos
* Mobile
* Desktop
* Multiusuário corporativo
* Open Banking
* Investimentos avançados
* Recomendações financeiras automatizadas
