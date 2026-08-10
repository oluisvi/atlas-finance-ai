# Backend Hardening Report — Fase 7

## Resultado

O backend V1 foi endurecido para integração com frontend. A fase revisou bootstrap, módulos, autenticação, ownership, DTOs, dinheiro/Decimal, imports, exports, relatórios, observabilidade mínima, PostgreSQL, dependências e runtime autenticado. Nenhum schema, migration, RLS ou regra financeira foi alterado.

## Segurança e pipeline HTTP

- `ValidationPipe` permanece com whitelist e rejeição de propriedades desconhecidas; coerção implícita global foi removida e conversões de query são explícitas.
- CORS usa allowlist de `CORS_ORIGIN`; sem allowlist, nenhuma origem browser é liberada, e produção falha no startup.
- Helmet fornece `nosniff`, frame protection e referrer policy; HSTS é ativado apenas em produção. CSP e CORP foram evitados na API para não interferir em downloads.
- JSON e URL-encoded têm limites configuráveis (`256kb` e `64kb`). Imports mantêm limite próprio de 10 MiB e 10.000 linhas.
- Rate limiting process-local: 120 requisições/minuto por padrão; login/register 5/minuto; refresh 20/minuto. O smoke confirmou 429.
- Toda resposta recebe `X-Request-Id` validado/gerado e `Cache-Control: private, no-store`. Logs estruturados incluem request ID, método, path, status e duração, sem body ou token.
- Erros desconhecidos são 500 genérico; erros conhecidos do parser viram 400/413. O smoke corrigiu um 413 anteriormente transformado em 500.

## Auth, sessões e autorização

JWT mantém assinatura separada para access/refresh, issuer, audience, TTL e claim de tipo. Senhas e refresh tokens usam Argon2id; somente hash do refresh é persistido. Rotation, reuse detection, expiração, revogação e logout idempotente foram preservados. A validação de access token agora consulta sessão e usuário e rejeita usuário desativado ou soft-deleted.

Todas as operações financeiras revisadas derivam o usuário do JWT e usam ownership nas queries; DTOs não autorizam por `userId`. O smoke com dois usuários confirmou 404 para acesso cruzado. Campos internos, hashes, fingerprints e dados de auditoria não são apresentados nas respostas públicas revisadas.

## Domínio, Decimal e concorrência

Valores monetários continuam como strings validadas por expressão decimal e `Prisma.Decimal`; notação científica, escala acima de quatro casas e overflow de `DECIMAL(19,4)` são rejeitados nos inputs financeiros. Ocorrências de `Number`, `Math.ceil` e transformações numéricas revisadas pertencem a paginação, anos, percentuais ou contadores, não a cálculo monetário.

Transfers, transactions, goals, recurring, imports e insights preservam suas transações, ownership, idempotência e retries existentes. Moedas permanecem separadas e transferências neutras. A auditoria é best-effort após a operação principal; falha de audit é logada sem reverter commit financeiro.

## Imports, exports e endpoints pesados

Imports validam nome/extensão, base64, tamanho, linhas, valores, conta pertencente ao usuário, DTD/entities OFX, hash e duplicidade P2002; não persistem arquivo bruto. A paginação foi normalizada defensivamente após o smoke detectar string chegando ao Prisma. A limitação conhecida do parser CSV simples (sem quoted-field completo) permanece documentada.

Exports usam allowlists de tipo/formato, limites de linhas, renderização em memória, neutralização de fórmula pelos renderers, nomes controlados, content type/disposition, nosniff e no-store. `reportType` inválido, que antes gerava 500, agora retorna 400. Imports, exports e geração de insights também ficam sob limites globais; limites dedicados mais restritivos são centralizados para auth e export.

## Banco e queries

O pool PostgreSQL continua limitado por `DATABASE_POOL_MAX` (1–50), com timeout de conexão de 5s, idle timeout de 30s e fechamento no lifecycle do Nest. Readiness executa `SELECT 1`; liveness não depende do banco. Queries revisadas usam selects delimitados e ordenação estável; agregações evitam N+1 óbvio nos caminhos críticos.

Índices recomendados para uma migration futura, sujeitos a `EXPLAIN (ANALYZE, BUFFERS)` em dados representativos: parciais por `(user_id, transaction_date, id) WHERE deleted_at IS NULL`, `(user_id, status, created_at, id)` para imports/insights e `(user_id, next_occurrence_date, id) WHERE deleted_at IS NULL` para recorrências. Nenhum índice/schema foi alterado nesta fase.

## Dependências e qualidade

Helmet e `@nestjs/throttler` foram adicionados. `npm audit fix` removeu o finding high e reduziu 8 findings para 2 moderados transitivos no `uuid` interno do ExcelJS. O npm só oferece downgrade major do ExcelJS; não foi aplicado porque a aplicação não chama UUID v3/v5/v6 com buffer e o downgrade aumenta risco de regressão. Prisma tooling findings foram corrigidos transitivamente.

TODO/FIXME, casts, suppressions, dependências e providers foram revisados; não houve remoção segura adicional. O start local agora usa o build TypeScript antes do Node, garantindo decorator metadata idêntico ao runtime de produção.

## Testes e smoke

A suíte horizontal cobre unknown fields, CORS allow/deny, headers, no-store, request ID, sanitização de 500, payload 413 e rate limit 429. Auth cobre token de usuário desativado/deletado. Total final: 35 suítes e 275 testes.

O smoke autenticado real usou dois usuários técnicos e dados artificiais e validou health/liveness/readiness, register/login/logout, contas, categoria, income/expense, transferência, budget, goal, recurring, dashboard, financial health, import, report, export, insights, IDOR 404, payload desconhecido 400, rate limit 429, request ID, headers e no-store. Recursos reversíveis foram removidos/soft-deleted e sessões revogadas; nenhum token, senha, URL de banco, conteúdo importado ou payload financeiro foi gravado neste relatório.

## Limitações e itens futuros

- Rate limiting é por processo; Redis/distribuição fica para infraestrutura futura.
- Load test real, observabilidade centralizada, deploy e tuning de pool/índices exigem ambiente dedicado.
- OpenAPI/Swagger, documentação formal de response schemas e exemplos ficam para a próxima fase.
- Frontend, IA, scheduler e notificações não fazem parte desta fase.
- ExcelJS mantém dois advisories moderados transitivos contextualmente não alcançados.
