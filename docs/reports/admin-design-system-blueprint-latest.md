# Design System Administrativo

Data: `2026-04-19`

## Objetivo

Definir a linguagem visual do novo painel admin antes da reimplementacao das telas.

O admin novo deve parecer um produto administrativo completo, nao uma versao mobile, nem uma casca colorida do admin atual.

## Direcao visual

Produto SaaS administrativo, desktop-first, com alta legibilidade e densidade controlada.

Caracteristicas:

- layout claro, profissional e orientado a operacao
- contraste forte para leitura de tabelas e estados
- areas de decisao bem separadas de areas de configuracao
- sidebar por dominio e subnavegacao contextual
- acoes primarias sempre previsiveis
- metricas com contexto, variacao e periodo
- tabelas densas com filtros e acoes em lote
- paineis laterais para investigacao rapida
- estados vazios com proxima acao concreta

## Paleta inicial

A paleta evita depender do indigo/slate dominante do admin atual.

| Token | Uso | Valor |
| --- | --- | --- |
| canvas | fundo geral | `#f8faf9` |
| surface | superficies principais | `#ffffff` |
| surfaceMuted | areas secundarias | `#eef4ef` |
| ink | texto principal | `#16211d` |
| muted | texto secundario | `#5f6f68` |
| line | bordas | `#d8e2dc` |
| accent | acao principal | `#0f766e` |
| accentStrong | hover/estado ativo | `#115e59` |
| revenue | sucesso/receita | `#15803d` |
| warning | atencao | `#a16207` |
| danger | risco/erro | `#b42318` |
| info | suporte/informacao | `#2563eb` |

## Layout

- sidebar fixa em desktop com largura estavel
- topbar compacta para busca, command palette e usuario
- area de conteudo com largura fluida e grid responsivo
- cabecalho de pagina com titulo, contexto, periodo e acoes
- subnavegacao horizontal ou lateral conforme dominio
- detalhe rapido em side panel, nao em navegacao profunda desnecessaria

## Componentes base

Primitivos iniciais:

- `AdminMetricCard`
- `AdminStatusPill`
- `AdminActionButton`
- `AdminSectionHeader`
- `AdminDataPanel`
- `AdminQueueRow`
- `AdminEmptyState`
- `AdminFilterBar`
- `AdminShellFrame`

Regras visuais:

- radius maximo de 8px
- sem cards dentro de cards
- sem gradientes decorativos como base visual
- tabela e listas com altura estavel
- texto sem letter spacing negativo
- componentes com tamanho previsivel em estados vazios, loading e erro

## Padroes de decisao

Cada tela deve informar:

- o que mudou no periodo
- o que exige decisao
- qual risco existe
- qual acao esta disponivel
- qual evidencia sustenta a decisao

## Tokens de severidade

| Severidade | Uso |
| --- | --- |
| critical | queda de pagamento, webhook parado, erro de seguranca |
| high | fila acumulada, refund pendente, denuncia sensivel |
| medium | atraso operacional, configuracao incompleta |
| low | informacao ou recomendacao |
| healthy | estado normal ou validado |

## Proxima entrega

Criar os tokens e componentes iniciais dentro de `src/app/admin/_rebuild`, sem conectar a rota `/admin` ainda.
