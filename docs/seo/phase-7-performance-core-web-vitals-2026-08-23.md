# Fase 7 - Performance e Core Web Vitals

Data: 2026-08-23
Baseline: `3b952a15665556f4337cbf7c126950288a73d7cb` (`1.0.0`)
Modo operacional: `PRELAUNCH`
Dataset: fixture representativa de contratos; não representa volume final.

## Escopo e evidência

Esta fase preserva SSR, metadata, canonical, robots, breadcrumbs, JSON-LD, links e boundaries públicos. O reporter `phase7-performance-readiness-reporter.mjs` é read-only, não abre conexão SQL e não possui caminho de escrita. Evidências são classificadas como:

- `CONTRACT`: source/tests e contratos versionados.
- `FIXTURE`: API fixture e contadores determinísticos.
- `LAB`: Chromium local, três execuções por rota/dispositivo.
- `REAL_DB`: não medido nesta fase.
- `FIELD`: não medido; nenhuma afirmação de CWV real é feita.

## Inventário de rotas

| Classe | Amostras LAB |
| --- | --- |
| Marketing/comercial | `/`, `/planos` |
| Diretório/prática | `/questoes` |
| Entidades | questão, disciplina, órgão, concurso |
| Editorial | artigo de lei, blog hub, artigo do blog |
| Suporte/erro | `/support`, 404 real |

As raízes públicas permanecem Server Components ou entregam conteúdo principal no HTML inicial. Interação, auth, filtros, comentários e overlays continuam em ilhas client. Foram encontrados 101 arquivos client no conjunto amplo de app/components/providers; a arquitetura global de providers continua um P2, não foi redesenhada.

## Alterações implementadas

1. `StudyTrackerBridge` passou a chunk dinâmico e só é montado quando existe usuário autenticado.
2. O facade de subscriptions passou a ser importado apenas por ações financeiras; o `planService` público deixou de puxá-lo estaticamente ao carregar o catálogo.
3. Logos duplicados do shell responsivo e do blog deixaram de competir como imagens `priority`.
4. Covers de blog e avatares de depoimentos agora reservam dimensões intrínsecas; somente o cover editorial destacado usa `fetchPriority=high`.
5. Foi criado reporter LAB repetível com status, TTFB, LCP, CLS, long-task/TBT proxy, payload, requests, imagens, terceiros, cache e contagem da fixture.

## Before/After

| Issue | Família | Before | Mudança | After | Evidência | Risco | Regressão |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tracker no startup anônimo | Todas públicas | import estático | dynamic + gate de auth | chunk ausente do caminho anônimo | CONTRACT + LAB | baixo | typecheck/build/SSR harness |
| Billing facade antecipado | Todas públicas | import estático direto e transitivo por `planService` | imports por ação | implementação ausente dos chunks iniciais públicos | CONTRACT + LAB | baixo | focused tests/build/first-click fixture |
| Prioridade duplicada | Shell/blog | logos light/dark e mobile/desktop prioritários | prioridade removida do shell | zero preload indiscriminado | CONTRACT | baixo | image/source tests |
| Dimensão de imagens | Home/blog | 6 ocorrências na matriz | width/height + decoding/loading | 0 ocorrências | LAB | baixo | image tests/harness |
| JS transferido | 24 combinações | média 341.703 B | boundaries menores | média 336.822 B (-4.881 B) | LAB | baixo | build + 24-route matrix |

## Performance matrix

Valores são medianas LAB locais após a mudança; não são SLOs de produção.

