# Runbook de corte da web publica para Next.js

Este documento descreve como colocar o `web-next` na frente das rotas publicas sem quebrar a SPA Vite que ainda atende area logada, pratica, admin e checkout transacional.

## Estado validado

Validado localmente em `2026-04-16`:

- `npm --prefix web-next run typecheck`: ok
- `npm --prefix web-next run build`: ok
- `npm run web-next:cutover-check`: ok
- `http://localhost:3001/plans`: `308` para `/planos`
- `http://localhost:3001/checkout/termos-de-adesao`: `200`
- `http://localhost:3001/question-sitemap.xml`: `200`

Atualizacao operacional em `2026-04-17`:

- `scripts/checks/transition-readiness.ps1` agora cobre `web-next:typecheck`, `web-next:build` e `web-next:cutover-check`
- a esteira frontend/web-next ficou verde fora do sandbox
- o artefato residual `C:\xampp\htdocs\questao-pro-backend\api\subscriptions\subscription_cron.log` foi removido
- o baseline de inventario publico do backend foi alinhado aos bridges reais atuais:
  - `api/questions/show.php`
  - `api/statistics/study-session.php`
  - `api/subscriptions/stripe_pix_capability.php`
  - `api/subscriptions/stripe_testing_matrix.php`
  - `api/subscriptions/stripe_testing_runs.php`
  - `api/users/remove_photo.php`
- `powershell -ExecutionPolicy Bypass -File scripts/checks/transition-readiness.ps1`: `TRANSITION_READY|OK`
- `web-next/src/app/auth/page.tsx` passou a agir como bridge local para a SPA legada quando o Next estiver rodando sem o proxy hibrido
- o bridge usa `NEXT_PUBLIC_LEGACY_WEB_URL` e preserva query string, convertendo `?register=true` para `?mode=signup`
- bridges equivalentes foram abertos para as rotas ainda autenticadas da SPA, reduzindo `404` locais enquanto o proxy final nao assume esses caminhos
- `scripts/checks/web-next-legacy-bridge-check.mjs` passou a validar automaticamente os redirects dessas rotas hibridas
- `/dashboard` agora tambem faz handoff explicito para a raiz da SPA legada, preservando query string para bookmarks antigos
- o check de bridges agora cobre tambem aliases raiz como `/profile` e `/admin`, alem dos tres retornos de assinatura em `/subscription/success|failure|pending`

## Validacao automatizada

Com o `web-next` rodando, execute:

```bash
npm run web-next:cutover-check
```

Para validar tambem o handoff das rotas ainda mantidas na SPA legada:

```bash
npm run web-next:legacy-bridge-check
```

Para gerar o relatorio JSON desse check:

```bash
npm run web-next:legacy-bridge-report
```

Esse runner tambem gera `docs/reports/web-next-legacy-bridge-check-latest.summary.md`.

Para o ambiente local hibrido, existe um atalho que roda os dois checks:

```bash
npm run web-next:hybrid-local-check
```

Para gerar um relatorio JSON consolidado desse modo hibrido:

```bash
npm run web-next:hybrid-local-report
```

Para fechar a macroetapa 3 com um pacote unico de handoff:

```bash
npm run web-next:cutover-handoff
```

Esse atalho usa o wrapper:

- `scripts/checks/run-web-next-hybrid-local-check.ps1`
- `scripts/checks/run-web-next-hybrid-local-report.ps1`
- `scripts/checks/run-web-next-legacy-bridge-check.ps1`

Tambem e possivel chamar o wrapper diretamente:

```bash
powershell -ExecutionPolicy Bypass -File scripts/checks/run-web-next-hybrid-local-check.ps1 -WebNextBaseUrl http://localhost:3001 -LegacyWebBaseUrl http://localhost:3000
```

O checklist tecnico unificado tambem passou a validar o `web-next`:

- `npm run test:transition` agora executa `web-next:typecheck` e `web-next:build`
- se `http://localhost:3001` estiver respondendo, o mesmo script dispara `web-next:cutover-check` automaticamente
- o template de ambiente do `web-next` fica em `web-next/.env.example`

Se a pasta `.next` local estiver travada por algum processo do Windows, valide o build em um diretorio isolado:

```bash
NEXT_DIST_DIR=.next-build-check npm --prefix web-next run build
```

Por padrao, o script usa `http://localhost:3001`. Para validar staging ou producao:

```bash
WEB_NEXT_BASE_URL=https://staging.exemplo.com npm run web-next:cutover-check
```

