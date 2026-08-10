# Deploy no Render

O Atlas Finance AI é publicado no Render como dois Web Services Node a partir da raiz do monorepo. O PostgreSQL permanece no Supabase; não há banco, migration, Redis ou Supabase Auth no Render.

## Blueprint

O arquivo [`render.yaml`](../render.yaml) cria os serviços `atlas-finance-api` e `atlas-finance-web`, ambos na branch `main`, plano `free` e com deploy automático em cada commit (`autoDeployTrigger: commit`). O diretório raiz é usado nos dois casos: a API depende do `package.json`, lockfile e Prisma da raiz; o web mantém seu próprio lockfile em `apps/web`.

| Serviço | Build | Start | Health check |
| --- | --- | --- | --- |
| `atlas-finance-api` | `npm ci && npm run prisma:generate && npm run build:api` | `npm run start:api:prod` | `/api/v1/health/readiness` |
| `atlas-finance-web` | `npm --prefix apps/web ci && npm run build:web` | `npm run start:web:prod` | padrão do Render |

Os dois serviços usam Node 22.14.0. A API usa `PORT` quando o provedor a define (mantendo `API_PORT` para uso local) e escuta em `0.0.0.0`.

## Variáveis do Render

No serviço **API**, preencha estes secrets no dashboard do Render — eles não são versionados:

| Variável | Tipo | Observação |
| --- | --- | --- |
| `DATABASE_URL` | secret | URI do Supabase Transaction Pooler usada em runtime. |
| `JWT_ACCESS_SECRET` | secret | Mínimo de 32 caracteres. |
| `JWT_REFRESH_SECRET` | secret | Mínimo de 32 caracteres e diferente da access secret. |
| `CORS_ORIGIN` | configuração de ambiente | URL HTTPS exata do Web Service, sem barra final. |

O blueprint configura estes valores não secretos: `NODE_ENV=production`, `SWAGGER_ENABLED=false`, `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=30d`, `JWT_ISSUER=atlas-finance-ai` e `JWT_AUDIENCE=atlas-finance-ai`.

`DIRECT_URL` não é necessário no runtime, pois esta fase não executa migrations. `API_PORT`, `API_PREFIX`, `API_VERSION`, `DATABASE_POOL_MAX`, `RATE_LIMIT_DEFAULT`, `JSON_BODY_LIMIT` e `URLENCODED_BODY_LIMIT` possuem defaults validados no código.

No serviço **Web**, configure `NEXT_PUBLIC_API_URL` como `https://<url-real-da-api>/api/v1`. Como a variável entra no bundle no build, alterá-la exige novo deploy do web.

## Provisionamento

1. Faça commit e push de `render.yaml` para `main`.
2. No Render, abra **New → Blueprint**, conecte o GitHub e escolha `oluisvi/atlas-finance-ai`.
3. Crie os dois serviços detectados pelo Blueprint e informe `DATABASE_URL`, `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` na API.
4. Copie a URL pública da API e defina `NEXT_PUBLIC_API_URL` no Web como `<url-da-api>/api/v1`; faça deploy manual do web.
5. Copie a URL pública do web e configure `CORS_ORIGIN` na API com essa origem exata; faça deploy manual da API e, por segurança, mais um deploy do web.

Não use `*`, padrões `*.onrender.com` ou uma URL com `/api/v1` em `CORS_ORIGIN`. Swagger fica desabilitado em produção; health continua público.

## Verificação pós-deploy

```text
GET https://<api>/api/v1/health            -> 200
GET https://<api>/api/v1/health/liveness   -> 200
GET https://<api>/api/v1/health/readiness  -> 200
GET https://<api>/api/docs                 -> 404 (Swagger desabilitado)
GET https://<web>/                         -> 200
```

No web, faça register, login, `/auth/me`, refresh e logout; crie conta e transação e confira Dashboard, Financial Health, Insights e Report. Valide também em viewport mobile. Uma origem fora da allowlist deve falhar no CORS.

## OpenAPI e diagnóstico

`npm run api:generate` produz `apps/api/openapi.json` com os metadados Nest sem subir uma API ou conectar no Supabase e gera `apps/web/src/lib/api/schema.d.ts` a partir desse arquivo. Portanto o build no Render não depende de `localhost`.

No plano free os serviços podem dormir por inatividade e API e web podem acordar separadamente. A primeira chamada após idle pode demorar; não há keep-alive artificial. Consulte os logs de cada serviço no Render para falhas de build, environment ou readiness.
