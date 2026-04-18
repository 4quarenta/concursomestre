# Inventario do Legado Web

## Data base

- referencia inicial: `2026-04-18`
- branch de consolidacao: `4quarenta/next-version`

## Objetivo

Registrar o que ainda permanece ativo na SPA Vite da raiz depois que o Next passou a ser a base principal do web.

## Leitura estrutural

- arquivos sob `src/`: `294`
- arquivos sob `web-next/src/`: `94`

## Rotas da SPA antiga que tambem ja existem no Next

Essas areas precisam ser tratadas como duplicacao controlada durante a transicao:

- `admin`
- `auth`
- `changelog`
- `checkout`
- `concursos`
- `confirm-email`
- `dashboard`
- `elite`
- `faq`
- `flashcards`
- `lei-comentada`
- `marketplace`
- `material`
- `notifications`
- `partner-dashboard`
- `planos`
- `practice`
- `privacy`
- `profile`
- `promo`
- `question`
- `ranking`
- `reset-password`
- `simulation`
- `support`
- `terms`

## Areas que continuam apenas na SPA legada

Essas rotas ainda exigem decisao explicita antes de qualquer remocao estrutural:

- `bank-analysis`
- `landing`
- `landing-campaign`
- `performance-subjects`
- `plans`
- `questions`
- `ranking-detail`
- `reader`

## Dominios de service ainda ativos na raiz

Os agrupamentos atuais em `src/services/` mostram que a raiz continua concentrando fluxos autenticados, administrativos e comerciais:

- `admin`
- `auth`
- `billing`
- `comments`
- `dashboard`
- `filters`
- `marketing`
- `marketplace`
- `materials`
- `notifications`
- `payments`
- `plans`
- `profile`
- `progress`
- `questions`
- `rankings`
- `simulations`
- `statistics`
- `subscriptions`
- `support`
- `system`
- `transactions`

## Leitura operacional

Hoje o estado correto da plataforma e o seguinte:

- o Next ja e a base operacional principal do web na raiz
- a SPA Vite ainda nao pode ser removida
- a raiz antiga continua sendo a dona de partes autenticadas, administrativas e de contratos de dominio

## Consequencia para a proxima etapa

Antes da limpeza pesada de diretorios, precisamos fechar este inventario em tres grupos:

1. rotas ja absorvidas pelo Next e prontas para desativacao futura
2. modulos que continuarao temporariamente como legado controlado
3. codigo morto, duplicado ou sem ownership claro, que sera alvo da auditoria de limpeza