No caso do check de bridge legado, tambem e possivel sobrescrever a base da SPA:

```bash
WEB_NEXT_BASE_URL=http://localhost:3001 WEB_LEGACY_BASE_URL=http://localhost:3000 npm run web-next:legacy-bridge-check
```

Quando quiser validar tambem o host do canonical, informe:

```bash
WEB_NEXT_BASE_URL=https://staging.exemplo.com WEB_NEXT_EXPECTED_CANONICAL_BASE_URL=https://staging.exemplo.com npm run web-next:cutover-check
```

Quando esse override estiver ativo, o script tambem valida:

- host do `<link rel="canonical">`
- host dos `Sitemap:` em `robots.txt`
- host dos `<loc>` em `sitemap.xml`
- host dos `<loc>` em `question-sitemap.xml`
- host dos `<loc>` em `question-sitemap-page.xml?page=1`

Para gerar um relatorio JSON reutilizavel em Windows:

```bash
npm run web-next:cutover-report
```

Por padrao, esse comando grava em `docs/reports/web-next-cutover-latest.json`. Tambem e possivel sobrescrever `BaseUrl`, `OutputPath`, `ExpectedCanonicalBaseUrl` e IDs reais no script `scripts/checks/run-web-next-cutover-report.ps1`.
Esse runner tambem gera `docs/reports/web-next-cutover-latest.summary.md`.

No modo local hibrido, o relatorio consolidado grava por padrao em:

```bash
docs/reports/web-next-hybrid-local-latest.json
```

Ele referencia tambem os artefatos detalhados:

- `docs/reports/web-next-cutover-local.json`
- `docs/reports/web-next-legacy-bridge-check-local.json`

Os wrappers locais tambem passam a gerar um resumo Markdown ao lado de cada JSON, com o sufixo `.summary.md`.
O handoff final da macro 3 gera tambem:

- `docs/reports/web-next-cutover-handoff-latest.json`
- `docs/reports/web-next-cutover-handoff-latest.md`

Para staging/producao, configure pelo menos:

```bash
NEXT_PUBLIC_API_URL=https://api.exemplo.com/api/
NEXT_PUBLIC_CANONICAL_URL=https://staging.exemplo.com/
```

Arquivos de apoio:

- `web-next/.env.example`
- `web-next/.env.local.example`
- `web-next/.env.staging.example`

Para desenvolvimento local do ambiente hibrido, configure tambem:

```bash
NEXT_PUBLIC_LEGACY_WEB_URL=http://localhost:3000/
```

O `web-next` continua com fallback para os manifestos versionados, mas a fase de corte deve preferir override por ambiente para evitar editar configuracao canonica no codigo.

Para validar redirects dinamicos de entidades reais, informe IDs existentes:

```bash
WEB_NEXT_CHECK_QUESTION_ID=123 WEB_NEXT_CHECK_RANKING_ID=abc WEB_NEXT_CHECK_MATERIAL_ID=xyz npm run web-next:cutover-check
```

Para staging/producao, existe tambem um modo estrito que transforma esses IDs em obrigatorios:

```bash
WEB_NEXT_REQUIRE_ENTITY_IDS=1 WEB_NEXT_CHECK_QUESTION_ID=123 WEB_NEXT_CHECK_RANKING_ID=abc WEB_NEXT_CHECK_MATERIAL_ID=xyz npm run web-next:cutover-check
```

Comando recomendado para staging antes do corte:

```bash
WEB_NEXT_BASE_URL=https://staging.exemplo.com WEB_NEXT_EXPECTED_CANONICAL_BASE_URL=https://staging.exemplo.com WEB_NEXT_REQUIRE_ENTITY_IDS=1 WEB_NEXT_CHECK_QUESTION_ID=123 WEB_NEXT_CHECK_RANKING_ID=abc WEB_NEXT_CHECK_MATERIAL_ID=xyz npm run web-next:cutover-check
```

Atalho equivalente em Windows:

```bash
npm run web-next:staging-gate -- -BaseUrl https://staging.exemplo.com -ExpectedCanonicalBaseUrl https://staging.exemplo.com -QuestionId 123 -RankingId abc -MaterialId xyz
```

Se quiser validar tambem o comportamento hibrido com a SPA legada ainda ativa no ambiente:

```bash
npm run web-next:staging-gate -- -BaseUrl https://staging.exemplo.com -LegacyWebBaseUrl https://app.staging.exemplo.com -ExpectedCanonicalBaseUrl https://staging.exemplo.com -QuestionId 123 -RankingId abc -MaterialId xyz
```

