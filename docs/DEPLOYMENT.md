# Preview no Render

O Atlas usa dois Web Services Node no Render e mantém o PostgreSQL no Supabase. O Next.js é dinâmico e não usa static export.

## Topologia e Blueprint

`GitHub → atlas-finance-web (Next.js) → atlas-finance-api (NestJS) → Supabase PostgreSQL`

O `render.yaml` na raiz cria os serviços na branch `main`, com auto deploy por commit e filtros de build para o monorepo. A raiz do repositório permanece acessível aos dois builds.

| Serviço | Build | Start | Health |
| --- | --- | --- | --- |
| API | `npm ci && npm run prisma:generate && npm run build:api` | `npm run start:api:prod` | `/api/v1/health/readiness` |
| Web | `npm --prefix apps/web ci && npm run build:web` | `npm run start:web:prod` | HTTP do Next.js |

A API lê `PORT` e escuta `0.0.0.0`. O web executa `next start -p $PORT`. Swagger fica desabilitado em produção.

## Campos obrigatórios no Render

API:

| Campo | Valor |
| --- | --- |
| `DATABASE_URL` | URI real do Supabase Transaction Pooler |
| `JWT_ACCESS_SECRET` | segredo aleatório com pelo menos 32 caracteres |
| `JWT_REFRESH_SECRET` | segredo diferente, com pelo menos 32 caracteres |
| `CORS_ORIGIN` | URL HTTPS exata do web, sem barra final |

Web:

| Campo | Valor |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://<api-real>.onrender.com/api/v1` |

Nunca coloque segredos no Blueprint. `NEXT_PUBLIC_` é público e não deve conter credenciais.

## Provisionamento humano restante

1. Entre no Render e escolha **New → Blueprint**.
2. Conecte o GitHub e selecione este repositório.
3. Confirme os dois serviços do `render.yaml`.
4. Preencha os três secrets da API.
5. Após a primeira URL da API, configure `NEXT_PUBLIC_API_URL` e redeploy do web.
6. Após a URL do web, configure `CORS_ORIGIN` e redeploy da API.

Não use wildcard no CORS. No plano free, serviços dormem após inatividade e o primeiro acesso pode sofrer cold start; não há ping artificial.

## Smoke público

Validar web, `/health`, `/health/liveness`, `/health/readiness`, register, login, `/auth/me`, refresh, dashboard, transações, imports, relatórios, insights, CORS e mobile/PWA. Não usar dados pessoais. O deploy não foi executado nesta fase porque o ambiente não possui sessão autenticada do Render.

## Diagnóstico

Falha de build web: confirme Node 22 e `NEXT_PUBLIC_API_URL` no build. Falha de startup API: confira `DATABASE_URL`, secrets, CORS e logs de validação. Readiness falha quando o PostgreSQL não está acessível. Alteração de variável pública exige rebuild do web.
