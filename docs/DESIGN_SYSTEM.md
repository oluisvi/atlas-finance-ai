# Atlas Mineral — Design System

## Personalidade e princípios

Atlas Mineral transmite confiança, inteligência, calma e precisão. A interface segue cinco regras: informação antes de decoração; dados antes de chrome; tipografia antes de cards; hierarquia antes de widgets; função antes de movimento.

O sistema evita estética crypto, glassmorphism, gradientes genéricos, gauges, gamificação, sombras pesadas, raios excessivos, cards aninhados e cor sem função semântica.

## Paleta

| Papel | Token | Valor |
| --- | --- | --- |
| Fundo mineral | `--background` | `#f4f7f6` |
| Superfície | `--surface` | `#ffffff` |
| Superfície secundária | `--surface-secondary` | `#edf2f0` |
| Texto | `--text` | `#10231f` |
| Texto secundário | `--text-secondary` | `#3f5751` |
| Texto discreto | `--muted` | `#6e817c` |
| Borda | `--border` | `#d7e0dd` |
| Atlas | `--atlas` | `#087a5b` |
| Navegação | `--nav` | `#062d31` |
| Positivo | `--positive` | `#087a5b` |
| Oportunidade | `--opportunity` | `#6f7d28` |
| Atenção | `--warning` | `#a96408` |
| Crítico | `--critical` | `#b63838` |
| Informação | `--information` | `#315f8c` |

Cor nunca é o único indicador de status. Estados combinam texto, posição e marcador.

## Tipografia e números

Manrope é carregada com `next/font`, `display: swap` e variável CSS. A escala usa títulos de página responsivos, seções em 19 px, corpo em 13–16 px e captions em 11–12 px. Valores monetários usam numerais tabulares, tracking negativo controlado e nunca quebram a associação com a moeda ativa.

## Espaçamento, superfícies e raio

O ritmo principal usa múltiplos de 4 px, com espaços recorrentes de 8, 12, 16, 22, 28, 36 e 46 px. Raios: 6 px para controles, 10 px para painéis, 14 px para diálogos. Sombras são raras; borda, superfície e espaço definem a estrutura. Seções abertas e divisores substituem grids de cards quando a leitura é editorial.

## Componentes

- Tabelas: HTML semântico, caption, headers, hover discreto e valores numéricos alinhados.
- Formulários: labels persistentes, 44 px mínimos, mensagens próximas ao campo, foco visível.
- Navegação: sidebar agrupada no desktop; quatro destinos frequentes e “Mais” no mobile.
- Gráficos: no máximo três séries principais, legenda textual, tooltip monetário e tabela alternativa para leitor de tela.
- Estados: skeleton com movimento reduzido, erro calmo e acionável, vazio explicativo com próximo passo.
- Motion: 160 ms apenas para resposta de controle; `prefers-reduced-motion` desativa movimento não essencial.

## Responsivo e acessibilidade

Desktop mantém densidade e tabela. Abaixo de 900 px, drawer e bottom navigation substituem a sidebar. Abaixo de 700 px, tabelas financeiras tornam-se listas compactas, preservando descrição, tipo, data e valor. Há skip link, foco de três pixels, alvos mínimos de 40–44 px, landmarks, `aria-current`, status não dependente de cor e contraste direcionado a WCAG 2.2 AA.
