# Diretrizes de UX do Atlas

## Hierarquia financeira

Cada tela responde primeiro à pergunta mais importante. O dashboard começa pelo patrimônio na moeda selecionada, depois mostra fluxo de caixa, leitura do período, prioridades e transações recentes. Saúde financeira explica score, qualidade, componentes e fatores. Insights funciona como briefing numerado, não central de notificações.

## Dinheiro e múltiplas moedas

- Nunca somar BRL, USD e EUR.
- Toda visão consolidada exige moeda ativa explícita.
- Valores vêm da API e são formatados no cliente; regras e cálculos financeiros permanecem no backend.
- Ausência de dados vira “Dados insuficientes”, nunca zero falso.

## Linguagem e confiança

A interface usa pt-BR natural e evita nomes técnicos. Preferir “com base nos registros atuais”, “seus dados indicam” e “o Atlas identificou”. Não usar promessas, ordens ou aconselhamento absoluto.

## Estados

- Vazio: explica por que não há dados e oferece um próximo passo real.
- Loading: skeleton preserva a geometria principal e expõe `aria-busy` quando aplicável.
- Erro: informa impacto, não culpa o usuário, oferece retry e mostra request ID apenas em detalhes técnicos.
- Sucesso: toast curto confirma a operação sem interromper o fluxo.
- Offline: nenhum dado financeiro é exibido; a página explica a proteção e oferece reconexão.

## Filtros, tabelas e formulários

Filtros têm estado ativo, ação de limpar e labels acessíveis. Desktop usa tabela semântica; mobile usa lista financeira compacta. Formulários preservam labels, autocomplete, mensagens associadas e ordem de foco lógica. Transferências comunicam origem, destino e valor sem decoração.

## Responsivo e acessibilidade

Validar em 1440×900, 1280×800, 768×900, 390×844 e 360×800. Não permitir overflow horizontal na página; tabelas podem rolar apenas no contêiner desktop. Teclado deve alcançar navegação, filtros, ações, diálogos e formulários. Charts têm resumo textual e tabela alternativa. Interações hover também funcionam com foco/click.