Tambem e possivel usar um arquivo de configuracao:

```bash
npm run web-next:staging-gate -- -ConfigPath config/deploy/web-next-staging-gate.example.json
```

Para uso local recorrente, copie o template para um arquivo ignorado pelo git:

- `config/deploy/web-next-staging-gate.local.json`
- `config/deploy/web-next-production-gate.local.json`

Depois disso, os atalhos ficam assim:

```bash
npm run web-next:staging-gate
npm run web-next:production-gate
```

Para executar a macro 4 completa, com validacao da configuracao de proxy e relatorio de rollout, use:

```bash
npm run web-next:stage4-smoke
npm run web-next:stage4-init-config -- -BaseUrl https://staging.concursomestre.com.br -LegacyWebBaseUrl https://app.staging.concursomestre.com.br -QuestionId questao-real -RankingId ranking-real -MaterialId material-real
npm run web-next:stage4-proxy-check -- -ProxyConfigPath docs/examples/nginx-web-next-cutover.conf
npm run web-next:stage4-config-check
npm run web-next:stage4-status
npm run web-next:stage4-rollout
npm run web-next:stage4-handoff
npm run web-next:stage4-readiness
```

O `stage4-smoke` valida os scripts da macro 4 em arquivos temporarios, sem chamar staging real. O `stage4-init-config` gera a config local ignorada pelo git. O `stage4-config-check` valida a config sem chamadas HTTP. O `stage4-rollout` executa o gate real de staging/producao.
O `stage4-proxy-check` valida uma referencia local de proxy contra rotas publicas essenciais e tambem roda automaticamente dentro do config-check quando `ProxyConfigReference` e um arquivo local.
O `stage4-status` mostra o estado atual da macro 4 lendo config, rollout e handoff sem chamar rede.
O handoff final so passa quando o rollout real passou, evitando abrir a macro 5 com apenas config validada.
O `stage4-readiness` e o gate final: ele falha ate que o status indique `macro5-ready`.
Se `stage4-readiness` retornar `missing-config`, a implementacao da macro 4 esta pronta, mas a validacao operacional ainda aguarda `config/deploy/web-next-staging-rollout.local.json` com dominio e IDs reais.

Templates disponiveis:

- `config/deploy/web-next-staging-gate.example.json`
- `config/deploy/web-next-production-gate.example.json`
- `config/deploy/web-next-staging-rollout.example.json`
- `config/deploy/README.md`

Por padrao:

- `web-next:staging-gate` grava em `docs/reports/web-next-staging-gate.json`
- `web-next:production-gate` grava em `docs/reports/web-next-production-gate.json`
- `web-next:stage4-rollout` grava em `docs/reports/web-next-stage4-rollout-latest.json`

O arquivo `config/deploy/web-next-staging-gate.example.json` e apenas um template. O script falha de proposito se ainda encontrar hosts placeholder como `exemplo.com`.
O arquivo `config/deploy/web-next-staging-rollout.example.json` tambem e apenas um template. O rollout da macro 4 falha cedo quando ainda encontra `seu-dominio.com` ou IDs de exemplo.

Tambem existe um workflow manual no GitHub Actions:

- `.github/workflows/web-next-stage4-smoke.yml`
- `.github/workflows/web-next-stage4-rollout.yml`
- `.github/workflows/web-next-staging-gate.yml`
- `.github/workflows/web-next-legacy-bridge-check.yml`

O workflow de smoke da macro 4 roda `web-next:stage4-smoke` e `web-next:typecheck`, sem chamar staging real.

O workflow de rollout da macro 4 recebe as mesmas URLs e IDs do gate, alem de:

- `proxy_mode`
- `proxy_config_reference`
- `notes`
- `validate_only`

Ele cria uma config local temporaria, executa `web-next:stage4-rollout` e publica o relatorio da macro 4 junto com as evidencias do gate.
Quando `validate_only=true`, o workflow valida a config e gera evidencia sem chamar o gate HTTP.
Quando `validate_only=false`, o workflow tambem executa `web-next:stage4-handoff` e anexa a evidencia de abertura da macro 5 quando o rollout real passa.
O artifact do workflow inclui rollout, proxy check, status, handoff e relatorios detalhados do gate.

O workflow de gate por ambiente agora recebe:

- `environment` (`staging` ou `production`)
- `base_url`
- `legacy_web_base_url` opcional para validar tambem os redirects da camada hibrida
- `expected_canonical_base_url`
- IDs reais das entidades publicas

