# Migracao Web para Next.js

Este documento registra a migracao da plataforma web publica do ConcursoMestre para Next.js App Router.

## Escopo corrigido

Em `2026-04-16`, o escopo foi corrigido para evitar confusao entre duas frentes diferentes:

- extracao do app mobile Expo a partir da plataforma web
- migracao da plataforma web publica para Next.js, focada em SEO

A migracao Next **nao** faz parte do app mobile. Ela atende a camada publica/indexavel da plataforma web, mantendo a area logada e administrativa no projeto Vite atual.

Consolidacao aberta em `2026-04-18`:

- branch dedicada criada: `4quarenta/next-version`
- a raiz do repositorio passa a tratar o Next como base principal do web
- os comandos `dev`, `build`, `start` e `typecheck` da raiz agora apontam para o Next
- a SPA Vite anterior fica preservada como legado por `legacy-web:dev|build|preview`
- `legacy-web:typecheck` agora usa `tsconfig.legacy.json` para medir apenas a divida real da SPA
- a transicao e a auditoria passaram a ser documentadas em:
  - `docs/NEXT_PLATFORM_CONSOLIDATION.md`
  - `docs/PLATFORM_1_0_0_AUDIT_PROGRAM.md`

Atualizacao em `2026-04-17`:

- `web-next` ganhou um bridge explicito para `/auth`
- quando o Next roda isolado em dev, `/auth` deixa de cair em `404` e redireciona para a SPA Vite legada
- o bridge preserva query string e converte `?register=true` para `?mode=signup`
- a URL base desse handoff pode ser ajustada por `NEXT_PUBLIC_LEGACY_WEB_URL`
- existe um atalho operacional `npm run web-next:hybrid-local-check` para validar Next publico + handoff legado no ambiente local
- agora existe tambem `npm run web-next:hybrid-local-report` para gerar um JSON consolidado desse mesmo fluxo
- o wrapper PowerShell `scripts/checks/run-web-next-hybrid-local-check.ps1` alinha esse fluxo com os demais checks operacionais do repositorio
- o wrapper `scripts/checks/run-web-next-hybrid-local-report.ps1` junta os relatórios do corte SEO e dos bridges legados em um artefato local unico
- o check de bridge legado agora tambem pode gerar relatorio JSON e ser rodado manualmente via GitHub Actions
- o workflow manual de bridge legado agora resolve `output_path` automaticamente e publica um resumo curto no `GITHUB_STEP_SUMMARY`
- o runner `scripts/checks/run-web-next-legacy-bridge-check.ps1` padroniza a geracao desse relatorio no Windows
- a amostra automatizada do handoff agora cobre tambem `/profile` sem slug, `/admin` raiz e todos os retornos de assinatura em `/subscription/success|failure|pending`
- o mesmo padrao agora cobre rotas que continuam no shell autenticado da SPA:
  - `/dashboard`
  - `/confirm-email`
  - `/reset-password`
  - `/concursos`
  - `/practice`
  - `/lei-comentada`
  - `/flashcards`
  - `/simulation`
  - `/x-ray`
  - `/marketplace`
  - `/ranking`
  - `/profile/*`
  - `/performance/subjects`
  - `/notifications`
  - `/partner-dashboard`
  - `/support`
  - `/subscription/success|failure|pending`
  - `/read/[id]`
  - `/checkout/[planId]`
  - `/admin/*`

## Arquitetura alvo

- `src/` continua como SPA Vite para area autenticada e admin
- `web-next/` passa a servir as rotas publicas SEO-first
- proxy/reverse proxy deve encaminhar:
  - `/`, `/planos`, `/elite`, `/faq`, `/changelog`, `/privacy`, `/terms`, `/checkout/termos-de-adesao` -> `web-next`
  - `/auth`, `/dashboard`, `/practice`, `/admin`, `/profile`, `/checkout/*` -> app Vite, exceto `/checkout/termos-de-adesao`

Enquanto esse proxy nao esta na frente do ambiente local, o `web-next` agora resolve `/auth` com redirect server-side para a SPA legada.

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
  - `/checkout/termos-de-adesao`
- rotas publicas dinamicas iniciais funcionando:
  - `/l/[slug]`
  - `/question/[id]/[slug]`
  - `/ranking/[id]/[slug]`
  - `/material/[id]/[slug]`
  - `/promo/[slug]`
- infraestrutura SEO inicial entregue:
  - `metadataBase` e canonicals no layout/root
  - `robots.txt` via metadata route
  - `sitemap.xml` via metadata route, agora incluindo landings publicadas em `/l/[slug]`
  - sitemap tambem inclui rankings e materiais aprovados quando as listas publicas estao disponiveis
  - `question-sitemap.xml` entregue como indice paginado para questoes publicas
  - promocao ativa em `/promo/[slug]` quando publicada nas configuracoes
  - `/checkout/termos-de-adesao` liberado no `robots.txt` sem abrir o checkout transacional
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
  - `/checkout/termos-de-adesao`
  - `/question/[id]/[slug]`
  - `/ranking/[id]/[slug]`
  - `/material/[id]/[slug]`
  - `/promo/[slug]`
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