| Rota desktop | TTFB ms | LCP ms | CLS | TBT proxy ms | HTML KiB | DOM | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 17.3 | 388 | 0 | 49 | 244.4 | 602 | 27 |
| `/questoes` | 91.6 | 436 | 0 | 101 | 258.6 | 575 | 37 |
| questão | 52.1 | 396 | 0 | 25 | 242.3 | 468 | 26 |
| disciplina | 48.5 | 388 | 0 | 12 | 235.3 | 386 | 20 |
| órgão | 54.2 | 400 | 0 | 17 | 246.8 | 428 | 20 |
| concurso | 56.2 | 432 | 0 | 22 | 241.5 | 418 | 30 |
| artigo de lei | 48.5 | 380 | 0 | 14 | 229.6 | 352 | 25 |
| blog hub | 51.8 | 372 | 0.16 | 27 | 247.6 | 385 | 50 |
| blog article | 52.2 | 368 | 0.05 | 19 | 231.0 | 306 | 47 |
| `/planos` | 17.6 | 520 | 0 | 32 | 259.0 | 709 | 27 |
| `/support` | 13.7 | 328 | 0.20 | 1 | 228.1 | 408 | 29 |
| 404 | 14.3 | 344 | 0 | 49 | 212.6 | 299 | 26 |

Medições antes/depois ocorreram sequencialmente em máquina variável. TTFB/LCP oscilaram e não sustentam causalidade. O dado determinístico é a redução de JS e de imagens sem dimensões. CLS preexistente de blog/support permanece P2 porque não foi introduzido nem ampliado por esta fase.

## Client bundle matrix

| Família | JS antes | JS depois | Delta |
| --- | ---: | ---: | ---: |
| Home | 341.018 B | 336.269 B | -4.749 B |
| Questões hub | 360.382 B | 354.586 B | -5.796 B |
| Entidade com shell | 324.074 B | 319.222 B | -4.852 B |
| Blog | 359.014-371.730 B | 354.305-367.021 B | -4.709 B |
| Planos | 356.847 B | 352.100 B | -4.747 B |
| Support | 332.069 B | 327.217 B | -4.852 B |

Budget operacional, não gate rígido: monitorar regressão por classe, investigar aumento superior a 10% ou 25 KiB sem justificativa. Nenhuma dependência nova foi adicionada.

## Query/API matrix

Os números abaixo são máximos de roundtrips à fixture durante navegação e podem incluir prefetch do App Router; não equivalem a queries SQL.

| Rota | API max | Shape observado | N+1 |
| --- | ---: | --- | --- |
| Home | 2 | planos + depoimentos | não observado |
| Questões hub | 4 | lista + filtros + prefetch legal | constante |
| Entidade simples | 1 | detail projection | constante |
| Concurso detail | 4 | contest + prefetch explícito de links | constante |
| Artigo de lei | 3 | article/detail + prefetch | constante |
| Blog hub | 8 | listas/taxonomias + prefetch | constante, P2 revisar prefetch |
| Blog article | 1 | comentários client | constante |

Repositories públicos tocados previamente usam limites e projections explícitas. Não houve mudança SQL, `SELECT *` novo, índice ou migration. `EXPLAIN` real não foi executado sem credencial/dataset real aprovado.

## Asset matrix

| Asset | Política | Resultado |
| --- | --- | --- |
| Inter | `next/font/google`, `display=swap`, uma declaração root | build passou; validar entrega real |
| Logos | dimensões conhecidas, sem múltiplos `priority` no shell | PASS |
| Cover destacado blog | dimensões + eager/high | PASS |
| Cards abaixo da dobra | dimensões + lazy/auto | PASS |
| Avatar depoimento | 48x48 + lazy | PASS |
| Imagens remotas | validações HTTPS/host existentes preservadas | PASS contratual |

LCP local foi H1/texto em home, hubs e blog; em páginas com shell, o logo pequeno apareceu como candidato. Ele permanece descoberto no HTML e com dimensões estáveis, sem quatro preloads concorrentes.

## Cache matrix

| Superfície | Cache observado | Isolamento |
| --- | --- | --- |
| Home/planos/support | `s-maxage=300`, Next HIT | conteúdo público |
| Entidades dinâmicas | HTML `private, no-store`; fetches públicos `revalidate=300` | seguro, P2 CDN/TTFB |
| Auth/admin/comments privados | `private/no-store` | obrigatório |
| Sitemaps PRELAUNCH | private/no-store e noindex | preservado |
| Blog feed | public `s-maxage=300` | conteúdo público |

