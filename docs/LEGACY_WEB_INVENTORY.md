# Inventario do Legado Web

## Data base

- referencia inicial: `2026-04-18`
- branch de consolidacao: `4quarenta/next-version`

## Objetivo

Registrar a decisao de remover a SPA Vite da arvore ativa deste branch depois que a arquitetura Next foi promovida para a raiz.

## Estado atual

- `src/` agora e a aplicacao Next principal
- `web-next/` foi removida depois da promocao
- `index.html`, `vite.config.ts` e `tsconfig.legacy.json` foram removidos da raiz
- o legado Vite permanece como backup historico no branch `master`
- relatorios antigos em `docs/reports/` continuam como evidencias da transicao, mas nao representam mais uma subpasta ativa

## Evidencias historicas

Durante a fase hibrida, os relatorios de inventario registraram:

- rotas com overlap entre SPA Vite e Next
- hotspots de typecheck da SPA antiga
- bridges ainda existentes no inicio da migracao
- entrada de `practice`, `simulation` e `admin` na fila de absorcao

Esses relatorios devem ser usados apenas para comparacao funcional. A partir da consolidacao na raiz, a auditoria deve olhar primeiro para a aplicacao Next ativa em `src/`.

## Entry points absorvidos pelo Next

- `admin/[[...slug]]`
- `auth`
- `checkout/[planId]`
- `concursos`
- `confirm-email`
- `dashboard`
- `flashcards`
- `lei-comentada`
- `marketplace`
- `notifications`
- `partner-dashboard`
- `performance/subjects`
- `practice`
- `profile/[[...slug]]`
- `ranking`
- `reset-password`
- `read/[id]`
- `simulation`
- `subscription/[status]`
- `support`
- `x-ray`

## Transicoes registradas em 2026-04-18

- `practice` foi absorvida como rota nativa do Next com listagem de questoes, filtros principais, resposta autenticada e salvos.
- `simulation` foi absorvida como rota nativa do Next com configuracao de simulado, cronometro, resultado, revisao e tentativa de persistencia da sessao.
- `admin/[[...slug]]` foi absorvido como shell administrativo nativo do Next com dashboard, usuarios, materiais, financeiro, suporte, marketing, configuracoes, SEO e logs.
- a SPA legada saiu da arvore ativa deste branch e deve ser consultada no branch `master` apenas quando for necessario comparar comportamento.

## Consequencia para a proxima etapa

A auditoria de limpeza deve ser feita sobre o Next ativo:

1. confirmar paridade funcional das rotas absorvidas
2. remover referencias operacionais a caminhos antigos
3. separar codigo vivo, codigo morto e codigo pendente de decisao
4. revisar seguranca, pagamentos, SEO, painel admin e analytics de receita antes da producao
