# ConcursoMestre Web

Plataforma web principal do ConcursoMestre em Next.js App Router.

Em `2026-04-18`, a arquitetura Next foi promovida para a raiz do repositorio. A antiga SPA Vite nao faz mais parte da arvore ativa deste branch; o backup historico permanece no branch `master` do GitHub e nos registros de transicao em `docs/`.

## Estado atual

- branch de consolidacao: `4quarenta/next-version`
- versao alvo: `1.0.0`
- app web principal: `src/`
- app mobile Expo: `mobile/`
- configs Next: `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`
- a pasta `web-next/` foi removida depois da promocao para raiz
- os aliases `web-next:*` continuam existindo apenas para preservar runbooks, checks e historico de relatorios

## Rotas web cobertas

- `/`
- `/auth`
- `/admin/[[...slug]]`
- `/dashboard`
- `/profile/[[...slug]]`
- `/planos`
- `/elite`
- `/faq`
- `/changelog`
- `/privacy`
- `/terms`
- `/checkout/[planId]`
- `/checkout/termos-de-adesao`
- `/concursos`
- `/practice`
- `/simulation`
- `/flashcards`
- `/lei-comentada`
- `/marketplace`
- `/ranking`
- `/notifications`
- `/partner-dashboard`
- `/performance/subjects`
- `/support`
- `/subscription/[status]`
- `/l/[slug]`
- `/question/[id]/[slug]`
- `/ranking/[id]/[slug]`
- `/material/[id]/[slug]`
- `/promo/[slug]`
- `/read/[id]`
- `/x-ray`
- `/robots.txt`
- `/sitemap.xml`
- `/question-sitemap.xml`
- `/question-sitemap-page.xml?page=N`

## Variaveis de ambiente

Use `.env.example` como base local.

Para staging, existe tambem `.env.staging.example`.
Para desenvolvimento local, existe `.env.local.example`.

- `NEXT_PUBLIC_API_URL`
  - endpoint base do backend PHP usado pelos dados publicos e autenticados
- `NEXT_PUBLIC_CANONICAL_URL`
  - dominio canonico usado por metadata, sitemap e robots
- `WEB_NEXT_SITEMAP_DYNAMIC_LIMIT`
  - limite das colecoes dinamicas em `sitemap.xml`
- `WEB_NEXT_QUESTION_SITEMAP_PAGE_SIZE`
  - quantidade de questoes por pagina no sitemap dedicado

## Comandos principais

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run start
```

## Checks de transicao e producao

Os nomes `web-next:*` continuam por compatibilidade, mas todos rodam a partir da raiz.

```bash
npm run web-next:typecheck
npm run web-next:build
npm run web-next:cutover-check
npm run web-next:legacy-bridge-check
npm run web-next:stage4-smoke
npm run web-next:stage5-smoke
npm run web-next:production-gate
```

## CI e deploy

Ambientes limpos devem instalar somente as dependencias da raiz:

```bash
npm ci
npm run build
```

Nao existe mais `web-next/package.json` ou `web-next/package-lock.json` neste branch.

## Documentacao operacional

- `docs/NEXT_PLATFORM_CONSOLIDATION.md`
  - estado da consolidacao e etapas de auditoria
- `docs/LEGACY_WEB_INVENTORY.md`
  - inventario historico do legado e decisao de remocao da arvore ativa
- `docs/NEXTJS_MIGRATION.md`
  - historico da migracao, macros e gates
- `docs/GOOGLE_SEARCH_CONSOLE.md`
  - preparacao para visibilidade no Google
- `docs/WEB_NEXT_STAGE4_ROLLOUT.md`
  - rollout controlado
- `docs/WEB_NEXT_STAGE5_PRODUCTION.md`
  - preparacao de producao
