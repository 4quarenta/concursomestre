# Documentacao do Projeto

Esta pasta concentra a documentacao viva do ConcursoMestre.

## Estado da transicao web

A plataforma web Next foi consolidada diretamente na raiz do repositorio. A SPA anterior permanece apenas como backup historico no branch `master`, usado para comparacao de UI e funcionalidade quando necessario.

A tentativa anterior de manter uma aplicacao Next separada foi encerrada. Os scripts, workflows, templates e relatorios especificos daquela fase foram removidos da arvore ativa para evitar que a equipe siga um runbook antigo por engano.

Snapshots de codigo antigo que ficavam em `docs/legacy/workspace-backups` tambem foram removidos. O backup oficial para comparacao agora e o branch `master`.

## Documentacao operacional atual

- `NEXT_PLATFORM_CONSOLIDATION.md`
- `NEXTJS_MIGRATION.md`
- `PRODUCTION_READINESS_AUDIT_PLAN.md`
- `PLATFORM_1_0_0_AUDIT_PROGRAM.md`
- `LEGACY_WEB_INVENTORY.md`
- `VERCEL_ROOT_TRANSITION.md`
- `GOOGLE_SEARCH_CONSOLE.md`
- `ADMIN_PANEL_REBUILD_BLUEPRINT.md`
- `PRODUTO_E_MODULOS.md`
- `BILLING_E_VALIDACAO.md`
- `IMPLEMENTATION_LOG_2026_04_ADMIN_BILLING_LEI_QUESTOES.md`
- `STRIPE_CARD_VAULT_OPERATIONS.md`
- `STRIPE_TESTING_MATRIX_ADMIN.md`
- `ENCODING_E_TEXTO.md`
- `MOBILE_TRANSITIONS.md`

## Historico preservado

Documentos que guardam auditorias antigas, consolidacoes anteriores e contexto de rodadas fechadas agora ficam em `docs/history/`.

- `history/README.md`
- `history/consolidated/ARQUITETURA_CONSOLIDADA.md`
- `history/admin/`

## Checks locais atuais

```bash
npm run dev
npm run typecheck
npm run check:text-encoding
```

`npm run build` permanece como comando de CI/deploy, mas nao foi executado nesta retomada porque a rodada atual esta usando o servidor de desenvolvimento.

## Relatorios

`docs/reports/` deve conter apenas evidencias atuais ou inventarios historicos ainda uteis para comparacao. Relatorios da tentativa anterior separada foram removidos nesta limpeza.

Relatorio atual da paridade Next:

- `reports/next-root-parity-audit-latest.md`
- `reports/root-cleanup-inventory-latest.md`
- `reports/documentation-audit-latest.md`
- `reports/code-cleanup-audit-latest.md`

## Regra de integridade de texto

Toda alteracao textual deve respeitar UTF-8 e passar no check de mojibake.

```bash
npm run check:text-encoding
npm run fix:text-encoding
```
