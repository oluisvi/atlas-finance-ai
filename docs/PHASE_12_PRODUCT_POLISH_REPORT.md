# Fase 12 — Product Polish + Distinctive UX/UI

## Escopo executado

A Fase 12 evolui o Atlas Mineral sem alterar fórmulas, contratos OpenAPI, autenticação, precisão monetária, regras multi-moeda, Prisma, migrations ou RLS. A direção final combina interação familiar com identidade baseada em orientação, trilhos, camadas, hierarquia editorial e progressão.

## Auditoria inicial

O frontend já possuía shell responsivo, dashboard editorial, listas mobile, score explicável, insights, relatórios e importação guiada. As lacunas de maior impacto estavam concentradas no `ResourcePage`: formulários pediam UUIDs de conta/categoria, enums internos ainda apareciam em opções, exclusões usavam `window.confirm`, filtros eram genéricos, placeholders/helper texts eram escassos e estados vazios não ensinavam o conceito do domínio.

Pelas heurísticas de Nielsen, isso afetava correspondência com o mundo real, reconhecimento em vez de memorização, prevenção/recuperação de erros, visibilidade de status e ajuda contextual.

## Correções implementadas

- Entity selects carregam contas e categorias pelo cache do TanStack Query e exibem rótulos humanos; UUIDs permanecem apenas no payload.
- Contas são apresentadas como instituição/nome, tipo traduzido e moeda.
- Labels persistentes, exemplos e helper texts foram adicionados aos campos financeiros mais ambíguos.
- Money input continua preservando string decimal e usa a normalização existente, sem `float` como fonte de verdade.
- Transferências impedem origem igual ao destino antes do submit e explicam a restrição de moeda.
- Exclusão passou a usar `alertdialog` acessível, com impacto e estado `Removendo…`.
- Empty states explicam conta, linha financeira, transferência, orçamento, meta e recorrência e oferecem próximo passo real.
- Feedback de mutation preserva toast transitório; erros de campo permanecem junto ao formulário.
- Desktop mantém tabela semântica; abaixo de 700 px a apresentação vira lista financeira.

## Arquitetura de informação e componentes

O shell permanece organizado em Visão geral, Finanças, Planejamento, Inteligência e Dados. O Dashboard funciona como Financial Briefing; Transactions como ledger; Accounts como mapa de fontes patrimoniais; Budgets como limites; Goals como trajetória; Recurring como pressão futura; Financial Health como diagnóstico; Insights como briefing; Reports como mesa analítica; Imports como fluxo guiado.

Primitives compartilhadas: botões, campos, helper text, status, progress, tabela, lista mobile, empty/error states, `CreateDialog`, entity select contextual e `ConfirmDialog`. A abstração `ResourcePage` foi preservada, mas recebeu UX de domínio sem duplicar transporte ou cache.

## Visual, motion e responsividade

Atlas Mineral usa fundo mineral frio, superfícies brancas, navegação teal profunda, tipografia editorial e numerais tabulares. Bordas e espaço estruturam o conteúdo; sombras são raras. Motion fica em 120–220 ms e `prefers-reduced-motion` reduz transições e animações. Foram considerados desktop 1440, laptop, tablet e mobile; navegação muda para drawer/bottom bar e tabelas viram listas.

## Acessibilidade e segurança

Baseline WCAG 2.2 AA: landmarks, skip link, foco visível, labels, `aria-current`, mensagens `role=alert`, `dialog`/`alertdialog`, touch targets e estado não comunicado apenas por cor. Nenhum HTML inseguro, secret ou dado pessoal foi adicionado. Auth, JWT, refresh rotation, IDOR, CORS, rate limit e PWA sem cache financeiro autenticado permanecem inalterados.

## Performance

Nenhuma dependência foi adicionada. Recharts continua carregado dinamicamente apenas no dashboard. TanStack Query deduplica entity selects por chaves de cache. Não houve mudança de schema, migration ou bundle library. Métricas Lighthouse/CWV só devem ser registradas quando medidas em build de produção; nenhum número foi inventado.

## Referências e autoria

Foram usados dois conceitos visuais gerados especificamente para o Atlas (Financial Briefing e Ledger) como referência de composição. Origin/Cult/Skiper/React Bits/Aceternity não tiveram source copiado e nenhuma biblioteca visual externa foi instalada.

## Validação

O QA cobre autenticação renderizada, estados de erro, typecheck, testes, lint, builds, Prisma, OpenAPI e revisão Git. O resultado factual final e limitações ambientais são registrados no handoff da tarefa.

## Fase 12.1 — Release Validation

### Visual QA e referências

As treze rotas do produto foram verificadas no navegador real: Dashboard, Accounts, Transactions, Transfers, Budgets, Goals, Recurring, Financial Health, Insights, Reports, Imports, Settings, Login e Register. A revisão Nielsen encontrou e corrigiu três problemas concretos: uniformidade excessiva nas páginas de recurso, contrato incorreto do formulário de orçamento e overflow no viewport de 320 px.

Origin UI orientou labels, fields e controles compactos; Skiper UI, motion discreto; Cult UI, disclosure progressivo; React Bits, feedback sem animação contínua; Uiverse, estados pequenos de controles; Refero Styles (Mercury/Linear/editorial analytics), densidade e hierarquia; Aceternity, progressão do upload. Nenhum source externo foi copiado e nenhuma dependência foi adicionada.

`ResourcePage` continua responsável por query, mutations, filtros, dialogs, errors e empty states, mas delega apresentação a superfícies de domínio: Financial Ledger para transações, trajetória para metas, leitura planejado/gasto para orçamentos e compromissos futuros para recorrências. O formulário de orçamento agora envia `month` e `year` numéricos e apenas campos aceitos pela API.

### Responsividade, acessibilidade e performance

A matriz cobriu 1920×1080, 1440×900, 1280×800, 1024×768, 768×1024, 430×932, 390×844, 360×800 e 320×568. Em 320 px, a remoção do `min-width` rígido do `body` eliminou overflow horizontal sem esconder controles. Foco visível, landmarks, labels, headings, dialogs, mensagens de erro, navegação por teclado e `prefers-reduced-motion` foram preservados.

Recharts permanece em import dinâmico e restrito ao Dashboard. Não houve dependency creep. Os screenshots atuais usam exclusivamente o dataset artificial `qa.phase12.1@atlas.local` e estão em `docs/screenshots/`.

### Produção

Lighthouse foi executado contra `next start`, nunca `next dev`. Desktop/login: performance 100, acessibilidade 96, boas práticas 100, FCP 235 ms, LCP 652 ms, TBT 0 ms e CLS 0. Mobile/login (segunda execução): performance 95, acessibilidade 96, FCP 763 ms, LCP 2.636 ms, TBT 150 ms e CLS 0. O LCP mobile ficou 136 ms acima da meta de 2,5 s sob throttling; INP não foi medido por ausência de uma interação válida no Lighthouse e não foi inferido. A build autenticada foi validada visualmente, mas Lighthouse autenticado ficou fora do escopo técnico do runner sem persistir credenciais em artefatos.

O web público existente respondeu `200` em `https://atlas-finance-web.onrender.com`. No fechamento, health, liveness e readiness da API pública `https://atlas-finance-api.onrender.com` responderam `503`; por isso o QA autenticado de produção e a inspeção de logs do Render permanecem bloqueados até a API recuperar e o PR ser mesclado. O auto-deploy configurado acompanha commits em `main`, então nenhum deploy manual foi disparado a partir da branch.
