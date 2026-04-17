# Migracao Web para Next.js

Este documento registra a migracao da plataforma web publica do ConcursoMestre para Next.js App Router.

## Escopo corrigido

Em `2026-04-16`, o escopo foi corrigido para evitar confusao entre duas frentes diferentes:

- extracao do app mobile Expo a partir da plataforma web
- migracao da plataforma web publica para Next.js, focada em SEO

A migracao Next **nao** faz parte do app mobile. Ela atende a camada publica/indexavel da plataforma web, mantendo a area logada e administrativa no projeto Vite atual.

## Arquitetura alvo

- `src/` continua como SPA Vite para area autenticada e admin
- `web-next/` passa a servir as rotas publicas SEO-first
- proxy/reverse proxy deve encaminhar:
  - `/`, `/planos`, `/elite`, `/faq`, `/changelog`, `/privacy`, `/terms` -> `web-next`
  - `/auth`, `/dashboard`, `/practice`, `/admin`, `/profile`, `/checkout` -> app Vite

## O que foi entregue nesta etapa

Base validada em `2026-04-16`:

- `web-next/` estabilizado e separado da extracao mobile
- rotas publicas estaticas funcionando:
  - `/`
  - `/planos`
  - `/elite`
  - `/faq`
  - `/changelog`
  - `/privacy`
  - `/terms`
- rotas publicas dinamicas iniciais funcionando:
  - `/l/[slug]`
  - `/question/[id]/[slug]`
  - `/ranking/[id]/[slug]`
- infraestrutura SEO inicial entregue:
  - `metadataBase` e canonicals no layout/root
  - `robots.txt` via metadata route
  - `sitemap.xml` via metadata route, agora incluindo landings publicadas em `/l/[slug]`
  - JSON-LD na FAQ
  - ISR de 1 hora no changelog
- fallback publico de `settings.php` para o build nao depender do backend local ligado
- correcao do scaffold herdado do Antigravity:
  - arquivos compartilhados ausentes copiados da plataforma
  - imports quebrados e tipos ajustados
  - rota comercial corrigida para `/planos` no lugar de `/plans`
  - configuracao `turbopack.root` definida para o workspace `web-next`
- contratos reaproveitados da plataforma atual:
  - slug SEO de questoes
  - sanitizacao server-safe do HTML do enunciado
  - metadata dinamica para landings e questoes publicas

## Validacoes executadas

- `npm --prefix web-next run typecheck`
- `npm --prefix web-next run build`

Resultado atual:

- typecheck: `ok`
- build: `ok`
- saida gerada pelo Next:
  - `/`
  - `/planos`
  - `/elite`
  - `/l/[slug]`
  - `/faq`
  - `/changelog`
  - `/privacy`
  - `/terms`
  - `/question/[id]/[slug]`
  - `/robots.txt`
  - `/sitemap.xml`

## Estrategia de coexistencia

Esta migracao segue o padrao strangler:

1. mover primeiro as rotas publicas e indexaveis para Next
2. preservar a SPA Vite para tudo que depende fortemente de sessao e painel admin
3. manter URLs canonicas estaveis durante o corte
4. ampliar o escopo do Next por fases, sem travar a extracao mobile

## Status atual

Fase 1 da migracao publica: concluida.

- base App Router estabilizada
- rotas estaticas principais entregues
- SEO base entregue

Fase 2 da migracao publica: em andamento.

- `ok` landing pages dinamicas em `/l/[slug]`
- `ok` pagina publica de questao em `/question/[id]/[slug]`
- `ok` ranking publico em `/ranking/[id]/[slug]`
- `pendente` material publico
- `pendente` promo page e termos/fluxos comerciais especiais

## Pendencias da Fase B

As proximas rotas a migrar no web-next sao as que concentram maior ganho de SEO organico:

- `/question/:id/:slug?`
- `/ranking/:id/:slug?`
- `/material/:id/:slug?`
- `/promo/:slug`
- `/checkout/termos-de-adesao`

Essas rotas exigem:

- fetch server-side tipado
- metadata dinamica por entidade
- canonical por slug
- Open Graph por pagina
- JSON-LD quando aplicavel
- politicas claras de cache/revalidate

## Arquivos-chave desta etapa

- `web-next/src/app/page.tsx`
- `web-next/src/app/planos/page.tsx`
- `web-next/src/app/elite/page.tsx`
- `web-next/src/app/l/[slug]/page.tsx`
- `web-next/src/app/question/[id]/[slug]/page.tsx`
- `web-next/src/app/ranking/[id]/[slug]/page.tsx`
- `web-next/src/app/faq/page.tsx`
- `web-next/src/app/changelog/page.tsx`
- `web-next/src/app/robots.ts`
- `web-next/src/app/sitemap.ts`
- `web-next/src/lib/api.ts`
- `web-next/src/lib/publicMarketing.ts`
- `web-next/src/lib/publicQuestions.ts`
- `web-next/src/lib/publicRankings.ts`
- `web-next/src/lib/publicSettings.ts`
- `web-next/src/services/seo/slug.ts`
- `web-next/src/services/questions/questionHtmlSanitizer.ts`
- `web-next/next.config.ts`
