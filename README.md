# atlas-finance-ai

Plataforma de gestao financeira pessoal com inteligencia artificial para analise financeira, planejamento e acompanhamento de metas.

## Backend NestJS

O backend principal fica em `apps/api` e usa NestJS, Prisma 7 e PostgreSQL remoto no Supabase.

Comandos principais:

```bash
npm install
npm run prisma:validate
npm run prisma:generate
npm run start:api
```

Endpoint de saude:

```text
GET /api/v1/health
```

Antes de iniciar a API, copie `.env.example` para `.env` e preencha `DATABASE_URL` com a connection string do Supabase Transaction Pooler. Use `DIRECT_URL` apenas para migrations e comandos administrativos.