Fase 2 da migracao publica: concluida.

- `ok` landing pages dinamicas em `/l/[slug]`
- `ok` pagina publica de questao em `/question/[id]/[slug]`
- `ok` ranking publico em `/ranking/[id]/[slug]`
- `ok` material publico em `/material/[id]/[slug]`
- `ok` promo page em `/promo/[slug]`
- `ok` termos de adesao do checkout em `/checkout/termos-de-adesao`

## Fase C: corte/deploy

A fase atual nao e mais migrar pagina publica principal; e preparar o corte operacional.

Ja entregue:

- `/plans` redireciona permanentemente para `/planos`
- `/question/[id]` redireciona para `/question/[id]/[slug]`
- `/ranking/[id]` redireciona para `/ranking/[id]/[slug]`
- `/material/[id]` redireciona para `/material/[id]/[slug]`
- slug incorreto em questao/ranking/material redireciona para a canonical correta
- `/l/planos` e `/l/elite` redirecionam para as rotas comerciais canonicas
- `revalidate` inicial configurado para rotas publicas dinamicas
- runbook de corte criado em `docs/WEB_NEXT_CUTOVER.md`
- script de validacao de corte criado em `scripts/checks/web-next-cutover-check.mjs`
- script unificado `scripts/checks/transition-readiness.ps1` passou a incluir `web-next:typecheck` e `web-next:build`, com `cutover-check` automatico quando o `web-next` estiver no ar
- validacao automatizada cobre status HTTP, redirects, `robots.txt`, `sitemap.xml`, `<title>`, description e canonical
- paginas que ja montam titulo completo usam `title.absolute` para evitar duplicacao de marca
- paginas dinamicas de questao, ranking e material entregam JSON-LD server-side
- `web-next:cutover-check` valida JSON-LD dinamico quando recebe IDs reais por variavel de ambiente
- sitemap dinamico inclui rankings/materiais aprovados com limite configuravel por `WEB_NEXT_SITEMAP_DYNAMIC_LIMIT`
- sitemap de questoes entregue em `/question-sitemap.xml`, com paginas em `/question-sitemap-page.xml?page=N`
- `robots.txt` agora anuncia os dois sitemaps publicos

Ainda pendente:

- configurar proxy/reverse proxy entre `web-next` e SPA Vite no ambiente real
- validar preview em ambiente semelhante ao deploy real
- configurar monitoramento de indexacao no Google Search Console

Marco validado em `2026-04-17`:

