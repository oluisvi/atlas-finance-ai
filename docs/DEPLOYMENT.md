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

## Monitoramento externo com UptimeRobot

Configure dois monitores HTTP(s), ambos com método `GET` e sem autenticação:

| Monitor | URL | Intervalo recomendado | Finalidade |
| --- | --- | --- | --- |
| Liveness | `https://atlas-finance-api-we3t.onrender.com/api/v1/health/liveness` | 5 minutos | Confirma que a aplicação está viva, monitora a API e reduz a ocorrência de cold start no Render Free. |
| Readiness | `https://atlas-finance-api-we3t.onrender.com/api/v1/health/readiness` | 15–30 minutos | Confirma que a API está pronta e consulta também o PostgreSQL no Supabase. |

A URL base da API é `https://atlas-finance-api-we3t.onrender.com`. O liveness deve ser leve e não depende do banco; o readiness verifica API + banco e, por isso, deve usar um intervalo maior. No free tier, a frequência mínima e os recursos disponíveis dependem do plano do UptimeRobot, e o Render Free ainda pode suspender ou reiniciar o serviço conforme os limites da plataforma. O monitoramento reduz cold starts, mas não garante disponibilidade contínua. Não adicione API keys, tokens ou credenciais do UptimeRobot ao repositório.

## Smoke público

Validar web, `/health`, `/health/liveness`, `/health/readiness`, register, login, `/auth/me`, refresh, dashboard, transações, imports, relatórios, insights, CORS e mobile/PWA. Não usar dados pessoais. O deploy não foi executado nesta fase porque o ambiente não possui sessão autenticada do Render.

## Diagnóstico

Falha de build web: confirme Node 22 e `NEXT_PUBLIC_API_URL` no build. Falha de startup API: confira `DATABASE_URL`, secrets, CORS e logs de validação. Readiness falha quando o PostgreSQL não está acessível. Alteração de variável pública exige rebuild do web.
