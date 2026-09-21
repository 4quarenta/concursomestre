# ConcursoMestre Web

Plataforma web principal do ConcursoMestre em Next.js App Router, consolidada diretamente na raiz do repositorio.

## Estado atual

- branch unica e padrao: `1.0.0`
- versao atual: `1.0.0`
- app web principal: `src/`
- app mobile Expo: `mobile/`
- historico da SPA anterior: preservado no historico Git consolidado em `1.0.0`
- runtime local atual: `npm run dev` na raiz

Em `2026-04-18`, a migracao foi reiniciada a partir do antigo branch `master` porque a tentativa anterior havia alterado a experiencia visual e funcional da plataforma logada. Esse historico foi consolidado em `1.0.0`; a regra atual e preservar a UI e os fluxos da plataforma web original, mudando apenas a base tecnica para Next.js.

## Arquitetura

- `src/app/`: rotas do App Router e paginas por dominio
- `src/components/`: componentes compartilhados e componentes restaurados da plataforma web
- `src/providers/`: providers globais reais da aplicacao
- `src/services/`: integracoes HTTP e servicos de dominio
- `src/constants/`, `src/config/`, `src/types/`, `src/utils/`: contratos transversais
- `src/assets/`: assets usados pela plataforma web

A aplicacao Next separada nao faz parte da arquitetura ativa. Ela foi removida desta base porque o Next agora e o proprio web da raiz.

## Rotas cobertas na raiz

- `/`
- `/auth`
- `/admin`
- `/admin/[tab]/[[...section]]`
- `/bank-analysis`
- `/dashboard`
- `/profile`
- `/profile/[tab]`
- `/planos`
- `/plans`
- `/elite`
- `/faq`
- `/changelog`
- `/privacy`
- `/terms`
- `/checkout`
- `/checkout/[planId]`
- `/checkout/termos-de-adesao`
- `/checkout/terms-of-adhesion`
- `/concursos`
- `/practice`
- `/simulation`
- `/flashcards`
- `/lei-comentada`
- `/marketplace`
- `/ranking`
- `/ranking/[id]/[[...slug]]`
- `/notifications`
- `/partner-dashboard`
- `/performance/subjects`
- `/performance-subjects`
- `/support`
- `/subscription/[status]`
- `/l/[slug]`
- `/question`
- `/question/[id]/[[...slug]]`
- `/material`
- `/material/[id]/[[...slug]]`
- `/promo`
- `/promo/[slug]`
- `/read/[id]`
- `/reader`
- `/ranking-detail`
- `/x-ray`

## Variaveis de ambiente

Use `.env.example` como base local.

- `NEXT_PUBLIC_API_BASE_URL`: endpoint base do backend PHP.
- `NEXT_PUBLIC_CANONICAL_URL`: URL canonica planejada para metadados. Em localhost, pode permanecer provisoria ate a compra do dominio.

## Comandos principais

```bash
npm install
npm run dev
npm run typecheck
npm run check:text-encoding
```

`npm run build` existe para CI/deploy, mas nao foi executado nesta retomada porque a rodada atual esta focada em `npm run dev`.

## Deploy

No Vercel, o projeto deve apontar para a raiz do repositorio:

- `Root Directory`: raiz
- `Install Command`: `npm ci`
- `Build Command`: `npm run build`
- framework: `Next.js`

## Documentacao operacional

- `docs/NEXT_PLATFORM_CONSOLIDATION.md`: estado da consolidacao e etapas atuais.
- `docs/NEXTJS_MIGRATION.md`: historico resumido da migracao e decisao de reinicio frio.
- `docs/LEGACY_WEB_INVENTORY.md`: inventario historico usado para comparar com o branch `master`.
- `docs/PLATFORM_1_0_0_AUDIT_PROGRAM.md`: programa de auditoria para producao.
- `docs/GOOGLE_SEARCH_CONSOLE.md`: preparacao futura para indexacao quando houver dominio.
- `docs/VERCEL_ROOT_TRANSITION.md`: orientacao de configuracao do projeto no Vercel.