Ele instala as dependencias da raiz e do `web-next`, roda o gate com o ambiente informado e publica o JSON final como artifact.
Tambem publica um resumo legivel no `GITHUB_STEP_SUMMARY`, para leitura rapida sem abrir o artifact.

Quando `legacy_web_base_url` estiver preenchido, o gate gera um relatorio combinado com:

- validacao publica/SEO do Next
- validacao dos redirects para a SPA legada

No GitHub Actions, esse modo hibrido tambem sobe tres artefatos no mesmo pacote:

- relatorio combinado
- resumo Markdown do relatorio combinado
- relatorio detalhado publico (`*.public.json`)
- resumo Markdown do relatorio publico
- relatorio detalhado de bridges legados (`*.legacy.json`)
- resumo Markdown do relatorio de bridges legados

Localmente, esses mesmos relatorios tambem ganham versoes resumidas em Markdown para leitura rapida.

No caso do workflow de bridge legado, os inputs sao:

- `web_next_base_url`
- `legacy_web_base_url`
- `output_path`

Ele valida os redirects das rotas hibridas, publica o relatorio JSON como artifact e anexa um resumo curto no `GITHUB_STEP_SUMMARY`.
O artifact desse workflow tambem passa a incluir o resumo Markdown correspondente.

Esses IDs sao opcionais porque dependem de dados reais do backend. Sem eles, o script valida:

- rotas publicas estaticas
- `<title>` das paginas publicas principais
- meta description das paginas publicas principais
- canonical das paginas publicas principais
- host do canonical, quando `WEB_NEXT_EXPECTED_CANONICAL_BASE_URL` estiver configurado
- `robots.txt`
- `sitemap.xml`
- `question-sitemap.xml`
- `question-sitemap-page.xml?page=1`
- `/plans -> /planos`

Com os IDs reais configurados, ele tambem valida JSON-LD nas paginas dinamicas:

- questao: `Article`
- ranking: `ItemList`
- material: `Product`

Em `strict mode`, a falta de qualquer um desses IDs passa a falhar o comando em vez de gerar `SKIP`.

O check tambem faz uma segunda tentativa curta quando recebe `5xx` transitório em alguma rota publica, para reduzir falso negativo em ambiente aquecendo cache ou subindo ISR.

## Servicos esperados

- `web-next`: Next.js App Router para rotas publicas e SEO-first
- `src/`: SPA Vite atual para produto autenticado e fluxos que dependem de sessao
- backend PHP/API: mantido como fonte dos endpoints publicos e autenticados

## Rotas para o Next

Encaminhar para `web-next`:

- `/`
- `/planos`
- `/plans`
- `/elite`
- `/faq`
- `/changelog`
- `/privacy`
- `/terms`
- `/checkout/termos-de-adesao`
- `/l/*`
- `/question/*`
- `/ranking/*`
- `/material/*`
- `/promo/*`
- `/robots.txt`
- `/sitemap.xml`
- `/question-sitemap.xml`

## Rotas para a SPA Vite

Encaminhar para a SPA atual:

- `/auth`
- `/dashboard`
- `/practice`
- `/admin`
- `/profile`
- `/checkout/*`, exceto `/checkout/termos-de-adesao`
- `/marketplace`
- `/read/*`
- `/confirm-email`
- `/reset-password`
- `/concursos`
- `/lei-comentada`
- `/flashcards`
- `/simulation`
- `/x-ray`
- `/notifications`
- `/partner-dashboard`
- `/support`
- `/performance/subjects`
- `/subscription/*`
- demais rotas autenticadas ainda nao migradas

## Redirects e canonicals

Ja implementado no `web-next`:

- `/plans` -> `/planos` permanente
- `/question/[id]` -> `/question/[id]/[slug]`
- `/ranking/[id]` -> `/ranking/[id]/[slug]`
- `/material/[id]` -> `/material/[id]/[slug]`
- slug incorreto em questao/ranking/material -> canonical com slug correto
- `/l/planos` -> `/planos`
- `/l/elite` -> `/elite`

## Cache e revalidate

Politica inicial:

- landings dinamicas: `revalidate = 3600`
- questoes publicas: `revalidate = 3600`
- rankings publicos: `revalidate = 3600`
- materiais publicos: `revalidate = 3600`
- promocao publica: `revalidate = 900`
- changelog: ISR de 1 hora

Essa politica e conservadora: reduz carga no backend sem deixar promocao e conteudo publico congelados por tempo demais.

## Sitemap dinamico

