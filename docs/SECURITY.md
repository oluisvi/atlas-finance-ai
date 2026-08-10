# Segurança

## Autenticação

- JWT
- Refresh Token
- Argon2

## Backend

- Helmet
- Rate Limiting
- Validation Pipes

## Banco

- Prisma ORM

## Logs

- Auditoria de login
- Auditoria de alterações

## Futuro

- MFA
- Open Finance
# Hardening V1 (Fase 7)

O pipeline HTTP usa validação estrita (whitelist e propriedades desconhecidas rejeitadas), CORS por allowlist, Helmet, limites explícitos de body, `Cache-Control: private, no-store`, correlation ID e erros 500 sanitizados. Rate limiting in-memory protege toda a API e aplica limites menores a register/login/refresh; proteção distribuída depende de infraestrutura futura.

JWT valida assinatura, issuer, audience, expiração, tipo, sessão persistida e estado atual do usuário. Refresh tokens são armazenados somente como hash Argon2id, rotacionados e revogados em reuse/logout. Ownership é derivado do JWT e recursos de outro usuário retornam 404 nos domínios financeiros.

Uploads de importação validam extensão, base64, tamanho, row count, conteúdo OFX perigoso, ownership e duplicidade, sem persistir arquivo bruto. Exports são gerados em memória com allowlists, limites, nomes controlados, formula-injection defense, no-store e nosniff. Segredos obrigatórios são validados no startup e nunca devem aparecer em logs.

Operações financeiras críticas mantêm transações e concorrência/idempotência específicas do módulo. Auditoria é best-effort após o commit: falha de auditoria é logada sem expor metadata nem desfazer uma operação já confirmada. Limitações conhecidas: rate limit process-local, parser CSV V1 simples, load test apenas de sanidade e dois advisories moderados transitivos de ExcelJS sem caminho de uso vulnerável conhecido.
# OpenAPI exposure

Swagger UI and its JSON endpoint are enabled by default outside production and disabled by default in production through `SWAGGER_ENABLED`. The UI does not persist Bearer credentials, examples contain no secrets, and the generated schema is tested against internal hashes, fingerprints, connection settings, and secret names.
