# Auditoria de Documentacao

Data: `2026-04-19`

## Objetivo

Separar documentacao operacional atual de material historico preservado, reduzindo o ruido na raiz de `docs/` sem perder rastreabilidade.

## Resultado desta rodada

### Permanecem na raiz como documentacao operacional atual

- `README.md`
- `NEXT_PLATFORM_CONSOLIDATION.md`
- `NEXTJS_MIGRATION.md`
- `PRODUCTION_READINESS_AUDIT_PLAN.md`
- `PLATFORM_1_0_0_AUDIT_PROGRAM.md`
- `LEGACY_WEB_INVENTORY.md`
- `VERCEL_ROOT_TRANSITION.md`
- `GOOGLE_SEARCH_CONSOLE.md`
- `ADMIN_PANEL_REBUILD_BLUEPRINT.md`
- `BILLING_E_VALIDACAO.md`
- `STRIPE_CARD_VAULT_OPERATIONS.md`
- `STRIPE_TESTING_MATRIX_ADMIN.md`
- `ENCODING_E_TEXTO.md`
- `MOBILE_TRANSITIONS.md`
- `PRODUTO_E_MODULOS.md`
- `base-faq-plataforma.txt`

### Foram reclassificados como historico

Movidos para `docs/history/consolidated/`:

- `ARQUITETURA_CONSOLIDADA.md`

Movidos para `docs/history/admin/`:

- `ADMIN_CONSOLIDADO.md`
- `AUDITORIA_COMPLETA_ADMIN.md`
- `AUDITORIA_FINAL_ADMIN_SEO.md`
- `CORRECOES_ADMIN_APLICADAS.md`
- `CORRECOES_ADMIN_SEO_APLICADAS.md`
- `FUNCIONALIDADES_UTEIS_ADMIN.md`
- `SEO_ADMIN_IMPLEMENTADO.md`
- `VALIDACAO_FINAL_ADMIN.md`
- `VALIDACAO_FINAL_ADMIN_SEO.md`

## Criterio aplicado

Os arquivos movidos preservam valor de contexto, mas deixaram de ser documentacao operacional principal porque:

- descrevem rodadas fechadas de auditoria ou validacao
- consolidam historicos antigos do admin
- incluem referencias estruturais superadas para a base atual, como Vite ou entrypoints anteriores
- nao devem competir com a trilha canonica da migracao Next na raiz

## Evidencias objetivas usadas

- `ARQUITETURA_CONSOLIDADA.md` ainda cita `src/main.tsx` e `src/App.tsx` como entrypoint do frontend
- `ADMIN_CONSOLIDADO.md` ainda descreve o frontend como `React 19 + Vite + TypeScript`
- os dossies de `AUDITORIA_*`, `CORRECOES_*`, `VALIDACAO_*` e `SEO_ADMIN_IMPLEMENTADO.md` representam rodadas fechadas e servem melhor como historico consultivo

## Proximo passo recomendado

Executar a segunda rodada de auditoria documental para classificar:

1. quais documentos restantes na raiz ainda devem ser quebrados por dominio
2. quais relatórios de `docs/reports/` devem virar evidencia permanente
3. quais runbooks de billing, SEO e mobile merecem consolidacao adicional