Não há cache público de cookie, user id, plano, favoritos, progresso, pedidos ou entitlement. Não foi criado subsistema paralelo de tags. Invalidação editorial futura deve reutilizar `revalidatePath`/`revalidateTag` quando o workflow existir.

## CWV LAB matrix

| Métrica | Evidência LAB | Interpretação | FIELD |
| --- | --- | --- | --- |
| LCP | 264-520 ms nas medianas locais | útil só para regressão | NOT_MEASURED |
| CLS | 0 na maioria; blog 0.16 e support 0.20 desktop | P2 preexistente | NOT_MEASURED |
| INP | não mensurável sem interação real | TBT proxy máximo 101 ms | NOT_MEASURED |
| TTFB | 13.7-91.6 ms local/fixture | sem extrapolação | NOT_MEASURED |

## Field matrix

| Metric | Lab evidence | Field evidence | Status | Future gate |
| --- | --- | --- | --- | --- |
| LCP | disponível | ausente | UNKNOWN_FIELD | RUM/CrUX |
| INP | TBT proxy | ausente | UNKNOWN_FIELD | RUM |
| CLS | disponível | ausente | UNKNOWN_FIELD | RUM/CrUX |
| TTFB | local fixture | ausente | UNKNOWN_PRODUCTION | production smoke |

## Arquitetura, waterfalls e streaming

- `generateMetadata` e page reutilizam loaders memoizados via React `cache` nas entidades principais.
- Blog paraleliza categorias/tags e page/categories/tags/exams quando independentes.
- Conteúdo crítico, breadcrumbs e JSON-LD continuam no HTML inicial; Suspense é usado com fallback SSR factual em planos/prática/Lei Comentada.
- Nenhuma rota SSR virou CSR; nenhum catálogo completo foi movido ao browser.
- O reporter encontrou zero URL de request duplicada no waterfall de 24 combinações.
- Prefetch padrão do `Link` explica parte dos 20-50 requests; não há prefetch agressivo customizado novo. Blog hub merece revisão P2 com produção.

## Segurança e regressões

- SSR harness: 31 rotas, 62 execuções, 0 divergência semântica, 0 divergência de segurança.
- 14 expectations históricas de schema permanecem idênticas à baseline; não são falhas de hidratação.
- Performance reporter: 24 rota/dispositivo, 0 status mismatch, 0 console error, 0 hydration message, 0 duplicate request URL.
- Hard 404 permanece documento 404; não houve soft-404 novo.
- `@seo`, `PublicInformationSeoSnapshot`, `ClientHydrationMarker`, `seo-snapshot` e `data-client-ready`: 0 consumers runtime.
- Client canonical/robots/indexability authority: 0 nas rotas tocadas.
- Nenhum DTO privado, token, signed URL, storage key, buyer/seller data ou nota administrativa foi adicionado.

## P0/P1/P2

- P0: 0.
- P1: 0.
- P2: CLS desktop em blog/support; provider tree global amplo; payload HTML 212-259 KiB; planos com 709 nós; prefetch/request count do blog; HTML dinâmico sem cache público; validação de fontes/imagens/CDN/queries com produção e dados reais; CWV FIELD ausente.

## Gates futuros

- `PERFORMANCE_REAL_DATA_QUERY_VALIDATION_REQUIRED`
- `PERFORMANCE_REAL_DATA_EXPLAIN_REQUIRED`
- `CORE_WEB_VITALS_REAL_USER_VALIDATION_REQUIRED`
- `PRODUCTION_PERFORMANCE_SMOKE_REQUIRED`
- `CDN_CACHE_PRODUCTION_VALIDATION_REQUIRED`
- `FONT_DELIVERY_PRODUCTION_VALIDATION_REQUIRED`
- `IMAGE_DELIVERY_REAL_DATA_VALIDATION_REQUIRED`

## Estado operacional

```text
phase 7 migration created = NÃO
phase 7 migration applied production = NÃO
production DB writes = 0
phase 7 backfill writes = 0
effective launch mode = PRELAUNCH
production indexing activated = NÃO
production sitemap published = NÃO
search engines notified = NÃO
commit = NÃO
push realizado = NÃO
deploy realizado = NÃO
```
