# Inventario do Legado Web

## Data base

- referencia inicial: `2026-04-18`
- branch consolidada atual: `1.0.0`

## Objetivo

Registrar a decisao historica de usar a SPA Vite do antigo branch `master` como fonte de verdade para a migracao Next na raiz, sem manter o app Vite ativo na arvore atual.

## Estado atual

- `src/` agora e a aplicacao Next principal
- a tentativa separada de Next nao faz mais parte da arquitetura ativa deste branch
- `index.html`, `vite.config.ts` e `tsconfig.legacy.json` foram removidos da raiz
- o legado Vite permanece preservado no historico Git consolidado em `1.0.0`
- relatorios antigos em `docs/reports/` continuam como evidencias da transicao, mas nao representam mais uma subpasta ativa
- a retomada de `2026-04-18` restaurou a UI e os fluxos do `master` diretamente dentro da estrutura Next

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

- a tentativa visual anterior foi descartada por nao preservar a experiencia web antiga.
- `practice`, `simulation`, `admin`, `marketplace`, `profile`, `checkout` e rotas publicas foram retomadas a partir dos arquivos do `master`.
- a SPA Vite saiu da arvore ativa deste branch e deve ser consultada no branch `master` para comparacao funcional e visual.
- o servidor dev Next na raiz respondeu `200` para as principais rotas restauradas.

## Consequencia para a proxima etapa

A auditoria de limpeza deve ser feita sobre o Next ativo:

1. confirmar paridade funcional das rotas absorvidas
2. remover referencias operacionais a caminhos antigos ou nomes de transicao que nao sejam mais uteis
3. separar codigo vivo, codigo morto e codigo pendente de decisao
4. revisar seguranca, pagamentos, SEO, painel admin e analytics de receita antes da producao