- `scripts/checks/transition-readiness.ps1` voltou a fechar com `TRANSITION_READY|OK`
- o baseline de inventario publico do backend foi sincronizado com os bridges atuais fora deste workspace
- `npm run web-next:cutover-report` passou a gerar relatorio JSON em `docs/reports/web-next-cutover-latest.json`
- runbook operacional do Search Console documentado em `docs/GOOGLE_SEARCH_CONSOLE.md`
- `web-next/.env.example` passou a documentar `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CANONICAL_URL` e limites de sitemap por ambiente
- `web-next:cutover-check` agora pode validar tambem o host do canonical via `WEB_NEXT_EXPECTED_CANONICAL_BASE_URL`
- `web-next:staging-gate` virou o atalho oficial para validar staging com canonical host e IDs reais obrigatorios
- `web-next:staging-gate` agora aceita `ConfigPath` e protege contra placeholder host antes de rodar a validacao real
- `web-next:staging-gate` agora tambem aceita `LegacyWebBaseUrl` para refletir melhor o corte hibrido com a SPA ainda ativa
- os wrappers operacionais agora tambem geram sumarios Markdown ao lado dos JSONs, o que deixou a leitura local do gate bem mais rapida
- os runners individuais `web-next:cutover-report` e `web-next:legacy-bridge-report` agora seguem o mesmo padrao e tambem entregam `.summary.md`
- a macro 3 agora pode ser encerrada com `web-next:cutover-handoff`, que empacota as evidencias locais e aponta a abertura formal da macro 4
- `web-next:stage4-rollout` agora executa a macro 4 completa a partir de `config/deploy/web-next-staging-rollout.local.json`
- `web-next:stage4-init-config` gera a config local da macro 4 a partir de parametros reais, evitando copia manual do template
- `web-next:stage4-status` mostra o estado local da macro 4 sem chamadas HTTP, a partir de config, rollout e handoff
- `web-next:stage4-readiness` falha ate que o status indique `macro5-ready`, servindo como trava antes do Search Console
- `web-next:stage4-proxy-check` valida referencias locais de proxy contra as rotas publicas essenciais do corte
- `web-next:stage4-smoke` valida os scripts da macro 4 em arquivos temporarios, sem chamar staging real
- `web-next:stage4-config-check` valida a config da macro 4 sem chamadas HTTP, evitando rodada falsa antes de aplicar o proxy real
- o rollout da macro 4 valida placeholders, referencia de proxy, gate de staging e evidencias antes de abrir a macro 5
- `web-next:stage4-handoff` registra a passagem 4 -> 5 e falha quando ainda existe apenas validacao de config
- workflow manual `.github/workflows/web-next-stage4-smoke.yml` preparado para validar scripts da macro 4 em CI sem staging real
- workflow manual `.github/workflows/web-next-stage4-rollout.yml` preparado para rodar a macro 4 em CI com artifact proprio
- o workflow da macro 4 tambem gera o handoff para a macro 5 quando executa o gate real
- o artifact da macro 4 agora inclui rollout, proxy check, status, handoff e relatorios detalhados do gate
- a implementacao da macro 4 esta concluida no repositorio; a conclusao operacional depende de `web-next-staging-rollout.local.json` com dominio/IDs reais e `stage4-readiness` em `macro5-ready`
- a macro 5 agora tambem tem init config, validate, launch, status, readiness e smoke dedicados para o corte final e Search Console
- workflow manual `.github/workflows/web-next-staging-gate.yml` preparado para rodar o gate em CI com artifact do relatorio
- esse workflow manual agora aceita `environment=staging|production`, evitando manter duas esteiras quase iguais para o mesmo gate
- workflow de CI atualizado para instalar dependencias da raiz e do `web-next` em ambiente limpo antes de executar o gate
- `config/deploy/` passou a concentrar templates de gate para staging e producao
- o gate local agora detecta automaticamente `config/deploy/web-next-<ambiente>-gate.local.json`, mantendo IDs reais fora do repositório
- alias `web-next:production-gate` criado para separar o fluxo e o relatorio de producao do gate de staging

## Arquivos-chave desta etapa

- `web-next/src/app/page.tsx`
- `web-next/src/app/planos/page.tsx`
- `web-next/src/app/elite/page.tsx`
- `web-next/src/app/l/[slug]/page.tsx`
- `web-next/src/app/question/[id]/page.tsx`
- `web-next/src/app/question/[id]/[slug]/page.tsx`
- `web-next/src/app/ranking/[id]/page.tsx`
- `web-next/src/app/ranking/[id]/[slug]/page.tsx`
- `web-next/src/app/material/[id]/page.tsx`
- `web-next/src/app/material/[id]/[slug]/page.tsx`
- `web-next/src/app/promo/[slug]/page.tsx`
- `web-next/src/app/checkout/termos-de-adesao/page.tsx`
- `web-next/src/app/checkout/termos-de-adesao/CheckoutAdhesionTermsClient.tsx`
- `web-next/src/app/faq/page.tsx`
- `web-next/src/app/auth/page.tsx`
- `web-next/src/app/dashboard/page.tsx`
- `web-next/src/app/admin/[[...slug]]/page.tsx`
- `web-next/src/app/checkout/[planId]/page.tsx`
- `web-next/src/app/confirm-email/page.tsx`
- `web-next/src/app/reset-password/page.tsx`
- `web-next/src/app/profile/[[...slug]]/page.tsx`
- `web-next/src/app/read/[id]/page.tsx`
- `web-next/src/lib/legacyRedirect.ts`
- `scripts/checks/web-next-legacy-bridge-check.mjs`
- `web-next/src/app/changelog/page.tsx`
- `web-next/src/app/robots.ts`
- `web-next/src/app/sitemap.ts`
- `web-next/src/app/question-sitemap.xml/route.ts`
- `web-next/src/app/question-sitemap-page.xml/route.ts`
- `web-next/src/lib/api.ts`
- `web-next/src/lib/publicMarketing.ts`
- `web-next/src/lib/publicQuestions.ts`
- `web-next/src/lib/publicRankings.ts`
- `web-next/src/lib/publicMaterials.ts`
- `web-next/src/lib/publicQuestionSitemap.ts`
- `web-next/src/lib/publicPromotion.ts`
- `web-next/src/lib/structuredData.ts`
- `web-next/src/lib/publicSettings.ts`
- `web-next/src/services/seo/slug.ts`
- `web-next/src/services/questions/questionHtmlSanitizer.ts`
- `web-next/next.config.ts`
- `scripts/checks/web-next-cutover-check.mjs`
- `docs/WEB_NEXT_CUTOVER.md`
