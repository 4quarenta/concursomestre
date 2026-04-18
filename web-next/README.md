## web-next

Camada publica SEO-first da plataforma web do ConcursoMestre.

Ela atende as rotas indexaveis e comerciais enquanto a SPA Vite da raiz continua responsavel pela area logada, pratica, admin e checkout transacional.

## Rotas cobertas

- `/`
- `/planos`
- `/plans`
- `/elite`
- `/faq`
- `/changelog`
- `/privacy`
- `/terms`
- `/checkout/termos-de-adesao`
- `/l/[slug]`
- `/question/[id]/[slug]`
- `/ranking/[id]/[slug]`
- `/material/[id]/[slug]`
- `/promo/[slug]`
- `/robots.txt`
- `/sitemap.xml`
- `/question-sitemap.xml`
- `/question-sitemap-page.xml?page=N`

## Variaveis de ambiente

Use `web-next/.env.example` como base.

Para staging, existe tambem um ponto de partida em `web-next/.env.staging.example`.
Para desenvolvimento local hibrido, existe tambem `web-next/.env.local.example`.

- `NEXT_PUBLIC_API_URL`
  - endpoint base do backend PHP para os dados publicos
- `NEXT_PUBLIC_CANONICAL_URL`
  - dominio canonico usado por metadata, sitemap e robots
- `NEXT_PUBLIC_LEGACY_WEB_URL`
  - base da SPA Vite legada para os handoffs das rotas ainda nao migradas, como `/auth`, `/profile` e `/admin`
- `WEB_NEXT_SITEMAP_DYNAMIC_LIMIT`
  - limite das colecoes dinamicas em `sitemap.xml`
- `WEB_NEXT_QUESTION_SITEMAP_PAGE_SIZE`
  - quantidade de questoes por pagina no sitemap dedicado

## Comandos

```bash
npm run dev
npm run typecheck
npm run build
npm run start
```

Na raiz do repositorio tambem existem atalhos para o corte:

```bash
npm run web-next:typecheck
npm run web-next:build
npm run web-next:cutover-check
npm run web-next:legacy-bridge-check
npm run web-next:legacy-bridge-report
npm run web-next:hybrid-local-check
npm run web-next:hybrid-local-report
npm run web-next:cutover-report
npm run web-next:staging-gate -- -BaseUrl https://staging.exemplo.com -ExpectedCanonicalBaseUrl https://staging.exemplo.com -QuestionId 123 -RankingId abc -MaterialId xyz
npm run web-next:staging-gate -- -ConfigPath config/deploy/web-next-staging-gate.example.json
npm run web-next:staging-gate
npm run web-next:stage4-smoke
npm run web-next:stage4-init-config -- -BaseUrl https://staging.concursomestre.com.br -LegacyWebBaseUrl https://app.staging.concursomestre.com.br -QuestionId questao-real -RankingId ranking-real -MaterialId material-real
npm run web-next:stage4-status
npm run web-next:stage4-proxy-check -- -ProxyConfigPath docs/examples/nginx-web-next-cutover.conf
npm run web-next:stage4-config-check
npm run web-next:stage4-rollout
npm run web-next:stage4-handoff
npm run web-next:stage4-readiness
npm run web-next:stage5-smoke
npm run web-next:stage5-init-config -- -BaseUrl https://concursomestre.com.br -LegacyWebBaseUrl https://app.concursomestre.com.br -QuestionId questao-real -RankingId ranking-real -MaterialId material-real -SearchConsoleProperty sc-domain:concursomestre.com.br -MonitoringNotes "monitorar cobertura e canonicals"
npm run web-next:stage5-validate
npm run web-next:stage5-launch
npm run web-next:stage5-status
npm run web-next:stage5-readiness
npm run web-next:production-gate
```

Os templates de gate e rollout por ambiente ficam em `config/deploy/`.

## Validacao de corte

Com o `web-next` rodando:

```bash
npm run web-next:cutover-check
```

Para validar tambem os handoffs para a SPA legada:

```bash
npm run web-next:legacy-bridge-check
```

Esse check cobre os handoffs mais sensiveis da transicao, incluindo `/auth`, `/dashboard`, `/profile`, `/admin` e `/subscription/success|failure|pending`.

Para gerar relatorio JSON desse handoff:

```bash
npm run web-next:legacy-bridge-report
```

Para o dia a dia local, existe um atalho que roda os dois checks:

```bash
npm run web-next:hybrid-local-check
```

Se quiser o mesmo fluxo com relatorio JSON consolidado:

```bash
npm run web-next:hybrid-local-report
```

Se quiser sobrescrever as URLs sem editar o ambiente, use:

```bash
powershell -ExecutionPolicy Bypass -File scripts/checks/run-web-next-hybrid-local-check.ps1 -WebNextBaseUrl http://localhost:3001 -LegacyWebBaseUrl http://localhost:3000
```

Para gerar relatorio JSON na raiz do repositorio:

```bash
npm run web-next:cutover-report
```

O runbook completo do corte fica em `docs/WEB_NEXT_CUTOVER.md`.

## Modo hibrido local

Quando voce estiver com:

- SPA Vite na raiz em `http://localhost:3000`
- `web-next` em `http://localhost:3001`

use:

```bash
npm run web-next:hybrid-local-check
```

Esse fluxo valida:

- paginas publicas e SEO do Next
- redirects hibridos para a SPA legada

Para staging/producao, o check tambem aceita:

- `WEB_NEXT_EXPECTED_CANONICAL_BASE_URL`
- `WEB_NEXT_REQUIRE_ENTITY_IDS=1`
- `WEB_NEXT_CHECK_QUESTION_ID`
- `WEB_NEXT_CHECK_RANKING_ID`
- `WEB_NEXT_CHECK_MATERIAL_ID`