O sitemap inclui automaticamente, quando o backend retornar dados publicos:

- landings publicadas em `/l/[slug]`
- promocao ativa em `/promo/[slug]`
- rankings aprovados em `/ranking/[id]/[slug]`
- materiais aprovados em `/material/[id]/[slug]`

Rankings e materiais usam limite conservador de `200` URLs por tipo. Para ajustar em staging/producao:

```bash
WEB_NEXT_SITEMAP_DYNAMIC_LIMIT=500
```

Questoes publicas agora usam um sitemap dedicado e paginado:

- `/question-sitemap.xml`: indice de sitemaps de questoes
- `/question-sitemap-page.xml?page=N`: pagina XML com as URLs canonicas de questoes

Por padrao, cada pagina carrega `500` questoes. Para ajustar esse tamanho:

```bash
WEB_NEXT_QUESTION_SITEMAP_PAGE_SIZE=500
```

O `robots.txt` referencia tanto `/sitemap.xml` quanto `/question-sitemap.xml`, separando o sitemap institucional/comercial do sitemap volumetrico de questoes.

## Ordem segura de corte

1. Subir `web-next` em staging com a mesma `NEXT_PUBLIC_API_URL` que o dominio final usara.
2. Validar `robots.txt`, `sitemap.xml` e `question-sitemap.xml` em staging.
3. Rodar `npm run web-next:cutover-check` apontando para o ambiente de staging.
4. Validar uma URL real de cada grupo:
   - `/planos`
   - `/elite`
   - `/faq`
   - `/checkout/termos-de-adesao`
   - `/question/[id]`
   - `/ranking/[id]`
   - `/material/[id]`
   - `/promo/[slug]`, se houver promocao ativa
5. Configurar proxy por rota, mantendo a SPA como fallback para rotas autenticadas.
6. Testar redirects permanentes antes de abrir indexacao:
   - `/plans`
   - `/question/[id]`
   - `/ranking/[id]`
   - `/material/[id]`
7. Publicar o corte em producao.
8. Rodar `npm run web-next:cutover-check` apontando para o dominio final.
9. Submeter `/sitemap.xml` e `/question-sitemap.xml` no Google Search Console.
10. Monitorar erros 404/500 e cobertura de indexacao nos primeiros dias.

O detalhamento da abertura e monitoramento do Search Console esta em:

- `docs/GOOGLE_SEARCH_CONSOLE.md`
- `docs/WEB_NEXT_STAGE5_PRODUCTION.md`

A abertura da macro 4 fica registrada em:

- `docs/WEB_NEXT_STAGE4_STAGING.md`
- `config/deploy/web-next-staging-rollout.example.json`
- `scripts/checks/new-web-next-stage4-rollout-config.ps1`
- `scripts/checks/run-web-next-stage4-status.ps1`
- `scripts/checks/run-web-next-stage4-proxy-check.ps1`
- `scripts/checks/run-web-next-stage4-smoke.ps1`
- `scripts/checks/run-web-next-stage4-rollout.ps1`
- `scripts/checks/run-web-next-stage4-handoff.ps1`
- `.github/workflows/web-next-stage4-rollout.yml`

## Regras de proxy

O proxy deve priorizar rotas mais especificas antes das genericas. Exemplo:

1. `/checkout/termos-de-adesao` -> `web-next`
2. `/checkout/*` -> SPA Vite
3. `/question/*`, `/ranking/*`, `/material/*`, `/promo/*`, `/l/*` -> `web-next`
4. rotas autenticadas -> SPA Vite
5. `/` e paginas publicas estaticas -> `web-next`

Para um ponto de partida operacional em Apache, usar como referencia:

- `docs/examples/apache-web-next-cutover.conf`
- `docs/examples/nginx-web-next-cutover.conf`

## Checklist pos-corte

- `/robots.txt` retorna 200 e aponta para o sitemap correto
- `/sitemap.xml` retorna 200 e lista rotas publicas
- `/question-sitemap.xml` retorna 200 e expoe as paginas de sitemap de questoes
- `/plans` retorna redirect permanente para `/planos`
- paginas publicas tem `<title>`, description e canonical
- titulos publicos nao duplicam o nome da marca
- JSON-LD dinamico aparece nas paginas de questao/ranking/material testadas
- area logada continua abrindo na SPA
- checkout transacional continua na SPA
- `/checkout/termos-de-adesao` continua publico no Next
- Search Console recebeu o sitemap novo
- `npm run web-next:cutover-check` passa contra o dominio final
