# Inventario Inicial de Limpeza da Raiz

Data: `2026-04-19`

## Objetivo

Registrar residuos visiveis da transicao para Next na raiz e separar o que ja pode sair do que ainda exige auditoria manual.

## Remocoes executadas nesta rodada

- residuos de logs locais da tentativa antiga em `web-next-dev.log`, `web-next-dev.stderr.log` e `web-next-dev.stdout.log`
- snapshots redundantes em `docs/legacy/workspace-backups`, que contradiziam a regra atual de manter o backup oficial somente no branch `master`
- referencias tecnicas a `docs/legacy/workspace-backups` nos scripts de validacao de encoding
- padroes antigos de `web-next-*` no `.gitignore`, ligados a uma fase que nao e mais a base operacional do branch

## Evidencias usadas para a decisao

- `docs/NEXT_PLATFORM_CONSOLIDATION.md` e `docs/README.md` ja declaravam que os snapshots em `docs/legacy/workspace-backups` tinham sido removidos da arvore ativa
- a raiz atual usa apenas `next dev`, `next start`, `next typegen` e `tsc`; nao existe mais aplicacao `web-next` ativa no branch
- os artefatos `web-next-dev*` eram logs locais de uma tentativa encerrada, sem valor operacional para a base atual

## Itens que seguem para auditoria posterior

- documentos antigos em `docs/` que podem conter runbooks superados, mas ainda precisam de classificacao antes de remover
- relatorios historicos em `docs/reports/` que ainda podem servir como evidencia de transicao
- possiveis residuos de nomenclatura de migracao em comentarios, scripts e documentacao secundaria

## Proximo passo recomendado

Executar uma auditoria documental por categoria:

1. documentos vivos de operacao atual
2. documentos historicos que ainda servem de referencia
3. documentos obsoletos que devem ser removidos ou reescritos

## Atualizacao desta trilha

Essa auditoria documental inicial foi executada na sequencia e registrada em `docs/reports/documentation-audit-latest.md`, com reorganizacao de dossies historicos para `docs/history/`.
