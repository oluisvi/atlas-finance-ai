# Supabase Setup — Atlas Finance AI

## Projeto remoto

| Campo | Valor |
|---|---|
| Project ref | `mzqipbkktbpdcasfvzny` |
| URL | `https://mzqipbkktbpdcasfvzny.supabase.co` |
| Auth | NestJS (não Supabase Auth) |
| Migrations | Prisma (`prisma/migrations/`) |

---

## 1. Bootstrap do `.env`

```bash
npm run setup:env
```

Isso cria `.env` a partir de `.env.example` e gera `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`.

Edite `.env` e preencha:

1. **DIRECT_URL** — Supabase Dashboard → Settings → Database → **Direct connection**
2. **DATABASE_URL** — mesma tela → **Transaction pooler** (porta 6543)

---

## 2. Supabase MCP (Cursor)

O arquivo `.mcp.json` na raiz aponta para:

```
https://mcp.supabase.com/mcp?project_ref=mzqipbkktbpdcasfvzny
```

Se as ferramentas MCP não aparecerem:

1. Recarregue a janela do Cursor
2. Complete o fluxo OAuth do Supabase MCP quando solicitado
3. Confirme que o projeto `mzqipbkktbpdcasfvzny` está selecionado

Ferramentas úteis após autenticar: `execute_sql`, `list_tables`, `get_advisors`.

---

## 3. Supabase CLI (opcional)

```bash
npx supabase login
npx supabase link --project-ref mzqipbkktbpdcasfvzny
npx supabase migration list --linked
```

---

## 4. Prisma migrations

```bash
# Aplicar migrations no remoto (usa DIRECT_URL)
npm run prisma:migrate:deploy

# Validar schema
npm run prisma:validate
npm run prisma:generate
```

---

## 5. Verificar catálogo Postgres

```bash
npm run db:verify-catalog
```

Gera `docs/supabase-catalog-snapshot.json` com tabelas, enums, índices, FKs, RLS e FKs sem índice.

---

## 6. RLS (futuro)

Políticas recomendadas (não aplicadas): `supabase/rls/recommended_policies.sql`

Relatórios:

- `docs/SUPABASE_MIGRATION_REPORT.md`
- `docs/DATABASE_REVIEW.md`
