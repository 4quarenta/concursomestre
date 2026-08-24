# Fase 8 — Full Crawl + Final SEO Gate

- **Data:** 2026-08-23T20:30:54.1773240-03:00
- **Evidência:** CONTRACT, FIXTURE, LAB
- **Gate:** GO
- **Launch mode efetivo:** PRELAUNCH

## A. Resumo executivo

**SEO arquitetural:** GO. **P0:** 0. **P1:** 0. **P2:** 0. O resultado aprova contratos, fixtures e laboratório; não aprova o dataset real nem autoriza produção.

## B. Baseline

Branch `1.0.0`; baseline `8c6e88ce051c72495293912068c2b2eb4b4349d1`; medição em `2026-08-23T20:30:54.1773240-03:00`.

## C. Diff

A Fase 8 adiciona reporter/crawl, configuração do harness e a correção estritamente necessária da rota funcional `/busca`. Diff atual: 21 arquivos: 11 modificados, 10 novos, 0 removidos; +3504/-14..

## D. Dataset status

`DATASET_TEMPORARIO_DE_TESTE`. Volume, densidade editorial e contagens atuais não foram usados como decisão permanente de família.

## E. SEO_GO semantics

`SEO_GO` significa aprovação arquitetural para avançar no roadmap. Não significa Production GO, indexação real, sitemap público, submissão a buscadores ou validação do dataset definitivo.

## F. 55-family inventory

| Família | Rotas | Estado | Elegibilidade | Target | Launch |
| --- | --- | --- | --- | --- | --- |
| home | / | INDEX | INDEXABLE | INDEX | ACTIVE |
| questions_hub | /questoes | INDEX | INDEXABLE | INDEX | ACTIVE |
| question_detail | /questoes/{id}/{slug}, /questoes/{id} | INDEX | INDEXABLE | INDEX | ACTIVE |
| discipline_hub | /disciplinas | INDEX | INDEXABLE | INDEX | ACTIVE |
| discipline_detail | /disciplinas/{slug} | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| board_hub | /bancas | INDEX | INDEXABLE | INDEX | ACTIVE |
| board_detail | /bancas/{slug} | MIXED | INDEXABLE | INDEX | ACTIVE |
| exam_hub | /provas | INDEX | INDEXABLE | INDEX | ACTIVE |
| exam_detail | /provas/{slug} | INDEX | INDEXABLE | INDEX | ACTIVE |
| contest_hub | /concursos | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| law_hub | /lei-comentada | INDEX | INDEXABLE | INDEX | ACTIVE |
| law_detail | /lei-comentada/{slug} | INDEX | INDEXABLE | INDEX | ACTIVE |
| blog_hub | /blog | INDEX | INDEXABLE | INDEX | ACTIVE |
| blog_article | /blog/{slug} | INDEX | INDEXABLE | INDEX | ACTIVE |
| blog_category | /blog/categoria/{slug} | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| blog_tag | /blog/tag/{slug} | NOINDEX | PERMANENT_NOINDEX | NOINDEX | PERMANENT |
| blog_author | /blog/autor/{id} | NOINDEX | CONDITIONAL | INDEX | PILOT |
| plans | /planos | INDEX | INDEXABLE | INDEX | ACTIVE |
| faq | /faq | INDEX | INDEXABLE | INDEX | ACTIVE |
| news | /novidades | INDEX | INDEXABLE | INDEX | ACTIVE |
| support | /support | MIXED | INDEXABLE | INDEX | ACTIVE |
| elite | /elite | INDEX | INDEXABLE | INDEX | PILOT |
| materials_hub | /materiais | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| material_detail | /materiais/{slug} | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| material_legacy | /material/{id}, /material/{id}/{*slug} | REDIRECT | PERMANENT_NOINDEX | NOINDEX | PERMANENT |
| marketplace | /marketplace | NOINDEX | PERMANENT_NOINDEX | NOINDEX | PERMANENT |
| ranking | /ranking, /ranking/{id}, /ranking/{id}/{*slug} | MIXED | CONDITIONAL | INDEX | PILOT |
| privacy | /privacy | INDEX | INDEXABLE | INDEX | ACTIVE |
| terms | /terms | INDEX | INDEXABLE | INDEX | ACTIVE |
| marketing_landing | /l/{slug} | INDEX | CONDITIONAL | INDEX | PILOT |
| topic_detail | /topicos/{slug} | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| subject_detail | /assuntos/{slug} | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| organizations_hub | /orgaos | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| organization_detail | /orgaos/{slug} | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| contest_detail | /concursos/{slug} | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| open_contests | /concursos-abertos | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| careers_hub | /carreiras | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| career_detail | /carreiras/{slug} | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| positions_hub | /cargos | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| position_detail | /cargos/{slug} | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| simulations_hub | /simulados | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| simulation_detail | /simulados/{slug} | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| law_article_detail | /lei-comentada/{lawSlug}/{articleSlug} | NOINDEX | INDEXABLE | INDEX | ACTIVE |
| search | /busca | NOINDEX | PERMANENT_NOINDEX | NOINDEX | PERMANENT |
| facet | /questoes | NOINDEX | PERMANENT_NOINDEX | NOINDEX | PERMANENT |
| auth | /auth, /activate, /activation, /confirm, /confirm-email, /forgot-password, /reset-password, /recover, /reset, /verify-email | PRIVATE | PERMANENT_NOINDEX | NOINDEX | PERMANENT |
| account | /profile/{*path}, /dashboard, /notifications, /subscription/{*path}, /plans, /read/{*path}, /partner-dashboard | PRIVATE | PERMANENT_NOINDEX | NOINDEX | PERMANENT |
| private_tools | /simulation, /cronograma, /flashcards, /x-ray, /bank-analysis, /performance/{*path}, /levels | PRIVATE | PERMANENT_NOINDEX | NOINDEX | PERMANENT |
| checkout | /checkout/{*path} | PRIVATE | PERMANENT_NOINDEX | NOINDEX | PERMANENT |
| admin | /admin/{*path} | PRIVATE | PERMANENT_NOINDEX | NOINDEX | PERMANENT |
| api | /api/{*path} | PRIVATE | PERMANENT_NOINDEX | NOINDEX | PERMANENT |
| setup | /setup | PRIVATE | PERMANENT_NOINDEX | NOINDEX | PERMANENT |
| temporary_promo | /promo/{slug} | MIXED | PERMANENT_NOINDEX | NOINDEX | PERMANENT |
| legacy_alias | /practice, /questions, /question/{*path}, /blog/provas/{*path}, /changelog | REDIRECT | PERMANENT_NOINDEX | NOINDEX | PERMANENT |
| not_found | /{*path} | NOINDEX | PERMANENT_NOINDEX | NOINDEX | PERMANENT |

## G. 40 TARGET_INDEX

| Família | Rotas | Readiness |
| --- | --- | --- |
| home | / | page.public_ready |
| questions_hub | /questoes | page.public_ready |
| question_detail | /questoes/{id}/{slug}, /questoes/{id} | entity.public_ready |
| discipline_hub | /disciplinas | page.public_ready |
| discipline_detail | /disciplinas/{slug} | taxonomy.hierarchy_ready |
| board_hub | /bancas | page.public_ready |
| board_detail | /bancas/{slug} | entity.public_ready |
| exam_hub | /provas | page.public_ready |
| exam_detail | /provas/{slug} | entity.public_ready |
| contest_hub | /concursos | contest.catalog_ready |
| law_hub | /lei-comentada | module.public_ready |
| law_detail | /lei-comentada/{slug} | entity.public_ready |
| blog_hub | /blog | page.public_ready |
| blog_article | /blog/{slug} | entity.public_ready |
| blog_category | /blog/categoria/{slug} | blog_taxonomy.public_posts_ready |
| blog_author | /blog/autor/{id} | author.editorial_identity_ready |
| plans | /planos | page.public_ready |
| faq | /faq | page.public_ready |
| news | /novidades | page.public_ready |
| support | /support | page.public_ready |
| elite | /elite | page.ssr_ready |
| materials_hub | /materiais | material.directory_ready |
| material_detail | /materiais/{slug} | material.public_ready |
| ranking | /ranking, /ranking/{id}, /ranking/{id}/{*slug} | ranking.public_privacy_ready |
| privacy | /privacy | page.public_ready |
| terms | /terms | page.public_ready |
| marketing_landing | /l/{slug} | landing.editorial_ready |
| topic_detail | /topicos/{slug} | taxonomy.hierarchy_ready |
| subject_detail | /assuntos/{slug} | taxonomy.hierarchy_ready |
| organizations_hub | /orgaos | page.public_ready |
| organization_detail | /orgaos/{slug} | entity.public_ready |
| contest_detail | /concursos/{slug} | contest.public_ready |
| open_contests | /concursos-abertos | contest.catalog_ready |
| careers_hub | /carreiras | page.public_ready |
| career_detail | /carreiras/{slug} | professional.public_ready |
| positions_hub | /cargos | page.public_ready |
| position_detail | /cargos/{slug} | professional.public_ready |
| simulations_hub | /simulados | simulation.catalog_ready |
| simulation_detail | /simulados/{slug} | simulation.public_ready |
| law_article_detail | /lei-comentada/{lawSlug}/{articleSlug} | law_article.official_text_ready |

## H. 15 PERMANENT_NOINDEX

| Família | Rotas | Sitemap |
| --- | --- | --- |
| blog_tag | /blog/tag/{slug} | EXCLUDE |
| material_legacy | /material/{id}, /material/{id}/{*slug} | EXCLUDE |
| marketplace | /marketplace | EXCLUDE |
| search | /busca | EXCLUDE |
| facet | /questoes | EXCLUDE |
| auth | /auth, /activate, /activation, /confirm, /confirm-email, /forgot-password, /reset-password, /recover, /reset, /verify-email | EXCLUDE |
| account | /profile/{*path}, /dashboard, /notifications, /subscription/{*path}, /plans, /read/{*path}, /partner-dashboard | EXCLUDE |
| private_tools | /simulation, /cronograma, /flashcards, /x-ray, /bank-analysis, /performance/{*path}, /levels | EXCLUDE |
| checkout | /checkout/{*path} | EXCLUDE |
| admin | /admin/{*path} | EXCLUDE |
| api | /api/{*path} | EXCLUDE |
| setup | /setup | EXCLUDE |
| temporary_promo | /promo/{slug} | EXCLUDE |
| legacy_alias | /practice, /questions, /question/{*path}, /blog/provas/{*path}, /changelog | EXCLUDE |
| not_found | /{*path} | EXCLUDE |

## I. Full crawl architecture

Crawler HTTP somente leitura, limitado a 300 URLs e profundidade 4, com seeds, representantes, descoberta por links, aliases, casos de erro, query variants, robots e sitemap.

## J. Seeds

20 seeds: `/`, `/questoes`, `/disciplinas`, `/bancas`, `/orgaos`, `/provas`, `/concursos`, `/concursos-abertos`, `/carreiras`, `/cargos`, `/simulados`, `/lei-comentada`, `/materiais`, `/blog`, `/planos`, `/faq`, `/novidades`, `/support`, `/privacy`, `/terms`.

## K. Discovered graph

60 URLs auditadas; 6 descobertas pelo grafo; 47 canonicals únicos.

## L. Crawl depth

Profundidade máxima configurada: 4. Maior profundidade observada: 3.

## M. Crawl traps

Queries não entram na fila de descoberta; tracking parameters e fragments são normalizados; máximo de URLs é limitado. Traps detectadas: 0.

## N. URL normalization

Remove fragmentos, parâmetros de tracking, barras duplicadas e trailing slash não raiz; ordena query parameters e rejeita esquemas inseguros/origens externas.

## O. Internal-link health

Broken: 0; redirects estruturais: 0; alvos privados: 0.

## P. Redirects

5 aliases auditados; todos com status e target esperados.

## Q. Redirect chains

Chains inesperadas maiores que um hop: 0. Loops: 0.

## R. Aliases

Aliases históricos testados com 308, canonical atual e um único hop; nenhum alias foi usado como link estrutural.

## S. Broken links

Links estruturais quebrados: 0.

## T. Private targets

Links estruturais para destinos privados: 0.

## U. Orphans

O laboratório não detectou orphan causado pela arquitetura. O censo completo permanece gate obrigatório após a carga real.

## V. Index pipeline

Existence → PublicationDecision → LaunchMode → FamilyEligibility → InstanceReadiness → Quality quando aplicável → canonical/resolution → indexability → sitemap.

## W. PublicationDecision

Entidades draft, unpublished, internal ou protected permanecem fora de indexação e sitemap.

## X. PRELAUNCH

INDEX detectado: 0. Modo efetivo permanece PRELAUNCH.

## Y. GO_CANDIDATE

INDEX detectado: 0. O modo continua destinado a auditoria, sem promoção em massa.

## Z. Production simulation

36 famílias simuladas como INDEX quando READY; NOT_READY continua protegido.

## AA. Explicit NOINDEX

Explicit NOINDEX permanece autoridade negativa e não pode ser sobreposto por launch mode ou target futuro.

## AB. Readiness

Readiness permanece por instância e separado da elegibilidade estratégica da família.

## AC. Quality

Quality é aplicada somente às famílias contratualmente configuradas e não substitui identidade, publicação ou readiness.

## AD. Canonical host

Autoridade: `https://concursomestre.com`. Mismatches no laboratório: 0.

## AE. Noncanonical hosts

Simulação e contratos preservam NOINDEX em origem não canônica. Nenhum host alternativo foi promovido.

## AF. Canonical audit

Canonicals inválidos, múltiplos, para redirect ou 404: 0. Query canonical poluída: 0.

## AG. HTTP status

53 respostas 200 no crawl, 5 redirects auditados e 8 hard 404 de fixtures negativas.

## AH. Hard 404

8 casos negativos retornaram 404, sem canonical.

## AI. Soft 404

Novos defeitos arquiteturais de soft 404: 0. O fixture de blog foi corrigido para não resolver slugs desconhecidos como artigo válido.

## AJ. 410

Casos 410 observados: 0. Nenhuma remoção real exigia 410 neste dataset de laboratório.

## AK. SSR

Harness cobriu 37 rotas em desktop/mobile; conteúdo SEO crítico permaneceu no HTML inicial.

## AL. Initial HTML

Título, canonical, robots, H1, links, breadcrumbs e JSON-LD foram extraídos do documento inicial pelo reporter.

## AM. CSR audit

Nenhuma família TARGET_INDEX regrediu para autoridade exclusivamente client-side. `/busca` usa SSR para o conteúdo funcional inicial.

## AN. Hydration

Execuções: 74; divergência semântica: 0; divergência de segurança: 0; falhas: 0.

## AO. Client authority

`useDocumentSeo`, mutações client-side de title/canonical/robots e árvore paralela de SEO não foram introduzidos.

## AP. Robots meta

52 documentos do crawl declararam NOINDEX; toda superfície pública rastreável em PRELAUNCH permaneceu protegida.

## AQ. X-Robots

O header transversal permaneceu coerente com PRELAUNCH e com superfícies protegidas. Conflitos observados: 0.

## AR. robots.txt

HTTP 200, sem `Disallow: /` global e sem exposição de Sitemap em PRELAUNCH.

## AS. Sitemap state

Endpoint público em PRELAUNCH retornou 503 fail-closed; URLs de produção publicadas: 0.

## AT. Sitemap simulation

Somente família TARGET_INDEX + READY + publicação permitida + canonical válido + render 200 torna-se elegível em PRODUCTION.

## AU. Sitemap crawl

O sitemap público não foi crawleado como inventário porque permanece indisponível em PRELAUNCH por contrato.

## AV. Sitemap intersections

Sitemap ∩ NOINDEX/redirect/404/410/private/NOT_READY/PERMANENT_NOINDEX: 0 na simulação.

## AW. Sitemap duplicates

Duplicatas simuladas: 0.

## AX. Lastmod/XML

Regras anteriores foram preservadas: sem `NOW()` artificial; XML e lastmod real permanecem gates de dataset/produção.

## AY. Internal-link graph

44 famílias no grafo; identidade e relações continuam contratuais, sem inferência por nome.

## AZ. 67 relations

| ID | Origem | Destino | Autoridade |
| --- | --- | --- | --- |
|  | home | questions_hub | curated primary navigation |
|  | home | discipline_hub | curated primary navigation |
|  | home | board_hub | curated primary navigation |
|  | home | blog_hub | curated primary navigation |
|  | discipline_hub | discipline_detail | public taxonomy directory type=assunto level=materia |
|  | board_hub | board_detail | public taxonomy directory type=banca |
|  | organizations_hub | organization_detail | public taxonomy directory type=orgao |
|  | exam_hub | exam_detail | public exam directory |
|  | contest_hub | contest_detail | published canonical contests |
|  | open_contests | contest_detail | canonical contest status and dates |
|  | careers_hub | career_detail | public filters type=carreira |
|  | positions_hub | position_detail | public filters type=cargo |
|  | simulations_hub | simulation_detail | published public simulations |
|  | law_hub | law_detail | public legal commentaries |
|  | materials_hub | material_detail | published public materials |
|  | blog_hub | blog_article | published blog articles |
|  | question_detail | discipline_detail | question_filters + taxonomy level |
|  | question_detail | topic_detail | question_filters + valid hierarchy |
|  | question_detail | subject_detail | question_filters + valid hierarchy |
|  | question_detail | position_detail | question_filters type=cargo + readiness |
|  | question_detail | career_detail | question_filters type=carreira + readiness |
|  | discipline_detail | topic_detail | filters.parent_id + hierarchy readiness |
|  | topic_detail | subject_detail | bounded canonical hierarchy |
|  | discipline_detail | question_detail | public question_filters |
|  | topic_detail | question_detail | public question_filters |
|  | subject_detail | question_detail | public question_filters |
|  | board_detail | exam_detail | prova_filters |
|  | organization_detail | question_detail | public question_filters type=orgao |
|  | organization_detail | position_detail | filter_relationships relation_type=cargo_organization |
|  | organization_detail | discipline_detail | public questions joined to canonical materia |
|  | organization_detail | board_detail | public provas explicitly related to organization and banca |
|  | organization_detail | contest_detail | contest_organizations |
|  | organization_detail | exam_detail | prova_filters |
|  | exam_detail | board_detail | prova_filters type=banca |
|  | exam_detail | organization_detail | prova_filters type=orgao |
|  | exam_detail | contest_detail | contest_exams |
|  | exam_detail | position_detail | prova_filters type=cargo |
|  | exam_detail | career_detail | exam cargo filters joined to explicit cargo_career |
|  | contest_detail | organization_detail | contest_organizations |
|  | contest_detail | board_detail | contests.board_filter_id |
|  | contest_detail | position_detail | contest_positions.role_filter_id |
|  | contest_detail | exam_detail | contest_exams |
|  | contest_detail | question_detail | contest_exams joined to public question_provas |
|  | career_detail | position_detail | filter_relationships relation_type=cargo_career |
|  | career_detail | contest_detail | explicit career cargo joined to contest_positions |
|  | career_detail | organization_detail | explicit career cargo joined to cargo_organization |
|  | career_detail | question_detail | question cargo filter joined to explicit cargo_career |
|  | position_detail | career_detail | filter_relationships relation_type=cargo_career |
|  | position_detail | contest_detail | contest_positions.role_filter_id |
|  | position_detail | organization_detail | filter_relationships relation_type=cargo_organization |
|  | position_detail | exam_detail | prova_filters type=cargo |
|  | position_detail | question_detail | public question_filters type=cargo |
|  | position_detail | board_detail | explicit related public provas or contests |
|  | simulation_detail | contest_detail | public_simulation_contests |
|  | simulation_detail | exam_detail | public_simulation_exams |
|  | simulation_detail | question_detail | published simulation question composition |
|  | law_detail | law_article_detail | legal_commentary_articles.law_id |
|  | law_article_detail | law_article_detail | ordered articles in same law |
|  | material_detail | discipline_detail | materials.subject_id explicit level |
|  | material_detail | topic_detail | materials.topic_id explicit level |
|  | blog_article | blog_category | blog article category relation |
|  | blog_article | blog_tag | blog article tag relation |
|  | blog_article | blog_author | published article author identity |
|  | blog_article | blog_article | editorial related article collection |
|  | blog_category | blog_article | published article category relation |
|  | blog_tag | blog_article | published article tag relation |
|  | blog_author | blog_article | published article author identity |

## BA. 9 rejected inferences

| ID | Origem | Destino | Motivo |
| --- | --- | --- | --- |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

## BB. Breadcrumbs

Breadcrumb visual e BreadcrumbList foram confrontados no HTML inicial. Divergências arquiteturais bloqueantes: 0; validação censitária com dados reais permanece pendente.

## BC. Structured data

JSON-LD inválido, duplicado ou com sentinel protegido: 0. A validação de cobertura integral permanece gate de dados reais.

## BD. Practice taxonomies

Disciplina, tópico e assunto mantêm identidade persistida, hierarquia, hard 404 e PRELAUNCH NOINDEX.

## BE. Questions

Hub, detalhe e facetas preservam separação estrutural/funcional; respostas e conteúdo protegido não vazaram.

## BF. Boards

Hub e detalhe permanecem por `filters.type=banca`, com relações explícitas e sem cross-resolution.

## BG. Organizations

Hub e detalhe permanecem por `filters.type=orgao`; relações e slugs persistidos foram preservados.

## BH. Exams

Hub/detalhe e aliases históricos mantêm slug persistido, SSR e links canônicos.

## BI. Contests

Somente Contest canônico define identidade; o crawl não reintroduziu combinação sintética de filtros.

## BJ. Careers/Cargos

Identidade permanece em filters tipados e relações explícitas; nenhuma inferência canônica por nome.

## BK. Simulations

Hub e detalhe público permanecem separados da ferramenta privada; publicação/readiness governam exposição.

## BL. Laws/Articles

Lei e artigo individual preservam texto oficial público, canonical persistido e hard 404.

## BM. Materials/Marketplace

Materiais públicos continuam TARGET_INDEX; Marketplace funcional permanece PERMANENT_NOINDEX.

## BN. Blog/Post/Category/Tag

Post e categoria mantêm target contratual; tag permanece PERMANENT_NOINDEX. Slug de post inexistente retorna hard 404 no fixture corrigido.

## BO. Query/facets

8 variantes auditadas; todas permaneceram NOINDEX e com canonical limpo.

## BP. Pagination

Paginação funcional não cria canonical alternativo indexável; escala e cobertura reais serão reavaliadas com o dataset definitivo.

## BQ. Performance regressions

Regressões bloqueantes no harness: 0.

## BR. Billing lazy regression

Gate da Fase 7 preservado: PASS (suíte Vitest).

## BS. Tracker regression

Gate da Fase 7 preservado: PASS (suíte Vitest).

## BT. Cache security

Nenhum sentinel ou indício de conteúdo privado em HTML/RSC observado. Validação cross-user real permanece gate de produção.

## BU. N+1

Nenhum novo fetch por card foi introduzido pela Fase 8; orçamento estrutural permanece coberto pelos testes das fases anteriores.

## BV. Security sentinels

Violações: 0.

## BW. Full crawl matrix

| URL | Origem | Depth | Família | HTTP | Location | Canonical | Robots | X-Robots | H1 | Schemas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / |  | 0 | home | 200 |  | https://concursomestre.com | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | Organization, WebSite |
| /questoes |  | 0 | questions_hub | 200 |  | https://concursomestre.com/questoes | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList |
| /disciplinas |  | 0 | discipline_hub | 200 |  | https://concursomestre.com/disciplinas | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList |
| /bancas |  | 0 | board_hub | 200 |  | https://concursomestre.com/bancas | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList |
| /orgaos |  | 0 | organizations_hub | 200 |  | https://concursomestre.com/orgaos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList |
| /provas |  | 0 | exam_hub | 200 |  | https://concursomestre.com/provas | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList |
| /concursos |  | 0 | contest_hub | 200 |  | https://concursomestre.com/concursos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList, ItemList |
| /concursos-abertos |  | 0 | open_contests | 200 |  | https://concursomestre.com/concursos-abertos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList, ItemList |
| /carreiras |  | 0 | careers_hub | 200 |  | https://concursomestre.com/carreiras | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList, ItemList |
| /cargos |  | 0 | positions_hub | 200 |  | https://concursomestre.com/cargos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList, ItemList |
| /simulados |  | 0 | simulations_hub | 200 |  | https://concursomestre.com/simulados | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList, ItemList |
| /lei-comentada |  | 0 | law_hub | 200 |  | https://concursomestre.com/lei-comentada | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList |
| /materiais |  | 0 | materials_hub | 200 |  | https://concursomestre.com/materiais | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList, ItemList |
| /blog |  | 0 | blog_hub | 200 |  | https://concursomestre.com/blog | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList |
| /planos |  | 0 | plans | 200 |  | https://concursomestre.com/planos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList |
| /faq |  | 0 | faq | 200 |  | https://concursomestre.com/faq | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | FAQPage, BreadcrumbList |
| /novidades |  | 0 | news | 200 |  | https://concursomestre.com/novidades | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList |
| /support |  | 0 | support | 200 |  | https://concursomestre.com/support | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList |
| /privacy |  | 0 | privacy | 200 |  | https://concursomestre.com/privacy | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList |
| /terms |  | 0 | terms | 200 |  | https://concursomestre.com/terms | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList |
| /questoes/67813/art-5o-acao-e-controle |  | 0 | question_detail | 200 |  | https://concursomestre.com/questoes/67813/art-5o-acao-e-controle | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList |
| /disciplinas/direito-constitucional |  | 0 | discipline_detail | 200 |  | https://concursomestre.com/disciplinas/direito-constitucional | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, ItemList |
| /topicos/controle-de-constitucionalidade |  | 0 | topic_detail | 200 |  | https://concursomestre.com/topicos/controle-de-constitucionalidade | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, ItemList |
| /assuntos/controle-concentrado |  | 0 | subject_detail | 200 |  | https://concursomestre.com/assuntos/controle-concentrado | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, ItemList |
| /bancas/cebraspe |  | 0 | board_detail | 200 |  | https://concursomestre.com/bancas/cebraspe | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, Organization |
| /orgaos/orgao-de-teste |  | 0 | organization_detail | 200 |  | https://concursomestre.com/orgaos/orgao-de-teste | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, Organization, BreadcrumbList, ItemList |
| /provas/prova-ssr-2026 |  | 0 | exam_detail | 200 |  | https://concursomestre.com/provas/prova-ssr-2026 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList |
| /concursos/concurso-canonico-2026 |  | 0 | contest_detail | 200 |  | https://concursomestre.com/concursos/concurso-canonico-2026 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, ItemList |
| /carreiras/carreira-fiscal |  | 0 | career_detail | 200 |  | https://concursomestre.com/carreiras/carreira-fiscal | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, ItemList |
| /cargos/analista |  | 0 | position_detail | 200 |  | https://concursomestre.com/cargos/analista | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, ItemList |
| /simulados/simulado-publico-constitucional |  | 0 | simulation_detail | 200 |  | https://concursomestre.com/simulados/simulado-publico-constitucional | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, ItemList |
| /lei-comentada/constituicao-federal |  | 0 | law_detail | 200 |  | https://concursomestre.com/lei-comentada/constituicao-federal | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList |
| /lei-comentada/constituicao-federal/artigo-5 |  | 0 | law_article_detail | 200 |  | https://concursomestre.com/lei-comentada/constituicao-federal/artigo-5 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList |
| /materiais/guia-publico-de-estudo |  | 0 | material_detail | 200 |  | https://concursomestre.com/materiais/guia-publico-de-estudo | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList |
| /blog/noticia-ssr |  | 0 | blog_article | 200 |  | https://concursomestre.com/blog/noticia-ssr | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | NewsArticle, BreadcrumbList |
| /blog/categoria/concursos |  | 0 | blog_category | 200 |  | https://concursomestre.com/blog/categoria/concursos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList |
| /blog/autor/staff-1 |  | 0 | blog_author | 200 |  | https://concursomestre.com/blog/autor/staff-1 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList |
| /elite |  | 0 | elite | 200 |  | https://concursomestre.com/elite | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 0 | WebPage, BreadcrumbList |
| /ranking |  | 0 | ranking | 200 |  |  | noindex, nofollow, noindex, nofollow | noindex, follow | 1 |  |
| /l/fixture-nao-publicada |  | 0 | marketing_landing | 404 |  |  |  | noindex, follow | 0 |  |
| /blog/tag/nordeste |  | 0 | blog_tag | 200 |  | https://concursomestre.com/blog/tag/nordeste | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList |
| /material/501/guia-publico-de-estudo |  | 0 | material_legacy | 404 |  |  |  | noindex, nofollow | 0 |  |
| /marketplace |  | 0 | marketplace | 200 |  | https://concursomestre.com/marketplace | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | BreadcrumbList |
| /busca |  | 0 | search | 200 |  | https://concursomestre.com/busca | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList |
| /auth |  | 0 | auth | 200 |  |  | noindex, nofollow, noindex, nofollow | noindex, nofollow | 1 |  |
| /profile |  | 0 | account | 200 |  |  | noindex, nofollow, noindex, nofollow | noindex, nofollow | 0 |  |
| /simulation |  | 0 | private_tools | 200 |  |  | noindex, nofollow, noindex, nofollow | noindex, nofollow | 0 |  |
| /checkout/elite |  | 0 | checkout | 200 |  |  | noindex, nofollow, noindex, nofollow | noindex, nofollow | 1 |  |
| /admin |  | 0 | admin | 404 |  |  |  | noindex, nofollow | 0 |  |
| /api/seo/sitemap-status |  | 0 | api | 503 |  |  |  | noindex, nofollow | 0 |  |
| /setup |  | 0 | setup | 404 |  |  |  | noindex, nofollow | 0 |  |
| /promo/fixture-inativa |  | 0 | temporary_promo | 200 |  | https://concursomestre.com/promo | noindex, nofollow, noindex, nofollow | noindex, follow | 1 |  |
| /practice |  | 0 | legacy_alias | 308 | /questoes |  |  |  | 0 |  |
| /fase-8-rota-inexistente |  | 0 | not_found | 404 |  |  |  | noindex, nofollow | 0 |  |
| /materiais/material-gratuito-publico | /materiais | 1 | material_detail | 200 |  | https://concursomestre.com/materiais/material-gratuito-publico | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList |
| /materiais/material-historico | /materiais | 1 | material_detail | 200 |  | https://concursomestre.com/materiais/material-historico | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList |
| /blog/feed.xml | /blog | 1 | blog_article | 200 |  |  |  | noindex, follow | 0 |  |
| /lei-comentada/constituicao-federal/artigo-5-a | /lei-comentada/constituicao-federal/artigo-5 | 1 | law_article_detail | 200 |  | https://concursomestre.com/lei-comentada/constituicao-federal/artigo-5-a | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList |
| /lei-comentada/constituicao-federal/artigo-5-b | /lei-comentada/constituicao-federal/artigo-5-a | 2 | law_article_detail | 200 |  | https://concursomestre.com/lei-comentada/constituicao-federal/artigo-5-b | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList |
| /lei-comentada/constituicao-federal/artigo-6 | /lei-comentada/constituicao-federal/artigo-5-b | 3 | law_article_detail | 200 |  | https://concursomestre.com/lei-comentada/constituicao-federal/artigo-6 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList |

## BX. Family coverage matrix

| Família | Rota | Identidade | Elegibilidade | Target | PRELAUNCH | Sitemap | Launch | Representante | HTTP | Cobertura |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home | / | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | / | 200 | REPRESENTATIVE |
| questions_hub | /questoes | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /questoes | 200 | REPRESENTATIVE |
| question_detail | /questoes/{id}/{slug}, /questoes/{id} | questions.id + persisted public slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /questoes/67813/art-5o-acao-e-controle | 200 | REPRESENTATIVE |
| discipline_hub | /disciplinas | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /disciplinas | 200 | REPRESENTATIVE |
| discipline_detail | /disciplinas/{slug} | filters.id type=assunto level=materia; filters.slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /disciplinas/direito-constitucional | 200 | REPRESENTATIVE |
| board_hub | /bancas | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /bancas | 200 | REPRESENTATIVE |
| board_detail | /bancas/{slug} | filters.id type=banca; filters.slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /bancas/cebraspe | 200 | REPRESENTATIVE |
| exam_hub | /provas | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /provas | 200 | REPRESENTATIVE |
| exam_detail | /provas/{slug} | provas.id; persisted slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /provas/prova-ssr-2026 | 200 | REPRESENTATIVE |
| contest_hub | /concursos | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /concursos | 200 | REPRESENTATIVE |
| law_hub | /lei-comentada | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /lei-comentada | 200 | REPRESENTATIVE |
| law_detail | /lei-comentada/{slug} | legal_commentaries.id; persisted slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /lei-comentada/constituicao-federal | 200 | REPRESENTATIVE |
| blog_hub | /blog | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /blog | 200 | REPRESENTATIVE |
| blog_article | /blog/{slug} | blog_articles.id; persisted slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /blog/noticia-ssr | 200 | REPRESENTATIVE |
| blog_category | /blog/categoria/{slug} | blog_categories.id; persisted slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /blog/categoria/concursos | 200 | REPRESENTATIVE |
| blog_tag | /blog/tag/{slug} | blog_tags.id; persisted slug | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /blog/tag/nordeste | 200 | REPRESENTATIVE |
| blog_author | /blog/autor/{id} | public editorial author id | CONDITIONAL | INDEX | NOINDEX | INCLUDE_WHEN_READY | PILOT | /blog/autor/staff-1 | 200 | REPRESENTATIVE |
| plans | /planos | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /planos | 200 | REPRESENTATIVE |
| faq | /faq | page + visible FAQ_DATA | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /faq | 200 | REPRESENTATIVE |
| news | /novidades | page + published changelog entries | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /novidades | 200 | REPRESENTATIVE |
| support | /support | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /support | 200 | REPRESENTATIVE |
| elite | /elite | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | PILOT | /elite | 200 | REPRESENTATIVE |
| materials_hub | /materiais | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /materiais | 200 | REPRESENTATIVE |
| material_detail | /materiais/{slug} | materials.id; materials.slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /materiais/guia-publico-de-estudo | 200 | REPRESENTATIVE |
| material_legacy | /material/{id}, /material/{id}/{*slug} | not_applicable | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /material/501/guia-publico-de-estudo | 404 | REPRESENTATIVE |
| marketplace | /marketplace | functional catalog | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /marketplace | 200 | REPRESENTATIVE |
| ranking | /ranking, /ranking/{id}, /ranking/{id}/{*slug} | public ranking id when a detail is resolved | CONDITIONAL | INDEX | NOINDEX | INCLUDE_WHEN_READY | PILOT | /ranking | 200 | REPRESENTATIVE |
| privacy | /privacy | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /privacy | 200 | REPRESENTATIVE |
| terms | /terms | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /terms | 200 | REPRESENTATIVE |
| marketing_landing | /l/{slug} | persisted editorial landing slug | CONDITIONAL | INDEX | NOINDEX | INCLUDE_WHEN_READY | PILOT | /l/fixture-nao-publicada | 404 | REPRESENTATIVE |
| topic_detail | /topicos/{slug} | filters.id type=assunto level=topico; filters.slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /topicos/controle-de-constitucionalidade | 200 | REPRESENTATIVE |
| subject_detail | /assuntos/{slug} | filters.id type=assunto level=assunto; filters.slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /assuntos/controle-concentrado | 200 | REPRESENTATIVE |
| organizations_hub | /orgaos | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /orgaos | 200 | REPRESENTATIVE |
| organization_detail | /orgaos/{slug} | filters.id type=orgao; filters.slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /orgaos/orgao-de-teste | 200 | REPRESENTATIVE |
| contest_detail | /concursos/{slug} | contests.id; contests.slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /concursos/concurso-canonico-2026 | 200 | REPRESENTATIVE |
| open_contests | /concursos-abertos | contest domain status and dates | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /concursos-abertos | 200 | REPRESENTATIVE |
| careers_hub | /carreiras | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /carreiras | 200 | REPRESENTATIVE |
| career_detail | /carreiras/{slug} | filters.id type=carreira; filters.slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /carreiras/carreira-fiscal | 200 | REPRESENTATIVE |
| positions_hub | /cargos | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /cargos | 200 | REPRESENTATIVE |
| position_detail | /cargos/{slug} | filters.id type=cargo; filters.slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /cargos/analista | 200 | REPRESENTATIVE |
| simulations_hub | /simulados | page | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /simulados | 200 | REPRESENTATIVE |
| simulation_detail | /simulados/{slug} | public_simulations.id; persisted slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /simulados/simulado-publico-constitucional | 200 | REPRESENTATIVE |
| law_article_detail | /lei-comentada/{lawSlug}/{articleSlug} | legal_commentary_articles.id; persisted slug | INDEXABLE | INDEX | NOINDEX | INCLUDE_WHEN_READY | ACTIVE | /lei-comentada/constituicao-federal/artigo-5 | 200 | REPRESENTATIVE |
| search | /busca | functional search query | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /busca | 200 | REPRESENTATIVE |
| facet | /questoes | functional filter parameters | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /questoes?materia=20 |  | REPRESENTATIVE |
| auth | /auth, /activate, /activation, /confirm, /confirm-email, /forgot-password, /reset-password, /recover, /reset, /verify-email | not_applicable | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /auth | 200 | REPRESENTATIVE |
| account | /profile/{*path}, /dashboard, /notifications, /subscription/{*path}, /plans, /read/{*path}, /partner-dashboard | not_applicable | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /profile | 200 | REPRESENTATIVE |
| private_tools | /simulation, /cronograma, /flashcards, /x-ray, /bank-analysis, /performance/{*path}, /levels | not_applicable | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /simulation | 200 | REPRESENTATIVE |
| checkout | /checkout/{*path} | not_applicable | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /checkout/elite | 200 | REPRESENTATIVE |
| admin | /admin/{*path} | not_applicable | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /admin | 404 | REPRESENTATIVE |
| api | /api/{*path} | not_applicable | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /api/seo/sitemap-status | 503 | REPRESENTATIVE |
| setup | /setup | not_applicable | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /setup | 404 | REPRESENTATIVE |
| temporary_promo | /promo/{slug} | not_applicable | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /promo/fixture-inativa | 200 | REPRESENTATIVE |
| legacy_alias | /practice, /questions, /question/{*path}, /blog/provas/{*path}, /changelog | not_applicable | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /practice | 308 | REPRESENTATIVE |
| not_found | /{*path} | not_applicable | PERMANENT_NOINDEX | NOINDEX | NOINDEX | EXCLUDE | PERMANENT | /fase-8-rota-inexistente | 404 | REPRESENTATIVE |

## BY. Redirect matrix

| Alias | Esperado | Target esperado | Real | Target real | Hops | Final |
| --- | --- | --- | --- | --- | --- | --- |
| /practice | 308 | /questoes | 308 | /questoes | 1 | 200 |
| /questions | 308 | /questoes | 308 | /questoes | 1 | 200 |
| /question/67813/art-5o-acao-e-controle | 308 | /questoes/67813/art-5o-acao-e-controle | 308 | /questoes/67813/art-5o-acao-e-controle | 1 | 200 |
| /blog/provas | 308 | /provas | 308 | /provas | 1 | 200 |
| /blog/provas/prova-ssr-2026 | 308 | /provas/prova-ssr-2026 | 308 | /provas/prova-ssr-2026 | 1 | 200 |

## BZ. Error matrix

| ID | URL | Esperado | Real | Canonical | Robots | X-Robots |
| --- | --- | --- | --- | --- | --- | --- |
| missing_question | /questoes/999999/nao-existe | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow | noindex, follow |
| missing_discipline | /disciplinas/nao-existe | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow | noindex, follow |
| missing_organization | /orgaos/nao-existe | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow | noindex, follow |
| missing_contest | /concursos/nao-existe | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow | noindex, follow |
| missing_simulation | /simulados/nao-existe | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow | noindex, follow |
| missing_law_article | /lei-comentada/constituicao-federal/artigo-999 | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow | noindex, follow |
| missing_material | /materiais/nao-existe | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow | noindex, follow |
| missing_blog_article | /blog/nao-existe | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow | noindex, follow |

## CA. SEO signal matrix

| URL | Família | HTTP | Title | Canonical | Robots | X-Robots | H1 | Schemas | Resultado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | home | 200 | ConcursoMestre \| Questoes, simulados, ranking e materiais para concursos | https://concursomestre.com | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | Organization, WebSite | HTML_AUDITED |
| /questoes | questions_hub | 200 | Questões de concursos para praticar \| ConcursoMestre | https://concursomestre.com/questoes | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList | HTML_AUDITED |
| /disciplinas | discipline_hub | 200 | Disciplinas para concursos \| ConcursoMestre | https://concursomestre.com/disciplinas | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList | HTML_AUDITED |
| /bancas | board_hub | 200 | Bancas de concursos \| ConcursoMestre | https://concursomestre.com/bancas | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList | HTML_AUDITED |
| /orgaos | organizations_hub | 200 | Órgãos públicos e concursos \| ConcursoMestre | https://concursomestre.com/orgaos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList | HTML_AUDITED |
| /provas | exam_hub | 200 | Provas de concursos por ano, região e estado \| ConcursoMestre | https://concursomestre.com/provas | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList | HTML_AUDITED |
| /concursos | contest_hub | 200 | Concursos públicos \| ConcursoMestre | https://concursomestre.com/concursos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList, ItemList | HTML_AUDITED |
| /concursos-abertos | open_contests | 200 | Concursos abertos \| ConcursoMestre | https://concursomestre.com/concursos-abertos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList, ItemList | HTML_AUDITED |
| /carreiras | careers_hub | 200 | Carreiras públicas \| ConcursoMestre | https://concursomestre.com/carreiras | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList, ItemList | HTML_AUDITED |
| /cargos | positions_hub | 200 | Cargos públicos \| ConcursoMestre | https://concursomestre.com/cargos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList, ItemList | HTML_AUDITED |
| /simulados | simulations_hub | 200 | Simulados \| ConcursoMestre | https://concursomestre.com/simulados | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList, ItemList | HTML_AUDITED |
| /lei-comentada | law_hub | 200 | Lei Comentada \| ConcursoMestre | https://concursomestre.com/lei-comentada | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList | HTML_AUDITED |
| /materiais | materials_hub | 200 | Materiais para concursos \| ConcursoMestre | https://concursomestre.com/materiais | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList, ItemList | HTML_AUDITED |
| /blog | blog_hub | 200 | Notícias de concursos, editais e carreiras \| ConcursoMestre | https://concursomestre.com/blog | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList | HTML_AUDITED |
| /planos | plans | 200 | Planos \| ConcursoMestre | https://concursomestre.com/planos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList | HTML_AUDITED |
| /faq | faq | 200 | Duvidas frequentes \| ConcursoMestre | https://concursomestre.com/faq | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | FAQPage, BreadcrumbList | HTML_AUDITED |
| /novidades | news | 200 | Novidades \| ConcursoMestre | https://concursomestre.com/novidades | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList | HTML_AUDITED |
| /support | support | 200 | Suporte \| ConcursoMestre | https://concursomestre.com/support | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList | HTML_AUDITED |
| /privacy | privacy | 200 | Politica de privacidade \| ConcursoMestre | https://concursomestre.com/privacy | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList | HTML_AUDITED |
| /terms | terms | 200 | Termos de uso \| ConcursoMestre | https://concursomestre.com/terms | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList | HTML_AUDITED |
| /questoes/67813/art-5o-acao-e-controle | question_detail | 200 | Questão comentada - CEBRASPE - 2026 - Direitos fundamentais | https://concursomestre.com/questoes/67813/art-5o-acao-e-controle | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList | HTML_AUDITED |
| /disciplinas/direito-constitucional | discipline_detail | 200 | Questões de Direito Constitucional \| ConcursoMestre | https://concursomestre.com/disciplinas/direito-constitucional | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, ItemList | HTML_AUDITED |
| /topicos/controle-de-constitucionalidade | topic_detail | 200 | Questões de Controle de Constitucionalidade — Direito Constitucional \| ConcursoMestre | https://concursomestre.com/topicos/controle-de-constitucionalidade | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, ItemList | HTML_AUDITED |
| /assuntos/controle-concentrado | subject_detail | 200 | Questões de Controle concentrado — Modelos de controle — Controle de Constitucionalidade — Direito Constitucional \| ConcursoMestre | https://concursomestre.com/assuntos/controle-concentrado | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, ItemList | HTML_AUDITED |
| /bancas/cebraspe | board_detail | 200 | CEBRASPE - Centro Brasileiro de Pesquisa em Avaliação - questões e provas \| ConcursoMestre | https://concursomestre.com/bancas/cebraspe | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, Organization | HTML_AUDITED |
| /orgaos/orgao-de-teste | organization_detail | 200 | Questões e provas de ODT \| ConcursoMestre | https://concursomestre.com/orgaos/orgao-de-teste | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, Organization, BreadcrumbList, ItemList | HTML_AUDITED |
| /provas/prova-ssr-2026 | exam_detail | 200 | Prova SSR 2026 \| ConcursoMestre | https://concursomestre.com/provas/prova-ssr-2026 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList | HTML_AUDITED |
| /concursos/concurso-canonico-2026 | contest_detail | 200 | Concurso Canônico 2026 - ODT \| ConcursoMestre | https://concursomestre.com/concursos/concurso-canonico-2026 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, ItemList | HTML_AUDITED |
| /carreiras/carreira-fiscal | career_detail | 200 | Concursos da Carreira Fiscal \| ConcursoMestre | https://concursomestre.com/carreiras/carreira-fiscal | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, ItemList | HTML_AUDITED |
| /cargos/analista | position_detail | 200 | Questões e concursos para Analista \| ConcursoMestre | https://concursomestre.com/cargos/analista | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, ItemList | HTML_AUDITED |
| /simulados/simulado-publico-constitucional | simulation_detail | 200 | Simulado de Direito Constitucional \| ConcursoMestre | https://concursomestre.com/simulados/simulado-publico-constitucional | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList, ItemList | HTML_AUDITED |
| /lei-comentada/constituicao-federal | law_detail | 200 | CF comentada | https://concursomestre.com/lei-comentada/constituicao-federal | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList | HTML_AUDITED |
| /lei-comentada/constituicao-federal/artigo-5 | law_article_detail | 200 | Art. 5º da Constituição Federal | https://concursomestre.com/lei-comentada/constituicao-federal/artigo-5 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList | HTML_AUDITED |
| /materiais/guia-publico-de-estudo | material_detail | 200 | Guia público de estudo \| ConcursoMestre | https://concursomestre.com/materiais/guia-publico-de-estudo | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList | HTML_AUDITED |
| /blog/noticia-ssr | blog_article | 200 | Notícia SSR de teste \| ConcursoMestre | https://concursomestre.com/blog/noticia-ssr | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | NewsArticle, BreadcrumbList | HTML_AUDITED |
| /blog/categoria/concursos | blog_category | 200 | Concursos: notícias e editais \| ConcursoMestre | https://concursomestre.com/blog/categoria/concursos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList | HTML_AUDITED |
| /blog/autor/staff-1 | blog_author | 200 | Artigos de Equipe ConcursoMestre \| ConcursoMestre | https://concursomestre.com/blog/autor/staff-1 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList | HTML_AUDITED |
| /elite | elite | 200 | ConcursoMestre Elite \| ConcursoMestre | https://concursomestre.com/elite | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 0 | WebPage, BreadcrumbList | HTML_AUDITED |
| /ranking | ranking | 200 | Rankings \| ConcursoMestre |  | noindex, nofollow, noindex, nofollow | noindex, follow | 1 |  | HTML_AUDITED |
| /l/fixture-nao-publicada | marketing_landing | 404 |  |  |  | noindex, follow | 0 |  | NOT_FOUND |
| /blog/tag/nordeste | blog_tag | 200 | Nordeste: notícias de concursos \| ConcursoMestre | https://concursomestre.com/blog/tag/nordeste | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList | HTML_AUDITED |
| /material/501/guia-publico-de-estudo | material_legacy | 404 |  |  |  | noindex, nofollow | 0 |  | NOT_FOUND |
| /marketplace | marketplace | 200 | Marketplace \| ConcursoMestre | https://concursomestre.com/marketplace | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | BreadcrumbList | HTML_AUDITED |
| /busca | search | 200 | Busca de questões de concursos \| ConcursoMestre | https://concursomestre.com/busca | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | CollectionPage, BreadcrumbList | HTML_AUDITED |
| /auth | auth | 200 | Entrar \| ConcursoMestre |  | noindex, nofollow, noindex, nofollow | noindex, nofollow | 1 |  | HTML_AUDITED |
| /profile | account | 200 | Perfil \| ConcursoMestre |  | noindex, nofollow, noindex, nofollow | noindex, nofollow | 0 |  | HTML_AUDITED |
| /simulation | private_tools | 200 | Simulado \| ConcursoMestre |  | noindex, nofollow, noindex, nofollow | noindex, nofollow | 0 |  | HTML_AUDITED |
| /checkout/elite | checkout | 200 | Checkout \| ConcursoMestre |  | noindex, nofollow, noindex, nofollow | noindex, nofollow | 1 |  | HTML_AUDITED |
| /admin | admin | 404 |  |  |  | noindex, nofollow | 0 |  | NOT_FOUND |
| /api/seo/sitemap-status | api | 503 |  |  |  | noindex, nofollow | 0 |  | NON_HTML_OR_PROTECTED |
| /setup | setup | 404 |  |  |  | noindex, nofollow | 0 |  | NOT_FOUND |
| /promo/fixture-inativa | temporary_promo | 200 | Promocao indisponivel \| ConcursoMestre | https://concursomestre.com/promo | noindex, nofollow, noindex, nofollow | noindex, follow | 1 |  | HTML_AUDITED |
| /practice | legacy_alias | 308 |  |  |  |  | 0 |  | REDIRECT |
| /fase-8-rota-inexistente | not_found | 404 |  |  |  | noindex, nofollow | 0 |  | NOT_FOUND |
| /materiais/material-gratuito-publico | material_detail | 200 | Material gratuito público \| ConcursoMestre | https://concursomestre.com/materiais/material-gratuito-publico | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList | HTML_AUDITED |
| /materiais/material-historico | material_detail | 200 | Material histórico \| ConcursoMestre | https://concursomestre.com/materiais/material-historico | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList | HTML_AUDITED |
| /blog/feed.xml | blog_article | 200 |  |  |  | noindex, follow | 0 |  | NON_HTML_OR_PROTECTED |
| /lei-comentada/constituicao-federal/artigo-5-a | law_article_detail | 200 | Art. 5º-A da Constituição Federal | https://concursomestre.com/lei-comentada/constituicao-federal/artigo-5-a | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList | HTML_AUDITED |
| /lei-comentada/constituicao-federal/artigo-5-b | law_article_detail | 200 | Art. 5º-B da Constituição Federal | https://concursomestre.com/lei-comentada/constituicao-federal/artigo-5-b | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList | HTML_AUDITED |
| /lei-comentada/constituicao-federal/artigo-6 | law_article_detail | 200 | Art. 6º da Constituição Federal | https://concursomestre.com/lei-comentada/constituicao-federal/artigo-6 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | 1 | WebPage, BreadcrumbList | HTML_AUDITED |

## CB. Indexability matrix

| Família | PRELAUNCH | GO_CANDIDATE | PRODUCTION READY | PRODUCTION NOT_READY | Sitemap READY |
| --- | --- | --- | --- | --- | --- |
| home | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| questions_hub | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| question_detail | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| discipline_hub | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| discipline_detail | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| board_hub | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| board_detail | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| exam_hub | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| exam_detail | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| contest_hub | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| law_hub | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| law_detail | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| blog_hub | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| blog_article | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| blog_category | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| blog_tag | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| blog_author | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| plans | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| faq | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| news | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| support | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| elite | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| materials_hub | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| material_detail | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| material_legacy | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| marketplace | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| ranking | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| privacy | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| terms | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| marketing_landing | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| topic_detail | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| subject_detail | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| organizations_hub | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| organization_detail | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| contest_detail | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| open_contests | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| careers_hub | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| career_detail | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| positions_hub | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| position_detail | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| simulations_hub | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| simulation_detail | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| law_article_detail | NOINDEX | NOINDEX | INDEX | NOINDEX | true |
| search | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| facet | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| auth | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| account | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| private_tools | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| checkout | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| admin | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| api | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| setup | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| temporary_promo | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| legacy_alias | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |
| not_found | NOINDEX | NOINDEX | NOINDEX | NOINDEX | false |

## CC. Sitemap matrix

| Família | PRODUCTION READY eligible |
| --- | --- |
| home | true |
| questions_hub | true |
| question_detail | true |
| discipline_hub | true |
| discipline_detail | true |
| board_hub | true |
| board_detail | true |
| exam_hub | true |
| exam_detail | true |
| contest_hub | true |
| law_hub | true |
| law_detail | true |
| blog_hub | true |
| blog_article | true |
| blog_category | true |
| blog_tag | false |
| blog_author | false |
| plans | true |
| faq | true |
| news | true |
| support | true |
| elite | false |
| materials_hub | true |
| material_detail | true |
| material_legacy | false |
| marketplace | false |
| ranking | false |
| privacy | true |
| terms | true |
| marketing_landing | false |
| topic_detail | true |
| subject_detail | true |
| organizations_hub | true |
| organization_detail | true |
| contest_detail | true |
| open_contests | true |
| careers_hub | true |
| career_detail | true |
| positions_hub | true |
| position_detail | true |
| simulations_hub | true |
| simulation_detail | true |
| law_article_detail | true |
| search | false |
| facet | false |
| auth | false |
| account | false |
| private_tools | false |
| checkout | false |
| admin | false |
| api | false |
| setup | false |
| temporary_promo | false |
| legacy_alias | false |
| not_found | false |

## CD. Internal-link matrix

| Origem | Href | Destino | Família | Estrutural | Texto |
| --- | --- | --- | --- | --- | --- |
| / | / | / | home | false | ConcursoMestre |
| / | #recursos | / | home | false | Recursos |
| / | /disciplinas | /disciplinas | discipline_hub | false | Disciplinas |
| / | /bancas | /bancas | board_hub | false | Bancas |
| / | #planos | / | home | false | Planos |
| / | #depoimentos | / | home | false | Depoimentos |
| / | /blog | /blog | blog_hub | false | Blog |
| / | /auth?mode=login | /auth?mode=login | auth | false | Entrar |
| / | /auth?mode=signup | /auth?mode=signup | auth | false | Começar grátis |
| / | /auth?mode=signup | /auth?mode=signup | auth | false | Começar grátis |
| / | #planos | / | home | true | Ver planos |
| / | /auth?mode=signup | /auth?mode=signup | auth | false | Começar grátis |
| / | / | / | home | false | ConcursoMestre |
| / | /disciplinas | /disciplinas | discipline_hub | false | Disciplinas |
| / | /bancas | /bancas | board_hub | false | Bancas |
| / | /#recursos | / | home | false | Recursos |
| / | /#planos | / | home | false | Planos |
| / | /#depoimentos | / | home | false | Depoimentos |
| / | /blog | /blog | blog_hub | false | Blog |
| / | /novidades | /novidades | news | false | Novidades |
| / | /support | /support | support | false | Central de ajuda |
| / | /support | /support | support | false | Fale conosco |
| / | /terms | /terms | terms | false | Termos de uso |
| / | /privacy | /privacy | privacy | false | Política de privacidade |
| /questoes | / | / | home | false | ConcursoMestre |
| /questoes | / | / | home | false | ConcursoMestre |
| /questoes | /questoes | /questoes | questions_hub | false | Questões |
| /questoes | /simulation | /simulation | private_tools | false | Simulados |
| /questoes | /cronograma | /cronograma | private_tools | false | Cronograma |
| /questoes | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /questoes | /ranking | /ranking | ranking | false | Rankings |
| /questoes | /marketplace | /marketplace | marketplace | false | Loja |
| /questoes | / | / | home | true | Início |
| /questoes | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /questoes | /bancas | /bancas | board_hub | true | Bancas |
| /questoes | /provas | /provas | exam_hub | true | Provas |
| /questoes | /questoes/67813/art-5o-acao-e-controle | /questoes/67813/art-5o-acao-e-controle | question_detail | true | Art. 5º — Ação & Controle |
| /questoes | / | / | home | true | ConcursoMestre |
| /questoes | /questoes | /questoes | questions_hub | true | Questões |
| /questoes | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /questoes | /bancas | /bancas | board_hub | true | Bancas |
| /questoes | /simulados | /simulados | simulations_hub | true | Simulados |
| /questoes | /blog | /blog | blog_hub | true | Blog |
| /questoes | /novidades | /novidades | news | true | Novidades |
| /questoes | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /questoes | /support | /support | support | true | Suporte |
| /questoes | /faq | /faq | faq | true | FAQ |
| /questoes | /terms | /terms | terms | true | Termos de uso |
| /questoes | /privacy | /privacy | privacy | true | Privacidade |
| /questoes | /questoes/67813/art-5o-acao-e-controle | /questoes/67813/art-5o-acao-e-controle | question_detail | false | Q67813 |
| /disciplinas | / | / | home | false | ConcursoMestre |
| /disciplinas | / | / | home | false | ConcursoMestre |
| /disciplinas | /questoes | /questoes | questions_hub | false | Questões |
| /disciplinas | /simulation | /simulation | private_tools | false | Simulados |
| /disciplinas | /cronograma | /cronograma | private_tools | false | Cronograma |
| /disciplinas | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /disciplinas | /ranking | /ranking | ranking | false | Rankings |
| /disciplinas | /marketplace | /marketplace | marketplace | false | Loja |
| /disciplinas | / | / | home | true | Início |
| /disciplinas | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /disciplinas | /bancas | /bancas | board_hub | true | Bancas |
| /disciplinas | /orgaos | /orgaos | organizations_hub | true | Órgãos |
| /disciplinas | /disciplinas?letra=A | /disciplinas?letra=A | discipline_hub | false | A |
| /disciplinas | /disciplinas?letra=B | /disciplinas?letra=B | discipline_hub | false | B |
| /disciplinas | /disciplinas?letra=C | /disciplinas?letra=C | discipline_hub | false | C |
| /disciplinas | /disciplinas?letra=D | /disciplinas?letra=D | discipline_hub | false | D |
| /disciplinas | /disciplinas?letra=E | /disciplinas?letra=E | discipline_hub | false | E |
| /disciplinas | /disciplinas?letra=F | /disciplinas?letra=F | discipline_hub | false | F |
| /disciplinas | /disciplinas?letra=G | /disciplinas?letra=G | discipline_hub | false | G |
| /disciplinas | /disciplinas?letra=H | /disciplinas?letra=H | discipline_hub | false | H |
| /disciplinas | /disciplinas?letra=I | /disciplinas?letra=I | discipline_hub | false | I |
| /disciplinas | /disciplinas?letra=J | /disciplinas?letra=J | discipline_hub | false | J |
| /disciplinas | /disciplinas?letra=K | /disciplinas?letra=K | discipline_hub | false | K |
| /disciplinas | /disciplinas?letra=L | /disciplinas?letra=L | discipline_hub | false | L |
| /disciplinas | /disciplinas?letra=M | /disciplinas?letra=M | discipline_hub | false | M |
| /disciplinas | /disciplinas?letra=N | /disciplinas?letra=N | discipline_hub | false | N |
| /disciplinas | /disciplinas?letra=O | /disciplinas?letra=O | discipline_hub | false | O |
| /disciplinas | /disciplinas?letra=P | /disciplinas?letra=P | discipline_hub | false | P |
| /disciplinas | /disciplinas?letra=Q | /disciplinas?letra=Q | discipline_hub | false | Q |
| /disciplinas | /disciplinas?letra=R | /disciplinas?letra=R | discipline_hub | false | R |
| /disciplinas | /disciplinas?letra=S | /disciplinas?letra=S | discipline_hub | false | S |
| /disciplinas | /disciplinas?letra=T | /disciplinas?letra=T | discipline_hub | false | T |
| /disciplinas | /disciplinas?letra=U | /disciplinas?letra=U | discipline_hub | false | U |
| /disciplinas | /disciplinas?letra=V | /disciplinas?letra=V | discipline_hub | false | V |
| /disciplinas | /disciplinas?letra=W | /disciplinas?letra=W | discipline_hub | false | W |
| /disciplinas | /disciplinas?letra=X | /disciplinas?letra=X | discipline_hub | false | X |
| /disciplinas | /disciplinas?letra=Y | /disciplinas?letra=Y | discipline_hub | false | Y |
| /disciplinas | /disciplinas?letra=Z | /disciplinas?letra=Z | discipline_hub | false | Z |
| /disciplinas | /disciplinas | /disciplinas | discipline_hub | true | Todos |
| /disciplinas | /disciplinas/direito-constitucional | /disciplinas/direito-constitucional | discipline_detail | true | Direito ConstitucionalAbrir landing da disciplina |
| /disciplinas | /questoes?materia=Direito+Constitucional | /questoes?materia=Direito+Constitucional | facet | false | 1 questões |
| /disciplinas | / | / | home | true | ConcursoMestre |
| /disciplinas | /questoes | /questoes | questions_hub | true | Questões |
| /disciplinas | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /disciplinas | /bancas | /bancas | board_hub | true | Bancas |
| /disciplinas | /simulados | /simulados | simulations_hub | true | Simulados |
| /disciplinas | /blog | /blog | blog_hub | true | Blog |
| /disciplinas | /novidades | /novidades | news | true | Novidades |
| /disciplinas | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /disciplinas | /support | /support | support | true | Suporte |
| /disciplinas | /faq | /faq | faq | true | FAQ |
| /disciplinas | /terms | /terms | terms | true | Termos de uso |
| /disciplinas | /privacy | /privacy | privacy | true | Privacidade |
| /bancas | / | / | home | false | ConcursoMestre |
| /bancas | / | / | home | false | ConcursoMestre |
| /bancas | /questoes | /questoes | questions_hub | false | Questões |
| /bancas | /simulation | /simulation | private_tools | false | Simulados |
| /bancas | /cronograma | /cronograma | private_tools | false | Cronograma |
| /bancas | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /bancas | /ranking | /ranking | ranking | false | Rankings |
| /bancas | /marketplace | /marketplace | marketplace | false | Loja |
| /bancas | / | / | home | true | Início |
| /bancas | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /bancas | /bancas | /bancas | board_hub | true | Bancas |
| /bancas | /orgaos | /orgaos | organizations_hub | true | Órgãos |
| /bancas | /bancas?letra=A | /bancas?letra=A | board_hub | false | A |
| /bancas | /bancas?letra=B | /bancas?letra=B | board_hub | false | B |
| /bancas | /bancas?letra=C | /bancas?letra=C | board_hub | false | C |
| /bancas | /bancas?letra=D | /bancas?letra=D | board_hub | false | D |
| /bancas | /bancas?letra=E | /bancas?letra=E | board_hub | false | E |
| /bancas | /bancas?letra=F | /bancas?letra=F | board_hub | false | F |
| /bancas | /bancas?letra=G | /bancas?letra=G | board_hub | false | G |
| /bancas | /bancas?letra=H | /bancas?letra=H | board_hub | false | H |
| /bancas | /bancas?letra=I | /bancas?letra=I | board_hub | false | I |
| /bancas | /bancas?letra=J | /bancas?letra=J | board_hub | false | J |
| /bancas | /bancas?letra=K | /bancas?letra=K | board_hub | false | K |
| /bancas | /bancas?letra=L | /bancas?letra=L | board_hub | false | L |
| /bancas | /bancas?letra=M | /bancas?letra=M | board_hub | false | M |
| /bancas | /bancas?letra=N | /bancas?letra=N | board_hub | false | N |
| /bancas | /bancas?letra=O | /bancas?letra=O | board_hub | false | O |
| /bancas | /bancas?letra=P | /bancas?letra=P | board_hub | false | P |
| /bancas | /bancas?letra=Q | /bancas?letra=Q | board_hub | false | Q |
| /bancas | /bancas?letra=R | /bancas?letra=R | board_hub | false | R |
| /bancas | /bancas?letra=S | /bancas?letra=S | board_hub | false | S |
| /bancas | /bancas?letra=T | /bancas?letra=T | board_hub | false | T |
| /bancas | /bancas?letra=U | /bancas?letra=U | board_hub | false | U |
| /bancas | /bancas?letra=V | /bancas?letra=V | board_hub | false | V |
| /bancas | /bancas?letra=W | /bancas?letra=W | board_hub | false | W |
| /bancas | /bancas?letra=X | /bancas?letra=X | board_hub | false | X |
| /bancas | /bancas?letra=Y | /bancas?letra=Y | board_hub | false | Y |
| /bancas | /bancas?letra=Z | /bancas?letra=Z | board_hub | false | Z |
| /bancas | /bancas | /bancas | board_hub | true | Todos |
| /bancas | /bancas/cebraspe | /bancas/cebraspe | board_detail | true | CEBRASPE - Centro Brasileiro de Pesquisa em AvaliaçãoBanca pública de teste usada pelo harness SSR. 1 questões 1 provas |
| /bancas | / | / | home | true | ConcursoMestre |
| /bancas | /questoes | /questoes | questions_hub | true | Questões |
| /bancas | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /bancas | /bancas | /bancas | board_hub | true | Bancas |
| /bancas | /simulados | /simulados | simulations_hub | true | Simulados |
| /bancas | /blog | /blog | blog_hub | true | Blog |
| /bancas | /novidades | /novidades | news | true | Novidades |
| /bancas | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /bancas | /support | /support | support | true | Suporte |
| /bancas | /faq | /faq | faq | true | FAQ |
| /bancas | /terms | /terms | terms | true | Termos de uso |
| /bancas | /privacy | /privacy | privacy | true | Privacidade |
| /orgaos | / | / | home | false | ConcursoMestre |
| /orgaos | / | / | home | false | ConcursoMestre |
| /orgaos | /questoes | /questoes | questions_hub | false | Questões |
| /orgaos | /simulation | /simulation | private_tools | false | Simulados |
| /orgaos | /cronograma | /cronograma | private_tools | false | Cronograma |
| /orgaos | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /orgaos | /ranking | /ranking | ranking | false | Rankings |
| /orgaos | /marketplace | /marketplace | marketplace | false | Loja |
| /orgaos | / | / | home | true | Início |
| /orgaos | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /orgaos | /bancas | /bancas | board_hub | true | Bancas |
| /orgaos | /orgaos | /orgaos | organizations_hub | true | Órgãos |
| /orgaos | /orgaos?letra=A | /orgaos?letra=A | organizations_hub | false | A |
| /orgaos | /orgaos?letra=B | /orgaos?letra=B | organizations_hub | false | B |
| /orgaos | /orgaos?letra=C | /orgaos?letra=C | organizations_hub | false | C |
| /orgaos | /orgaos?letra=D | /orgaos?letra=D | organizations_hub | false | D |
| /orgaos | /orgaos?letra=E | /orgaos?letra=E | organizations_hub | false | E |
| /orgaos | /orgaos?letra=F | /orgaos?letra=F | organizations_hub | false | F |
| /orgaos | /orgaos?letra=G | /orgaos?letra=G | organizations_hub | false | G |
| /orgaos | /orgaos?letra=H | /orgaos?letra=H | organizations_hub | false | H |
| /orgaos | /orgaos?letra=I | /orgaos?letra=I | organizations_hub | false | I |
| /orgaos | /orgaos?letra=J | /orgaos?letra=J | organizations_hub | false | J |
| /orgaos | /orgaos?letra=K | /orgaos?letra=K | organizations_hub | false | K |
| /orgaos | /orgaos?letra=L | /orgaos?letra=L | organizations_hub | false | L |
| /orgaos | /orgaos?letra=M | /orgaos?letra=M | organizations_hub | false | M |
| /orgaos | /orgaos?letra=N | /orgaos?letra=N | organizations_hub | false | N |
| /orgaos | /orgaos?letra=O | /orgaos?letra=O | organizations_hub | false | O |
| /orgaos | /orgaos?letra=P | /orgaos?letra=P | organizations_hub | false | P |
| /orgaos | /orgaos?letra=Q | /orgaos?letra=Q | organizations_hub | false | Q |
| /orgaos | /orgaos?letra=R | /orgaos?letra=R | organizations_hub | false | R |
| /orgaos | /orgaos?letra=S | /orgaos?letra=S | organizations_hub | false | S |
| /orgaos | /orgaos?letra=T | /orgaos?letra=T | organizations_hub | false | T |
| /orgaos | /orgaos?letra=U | /orgaos?letra=U | organizations_hub | false | U |
| /orgaos | /orgaos?letra=V | /orgaos?letra=V | organizations_hub | false | V |
| /orgaos | /orgaos?letra=W | /orgaos?letra=W | organizations_hub | false | W |
| /orgaos | /orgaos?letra=X | /orgaos?letra=X | organizations_hub | false | X |
| /orgaos | /orgaos?letra=Y | /orgaos?letra=Y | organizations_hub | false | Y |
| /orgaos | /orgaos?letra=Z | /orgaos?letra=Z | organizations_hub | false | Z |
| /orgaos | /orgaos | /orgaos | organizations_hub | true | Todos |
| /orgaos | /orgaos/orgao-de-teste | /orgaos/orgao-de-teste | organization_detail | true | ODT - Órgão de TesteÓrgão público usado para validar a landing SSR. 1 questões 1 provas |
| /orgaos | / | / | home | true | ConcursoMestre |
| /orgaos | /questoes | /questoes | questions_hub | true | Questões |
| /orgaos | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /orgaos | /bancas | /bancas | board_hub | true | Bancas |
| /orgaos | /simulados | /simulados | simulations_hub | true | Simulados |
| /orgaos | /blog | /blog | blog_hub | true | Blog |
| /orgaos | /novidades | /novidades | news | true | Novidades |
| /orgaos | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /orgaos | /support | /support | support | true | Suporte |
| /orgaos | /faq | /faq | faq | true | FAQ |
| /orgaos | /terms | /terms | terms | true | Termos de uso |
| /orgaos | /privacy | /privacy | privacy | true | Privacidade |
| /provas | / | / | home | false |  |
| /provas | /questoes | /questoes | questions_hub | false | Questões |
| /provas | /provas | /provas | exam_hub | false | Provas |
| /provas | /blog | /blog | blog_hub | false | Notícias |
| /provas | /blog | /blog | blog_hub | false | Últimas |
| /provas | /blog/categoria/concursos | /blog/categoria/concursos | blog_category | false | Concursos |
| /provas | /blog/tag/nordeste | /blog/tag/nordeste | blog_tag | false | Nordeste |
| /provas | / | / | home | true | Início |
| /provas | /provas | /provas | exam_hub | true | Limpar |
| /provas | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Prova SSR 2026 |
| /provas | /bancas/cebraspe | /bancas/cebraspe | board_detail | true | CEBRASPE |
| /provas | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Ver detalhes |
| /concursos | / | / | home | false | ConcursoMestre |
| /concursos | / | / | home | false | ConcursoMestre |
| /concursos | /questoes | /questoes | questions_hub | false | Questões |
| /concursos | /simulation | /simulation | private_tools | false | Simulados |
| /concursos | /cronograma | /cronograma | private_tools | false | Cronograma |
| /concursos | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /concursos | /ranking | /ranking | ranking | false | Rankings |
| /concursos | /marketplace | /marketplace | marketplace | false | Loja |
| /concursos | / | / | home | true | Início |
| /concursos | /concursos-abertos | /concursos-abertos | open_contests | true | Ver concursos abertos |
| /concursos | /concursos/concurso-canonico-2026 | /concursos/concurso-canonico-2026 | contest_detail | true | Concurso Canônico 2026 |
| /concursos | / | / | home | true | ConcursoMestre |
| /concursos | /questoes | /questoes | questions_hub | true | Questões |
| /concursos | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /concursos | /bancas | /bancas | board_hub | true | Bancas |
| /concursos | /simulados | /simulados | simulations_hub | true | Simulados |
| /concursos | /blog | /blog | blog_hub | true | Blog |
| /concursos | /novidades | /novidades | news | true | Novidades |
| /concursos | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /concursos | /support | /support | support | true | Suporte |
| /concursos | /faq | /faq | faq | true | FAQ |
| /concursos | /terms | /terms | terms | true | Termos de uso |
| /concursos | /privacy | /privacy | privacy | true | Privacidade |
| /concursos-abertos | / | / | home | false | ConcursoMestre |
| /concursos-abertos | / | / | home | false | ConcursoMestre |
| /concursos-abertos | /questoes | /questoes | questions_hub | false | Questões |
| /concursos-abertos | /simulation | /simulation | private_tools | false | Simulados |
| /concursos-abertos | /cronograma | /cronograma | private_tools | false | Cronograma |
| /concursos-abertos | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /concursos-abertos | /ranking | /ranking | ranking | false | Rankings |
| /concursos-abertos | /marketplace | /marketplace | marketplace | false | Loja |
| /concursos-abertos | / | / | home | true | Início |
| /concursos-abertos | /concursos | /concursos | contest_hub | true | Concursos |
| /concursos-abertos | /concursos/concurso-canonico-2026 | /concursos/concurso-canonico-2026 | contest_detail | true | Concurso Canônico 2026 |
| /concursos-abertos | / | / | home | true | ConcursoMestre |
| /concursos-abertos | /questoes | /questoes | questions_hub | true | Questões |
| /concursos-abertos | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /concursos-abertos | /bancas | /bancas | board_hub | true | Bancas |
| /concursos-abertos | /simulados | /simulados | simulations_hub | true | Simulados |
| /concursos-abertos | /blog | /blog | blog_hub | true | Blog |
| /concursos-abertos | /novidades | /novidades | news | true | Novidades |
| /concursos-abertos | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /concursos-abertos | /support | /support | support | true | Suporte |
| /concursos-abertos | /faq | /faq | faq | true | FAQ |
| /concursos-abertos | /terms | /terms | terms | true | Termos de uso |
| /concursos-abertos | /privacy | /privacy | privacy | true | Privacidade |
| /carreiras | / | / | home | false | ConcursoMestre |
| /carreiras | / | / | home | false | ConcursoMestre |
| /carreiras | /questoes | /questoes | questions_hub | false | Questões |
| /carreiras | /simulation | /simulation | private_tools | false | Simulados |
| /carreiras | /cronograma | /cronograma | private_tools | false | Cronograma |
| /carreiras | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /carreiras | /ranking | /ranking | ranking | false | Rankings |
| /carreiras | /marketplace | /marketplace | marketplace | false | Loja |
| /carreiras | / | / | home | true | Início |
| /carreiras | /carreiras | /carreiras | careers_hub | true | Carreiras |
| /carreiras | /cargos | /cargos | positions_hub | true | Cargos |
| /carreiras | /carreiras?letra=A | /carreiras?letra=A | careers_hub | false | A |
| /carreiras | /carreiras?letra=B | /carreiras?letra=B | careers_hub | false | B |
| /carreiras | /carreiras?letra=C | /carreiras?letra=C | careers_hub | false | C |
| /carreiras | /carreiras?letra=D | /carreiras?letra=D | careers_hub | false | D |
| /carreiras | /carreiras?letra=E | /carreiras?letra=E | careers_hub | false | E |
| /carreiras | /carreiras?letra=F | /carreiras?letra=F | careers_hub | false | F |
| /carreiras | /carreiras?letra=G | /carreiras?letra=G | careers_hub | false | G |
| /carreiras | /carreiras?letra=H | /carreiras?letra=H | careers_hub | false | H |
| /carreiras | /carreiras?letra=I | /carreiras?letra=I | careers_hub | false | I |
| /carreiras | /carreiras?letra=J | /carreiras?letra=J | careers_hub | false | J |
| /carreiras | /carreiras?letra=K | /carreiras?letra=K | careers_hub | false | K |
| /carreiras | /carreiras?letra=L | /carreiras?letra=L | careers_hub | false | L |
| /carreiras | /carreiras?letra=M | /carreiras?letra=M | careers_hub | false | M |
| /carreiras | /carreiras?letra=N | /carreiras?letra=N | careers_hub | false | N |
| /carreiras | /carreiras?letra=O | /carreiras?letra=O | careers_hub | false | O |
| /carreiras | /carreiras?letra=P | /carreiras?letra=P | careers_hub | false | P |
| /carreiras | /carreiras?letra=Q | /carreiras?letra=Q | careers_hub | false | Q |
| /carreiras | /carreiras?letra=R | /carreiras?letra=R | careers_hub | false | R |
| /carreiras | /carreiras?letra=S | /carreiras?letra=S | careers_hub | false | S |
| /carreiras | /carreiras?letra=T | /carreiras?letra=T | careers_hub | false | T |
| /carreiras | /carreiras?letra=U | /carreiras?letra=U | careers_hub | false | U |
| /carreiras | /carreiras?letra=V | /carreiras?letra=V | careers_hub | false | V |
| /carreiras | /carreiras?letra=W | /carreiras?letra=W | careers_hub | false | W |
| /carreiras | /carreiras?letra=X | /carreiras?letra=X | careers_hub | false | X |
| /carreiras | /carreiras?letra=Y | /carreiras?letra=Y | careers_hub | false | Y |
| /carreiras | /carreiras?letra=Z | /carreiras?letra=Z | careers_hub | false | Z |
| /carreiras | /carreiras/carreira-fiscal | /carreiras/carreira-fiscal | career_detail | true | Carreira FiscalCarreira pública editorial usada pelo harness.1 questões · 1 provas |
| /carreiras | / | / | home | true | ConcursoMestre |
| /carreiras | /questoes | /questoes | questions_hub | true | Questões |
| /carreiras | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /carreiras | /bancas | /bancas | board_hub | true | Bancas |
| /carreiras | /simulados | /simulados | simulations_hub | true | Simulados |
| /carreiras | /blog | /blog | blog_hub | true | Blog |
| /carreiras | /novidades | /novidades | news | true | Novidades |
| /carreiras | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /carreiras | /support | /support | support | true | Suporte |
| /carreiras | /faq | /faq | faq | true | FAQ |
| /carreiras | /terms | /terms | terms | true | Termos de uso |
| /carreiras | /privacy | /privacy | privacy | true | Privacidade |
| /cargos | / | / | home | false | ConcursoMestre |
| /cargos | / | / | home | false | ConcursoMestre |
| /cargos | /questoes | /questoes | questions_hub | false | Questões |
| /cargos | /simulation | /simulation | private_tools | false | Simulados |
| /cargos | /cronograma | /cronograma | private_tools | false | Cronograma |
| /cargos | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /cargos | /ranking | /ranking | ranking | false | Rankings |
| /cargos | /marketplace | /marketplace | marketplace | false | Loja |
| /cargos | / | / | home | true | Início |
| /cargos | /carreiras | /carreiras | careers_hub | true | Carreiras |
| /cargos | /cargos | /cargos | positions_hub | true | Cargos |
| /cargos | /cargos?letra=A | /cargos?letra=A | positions_hub | false | A |
| /cargos | /cargos?letra=B | /cargos?letra=B | positions_hub | false | B |
| /cargos | /cargos?letra=C | /cargos?letra=C | positions_hub | false | C |
| /cargos | /cargos?letra=D | /cargos?letra=D | positions_hub | false | D |
| /cargos | /cargos?letra=E | /cargos?letra=E | positions_hub | false | E |
| /cargos | /cargos?letra=F | /cargos?letra=F | positions_hub | false | F |
| /cargos | /cargos?letra=G | /cargos?letra=G | positions_hub | false | G |
| /cargos | /cargos?letra=H | /cargos?letra=H | positions_hub | false | H |
| /cargos | /cargos?letra=I | /cargos?letra=I | positions_hub | false | I |
| /cargos | /cargos?letra=J | /cargos?letra=J | positions_hub | false | J |
| /cargos | /cargos?letra=K | /cargos?letra=K | positions_hub | false | K |
| /cargos | /cargos?letra=L | /cargos?letra=L | positions_hub | false | L |
| /cargos | /cargos?letra=M | /cargos?letra=M | positions_hub | false | M |
| /cargos | /cargos?letra=N | /cargos?letra=N | positions_hub | false | N |
| /cargos | /cargos?letra=O | /cargos?letra=O | positions_hub | false | O |
| /cargos | /cargos?letra=P | /cargos?letra=P | positions_hub | false | P |
| /cargos | /cargos?letra=Q | /cargos?letra=Q | positions_hub | false | Q |
| /cargos | /cargos?letra=R | /cargos?letra=R | positions_hub | false | R |
| /cargos | /cargos?letra=S | /cargos?letra=S | positions_hub | false | S |
| /cargos | /cargos?letra=T | /cargos?letra=T | positions_hub | false | T |
| /cargos | /cargos?letra=U | /cargos?letra=U | positions_hub | false | U |
| /cargos | /cargos?letra=V | /cargos?letra=V | positions_hub | false | V |
| /cargos | /cargos?letra=W | /cargos?letra=W | positions_hub | false | W |
| /cargos | /cargos?letra=X | /cargos?letra=X | positions_hub | false | X |
| /cargos | /cargos?letra=Y | /cargos?letra=Y | positions_hub | false | Y |
| /cargos | /cargos?letra=Z | /cargos?letra=Z | positions_hub | false | Z |
| /cargos | /cargos/analista | /cargos/analista | position_detail | true | AnalistaCargo público usado pelo harness.1 questões · 1 provas |
| /cargos | / | / | home | true | ConcursoMestre |
| /cargos | /questoes | /questoes | questions_hub | true | Questões |
| /cargos | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /cargos | /bancas | /bancas | board_hub | true | Bancas |
| /cargos | /simulados | /simulados | simulations_hub | true | Simulados |
| /cargos | /blog | /blog | blog_hub | true | Blog |
| /cargos | /novidades | /novidades | news | true | Novidades |
| /cargos | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /cargos | /support | /support | support | true | Suporte |
| /cargos | /faq | /faq | faq | true | FAQ |
| /cargos | /terms | /terms | terms | true | Termos de uso |
| /cargos | /privacy | /privacy | privacy | true | Privacidade |
| /simulados | / | / | home | false | ConcursoMestre |
| /simulados | / | / | home | false | ConcursoMestre |
| /simulados | /questoes | /questoes | questions_hub | false | Questões |
| /simulados | /simulation | /simulation | private_tools | false | Simulados |
| /simulados | /cronograma | /cronograma | private_tools | false | Cronograma |
| /simulados | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /simulados | /ranking | /ranking | ranking | false | Rankings |
| /simulados | /marketplace | /marketplace | marketplace | false | Loja |
| /simulados | / | / | home | true | Início |
| /simulados | /simulados/simulado-publico-constitucional | /simulados/simulado-publico-constitucional | simulation_detail | true | Simulado de Direito ConstitucionalSimulado editorial público com composição estável para validar a experiência SSR.1 questões45 min |
| /simulados | /simulados?pagina=2 | /simulados?pagina=2 | simulations_hub | false | Próxima |
| /simulados | / | / | home | true | ConcursoMestre |
| /simulados | /questoes | /questoes | questions_hub | true | Questões |
| /simulados | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /simulados | /bancas | /bancas | board_hub | true | Bancas |
| /simulados | /simulados | /simulados | simulations_hub | true | Simulados |
| /simulados | /blog | /blog | blog_hub | true | Blog |
| /simulados | /novidades | /novidades | news | true | Novidades |
| /simulados | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /simulados | /support | /support | support | true | Suporte |
| /simulados | /faq | /faq | faq | true | FAQ |
| /simulados | /terms | /terms | terms | true | Termos de uso |
| /simulados | /privacy | /privacy | privacy | true | Privacidade |
| /lei-comentada | / | / | home | false | ConcursoMestre |
| /lei-comentada | / | / | home | false | ConcursoMestre |
| /lei-comentada | /questoes | /questoes | questions_hub | false | Questões |
| /lei-comentada | /simulation | /simulation | private_tools | false | Simulados |
| /lei-comentada | /cronograma | /cronograma | private_tools | false | Cronograma |
| /lei-comentada | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /lei-comentada | /ranking | /ranking | ranking | false | Rankings |
| /lei-comentada | /marketplace | /marketplace | marketplace | false | Loja |
| /lei-comentada | / | / | home | true | Início |
| /lei-comentada | /lei-comentada/constituicao-federal | /lei-comentada/constituicao-federal | law_detail | true | Constituição Federal |
| /lei-comentada | / | / | home | true | ConcursoMestre |
| /lei-comentada | /questoes | /questoes | questions_hub | true | Questões |
| /lei-comentada | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /lei-comentada | /bancas | /bancas | board_hub | true | Bancas |
| /lei-comentada | /simulados | /simulados | simulations_hub | true | Simulados |
| /lei-comentada | /blog | /blog | blog_hub | true | Blog |
| /lei-comentada | /novidades | /novidades | news | true | Novidades |
| /lei-comentada | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /lei-comentada | /support | /support | support | true | Suporte |
| /lei-comentada | /faq | /faq | faq | true | FAQ |
| /lei-comentada | /terms | /terms | terms | true | Termos de uso |
| /lei-comentada | /privacy | /privacy | privacy | true | Privacidade |
| /materiais | / | / | home | false | ConcursoMestre |
| /materiais | / | / | home | false | ConcursoMestre |
| /materiais | /questoes | /questoes | questions_hub | false | Questões |
| /materiais | /simulation | /simulation | private_tools | false | Simulados |
| /materiais | /cronograma | /cronograma | private_tools | false | Cronograma |
| /materiais | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /materiais | /ranking | /ranking | ranking | false | Rankings |
| /materiais | /marketplace | /marketplace | marketplace | false | Loja |
| /materiais | / | / | home | true | Início |
| /materiais | /marketplace | /marketplace | marketplace | false | Abrir marketplace |
| /materiais | /materiais/guia-publico-de-estudo | /materiais/guia-publico-de-estudo | material_detail | true | PDFGuia público de estudoMaterial editorial público usado para validar SSR e segurança.Oferta disponível no marketplace |
| /materiais | /materiais/material-gratuito-publico | /materiais/material-gratuito-publico | material_detail | true | PDFMaterial gratuito públicoMaterial editorial público usado para validar SSR e segurança.Acesso gratuito |
| /materiais | /materiais/material-historico | /materiais/material-historico | material_detail | true | PDFMaterial históricoMaterial editorial público usado para validar SSR e segurança.Consulta pública |
| /materiais | / | / | home | true | ConcursoMestre |
| /materiais | /questoes | /questoes | questions_hub | true | Questões |
| /materiais | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /materiais | /bancas | /bancas | board_hub | true | Bancas |
| /materiais | /simulados | /simulados | simulations_hub | true | Simulados |
| /materiais | /blog | /blog | blog_hub | true | Blog |
| /materiais | /novidades | /novidades | news | true | Novidades |
| /materiais | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /materiais | /support | /support | support | true | Suporte |
| /materiais | /faq | /faq | faq | true | FAQ |
| /materiais | /terms | /terms | terms | true | Termos de uso |
| /materiais | /privacy | /privacy | privacy | true | Privacidade |
| /blog | / | / | home | false |  |
| /blog | /questoes | /questoes | questions_hub | false | Questões |
| /blog | /provas | /provas | exam_hub | false | Provas |
| /blog | /blog | /blog | blog_hub | false | Notícias |
| /blog | /blog | /blog | blog_hub | false | Últimas |
| /blog | /blog/categoria/concursos | /blog/categoria/concursos | blog_category | false | Concursos |
| /blog | /blog/tag/nordeste | /blog/tag/nordeste | blog_tag | false | Nordeste |
| /blog | / | / | home | true | Início |
| /blog | /blog/feed.xml | /blog/feed.xml | blog_article | true | Acompanhar por RSS |
| /blog | /blog/categoria/concursos | /blog/categoria/concursos | blog_category | true | Concursos |
| /blog | /blog/noticia-ssr | /blog/noticia-ssr | blog_article | true | Notícia SSR de teste |
| /blog | /blog/tag/nordeste | /blog/tag/nordeste | blog_tag | false | Nordeste |
| /blog | /blog/autor/staff-1 | /blog/autor/staff-1 | blog_author | true | Por Equipe ConcursoMestre |
| /blog | /provas | /provas | exam_hub | true | Ver todas |
| /blog | /provas?ano=2026 | /provas?ano=2026 | exam_hub | false | 2026 |
| /blog | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Prova SSR 2026 |
| /blog | /bancas/cebraspe | /bancas/cebraspe | board_detail | true | CEBRASPE |
| /blog | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Ver detalhes |
| /blog | /blog/noticia-ssr | /blog/noticia-ssr | blog_article | true | Notícia SSR de teste |
| /blog | /blog/categoria/concursos | /blog/categoria/concursos | blog_category | true | Ver tudo |
| /blog | /blog/categoria/concursos | /blog/categoria/concursos | blog_category | true | Concursos |
| /blog | /blog/noticia-ssr | /blog/noticia-ssr | blog_article | true | Notícia SSR de teste |
| /blog | /blog/tag/nordeste | /blog/tag/nordeste | blog_tag | false | Nordeste |
| /blog | /blog/autor/staff-1 | /blog/autor/staff-1 | blog_author | true | Por Equipe ConcursoMestre |
| /blog | /blog/tag/nordeste | /blog/tag/nordeste | blog_tag | false | Nordeste1 |
| /blog | / | / | home | false | ConcursoMestre |
| /blog | /disciplinas | /disciplinas | discipline_hub | false | Disciplinas |
| /blog | /bancas | /bancas | board_hub | false | Bancas |
| /blog | /#recursos | / | home | false | Recursos |
| /blog | /#planos | / | home | false | Planos |
| /blog | /#depoimentos | / | home | false | Depoimentos |
| /blog | /blog | /blog | blog_hub | false | Blog |
| /blog | /novidades | /novidades | news | false | Novidades |
| /blog | /support | /support | support | false | Central de ajuda |
| /blog | /support | /support | support | false | Fale conosco |
| /blog | /terms | /terms | terms | false | Termos de uso |
| /blog | /privacy | /privacy | privacy | false | Política de privacidade |
| /planos | / | / | home | true | Início |
| /planos | #comparar-planos | / | home | true | Comparar planos |
| /planos | /support | /support | support | true | Tirar dúvidas |
| /faq | / | / | home | false | ConcursoMestre |
| /faq | / | / | home | false | ConcursoMestre |
| /faq | /questoes | /questoes | questions_hub | false | Questões |
| /faq | /simulation | /simulation | private_tools | false | Simulados |
| /faq | /cronograma | /cronograma | private_tools | false | Cronograma |
| /faq | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /faq | /ranking | /ranking | ranking | false | Rankings |
| /faq | /marketplace | /marketplace | marketplace | false | Loja |
| /faq | / | / | home | true | Início |
| /faq | /support?category=info | /support?category=info | support | false | Abrir suporte de ajuda |
| /faq | / | / | home | true | ConcursoMestre |
| /faq | /questoes | /questoes | questions_hub | true | Questões |
| /faq | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /faq | /bancas | /bancas | board_hub | true | Bancas |
| /faq | /simulados | /simulados | simulations_hub | true | Simulados |
| /faq | /blog | /blog | blog_hub | true | Blog |
| /faq | /novidades | /novidades | news | true | Novidades |
| /faq | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /faq | /support | /support | support | true | Suporte |
| /faq | /faq | /faq | faq | true | FAQ |
| /faq | /terms | /terms | terms | true | Termos de uso |
| /faq | /privacy | /privacy | privacy | true | Privacidade |
| /novidades | / | / | home | false |  |
| /novidades | /questoes | /questoes | questions_hub | false | Questões |
| /novidades | /blog | /blog | blog_hub | false | Blog |
| /novidades | / | / | home | true | Início |
| /novidades | /support?category=feedback | /support?category=feedback | support | false | Enviar sugestão |
| /novidades | / | / | home | false | ConcursoMestre |
| /novidades | /disciplinas | /disciplinas | discipline_hub | false | Disciplinas |
| /novidades | /bancas | /bancas | board_hub | false | Bancas |
| /novidades | /#recursos | / | home | false | Recursos |
| /novidades | /#planos | / | home | false | Planos |
| /novidades | /#depoimentos | / | home | false | Depoimentos |
| /novidades | /blog | /blog | blog_hub | false | Blog |
| /novidades | /novidades | /novidades | news | false | Novidades |
| /novidades | /support | /support | support | false | Central de ajuda |
| /novidades | /support | /support | support | false | Fale conosco |
| /novidades | /terms | /terms | terms | false | Termos de uso |
| /novidades | /privacy | /privacy | privacy | false | Política de privacidade |
| /support | / | / | home | false | ConcursoMestre |
| /support | / | / | home | false | ConcursoMestre |
| /support | /questoes | /questoes | questions_hub | false | Questões |
| /support | /simulation | /simulation | private_tools | false | Simulados |
| /support | /cronograma | /cronograma | private_tools | false | Cronograma |
| /support | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /support | /ranking | /ranking | ranking | false | Rankings |
| /support | /marketplace | /marketplace | marketplace | false | Loja |
| /support | / | / | home | true | Início |
| /support | /support?category=bug | /support?category=bug | support | false | Reportar problema |
| /support | /support?category=feedback | /support?category=feedback | support | false | Enviar sugestão |
| /support | /profile/support-history | /profile/support-history | account | false | Meus atendimentos |
| /support | / | / | home | true | ConcursoMestre |
| /support | /questoes | /questoes | questions_hub | true | Questões |
| /support | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /support | /bancas | /bancas | board_hub | true | Bancas |
| /support | /simulados | /simulados | simulations_hub | true | Simulados |
| /support | /blog | /blog | blog_hub | true | Blog |
| /support | /novidades | /novidades | news | true | Novidades |
| /support | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /support | /support | /support | support | true | Suporte |
| /support | /faq | /faq | faq | true | FAQ |
| /support | /terms | /terms | terms | true | Termos de uso |
| /support | /privacy | /privacy | privacy | true | Privacidade |
| /privacy | / | / | home | false | Início |
| /terms | / | / | home | false | Início |
| /questoes/67813/art-5o-acao-e-controle | / | / | home | false | ConcursoMestre |
| /questoes/67813/art-5o-acao-e-controle | / | / | home | false | ConcursoMestre |
| /questoes/67813/art-5o-acao-e-controle | /questoes | /questoes | questions_hub | false | Questões |
| /questoes/67813/art-5o-acao-e-controle | /simulation | /simulation | private_tools | false | Simulados |
| /questoes/67813/art-5o-acao-e-controle | /cronograma | /cronograma | private_tools | false | Cronograma |
| /questoes/67813/art-5o-acao-e-controle | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /questoes/67813/art-5o-acao-e-controle | /ranking | /ranking | ranking | false | Rankings |
| /questoes/67813/art-5o-acao-e-controle | /marketplace | /marketplace | marketplace | false | Loja |
| /questoes/67813/art-5o-acao-e-controle | / | / | home | true | Início |
| /questoes/67813/art-5o-acao-e-controle | /questoes | /questoes | questions_hub | true | Questões |
| /questoes/67813/art-5o-acao-e-controle | /questoes?questionId=67813 | /questoes?questionId=67813 | facet | false | Resolver na prática |
| /questoes/67813/art-5o-acao-e-controle | /bancas/cebraspe | /bancas/cebraspe | board_detail | true | CEBRASPE |
| /questoes/67813/art-5o-acao-e-controle | /disciplinas/direito-constitucional | /disciplinas/direito-constitucional | discipline_detail | true | Direito Constitucional |
| /questoes/67813/art-5o-acao-e-controle | /topicos/controle-de-constitucionalidade | /topicos/controle-de-constitucionalidade | topic_detail | true | Controle de Constitucionalidade |
| /questoes/67813/art-5o-acao-e-controle | /assuntos/controle-concentrado | /assuntos/controle-concentrado | subject_detail | true | Controle concentrado |
| /questoes/67813/art-5o-acao-e-controle | /cargos/analista | /cargos/analista | position_detail | true | Analista |
| /questoes/67813/art-5o-acao-e-controle | /carreiras/carreira-fiscal | /carreiras/carreira-fiscal | career_detail | true | Carreira Fiscal |
| /questoes/67813/art-5o-acao-e-controle | /bancas/cebraspe | /bancas/cebraspe | board_detail | true | CEBRASPE |
| /questoes/67813/art-5o-acao-e-controle | /questoes?questionId=67813 | /questoes?questionId=67813 | facet | false | Abrir na prática |
| /questoes/67813/art-5o-acao-e-controle | /plans | /plans | account | false | Ver planos |
| /questoes/67813/art-5o-acao-e-controle | / | / | home | true | ConcursoMestre |
| /questoes/67813/art-5o-acao-e-controle | /questoes | /questoes | questions_hub | true | Questões |
| /questoes/67813/art-5o-acao-e-controle | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /questoes/67813/art-5o-acao-e-controle | /bancas | /bancas | board_hub | true | Bancas |
| /questoes/67813/art-5o-acao-e-controle | /simulados | /simulados | simulations_hub | true | Simulados |
| /questoes/67813/art-5o-acao-e-controle | /blog | /blog | blog_hub | true | Blog |
| /questoes/67813/art-5o-acao-e-controle | /novidades | /novidades | news | true | Novidades |
| /questoes/67813/art-5o-acao-e-controle | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /questoes/67813/art-5o-acao-e-controle | /support | /support | support | true | Suporte |
| /questoes/67813/art-5o-acao-e-controle | /faq | /faq | faq | true | FAQ |
| /questoes/67813/art-5o-acao-e-controle | /terms | /terms | terms | true | Termos de uso |
| /questoes/67813/art-5o-acao-e-controle | /privacy | /privacy | privacy | true | Privacidade |
| /disciplinas/direito-constitucional | / | / | home | false | ConcursoMestre |
| /disciplinas/direito-constitucional | / | / | home | false | ConcursoMestre |
| /disciplinas/direito-constitucional | /questoes | /questoes | questions_hub | false | Questões |
| /disciplinas/direito-constitucional | /simulation | /simulation | private_tools | false | Simulados |
| /disciplinas/direito-constitucional | /cronograma | /cronograma | private_tools | false | Cronograma |
| /disciplinas/direito-constitucional | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /disciplinas/direito-constitucional | /ranking | /ranking | ranking | false | Rankings |
| /disciplinas/direito-constitucional | /marketplace | /marketplace | marketplace | false | Loja |
| /disciplinas/direito-constitucional | / | / | home | true | Início |
| /disciplinas/direito-constitucional | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /disciplinas/direito-constitucional | /questoes?materia=Direito%20Constitucional | /questoes?materia=Direito+Constitucional | facet | false | Resolver questões |
| /disciplinas/direito-constitucional | /topicos/controle-de-constitucionalidade | /topicos/controle-de-constitucionalidade | topic_detail | true | Controle de Constitucionalidade |
| /disciplinas/direito-constitucional | /questoes?topico=Controle%20de%20Constitucionalidade | /questoes?topico=Controle+de+Constitucionalidade | facet | false | 1 questões |
| /disciplinas/direito-constitucional | /questoes?materia=Direito%20Constitucional | /questoes?materia=Direito+Constitucional | facet | false | Abrir ferramenta |
| /disciplinas/direito-constitucional | /questoes/67813/art-5o-acao-e-controle | /questoes/67813/art-5o-acao-e-controle | question_detail | true | 67813Art. 5º — Ação & Controle |
| /disciplinas/direito-constitucional | /bancas/cebraspe | /bancas/cebraspe | board_detail | true | CEBRASPE |
| /disciplinas/direito-constitucional | /orgaos/orgao-de-teste | /orgaos/orgao-de-teste | organization_detail | true | ODT |
| /disciplinas/direito-constitucional | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Prova SSR 2026 |
| /disciplinas/direito-constitucional | / | / | home | true | ConcursoMestre |
| /disciplinas/direito-constitucional | /questoes | /questoes | questions_hub | true | Questões |
| /disciplinas/direito-constitucional | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /disciplinas/direito-constitucional | /bancas | /bancas | board_hub | true | Bancas |
| /disciplinas/direito-constitucional | /simulados | /simulados | simulations_hub | true | Simulados |
| /disciplinas/direito-constitucional | /blog | /blog | blog_hub | true | Blog |
| /disciplinas/direito-constitucional | /novidades | /novidades | news | true | Novidades |
| /disciplinas/direito-constitucional | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /disciplinas/direito-constitucional | /support | /support | support | true | Suporte |
| /disciplinas/direito-constitucional | /faq | /faq | faq | true | FAQ |
| /disciplinas/direito-constitucional | /terms | /terms | terms | true | Termos de uso |
| /disciplinas/direito-constitucional | /privacy | /privacy | privacy | true | Privacidade |
| /topicos/controle-de-constitucionalidade | / | / | home | false | ConcursoMestre |
| /topicos/controle-de-constitucionalidade | / | / | home | false | ConcursoMestre |
| /topicos/controle-de-constitucionalidade | /questoes | /questoes | questions_hub | false | Questões |
| /topicos/controle-de-constitucionalidade | /simulation | /simulation | private_tools | false | Simulados |
| /topicos/controle-de-constitucionalidade | /cronograma | /cronograma | private_tools | false | Cronograma |
| /topicos/controle-de-constitucionalidade | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /topicos/controle-de-constitucionalidade | /ranking | /ranking | ranking | false | Rankings |
| /topicos/controle-de-constitucionalidade | /marketplace | /marketplace | marketplace | false | Loja |
| /topicos/controle-de-constitucionalidade | / | / | home | true | Início |
| /topicos/controle-de-constitucionalidade | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /topicos/controle-de-constitucionalidade | /disciplinas/direito-constitucional | /disciplinas/direito-constitucional | discipline_detail | true | Direito Constitucional |
| /topicos/controle-de-constitucionalidade | /questoes?topico=Controle%20de%20Constitucionalidade | /questoes?topico=Controle+de+Constitucionalidade | facet | false | Resolver questões |
| /topicos/controle-de-constitucionalidade | /assuntos/controle-concentrado | /assuntos/controle-concentrado | subject_detail | true | Controle concentrado |
| /topicos/controle-de-constitucionalidade | /questoes?topico=Controle%20de%20Constitucionalidade | /questoes?topico=Controle+de+Constitucionalidade | facet | false | Abrir ferramenta |
| /topicos/controle-de-constitucionalidade | /questoes/67813/art-5o-acao-e-controle | /questoes/67813/art-5o-acao-e-controle | question_detail | true | 67813Art. 5º — Ação & Controle |
| /topicos/controle-de-constitucionalidade | /bancas/cebraspe | /bancas/cebraspe | board_detail | true | CEBRASPE |
| /topicos/controle-de-constitucionalidade | /orgaos/orgao-de-teste | /orgaos/orgao-de-teste | organization_detail | true | ODT |
| /topicos/controle-de-constitucionalidade | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Prova SSR 2026 |
| /topicos/controle-de-constitucionalidade | / | / | home | true | ConcursoMestre |
| /topicos/controle-de-constitucionalidade | /questoes | /questoes | questions_hub | true | Questões |
| /topicos/controle-de-constitucionalidade | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /topicos/controle-de-constitucionalidade | /bancas | /bancas | board_hub | true | Bancas |
| /topicos/controle-de-constitucionalidade | /simulados | /simulados | simulations_hub | true | Simulados |
| /topicos/controle-de-constitucionalidade | /blog | /blog | blog_hub | true | Blog |
| /topicos/controle-de-constitucionalidade | /novidades | /novidades | news | true | Novidades |
| /topicos/controle-de-constitucionalidade | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /topicos/controle-de-constitucionalidade | /support | /support | support | true | Suporte |
| /topicos/controle-de-constitucionalidade | /faq | /faq | faq | true | FAQ |
| /topicos/controle-de-constitucionalidade | /terms | /terms | terms | true | Termos de uso |
| /topicos/controle-de-constitucionalidade | /privacy | /privacy | privacy | true | Privacidade |
| /assuntos/controle-concentrado | / | / | home | false | ConcursoMestre |
| /assuntos/controle-concentrado | / | / | home | false | ConcursoMestre |
| /assuntos/controle-concentrado | /questoes | /questoes | questions_hub | false | Questões |
| /assuntos/controle-concentrado | /simulation | /simulation | private_tools | false | Simulados |
| /assuntos/controle-concentrado | /cronograma | /cronograma | private_tools | false | Cronograma |
| /assuntos/controle-concentrado | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /assuntos/controle-concentrado | /ranking | /ranking | ranking | false | Rankings |
| /assuntos/controle-concentrado | /marketplace | /marketplace | marketplace | false | Loja |
| /assuntos/controle-concentrado | / | / | home | true | Início |
| /assuntos/controle-concentrado | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /assuntos/controle-concentrado | /disciplinas/direito-constitucional | /disciplinas/direito-constitucional | discipline_detail | true | Direito Constitucional |
| /assuntos/controle-concentrado | /topicos/controle-de-constitucionalidade | /topicos/controle-de-constitucionalidade | topic_detail | true | Controle de Constitucionalidade |
| /assuntos/controle-concentrado | /questoes?assunto=Controle%20concentrado | /questoes?assunto=Controle+concentrado | facet | false | Resolver questões |
| /assuntos/controle-concentrado | /questoes?assunto=Controle%20concentrado | /questoes?assunto=Controle+concentrado | facet | false | Abrir ferramenta |
| /assuntos/controle-concentrado | /questoes/67813/art-5o-acao-e-controle | /questoes/67813/art-5o-acao-e-controle | question_detail | true | 67813Art. 5º — Ação & Controle |
| /assuntos/controle-concentrado | /bancas/cebraspe | /bancas/cebraspe | board_detail | true | CEBRASPE |
| /assuntos/controle-concentrado | /orgaos/orgao-de-teste | /orgaos/orgao-de-teste | organization_detail | true | ODT |
| /assuntos/controle-concentrado | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Prova SSR 2026 |
| /assuntos/controle-concentrado | / | / | home | true | ConcursoMestre |
| /assuntos/controle-concentrado | /questoes | /questoes | questions_hub | true | Questões |
| /assuntos/controle-concentrado | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /assuntos/controle-concentrado | /bancas | /bancas | board_hub | true | Bancas |
| /assuntos/controle-concentrado | /simulados | /simulados | simulations_hub | true | Simulados |
| /assuntos/controle-concentrado | /blog | /blog | blog_hub | true | Blog |
| /assuntos/controle-concentrado | /novidades | /novidades | news | true | Novidades |
| /assuntos/controle-concentrado | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /assuntos/controle-concentrado | /support | /support | support | true | Suporte |
| /assuntos/controle-concentrado | /faq | /faq | faq | true | FAQ |
| /assuntos/controle-concentrado | /terms | /terms | terms | true | Termos de uso |
| /assuntos/controle-concentrado | /privacy | /privacy | privacy | true | Privacidade |
| /bancas/cebraspe | / | / | home | false | ConcursoMestre |
| /bancas/cebraspe | / | / | home | false | ConcursoMestre |
| /bancas/cebraspe | /questoes | /questoes | questions_hub | false | Questões |
| /bancas/cebraspe | /simulation | /simulation | private_tools | false | Simulados |
| /bancas/cebraspe | /cronograma | /cronograma | private_tools | false | Cronograma |
| /bancas/cebraspe | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /bancas/cebraspe | /ranking | /ranking | ranking | false | Rankings |
| /bancas/cebraspe | /marketplace | /marketplace | marketplace | false | Loja |
| /bancas/cebraspe | / | / | home | true | Início |
| /bancas/cebraspe | /bancas | /bancas | board_hub | true | Bancas |
| /bancas/cebraspe | /questoes?agency=CEBRASPE | /questoes?agency=CEBRASPE | facet | false | Resolver questões |
| /bancas/cebraspe | /questoes?agency=CEBRASPE&materia=Direito+Constitucional | /questoes?agency=CEBRASPE&materia=Direito+Constitucional | facet | false | Direito Constitucional |
| /bancas/cebraspe | /bancas/cebraspe | /bancas/cebraspe | board_detail | true | Todos · 1 |
| /bancas/cebraspe | /bancas/cebraspe?status=open | /bancas/cebraspe?status=open | board_detail | false | Inscrições abertas · 0 |
| /bancas/cebraspe | /bancas/cebraspe?status=upcoming | /bancas/cebraspe?status=upcoming | board_detail | false | Próximos · 1 |
| /bancas/cebraspe | /bancas/cebraspe?status=completed | /bancas/cebraspe?status=completed | board_detail | false | Realizados · 0 |
| /bancas/cebraspe | /bancas/cebraspe?status=unknown | /bancas/cebraspe?status=unknown | board_detail | false | Sem data · 0 |
| /bancas/cebraspe | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Prova SSR 2026 |
| /bancas/cebraspe | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Ver prova |
| /bancas/cebraspe | / | / | home | true | ConcursoMestre |
| /bancas/cebraspe | /questoes | /questoes | questions_hub | true | Questões |
| /bancas/cebraspe | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /bancas/cebraspe | /bancas | /bancas | board_hub | true | Bancas |
| /bancas/cebraspe | /simulados | /simulados | simulations_hub | true | Simulados |
| /bancas/cebraspe | /blog | /blog | blog_hub | true | Blog |
| /bancas/cebraspe | /novidades | /novidades | news | true | Novidades |
| /bancas/cebraspe | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /bancas/cebraspe | /support | /support | support | true | Suporte |
| /bancas/cebraspe | /faq | /faq | faq | true | FAQ |
| /bancas/cebraspe | /terms | /terms | terms | true | Termos de uso |
| /bancas/cebraspe | /privacy | /privacy | privacy | true | Privacidade |
| /orgaos/orgao-de-teste | / | / | home | false | ConcursoMestre |
| /orgaos/orgao-de-teste | / | / | home | false | ConcursoMestre |
| /orgaos/orgao-de-teste | /questoes | /questoes | questions_hub | false | Questões |
| /orgaos/orgao-de-teste | /simulation | /simulation | private_tools | false | Simulados |
| /orgaos/orgao-de-teste | /cronograma | /cronograma | private_tools | false | Cronograma |
| /orgaos/orgao-de-teste | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /orgaos/orgao-de-teste | /ranking | /ranking | ranking | false | Rankings |
| /orgaos/orgao-de-teste | /marketplace | /marketplace | marketplace | false | Loja |
| /orgaos/orgao-de-teste | / | / | home | true | Início |
| /orgaos/orgao-de-teste | /orgaos | /orgaos | organizations_hub | true | Órgãos |
| /orgaos/orgao-de-teste | /questoes?orgao=%C3%93rg%C3%A3o%20de%20Teste | /questoes?orgao=%C3%93rg%C3%A3o+de+Teste | facet | false | Resolver questões deste órgão |
| /orgaos/orgao-de-teste | /questoes?orgao=%C3%93rg%C3%A3o%20de%20Teste | /questoes?orgao=%C3%93rg%C3%A3o+de+Teste | facet | false | Abrir prática |
| /orgaos/orgao-de-teste | /questoes/67813/art-5o-acao-e-controle | /questoes/67813/art-5o-acao-e-controle | question_detail | true | 67813Art. 5º — Ação & Controle |
| /orgaos/orgao-de-teste | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Prova SSR 20262026 · 1 |
| /orgaos/orgao-de-teste | /disciplinas/direito-constitucional | /disciplinas/direito-constitucional | discipline_detail | true | Direito Constitucional · 1 |
| /orgaos/orgao-de-teste | /cargos/analista | /cargos/analista | position_detail | true | Analista |
| /orgaos/orgao-de-teste | /bancas/cebraspe | /bancas/cebraspe | board_detail | true | CEBRASPE · 1 provas |
| /orgaos/orgao-de-teste | /concursos/concurso-canonico-2026 | /concursos/concurso-canonico-2026 | contest_detail | true | Concurso Canônico 2026 · 2026 |
| /orgaos/orgao-de-teste | / | / | home | true | ConcursoMestre |
| /orgaos/orgao-de-teste | /questoes | /questoes | questions_hub | true | Questões |
| /orgaos/orgao-de-teste | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /orgaos/orgao-de-teste | /bancas | /bancas | board_hub | true | Bancas |
| /orgaos/orgao-de-teste | /simulados | /simulados | simulations_hub | true | Simulados |
| /orgaos/orgao-de-teste | /blog | /blog | blog_hub | true | Blog |
| /orgaos/orgao-de-teste | /novidades | /novidades | news | true | Novidades |
| /orgaos/orgao-de-teste | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /orgaos/orgao-de-teste | /support | /support | support | true | Suporte |
| /orgaos/orgao-de-teste | /faq | /faq | faq | true | FAQ |
| /orgaos/orgao-de-teste | /terms | /terms | terms | true | Termos de uso |
| /orgaos/orgao-de-teste | /privacy | /privacy | privacy | true | Privacidade |
| /provas/prova-ssr-2026 | / | / | home | false |  |
| /provas/prova-ssr-2026 | /questoes | /questoes | questions_hub | false | Questões |
| /provas/prova-ssr-2026 | /provas | /provas | exam_hub | false | Provas |
| /provas/prova-ssr-2026 | /blog | /blog | blog_hub | false | Notícias |
| /provas/prova-ssr-2026 | /blog | /blog | blog_hub | false | Últimas |
| /provas/prova-ssr-2026 | /blog/categoria/concursos | /blog/categoria/concursos | blog_category | false | Concursos |
| /provas/prova-ssr-2026 | /blog/tag/nordeste | /blog/tag/nordeste | blog_tag | false | Nordeste |
| /provas/prova-ssr-2026 | / | / | home | true | Início |
| /provas/prova-ssr-2026 | /provas | /provas | exam_hub | true | Provas |
| /provas/prova-ssr-2026 | /concursos/concurso-canonico-2026 | /concursos/concurso-canonico-2026 | contest_detail | true | Concurso Canônico 2026 |
| /provas/prova-ssr-2026 | /bancas/cebraspe | /bancas/cebraspe | board_detail | true | Centro Brasileiro de Pesquisa em Avaliação |
| /provas/prova-ssr-2026 | /orgaos/orgao-de-teste | /orgaos/orgao-de-teste | organization_detail | true | Órgão de Teste |
| /provas/prova-ssr-2026 | /cargos/analista | /cargos/analista | position_detail | true | Analista |
| /provas/prova-ssr-2026 | /questoes | /questoes | questions_hub | true | Ir para questões |
| /concursos/concurso-canonico-2026 | / | / | home | false | ConcursoMestre |
| /concursos/concurso-canonico-2026 | / | / | home | false | ConcursoMestre |
| /concursos/concurso-canonico-2026 | /questoes | /questoes | questions_hub | false | Questões |
| /concursos/concurso-canonico-2026 | /simulation | /simulation | private_tools | false | Simulados |
| /concursos/concurso-canonico-2026 | /cronograma | /cronograma | private_tools | false | Cronograma |
| /concursos/concurso-canonico-2026 | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /concursos/concurso-canonico-2026 | /ranking | /ranking | ranking | false | Rankings |
| /concursos/concurso-canonico-2026 | /marketplace | /marketplace | marketplace | false | Loja |
| /concursos/concurso-canonico-2026 | / | / | home | true | Início |
| /concursos/concurso-canonico-2026 | /concursos | /concursos | contest_hub | true | Concursos |
| /concursos/concurso-canonico-2026 | /orgaos/orgao-de-teste | /orgaos/orgao-de-teste | organization_detail | true | ODT |
| /concursos/concurso-canonico-2026 | /bancas/cebraspe | /bancas/cebraspe | board_detail | true | CEBRASPE |
| /concursos/concurso-canonico-2026 | /cargos/analista | /cargos/analista | position_detail | true | Analista |
| /concursos/concurso-canonico-2026 | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Prova SSR 20261 questões |
| /concursos/concurso-canonico-2026 | /questoes/67813/art-5o-acao-e-controle | /questoes/67813/art-5o-acao-e-controle | question_detail | true | Art. 5º — Ação & Controle |
| /concursos/concurso-canonico-2026 | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Ver provas deste concurso |
| /concursos/concurso-canonico-2026 | / | / | home | true | ConcursoMestre |
| /concursos/concurso-canonico-2026 | /questoes | /questoes | questions_hub | true | Questões |
| /concursos/concurso-canonico-2026 | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /concursos/concurso-canonico-2026 | /bancas | /bancas | board_hub | true | Bancas |
| /concursos/concurso-canonico-2026 | /simulados | /simulados | simulations_hub | true | Simulados |
| /concursos/concurso-canonico-2026 | /blog | /blog | blog_hub | true | Blog |
| /concursos/concurso-canonico-2026 | /novidades | /novidades | news | true | Novidades |
| /concursos/concurso-canonico-2026 | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /concursos/concurso-canonico-2026 | /support | /support | support | true | Suporte |
| /concursos/concurso-canonico-2026 | /faq | /faq | faq | true | FAQ |
| /concursos/concurso-canonico-2026 | /terms | /terms | terms | true | Termos de uso |
| /concursos/concurso-canonico-2026 | /privacy | /privacy | privacy | true | Privacidade |
| /carreiras/carreira-fiscal | / | / | home | false | ConcursoMestre |
| /carreiras/carreira-fiscal | / | / | home | false | ConcursoMestre |
| /carreiras/carreira-fiscal | /questoes | /questoes | questions_hub | false | Questões |
| /carreiras/carreira-fiscal | /simulation | /simulation | private_tools | false | Simulados |
| /carreiras/carreira-fiscal | /cronograma | /cronograma | private_tools | false | Cronograma |
| /carreiras/carreira-fiscal | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /carreiras/carreira-fiscal | /ranking | /ranking | ranking | false | Rankings |
| /carreiras/carreira-fiscal | /marketplace | /marketplace | marketplace | false | Loja |
| /carreiras/carreira-fiscal | / | / | home | true | Início |
| /carreiras/carreira-fiscal | /carreiras | /carreiras | careers_hub | true | Carreiras |
| /carreiras/carreira-fiscal | /questoes?career=Carreira%20Fiscal | /questoes?career=Carreira+Fiscal | facet | false | Resolver questões desta carreira |
| /carreiras/carreira-fiscal | /concursos | /concursos | contest_hub | true | Ver concursos |
| /carreiras/carreira-fiscal | /cargos/analista | /cargos/analista | position_detail | true | Analista1 questões · 1 provas |
| /carreiras/carreira-fiscal | /concursos/concurso-canonico-2026 | /concursos/concurso-canonico-2026 | contest_detail | true | Concurso Canônico 2026Órgão de Teste · 2026 |
| /carreiras/carreira-fiscal | /orgaos/orgao-de-teste | /orgaos/orgao-de-teste | organization_detail | true | ODT |
| /carreiras/carreira-fiscal | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Prova SSR 20262026 |
| /carreiras/carreira-fiscal | /questoes/67813/art-5o-acao-e-controle | /questoes/67813/art-5o-acao-e-controle | question_detail | true | Art. 5º — Ação & Controle |
| /carreiras/carreira-fiscal | /bancas/cebraspe | /bancas/cebraspe | board_detail | true | CEBRASPE |
| /carreiras/carreira-fiscal | / | / | home | true | ConcursoMestre |
| /carreiras/carreira-fiscal | /questoes | /questoes | questions_hub | true | Questões |
| /carreiras/carreira-fiscal | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /carreiras/carreira-fiscal | /bancas | /bancas | board_hub | true | Bancas |
| /carreiras/carreira-fiscal | /simulados | /simulados | simulations_hub | true | Simulados |
| /carreiras/carreira-fiscal | /blog | /blog | blog_hub | true | Blog |
| /carreiras/carreira-fiscal | /novidades | /novidades | news | true | Novidades |
| /carreiras/carreira-fiscal | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /carreiras/carreira-fiscal | /support | /support | support | true | Suporte |
| /carreiras/carreira-fiscal | /faq | /faq | faq | true | FAQ |
| /carreiras/carreira-fiscal | /terms | /terms | terms | true | Termos de uso |
| /carreiras/carreira-fiscal | /privacy | /privacy | privacy | true | Privacidade |
| /cargos/analista | / | / | home | false | ConcursoMestre |
| /cargos/analista | / | / | home | false | ConcursoMestre |
| /cargos/analista | /questoes | /questoes | questions_hub | false | Questões |
| /cargos/analista | /simulation | /simulation | private_tools | false | Simulados |
| /cargos/analista | /cronograma | /cronograma | private_tools | false | Cronograma |
| /cargos/analista | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /cargos/analista | /ranking | /ranking | ranking | false | Rankings |
| /cargos/analista | /marketplace | /marketplace | marketplace | false | Loja |
| /cargos/analista | / | / | home | true | Início |
| /cargos/analista | /cargos | /cargos | positions_hub | true | Cargos |
| /cargos/analista | /questoes?role=Analista | /questoes?role=Analista | facet | false | Resolver questões deste cargo |
| /cargos/analista | /concursos?cargo=Analista | /concursos?cargo=Analista | contest_hub | false | Ver concursos |
| /cargos/analista | /carreiras/carreira-fiscal | /carreiras/carreira-fiscal | career_detail | true | Carreira Fiscal |
| /cargos/analista | /concursos/concurso-canonico-2026 | /concursos/concurso-canonico-2026 | contest_detail | true | Concurso Canônico 2026Órgão de Teste · 2026 |
| /cargos/analista | /orgaos/orgao-de-teste | /orgaos/orgao-de-teste | organization_detail | true | ODT |
| /cargos/analista | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Prova SSR 20262026 |
| /cargos/analista | /questoes/67813/art-5o-acao-e-controle | /questoes/67813/art-5o-acao-e-controle | question_detail | true | Art. 5º — Ação & Controle |
| /cargos/analista | /bancas/cebraspe | /bancas/cebraspe | board_detail | true | CEBRASPE |
| /cargos/analista | / | / | home | true | ConcursoMestre |
| /cargos/analista | /questoes | /questoes | questions_hub | true | Questões |
| /cargos/analista | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /cargos/analista | /bancas | /bancas | board_hub | true | Bancas |
| /cargos/analista | /simulados | /simulados | simulations_hub | true | Simulados |
| /cargos/analista | /blog | /blog | blog_hub | true | Blog |
| /cargos/analista | /novidades | /novidades | news | true | Novidades |
| /cargos/analista | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /cargos/analista | /support | /support | support | true | Suporte |
| /cargos/analista | /faq | /faq | faq | true | FAQ |
| /cargos/analista | /terms | /terms | terms | true | Termos de uso |
| /cargos/analista | /privacy | /privacy | privacy | true | Privacidade |
| /simulados/simulado-publico-constitucional | / | / | home | false | ConcursoMestre |
| /simulados/simulado-publico-constitucional | / | / | home | false | ConcursoMestre |
| /simulados/simulado-publico-constitucional | /questoes | /questoes | questions_hub | false | Questões |
| /simulados/simulado-publico-constitucional | /simulation | /simulation | private_tools | false | Simulados |
| /simulados/simulado-publico-constitucional | /cronograma | /cronograma | private_tools | false | Cronograma |
| /simulados/simulado-publico-constitucional | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /simulados/simulado-publico-constitucional | /ranking | /ranking | ranking | false | Rankings |
| /simulados/simulado-publico-constitucional | /marketplace | /marketplace | marketplace | false | Loja |
| /simulados/simulado-publico-constitucional | / | / | home | true | Início |
| /simulados/simulado-publico-constitucional | /simulados | /simulados | simulations_hub | true | Simulados |
| /simulados/simulado-publico-constitucional | /simulation | /simulation | private_tools | false | Abrir área de simulados |
| /simulados/simulado-publico-constitucional | /disciplinas/direito-constitucional | /disciplinas/direito-constitucional | discipline_detail | true | Direito Constitucional |
| /simulados/simulado-publico-constitucional | /carreiras/carreira-fiscal | /carreiras/carreira-fiscal | career_detail | true | Carreira Fiscal |
| /simulados/simulado-publico-constitucional | /cargos/analista | /cargos/analista | position_detail | true | Analista |
| /simulados/simulado-publico-constitucional | /orgaos/orgao-de-teste | /orgaos/orgao-de-teste | organization_detail | true | Órgão de Teste |
| /simulados/simulado-publico-constitucional | /concursos/concurso-canonico-2026 | /concursos/concurso-canonico-2026 | contest_detail | true | Concurso Canônico 2026 |
| /simulados/simulado-publico-constitucional | /provas/prova-ssr-2026 | /provas/prova-ssr-2026 | exam_detail | true | Prova SSR 20262026 |
| /simulados/simulado-publico-constitucional | /questoes/67813/art-5o-acao-e-controle | /questoes/67813/art-5o-acao-e-controle | question_detail | true | Art. 5º — Ação & Controle |
| /simulados/simulado-publico-constitucional | / | / | home | true | ConcursoMestre |
| /simulados/simulado-publico-constitucional | /questoes | /questoes | questions_hub | true | Questões |
| /simulados/simulado-publico-constitucional | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /simulados/simulado-publico-constitucional | /bancas | /bancas | board_hub | true | Bancas |
| /simulados/simulado-publico-constitucional | /simulados | /simulados | simulations_hub | true | Simulados |
| /simulados/simulado-publico-constitucional | /blog | /blog | blog_hub | true | Blog |
| /simulados/simulado-publico-constitucional | /novidades | /novidades | news | true | Novidades |
| /simulados/simulado-publico-constitucional | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /simulados/simulado-publico-constitucional | /support | /support | support | true | Suporte |
| /simulados/simulado-publico-constitucional | /faq | /faq | faq | true | FAQ |
| /simulados/simulado-publico-constitucional | /terms | /terms | terms | true | Termos de uso |
| /simulados/simulado-publico-constitucional | /privacy | /privacy | privacy | true | Privacidade |
| /lei-comentada/constituicao-federal | / | / | home | false | ConcursoMestre |
| /lei-comentada/constituicao-federal | / | / | home | false | ConcursoMestre |
| /lei-comentada/constituicao-federal | /questoes | /questoes | questions_hub | false | Questões |
| /lei-comentada/constituicao-federal | /simulation | /simulation | private_tools | false | Simulados |
| /lei-comentada/constituicao-federal | /cronograma | /cronograma | private_tools | false | Cronograma |
| /lei-comentada/constituicao-federal | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /lei-comentada/constituicao-federal | /ranking | /ranking | ranking | false | Rankings |
| /lei-comentada/constituicao-federal | /marketplace | /marketplace | marketplace | false | Loja |
| /lei-comentada/constituicao-federal | / | / | home | true | Início |
| /lei-comentada/constituicao-federal | /lei-comentada | /lei-comentada | law_hub | true | Lei Comentada |
| /lei-comentada/constituicao-federal | /lei-comentada/constituicao-federal/artigo-5 | /lei-comentada/constituicao-federal/artigo-5 | law_article_detail | true | Art. 5º |
| /lei-comentada/constituicao-federal | / | / | home | true | ConcursoMestre |
| /lei-comentada/constituicao-federal | /questoes | /questoes | questions_hub | true | Questões |
| /lei-comentada/constituicao-federal | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /lei-comentada/constituicao-federal | /bancas | /bancas | board_hub | true | Bancas |
| /lei-comentada/constituicao-federal | /simulados | /simulados | simulations_hub | true | Simulados |
| /lei-comentada/constituicao-federal | /blog | /blog | blog_hub | true | Blog |
| /lei-comentada/constituicao-federal | /novidades | /novidades | news | true | Novidades |
| /lei-comentada/constituicao-federal | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /lei-comentada/constituicao-federal | /support | /support | support | true | Suporte |
| /lei-comentada/constituicao-federal | /faq | /faq | faq | true | FAQ |
| /lei-comentada/constituicao-federal | /terms | /terms | terms | true | Termos de uso |
| /lei-comentada/constituicao-federal | /privacy | /privacy | privacy | true | Privacidade |
| /lei-comentada/constituicao-federal | /lei-comentada/constituicao-federal/artigo-5 | /lei-comentada/constituicao-federal/artigo-5 | law_article_detail | false | Art. 5 |
| /lei-comentada/constituicao-federal/artigo-5 | / | / | home | false | ConcursoMestre |
| /lei-comentada/constituicao-federal/artigo-5 | / | / | home | false | ConcursoMestre |
| /lei-comentada/constituicao-federal/artigo-5 | /questoes | /questoes | questions_hub | false | Questões |
| /lei-comentada/constituicao-federal/artigo-5 | /simulation | /simulation | private_tools | false | Simulados |
| /lei-comentada/constituicao-federal/artigo-5 | /cronograma | /cronograma | private_tools | false | Cronograma |
| /lei-comentada/constituicao-federal/artigo-5 | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /lei-comentada/constituicao-federal/artigo-5 | /ranking | /ranking | ranking | false | Rankings |
| /lei-comentada/constituicao-federal/artigo-5 | /marketplace | /marketplace | marketplace | false | Loja |
| /lei-comentada/constituicao-federal/artigo-5 | / | / | home | true | Início |
| /lei-comentada/constituicao-federal/artigo-5 | /lei-comentada | /lei-comentada | law_hub | true | Lei Comentada |
| /lei-comentada/constituicao-federal/artigo-5 | /lei-comentada/constituicao-federal | /lei-comentada/constituicao-federal | law_detail | true | Constituição Federal |
| /lei-comentada/constituicao-federal/artigo-5 | /lei-comentada/constituicao-federal/artigo-5-a | /lei-comentada/constituicao-federal/artigo-5-a | law_article_detail | true | Próximo artigoArt. 5º-A |
| /lei-comentada/constituicao-federal/artigo-5 | /lei-comentada/constituicao-federal | /lei-comentada/constituicao-federal | law_detail | true | Ver Constituição Federal completa |
| /lei-comentada/constituicao-federal/artigo-5 | / | / | home | true | ConcursoMestre |
| /lei-comentada/constituicao-federal/artigo-5 | /questoes | /questoes | questions_hub | true | Questões |
| /lei-comentada/constituicao-federal/artigo-5 | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /lei-comentada/constituicao-federal/artigo-5 | /bancas | /bancas | board_hub | true | Bancas |
| /lei-comentada/constituicao-federal/artigo-5 | /simulados | /simulados | simulations_hub | true | Simulados |
| /lei-comentada/constituicao-federal/artigo-5 | /blog | /blog | blog_hub | true | Blog |
| /lei-comentada/constituicao-federal/artigo-5 | /novidades | /novidades | news | true | Novidades |
| /lei-comentada/constituicao-federal/artigo-5 | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /lei-comentada/constituicao-federal/artigo-5 | /support | /support | support | true | Suporte |
| /lei-comentada/constituicao-federal/artigo-5 | /faq | /faq | faq | true | FAQ |
| /lei-comentada/constituicao-federal/artigo-5 | /terms | /terms | terms | true | Termos de uso |
| /lei-comentada/constituicao-federal/artigo-5 | /privacy | /privacy | privacy | true | Privacidade |
| /materiais/guia-publico-de-estudo | / | / | home | false | ConcursoMestre |
| /materiais/guia-publico-de-estudo | / | / | home | false | ConcursoMestre |
| /materiais/guia-publico-de-estudo | /questoes | /questoes | questions_hub | false | Questões |
| /materiais/guia-publico-de-estudo | /simulation | /simulation | private_tools | false | Simulados |
| /materiais/guia-publico-de-estudo | /cronograma | /cronograma | private_tools | false | Cronograma |
| /materiais/guia-publico-de-estudo | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /materiais/guia-publico-de-estudo | /ranking | /ranking | ranking | false | Rankings |
| /materiais/guia-publico-de-estudo | /marketplace | /marketplace | marketplace | false | Loja |
| /materiais/guia-publico-de-estudo | / | / | home | true | Início |
| /materiais/guia-publico-de-estudo | /materiais | /materiais | materials_hub | true | Materiais |
| /materiais/guia-publico-de-estudo | /marketplace?openMaterial=mat-publico-1 | /marketplace?openMaterial=mat-publico-1 | marketplace | false | Ver oferta no marketplace |
| /materiais/guia-publico-de-estudo | /disciplinas/direito-constitucional | /disciplinas/direito-constitucional | discipline_detail | true | Direito Constitucional |
| /materiais/guia-publico-de-estudo | / | / | home | true | ConcursoMestre |
| /materiais/guia-publico-de-estudo | /questoes | /questoes | questions_hub | true | Questões |
| /materiais/guia-publico-de-estudo | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /materiais/guia-publico-de-estudo | /bancas | /bancas | board_hub | true | Bancas |
| /materiais/guia-publico-de-estudo | /simulados | /simulados | simulations_hub | true | Simulados |
| /materiais/guia-publico-de-estudo | /blog | /blog | blog_hub | true | Blog |
| /materiais/guia-publico-de-estudo | /novidades | /novidades | news | true | Novidades |
| /materiais/guia-publico-de-estudo | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /materiais/guia-publico-de-estudo | /support | /support | support | true | Suporte |
| /materiais/guia-publico-de-estudo | /faq | /faq | faq | true | FAQ |
| /materiais/guia-publico-de-estudo | /terms | /terms | terms | true | Termos de uso |
| /materiais/guia-publico-de-estudo | /privacy | /privacy | privacy | true | Privacidade |
| /blog/noticia-ssr | / | / | home | false |  |
| /blog/noticia-ssr | /questoes | /questoes | questions_hub | false | Questões |
| /blog/noticia-ssr | /provas | /provas | exam_hub | false | Provas |
| /blog/noticia-ssr | /blog | /blog | blog_hub | false | Notícias |
| /blog/noticia-ssr | /blog | /blog | blog_hub | false | Últimas |
| /blog/noticia-ssr | /blog/categoria/concursos | /blog/categoria/concursos | blog_category | false | Concursos |
| /blog/noticia-ssr | /blog/tag/nordeste | /blog/tag/nordeste | blog_tag | false | Nordeste |
| /blog/noticia-ssr | / | / | home | true | Início |
| /blog/noticia-ssr | /blog | /blog | blog_hub | true | Blog |
| /blog/noticia-ssr | /blog/categoria/concursos | /blog/categoria/concursos | blog_category | true | Concursos |
| /blog/noticia-ssr | /blog/autor/staff-1 | /blog/autor/staff-1 | blog_author | true | Equipe ConcursoMestre |
| /blog/noticia-ssr | /blog/tag/nordeste | /blog/tag/nordeste | blog_tag | false | Nordeste |
| /blog/noticia-ssr | /blog/autor/staff-1 | /blog/autor/staff-1 | blog_author | true | Equipe ConcursoMestre |
| /blog/noticia-ssr | /auth | /auth | auth | false | Fazer Login |
| /blog/noticia-ssr | / | / | home | false | ConcursoMestre |
| /blog/noticia-ssr | /disciplinas | /disciplinas | discipline_hub | false | Disciplinas |
| /blog/noticia-ssr | /bancas | /bancas | board_hub | false | Bancas |
| /blog/noticia-ssr | /#recursos | / | home | false | Recursos |
| /blog/noticia-ssr | /#planos | / | home | false | Planos |
| /blog/noticia-ssr | /#depoimentos | / | home | false | Depoimentos |
| /blog/noticia-ssr | /blog | /blog | blog_hub | false | Blog |
| /blog/noticia-ssr | /novidades | /novidades | news | false | Novidades |
| /blog/noticia-ssr | /support | /support | support | false | Central de ajuda |
| /blog/noticia-ssr | /support | /support | support | false | Fale conosco |
| /blog/noticia-ssr | /terms | /terms | terms | false | Termos de uso |
| /blog/noticia-ssr | /privacy | /privacy | privacy | false | Política de privacidade |
| /blog/categoria/concursos | / | / | home | false |  |
| /blog/categoria/concursos | /questoes | /questoes | questions_hub | false | Questões |
| /blog/categoria/concursos | /provas | /provas | exam_hub | false | Provas |
| /blog/categoria/concursos | /blog | /blog | blog_hub | false | Notícias |
| /blog/categoria/concursos | /blog | /blog | blog_hub | false | Últimas |
| /blog/categoria/concursos | /blog/categoria/concursos | /blog/categoria/concursos | blog_category | false | Concursos |
| /blog/categoria/concursos | /blog/tag/nordeste | /blog/tag/nordeste | blog_tag | false | Nordeste |
| /blog/categoria/concursos | / | / | home | true | Início |
| /blog/categoria/concursos | /blog | /blog | blog_hub | true | Blog |
| /blog/categoria/concursos | /blog/categoria/concursos | /blog/categoria/concursos | blog_category | true | Concursos |
| /blog/categoria/concursos | /blog/noticia-ssr | /blog/noticia-ssr | blog_article | true | Notícia SSR de teste |
| /blog/categoria/concursos | /blog/tag/nordeste | /blog/tag/nordeste | blog_tag | false | Nordeste |
| /blog/categoria/concursos | /blog/autor/staff-1 | /blog/autor/staff-1 | blog_author | true | Por Equipe ConcursoMestre |
| /blog/categoria/concursos | / | / | home | false | ConcursoMestre |
| /blog/categoria/concursos | /disciplinas | /disciplinas | discipline_hub | false | Disciplinas |
| /blog/categoria/concursos | /bancas | /bancas | board_hub | false | Bancas |
| /blog/categoria/concursos | /#recursos | / | home | false | Recursos |
| /blog/categoria/concursos | /#planos | / | home | false | Planos |
| /blog/categoria/concursos | /#depoimentos | / | home | false | Depoimentos |
| /blog/categoria/concursos | /blog | /blog | blog_hub | false | Blog |
| /blog/categoria/concursos | /novidades | /novidades | news | false | Novidades |
| /blog/categoria/concursos | /support | /support | support | false | Central de ajuda |
| /blog/categoria/concursos | /support | /support | support | false | Fale conosco |
| /blog/categoria/concursos | /terms | /terms | terms | false | Termos de uso |
| /blog/categoria/concursos | /privacy | /privacy | privacy | false | Política de privacidade |
| /blog/autor/staff-1 | / | / | home | false |  |
| /blog/autor/staff-1 | /questoes | /questoes | questions_hub | false | Questões |
| /blog/autor/staff-1 | /provas | /provas | exam_hub | false | Provas |
| /blog/autor/staff-1 | /blog | /blog | blog_hub | false | Notícias |
| /blog/autor/staff-1 | /blog | /blog | blog_hub | false | Últimas |
| /blog/autor/staff-1 | /blog/categoria/concursos | /blog/categoria/concursos | blog_category | false | Concursos |
| /blog/autor/staff-1 | /blog/tag/nordeste | /blog/tag/nordeste | blog_tag | false | Nordeste |
| /blog/autor/staff-1 | / | / | home | true | Início |
| /blog/autor/staff-1 | /blog | /blog | blog_hub | true | Blog |
| /blog/autor/staff-1 | /blog/categoria/concursos | /blog/categoria/concursos | blog_category | true | Concursos |
| /blog/autor/staff-1 | /blog/noticia-ssr | /blog/noticia-ssr | blog_article | true | Notícia SSR de teste |
| /blog/autor/staff-1 | /blog/tag/nordeste | /blog/tag/nordeste | blog_tag | false | Nordeste |
| /blog/autor/staff-1 | /blog/autor/staff-1 | /blog/autor/staff-1 | blog_author | true | Por Equipe ConcursoMestre |
| /blog/autor/staff-1 | / | / | home | false | ConcursoMestre |
| /blog/autor/staff-1 | /disciplinas | /disciplinas | discipline_hub | false | Disciplinas |
| /blog/autor/staff-1 | /bancas | /bancas | board_hub | false | Bancas |
| /blog/autor/staff-1 | /#recursos | / | home | false | Recursos |
| /blog/autor/staff-1 | /#planos | / | home | false | Planos |
| /blog/autor/staff-1 | /#depoimentos | / | home | false | Depoimentos |
| /blog/autor/staff-1 | /blog | /blog | blog_hub | false | Blog |
| /blog/autor/staff-1 | /novidades | /novidades | news | false | Novidades |
| /blog/autor/staff-1 | /support | /support | support | false | Central de ajuda |
| /blog/autor/staff-1 | /support | /support | support | false | Fale conosco |
| /blog/autor/staff-1 | /terms | /terms | terms | false | Termos de uso |
| /blog/autor/staff-1 | /privacy | /privacy | privacy | false | Política de privacidade |
| /elite | / | / | home | false | Início |
| /ranking | / | / | home | false | ConcursoMestre |
| /ranking | / | / | home | false | ConcursoMestre |
| /ranking | /questoes | /questoes | questions_hub | false | Questões |
| /ranking | /simulation | /simulation | private_tools | false | Simulados |
| /ranking | /cronograma | /cronograma | private_tools | false | Cronograma |
| /ranking | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /ranking | /ranking | /ranking | ranking | false | Rankings |
| /ranking | /marketplace | /marketplace | marketplace | false | Loja |
| /ranking | / | / | home | true | ConcursoMestre |
| /ranking | /questoes | /questoes | questions_hub | true | Questões |
| /ranking | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /ranking | /bancas | /bancas | board_hub | true | Bancas |
| /ranking | /simulados | /simulados | simulations_hub | true | Simulados |
| /ranking | /blog | /blog | blog_hub | true | Blog |
| /ranking | /novidades | /novidades | news | true | Novidades |
| /ranking | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /ranking | /support | /support | support | true | Suporte |
| /ranking | /faq | /faq | faq | true | FAQ |
| /ranking | /terms | /terms | terms | true | Termos de uso |
| /ranking | /privacy | /privacy | privacy | true | Privacidade |
| /blog/tag/nordeste | / | / | home | false |  |
| /blog/tag/nordeste | /questoes | /questoes | questions_hub | false | Questões |
| /blog/tag/nordeste | /provas | /provas | exam_hub | false | Provas |
| /blog/tag/nordeste | /blog | /blog | blog_hub | false | Notícias |
| /blog/tag/nordeste | /blog | /blog | blog_hub | false | Últimas |
| /blog/tag/nordeste | /blog/categoria/concursos | /blog/categoria/concursos | blog_category | false | Concursos |
| /blog/tag/nordeste | /blog/tag/nordeste | /blog/tag/nordeste | blog_tag | false | Nordeste |
| /blog/tag/nordeste | / | / | home | true | Início |
| /blog/tag/nordeste | /blog | /blog | blog_hub | true | Blog |
| /blog/tag/nordeste | /blog/categoria/concursos | /blog/categoria/concursos | blog_category | true | Concursos |
| /blog/tag/nordeste | /blog/noticia-ssr | /blog/noticia-ssr | blog_article | true | Notícia SSR de teste |
| /blog/tag/nordeste | /blog/tag/nordeste | /blog/tag/nordeste | blog_tag | false | Nordeste |
| /blog/tag/nordeste | /blog/autor/staff-1 | /blog/autor/staff-1 | blog_author | true | Por Equipe ConcursoMestre |
| /blog/tag/nordeste | / | / | home | false | ConcursoMestre |
| /blog/tag/nordeste | /disciplinas | /disciplinas | discipline_hub | false | Disciplinas |
| /blog/tag/nordeste | /bancas | /bancas | board_hub | false | Bancas |
| /blog/tag/nordeste | /#recursos | / | home | false | Recursos |
| /blog/tag/nordeste | /#planos | / | home | false | Planos |
| /blog/tag/nordeste | /#depoimentos | / | home | false | Depoimentos |
| /blog/tag/nordeste | /blog | /blog | blog_hub | false | Blog |
| /blog/tag/nordeste | /novidades | /novidades | news | false | Novidades |
| /blog/tag/nordeste | /support | /support | support | false | Central de ajuda |
| /blog/tag/nordeste | /support | /support | support | false | Fale conosco |
| /blog/tag/nordeste | /terms | /terms | terms | false | Termos de uso |
| /blog/tag/nordeste | /privacy | /privacy | privacy | false | Política de privacidade |
| /marketplace | / | / | home | false | ConcursoMestre |
| /marketplace | / | / | home | false | ConcursoMestre |
| /marketplace | /questoes | /questoes | questions_hub | false | Questões |
| /marketplace | /simulation | /simulation | private_tools | false | Simulados |
| /marketplace | /cronograma | /cronograma | private_tools | false | Cronograma |
| /marketplace | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /marketplace | /ranking | /ranking | ranking | false | Rankings |
| /marketplace | /marketplace | /marketplace | marketplace | false | Loja |
| /marketplace | / | / | home | true | Início |
| /marketplace | /materiais/guia-publico-de-estudo | /materiais/guia-publico-de-estudo | material_detail | true | Ver página pública |
| /marketplace | /materiais/material-gratuito-publico | /materiais/material-gratuito-publico | material_detail | true | Ver página pública |
| /marketplace | / | / | home | true | ConcursoMestre |
| /marketplace | /questoes | /questoes | questions_hub | true | Questões |
| /marketplace | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /marketplace | /bancas | /bancas | board_hub | true | Bancas |
| /marketplace | /simulados | /simulados | simulations_hub | true | Simulados |
| /marketplace | /blog | /blog | blog_hub | true | Blog |
| /marketplace | /novidades | /novidades | news | true | Novidades |
| /marketplace | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /marketplace | /support | /support | support | true | Suporte |
| /marketplace | /faq | /faq | faq | true | FAQ |
| /marketplace | /terms | /terms | terms | true | Termos de uso |
| /marketplace | /privacy | /privacy | privacy | true | Privacidade |
| /busca | / | / | home | false | ConcursoMestre |
| /busca | / | / | home | false | ConcursoMestre |
| /busca | /questoes | /questoes | questions_hub | false | Questões |
| /busca | /simulation | /simulation | private_tools | false | Simulados |
| /busca | /cronograma | /cronograma | private_tools | false | Cronograma |
| /busca | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /busca | /ranking | /ranking | ranking | false | Rankings |
| /busca | /marketplace | /marketplace | marketplace | false | Loja |
| /busca | / | / | home | true | Início |
| /busca | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /busca | /bancas | /bancas | board_hub | true | Bancas |
| /busca | /provas | /provas | exam_hub | true | Provas |
| /busca | /questoes/67813/art-5o-acao-e-controle | /questoes/67813/art-5o-acao-e-controle | question_detail | true | Art. 5º — Ação & Controle |
| /busca | / | / | home | true | ConcursoMestre |
| /busca | /questoes | /questoes | questions_hub | true | Questões |
| /busca | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /busca | /bancas | /bancas | board_hub | true | Bancas |
| /busca | /simulados | /simulados | simulations_hub | true | Simulados |
| /busca | /blog | /blog | blog_hub | true | Blog |
| /busca | /novidades | /novidades | news | true | Novidades |
| /busca | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /busca | /support | /support | support | true | Suporte |
| /busca | /faq | /faq | faq | true | FAQ |
| /busca | /terms | /terms | terms | true | Termos de uso |
| /busca | /privacy | /privacy | privacy | true | Privacidade |
| /busca | /questoes/67813/art-5o-acao-e-controle | /questoes/67813/art-5o-acao-e-controle | question_detail | false | Q67813 |
| /auth | / | / | home | false | ConcursoMestre |
| /auth | / | / | home | true | ConcursoMestre |
| /auth | / | / | home | true | Voltar para a home |
| /simulation | / | / | home | false | ConcursoMestre |
| /simulation | / | / | home | false | ConcursoMestre |
| /simulation | /questoes | /questoes | questions_hub | false | Questões |
| /simulation | /simulation | /simulation | private_tools | false | Simulados |
| /simulation | /cronograma | /cronograma | private_tools | false | Cronograma |
| /simulation | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /simulation | /ranking | /ranking | ranking | false | Rankings |
| /simulation | /marketplace | /marketplace | marketplace | false | Loja |
| /simulation | / | / | home | true | ConcursoMestre |
| /simulation | /questoes | /questoes | questions_hub | true | Questões |
| /simulation | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /simulation | /bancas | /bancas | board_hub | true | Bancas |
| /simulation | /simulados | /simulados | simulations_hub | true | Simulados |
| /simulation | /blog | /blog | blog_hub | true | Blog |
| /simulation | /novidades | /novidades | news | true | Novidades |
| /simulation | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /simulation | /support | /support | support | true | Suporte |
| /simulation | /faq | /faq | faq | true | FAQ |
| /simulation | /terms | /terms | terms | true | Termos de uso |
| /simulation | /privacy | /privacy | privacy | true | Privacidade |
| /materiais/material-gratuito-publico | / | / | home | false | ConcursoMestre |
| /materiais/material-gratuito-publico | / | / | home | false | ConcursoMestre |
| /materiais/material-gratuito-publico | /questoes | /questoes | questions_hub | false | Questões |
| /materiais/material-gratuito-publico | /simulation | /simulation | private_tools | false | Simulados |
| /materiais/material-gratuito-publico | /cronograma | /cronograma | private_tools | false | Cronograma |
| /materiais/material-gratuito-publico | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /materiais/material-gratuito-publico | /ranking | /ranking | ranking | false | Rankings |
| /materiais/material-gratuito-publico | /marketplace | /marketplace | marketplace | false | Loja |
| /materiais/material-gratuito-publico | / | / | home | true | Início |
| /materiais/material-gratuito-publico | /materiais | /materiais | materials_hub | true | Materiais |
| /materiais/material-gratuito-publico | /marketplace?openMaterial=mat-gratis-1 | /marketplace?openMaterial=mat-gratis-1 | marketplace | false | Ver oferta no marketplace |
| /materiais/material-gratuito-publico | /disciplinas/direito-constitucional | /disciplinas/direito-constitucional | discipline_detail | true | Direito Constitucional |
| /materiais/material-gratuito-publico | / | / | home | true | ConcursoMestre |
| /materiais/material-gratuito-publico | /questoes | /questoes | questions_hub | true | Questões |
| /materiais/material-gratuito-publico | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /materiais/material-gratuito-publico | /bancas | /bancas | board_hub | true | Bancas |
| /materiais/material-gratuito-publico | /simulados | /simulados | simulations_hub | true | Simulados |
| /materiais/material-gratuito-publico | /blog | /blog | blog_hub | true | Blog |
| /materiais/material-gratuito-publico | /novidades | /novidades | news | true | Novidades |
| /materiais/material-gratuito-publico | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /materiais/material-gratuito-publico | /support | /support | support | true | Suporte |
| /materiais/material-gratuito-publico | /faq | /faq | faq | true | FAQ |
| /materiais/material-gratuito-publico | /terms | /terms | terms | true | Termos de uso |
| /materiais/material-gratuito-publico | /privacy | /privacy | privacy | true | Privacidade |
| /materiais/material-historico | / | / | home | false | ConcursoMestre |
| /materiais/material-historico | / | / | home | false | ConcursoMestre |
| /materiais/material-historico | /questoes | /questoes | questions_hub | false | Questões |
| /materiais/material-historico | /simulation | /simulation | private_tools | false | Simulados |
| /materiais/material-historico | /cronograma | /cronograma | private_tools | false | Cronograma |
| /materiais/material-historico | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /materiais/material-historico | /ranking | /ranking | ranking | false | Rankings |
| /materiais/material-historico | /marketplace | /marketplace | marketplace | false | Loja |
| /materiais/material-historico | / | / | home | true | Início |
| /materiais/material-historico | /materiais | /materiais | materials_hub | true | Materiais |
| /materiais/material-historico | /disciplinas/direito-constitucional | /disciplinas/direito-constitucional | discipline_detail | true | Direito Constitucional |
| /materiais/material-historico | / | / | home | true | ConcursoMestre |
| /materiais/material-historico | /questoes | /questoes | questions_hub | true | Questões |
| /materiais/material-historico | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /materiais/material-historico | /bancas | /bancas | board_hub | true | Bancas |
| /materiais/material-historico | /simulados | /simulados | simulations_hub | true | Simulados |
| /materiais/material-historico | /blog | /blog | blog_hub | true | Blog |
| /materiais/material-historico | /novidades | /novidades | news | true | Novidades |
| /materiais/material-historico | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /materiais/material-historico | /support | /support | support | true | Suporte |
| /materiais/material-historico | /faq | /faq | faq | true | FAQ |
| /materiais/material-historico | /terms | /terms | terms | true | Termos de uso |
| /materiais/material-historico | /privacy | /privacy | privacy | true | Privacidade |
| /lei-comentada/constituicao-federal/artigo-5-a | / | / | home | false | ConcursoMestre |
| /lei-comentada/constituicao-federal/artigo-5-a | / | / | home | false | ConcursoMestre |
| /lei-comentada/constituicao-federal/artigo-5-a | /questoes | /questoes | questions_hub | false | Questões |
| /lei-comentada/constituicao-federal/artigo-5-a | /simulation | /simulation | private_tools | false | Simulados |
| /lei-comentada/constituicao-federal/artigo-5-a | /cronograma | /cronograma | private_tools | false | Cronograma |
| /lei-comentada/constituicao-federal/artigo-5-a | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /lei-comentada/constituicao-federal/artigo-5-a | /ranking | /ranking | ranking | false | Rankings |
| /lei-comentada/constituicao-federal/artigo-5-a | /marketplace | /marketplace | marketplace | false | Loja |
| /lei-comentada/constituicao-federal/artigo-5-a | / | / | home | true | Início |
| /lei-comentada/constituicao-federal/artigo-5-a | /lei-comentada | /lei-comentada | law_hub | true | Lei Comentada |
| /lei-comentada/constituicao-federal/artigo-5-a | /lei-comentada/constituicao-federal | /lei-comentada/constituicao-federal | law_detail | true | Constituição Federal |
| /lei-comentada/constituicao-federal/artigo-5-a | /lei-comentada/constituicao-federal/artigo-5 | /lei-comentada/constituicao-federal/artigo-5 | law_article_detail | true | Artigo anteriorArt. 5º |
| /lei-comentada/constituicao-federal/artigo-5-a | /lei-comentada/constituicao-federal/artigo-5-b | /lei-comentada/constituicao-federal/artigo-5-b | law_article_detail | true | Próximo artigoArt. 5º-B |
| /lei-comentada/constituicao-federal/artigo-5-a | /lei-comentada/constituicao-federal | /lei-comentada/constituicao-federal | law_detail | true | Ver Constituição Federal completa |
| /lei-comentada/constituicao-federal/artigo-5-a | / | / | home | true | ConcursoMestre |
| /lei-comentada/constituicao-federal/artigo-5-a | /questoes | /questoes | questions_hub | true | Questões |
| /lei-comentada/constituicao-federal/artigo-5-a | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /lei-comentada/constituicao-federal/artigo-5-a | /bancas | /bancas | board_hub | true | Bancas |
| /lei-comentada/constituicao-federal/artigo-5-a | /simulados | /simulados | simulations_hub | true | Simulados |
| /lei-comentada/constituicao-federal/artigo-5-a | /blog | /blog | blog_hub | true | Blog |
| /lei-comentada/constituicao-federal/artigo-5-a | /novidades | /novidades | news | true | Novidades |
| /lei-comentada/constituicao-federal/artigo-5-a | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /lei-comentada/constituicao-federal/artigo-5-a | /support | /support | support | true | Suporte |
| /lei-comentada/constituicao-federal/artigo-5-a | /faq | /faq | faq | true | FAQ |
| /lei-comentada/constituicao-federal/artigo-5-a | /terms | /terms | terms | true | Termos de uso |
| /lei-comentada/constituicao-federal/artigo-5-a | /privacy | /privacy | privacy | true | Privacidade |
| /lei-comentada/constituicao-federal/artigo-5-b | / | / | home | false | ConcursoMestre |
| /lei-comentada/constituicao-federal/artigo-5-b | / | / | home | false | ConcursoMestre |
| /lei-comentada/constituicao-federal/artigo-5-b | /questoes | /questoes | questions_hub | false | Questões |
| /lei-comentada/constituicao-federal/artigo-5-b | /simulation | /simulation | private_tools | false | Simulados |
| /lei-comentada/constituicao-federal/artigo-5-b | /cronograma | /cronograma | private_tools | false | Cronograma |
| /lei-comentada/constituicao-federal/artigo-5-b | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /lei-comentada/constituicao-federal/artigo-5-b | /ranking | /ranking | ranking | false | Rankings |
| /lei-comentada/constituicao-federal/artigo-5-b | /marketplace | /marketplace | marketplace | false | Loja |
| /lei-comentada/constituicao-federal/artigo-5-b | / | / | home | true | Início |
| /lei-comentada/constituicao-federal/artigo-5-b | /lei-comentada | /lei-comentada | law_hub | true | Lei Comentada |
| /lei-comentada/constituicao-federal/artigo-5-b | /lei-comentada/constituicao-federal | /lei-comentada/constituicao-federal | law_detail | true | Constituição Federal |
| /lei-comentada/constituicao-federal/artigo-5-b | /lei-comentada/constituicao-federal/artigo-5-a | /lei-comentada/constituicao-federal/artigo-5-a | law_article_detail | true | Artigo anteriorArt. 5º-A |
| /lei-comentada/constituicao-federal/artigo-5-b | /lei-comentada/constituicao-federal/artigo-6 | /lei-comentada/constituicao-federal/artigo-6 | law_article_detail | true | Próximo artigoArt. 6º |
| /lei-comentada/constituicao-federal/artigo-5-b | /lei-comentada/constituicao-federal | /lei-comentada/constituicao-federal | law_detail | true | Ver Constituição Federal completa |
| /lei-comentada/constituicao-federal/artigo-5-b | / | / | home | true | ConcursoMestre |
| /lei-comentada/constituicao-federal/artigo-5-b | /questoes | /questoes | questions_hub | true | Questões |
| /lei-comentada/constituicao-federal/artigo-5-b | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /lei-comentada/constituicao-federal/artigo-5-b | /bancas | /bancas | board_hub | true | Bancas |
| /lei-comentada/constituicao-federal/artigo-5-b | /simulados | /simulados | simulations_hub | true | Simulados |
| /lei-comentada/constituicao-federal/artigo-5-b | /blog | /blog | blog_hub | true | Blog |
| /lei-comentada/constituicao-federal/artigo-5-b | /novidades | /novidades | news | true | Novidades |
| /lei-comentada/constituicao-federal/artigo-5-b | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /lei-comentada/constituicao-federal/artigo-5-b | /support | /support | support | true | Suporte |
| /lei-comentada/constituicao-federal/artigo-5-b | /faq | /faq | faq | true | FAQ |
| /lei-comentada/constituicao-federal/artigo-5-b | /terms | /terms | terms | true | Termos de uso |
| /lei-comentada/constituicao-federal/artigo-5-b | /privacy | /privacy | privacy | true | Privacidade |
| /lei-comentada/constituicao-federal/artigo-6 | / | / | home | false | ConcursoMestre |
| /lei-comentada/constituicao-federal/artigo-6 | / | / | home | false | ConcursoMestre |
| /lei-comentada/constituicao-federal/artigo-6 | /questoes | /questoes | questions_hub | false | Questões |
| /lei-comentada/constituicao-federal/artigo-6 | /simulation | /simulation | private_tools | false | Simulados |
| /lei-comentada/constituicao-federal/artigo-6 | /cronograma | /cronograma | private_tools | false | Cronograma |
| /lei-comentada/constituicao-federal/artigo-6 | /x-ray | /x-ray | private_tools | false | Raio-X Banca |
| /lei-comentada/constituicao-federal/artigo-6 | /ranking | /ranking | ranking | false | Rankings |
| /lei-comentada/constituicao-federal/artigo-6 | /marketplace | /marketplace | marketplace | false | Loja |
| /lei-comentada/constituicao-federal/artigo-6 | / | / | home | true | Início |
| /lei-comentada/constituicao-federal/artigo-6 | /lei-comentada | /lei-comentada | law_hub | true | Lei Comentada |
| /lei-comentada/constituicao-federal/artigo-6 | /lei-comentada/constituicao-federal | /lei-comentada/constituicao-federal | law_detail | true | Constituição Federal |
| /lei-comentada/constituicao-federal/artigo-6 | /lei-comentada/constituicao-federal | /lei-comentada/constituicao-federal | law_detail | true | Ver Constituição Federal completa |
| /lei-comentada/constituicao-federal/artigo-6 | / | / | home | true | ConcursoMestre |
| /lei-comentada/constituicao-federal/artigo-6 | /questoes | /questoes | questions_hub | true | Questões |
| /lei-comentada/constituicao-federal/artigo-6 | /disciplinas | /disciplinas | discipline_hub | true | Disciplinas |
| /lei-comentada/constituicao-federal/artigo-6 | /bancas | /bancas | board_hub | true | Bancas |
| /lei-comentada/constituicao-federal/artigo-6 | /simulados | /simulados | simulations_hub | true | Simulados |
| /lei-comentada/constituicao-federal/artigo-6 | /blog | /blog | blog_hub | true | Blog |
| /lei-comentada/constituicao-federal/artigo-6 | /novidades | /novidades | news | true | Novidades |
| /lei-comentada/constituicao-federal/artigo-6 | /lei-comentada | /lei-comentada | law_hub | true | Lei comentada |
| /lei-comentada/constituicao-federal/artigo-6 | /support | /support | support | true | Suporte |
| /lei-comentada/constituicao-federal/artigo-6 | /faq | /faq | faq | true | FAQ |
| /lei-comentada/constituicao-federal/artigo-6 | /terms | /terms | terms | true | Termos de uso |
| /lei-comentada/constituicao-federal/artigo-6 | /privacy | /privacy | privacy | true | Privacidade |

## CE. Performance regression matrix

| Rota | Key | Viewport | Classificação | HTML raw | HTML hydrated | RSC | Server fetches | Browser fetches | Console | Page errors | Hydration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | home | desktop | EQUIVALENT | 250233 | 250310 | 164033 |  | 0 | 0 | 0 | 0 |
| / | home | mobile | EQUIVALENT | 250233 | 250310 | 164033 |  | 0 | 0 | 0 | 0 |
| /questoes | questions_hub | desktop | EQUIVALENT | 263541 | 264838 | 191 |  | 0 | 0 | 0 | 0 |
| /questoes | questions_hub | mobile | EQUIVALENT | 263541 | 264838 | 191 |  | 0 | 0 | 0 | 0 |
| /questoes/67813/art-5o-acao-e-controle | question_detail | desktop | EQUIVALENT | 243989 | 248171 | 289 |  | 0 | 0 | 0 | 0 |
| /questoes/67813/art-5o-acao-e-controle | question_detail | mobile | EQUIVALENT | 243989 | 248171 | 289 |  | 0 | 0 | 0 | 0 |
| /disciplinas | discipline_hub | desktop | EQUIVALENT | 254181 | 255462 | 168 |  | 0 | 0 | 0 | 0 |
| /disciplinas | discipline_hub | mobile | EQUIVALENT | 254181 | 255462 | 168 |  | 0 | 0 | 0 | 0 |
| /disciplinas/direito-constitucional | discipline_detail | desktop | EQUIVALENT | 239726 | 241008 | 226 |  | 0 | 0 | 0 | 0 |
| /disciplinas/direito-constitucional | discipline_detail | mobile | EQUIVALENT | 239726 | 241008 | 226 |  | 0 | 0 | 0 | 0 |
| /topicos/controle-de-constitucionalidade | topic_detail | desktop | EQUIVALENT | 240437 | 241719 | 227 |  | 0 | 0 | 0 | 0 |
| /topicos/controle-de-constitucionalidade | topic_detail | mobile | EQUIVALENT | 240437 | 241719 | 227 |  | 0 | 0 | 0 | 0 |
| /assuntos/controle-concentrado | subject_detail | desktop | EQUIVALENT | 239730 | 241012 | 218 |  | 0 | 0 | 0 | 0 |
| /assuntos/controle-concentrado | subject_detail | mobile | EQUIVALENT | 239730 | 241012 | 218 |  | 0 | 0 | 0 | 0 |
| /bancas/cebraspe | board_detail | desktop | EQUIVALENT | 250491 | 251775 | 202 |  | 0 | 0 | 0 | 0 |
| /bancas/cebraspe | board_detail | mobile | EQUIVALENT | 250491 | 251775 | 202 |  | 0 | 0 | 0 | 0 |
| /orgaos/orgao-de-teste | organization_detail | desktop | EQUIVALENT | 251595 | 252877 | 208 |  | 0 | 0 | 0 | 0 |
| /orgaos/orgao-de-teste | organization_detail | mobile | EQUIVALENT | 251595 | 252877 | 208 |  | 0 | 0 | 0 | 0 |
| /provas/prova-ssr-2026 | exam_detail | desktop | INTERACTION_ONLY | 232843 | 235497 | 208 |  | 0 | 0 | 0 | 0 |
| /provas/prova-ssr-2026 | exam_detail | mobile | INTERACTION_ONLY | 232843 | 235619 | 208 |  | 0 | 0 | 0 | 0 |
| /concursos | contest_hub | desktop | EQUIVALENT | 232703 | 233983 | 193 |  | 0 | 0 | 0 | 0 |
| /concursos | contest_hub | mobile | EQUIVALENT | 232703 | 233983 | 193 |  | 0 | 0 | 0 | 0 |
| /concursos/concurso-canonico-2026 | contest_detail | desktop | EQUIVALENT | 246149 | 247439 | 251 |  | 0 | 0 | 0 | 0 |
| /concursos/concurso-canonico-2026 | contest_detail | mobile | EQUIVALENT | 246149 | 247439 | 251 |  | 0 | 0 | 0 | 0 |
| /concursos-abertos | open_contests | desktop | EQUIVALENT | 231985 | 233308 | 180 |  | 0 | 0 | 0 | 0 |
| /concursos-abertos | open_contests | mobile | EQUIVALENT | 232028 | 233308 | 180 |  | 0 | 0 | 0 | 0 |
| /carreiras | careers_hub | desktop | EQUIVALENT | 235274 | 236555 | 164 |  | 0 | 0 | 0 | 0 |
| /carreiras | careers_hub | mobile | EQUIVALENT | 235274 | 236555 | 164 |  | 0 | 0 | 0 | 0 |
| /carreiras/carreira-fiscal | career_detail | desktop | EQUIVALENT | 241629 | 242911 | 215 |  | 0 | 0 | 0 | 0 |
| /carreiras/carreira-fiscal | career_detail | mobile | EQUIVALENT | 241629 | 242911 | 215 |  | 0 | 0 | 0 | 0 |
| /cargos | positions_hub | desktop | EQUIVALENT | 235199 | 236480 | 158 |  | 0 | 0 | 0 | 0 |
| /cargos | positions_hub | mobile | EQUIVALENT | 235199 | 236480 | 158 |  | 0 | 0 | 0 | 0 |
| /cargos/analista | position_detail | desktop | EQUIVALENT | 240860 | 242142 | 202 |  | 0 | 0 | 0 | 0 |
| /cargos/analista | position_detail | mobile | EQUIVALENT | 240860 | 242142 | 202 |  | 0 | 0 | 0 | 0 |
| /simulados | simulations_hub | desktop | EQUIVALENT | 228314 | 229595 | 164 |  | 0 | 0 | 0 | 0 |
| /simulados | simulations_hub | mobile | EQUIVALENT | 228314 | 229595 | 164 |  | 0 | 0 | 0 | 0 |
| /simulados/simulado-publico-constitucional | simulation_detail | desktop | EQUIVALENT | 243905 | 245386 | 231 |  | 0 | 0 | 0 | 0 |
| /simulados/simulado-publico-constitucional | simulation_detail | mobile | EQUIVALENT | 243905 | 245386 | 231 |  | 0 | 0 | 0 | 0 |
| /lei-comentada | law_hub | desktop | EQUIVALENT | 229522 | 230061 | 168000 |  | 0 | 0 | 0 | 0 |
| /lei-comentada | law_hub | mobile | EQUIVALENT | 229522 | 230061 | 168000 |  | 0 | 0 | 0 | 0 |
| /lei-comentada/constituicao-federal | law_detail | desktop | EQUIVALENT | 257691 | 258285 | 257 |  | 0 | 0 | 0 | 0 |
| /lei-comentada/constituicao-federal | law_detail | mobile | EQUIVALENT | 257691 | 258285 | 257 |  | 0 | 0 | 0 | 0 |
| /lei-comentada/constituicao-federal/artigo-5 | law_article | desktop | EQUIVALENT | 233892 | 235173 | 308 |  | 0 | 0 | 0 | 0 |
| /lei-comentada/constituicao-federal/artigo-5 | law_article | mobile | EQUIVALENT | 233892 | 235173 | 308 |  | 0 | 0 | 0 | 0 |
| /materiais | materials_hub | desktop | EQUIVALENT | 233392 | 234813 | 164 |  | 0 | 0 | 0 | 0 |
| /materiais | materials_hub | mobile | EQUIVALENT | 233349 | 234813 | 164 |  | 0 | 0 | 0 | 0 |
| /materiais/guia-publico-de-estudo | material_detail | desktop | EQUIVALENT | 232468 | 233937 | 222 |  | 0 | 0 | 0 | 0 |
| /materiais/guia-publico-de-estudo | material_detail | mobile | EQUIVALENT | 232468 | 233937 | 222 |  | 0 | 0 | 0 | 0 |
| /marketplace | marketplace | desktop | EQUIVALENT | 233894 | 235047 | 167731 |  | 0 | 0 | 0 | 0 |
| /marketplace | marketplace | mobile | EQUIVALENT | 233894 | 235047 | 167731 |  | 0 | 0 | 0 | 0 |
| /blog | blog_hub | desktop | INTERACTION_ONLY | 248734 | 253555 | 183 |  | 0 | 0 | 0 | 0 |
| /blog | blog_hub | mobile | INTERACTION_ONLY | 248734 | 253677 | 183 |  | 0 | 0 | 0 | 0 |
| /blog/noticia-ssr | blog_article | desktop | INTERACTION_ONLY | 233717 | 236340 | 230 |  | 0 | 0 | 0 | 0 |
| /blog/noticia-ssr | blog_article | mobile | INTERACTION_ONLY | 233717 | 236462 | 230 |  | 0 | 0 | 0 | 0 |
| /blog/categoria/concursos | blog_category | desktop | INTERACTION_ONLY | 224577 | 227228 | 255 |  | 0 | 0 | 0 | 0 |
| /blog/categoria/concursos | blog_category | mobile | INTERACTION_ONLY | 224577 | 227350 | 255 |  | 0 | 0 | 0 | 0 |
| /blog/tag/nordeste | blog_tag | desktop | INTERACTION_ONLY | 224651 | 227424 | 248 |  | 0 | 0 | 0 | 0 |
| /blog/tag/nordeste | blog_tag | mobile | INTERACTION_ONLY | 224651 | 227424 | 248 |  | 0 | 0 | 0 | 0 |
| /blog/autor/staff-1 | blog_author | desktop | INTERACTION_ONLY | 223196 | 223774 | 247 |  | 0 | 0 | 0 | 0 |
| /blog/autor/staff-1 | blog_author | mobile | INTERACTION_ONLY | 223196 | 223774 | 247 |  | 0 | 0 | 0 | 0 |
| /planos | plans | desktop | EQUIVALENT | 203534 | 265249 | 167241 |  | 0 | 0 | 0 | 0 |
| /planos | plans | mobile | EQUIVALENT | 203534 | 265249 | 167241 |  | 0 | 0 | 0 | 0 |
| /faq | faq | desktop | EQUIVALENT | 276283 | 277432 | 173366 |  | 0 | 0 | 0 | 0 |
| /faq | faq | mobile | EQUIVALENT | 276283 | 277432 | 173366 |  | 0 | 0 | 0 | 0 |
| /novidades | news | desktop | INTERACTION_ONLY | 219396 | 220161 | 193 |  | 0 | 0 | 0 | 0 |
| /novidades | news | mobile | INTERACTION_ONLY | 219396 | 220100 | 193 |  | 0 | 0 | 0 | 0 |
| /support | support | desktop | EQUIVALENT | 222095 | 233642 | 166886 |  | 0 | 0 | 0 | 0 |
| /support | support | mobile | EQUIVALENT | 222095 | 233642 | 166886 |  | 0 | 0 | 0 | 0 |
| /privacy | privacy | desktop | EQUIVALENT | 223104 | 223152 | 165789 |  | 0 | 0 | 0 | 0 |
| /privacy | privacy | mobile | EQUIVALENT | 223104 | 223152 | 165789 |  | 0 | 0 | 0 | 0 |
| /terms | terms | desktop | EQUIVALENT | 221000 | 221078 | 165684 |  | 0 | 0 | 0 | 0 |
| /terms | terms | mobile | EQUIVALENT | 221000 | 221078 | 165684 |  | 0 | 0 | 0 | 0 |
| /busca?q=controle | search | desktop | EQUIVALENT | 264123 | 265420 | 217 |  | 0 | 0 | 0 | 0 |
| /busca?q=controle | search | mobile | EQUIVALENT | 264123 | 265420 | 217 |  | 0 | 0 | 0 | 0 |

## CF. Security matrix

| URL | Sentinels | Resultado |
| --- | --- | --- |
| / |  | PASS |
| /questoes |  | PASS |
| /disciplinas |  | PASS |
| /bancas |  | PASS |
| /orgaos |  | PASS |
| /provas |  | PASS |
| /concursos |  | PASS |
| /concursos-abertos |  | PASS |
| /carreiras |  | PASS |
| /cargos |  | PASS |
| /simulados |  | PASS |
| /lei-comentada |  | PASS |
| /materiais |  | PASS |
| /blog |  | PASS |
| /planos |  | PASS |
| /faq |  | PASS |
| /novidades |  | PASS |
| /support |  | PASS |
| /privacy |  | PASS |
| /terms |  | PASS |
| /questoes/67813/art-5o-acao-e-controle |  | PASS |
| /disciplinas/direito-constitucional |  | PASS |
| /topicos/controle-de-constitucionalidade |  | PASS |
| /assuntos/controle-concentrado |  | PASS |
| /bancas/cebraspe |  | PASS |
| /orgaos/orgao-de-teste |  | PASS |
| /provas/prova-ssr-2026 |  | PASS |
| /concursos/concurso-canonico-2026 |  | PASS |
| /carreiras/carreira-fiscal |  | PASS |
| /cargos/analista |  | PASS |
| /simulados/simulado-publico-constitucional |  | PASS |
| /lei-comentada/constituicao-federal |  | PASS |
| /lei-comentada/constituicao-federal/artigo-5 |  | PASS |
| /materiais/guia-publico-de-estudo |  | PASS |
| /blog/noticia-ssr |  | PASS |
| /blog/categoria/concursos |  | PASS |
| /blog/autor/staff-1 |  | PASS |
| /elite |  | PASS |
| /ranking |  | PASS |
| /l/fixture-nao-publicada |  | PASS |
| /blog/tag/nordeste |  | PASS |
| /material/501/guia-publico-de-estudo |  | PASS |
| /marketplace |  | PASS |
| /busca |  | PASS |
| /auth |  | PASS |
| /profile |  | PASS |
| /simulation |  | PASS |
| /checkout/elite |  | PASS |
| /admin |  | PASS |
| /api/seo/sitemap-status |  | PASS |
| /setup |  | PASS |
| /promo/fixture-inativa |  | PASS |
| /practice |  | PASS |
| /fase-8-rota-inexistente |  | PASS |
| /materiais/material-gratuito-publico |  | PASS |
| /materiais/material-historico |  | PASS |
| /blog/feed.xml |  | PASS |
| /lei-comentada/constituicao-federal/artigo-5-a |  | PASS |
| /lei-comentada/constituicao-federal/artigo-5-b |  | PASS |
| /lei-comentada/constituicao-federal/artigo-6 |  | PASS |

## CG. Cross-matrix consistency

PASS. Nenhuma família NOINDEX foi marcada como sitemap-eligible fora da simulação PRODUCTION READY; nenhuma URL 404/redirect/private aparece como link estrutural saudável.

## CH. Reporter

`Phase8SeoFinalGateReporter` equivalente implementado em `scripts/seo/phase8-full-crawl-final-gate.mjs`, somente leitura e fail-closed.

## CI. Machine-readable gate

Artefato: `.tmp/seo/phase-8-final-gate.json`. Schema determinístico contém phase, baseline, contagens, crawlStats, severidades, gates e matrizes.

## CJ. Real-data gates

| Gate pendente |
| --- |
| INTERNAL_LINK_GRAPH_REAL_DATA_VALIDATION_REQUIRED |
| SEO_ORPHAN_REAL_DATA_VALIDATION_REQUIRED |
| BREADCRUMB_REAL_DATA_VALIDATION_REQUIRED |
| STRUCTURED_DATA_REAL_DATA_VALIDATION_REQUIRED |
| BLOG_TAXONOMY_REAL_DATA_VALIDATION |
| BLOG_TAXONOMY_REAL_DATA_QUALITY_GATE |
| BLOG_TAXONOMY_REAL_DATA_EXPLAIN_REQUIRED |
| SITEMAP_REAL_DATA_VALIDATION_REQUIRED |
| INDEX_POLICY_REAL_DATA_VALIDATION_REQUIRED |
| ROBOTS_PRODUCTION_VALIDATION_REQUIRED |
| CANONICAL_HOST_PRODUCTION_VALIDATION_REQUIRED |
| SITEMAP_PRODUCTION_SCALE_VALIDATION_REQUIRED |
| SEARCH_ENGINE_SUBMISSION_AFTER_SEO_GO |
| PERFORMANCE_REAL_DATA_QUERY_VALIDATION_REQUIRED |
| PERFORMANCE_REAL_DATA_EXPLAIN_REQUIRED |
| CORE_WEB_VITALS_REAL_USER_VALIDATION_REQUIRED |
| PRODUCTION_PERFORMANCE_SMOKE_REQUIRED |
| CDN_CACHE_PRODUCTION_VALIDATION_REQUIRED |
| FONT_DELIVERY_PRODUCTION_VALIDATION_REQUIRED |
| IMAGE_DELIVERY_REAL_DATA_VALIDATION_REQUIRED |

## CK. Dependencies

npm/composer/lockfile changes: 0 mudanças npm/composer/lockfile.

## CL. Migration

phase 8 migration created = NÃO; phase 8 migration applied production = NÃO.

## CM. Production DB

production DB writes = 0; phase 8 backfill writes = 0.

## CN. Vitest

PASS: 154 arquivos, 910 testes.

## CO. Build

PASS: Next.js 16.2.11 production build com fixture API e PRELAUNCH.

## CP. Typecheck/route types

PASS: next typegen + tsc --noEmit.

## CQ. PHP

PASS: 7 testes SEO focados e lint de 9 arquivos PHP.

## CR. ESLint

PASS: 0 erros; 2 warnings preexistentes em PracticeClient; warning da Fase 8 removido.

## CS. Launch validator

PASS: 55 famílias, 44 famílias no grafo, 40 TARGET_INDEX, 15 PERMANENT_NOINDEX e 19 fixtures.

## CT. Security scan

PASS: secrets, encoding, generated artifacts e sentinelas.

## CU. P0

0.

## CV. P1

0.

## CW. P2

0. Nenhum item novo no laboratório.

## CX. Diffstat

21 arquivos: 11 modificados, 10 novos, 0 removidos; +3504/-14.

## CY. Worktree

Alterações exclusivamente da Fase 8, não commitadas.

## CZ. Push

push realizado = NÃO.

## DA. Deploy

deploy realizado = NÃO.

## DB. Production indexing

production indexing activated = NÃO; effective launch mode = PRELAUNCH.

## DC. Production sitemap

production sitemap published = NÃO.

## DD. Search engines

search engines notified = NÃO.

## DE. Final gate decision

`SEO_GO`. Aprovação limitada à arquitetura/contratos. real dataset validated = NÃO; platform production ready = NÃO; CONCURSOMESTRE_PRODUCTION_GO = NÃO.

## DF. Próximo passo

Manter PRELAUNCH. Remover o dataset de teste de forma controlada, carregar o dataset real e reexecutar todos os gates `REAL_DATA` antes de qualquer Production GO, sitemap público ou submissão a buscadores.

## Declarações obrigatórias

- phase 8 migration created = NÃO
- phase 8 migration applied production = NÃO
- production DB writes = 0
- phase 8 backfill writes = 0
- new SEO families created = 0
- effective launch mode = PRELAUNCH
- production indexing activated = NÃO
- production sitemap published = NÃO
- search engines notified = NÃO
- test dataset removed = NÃO
- real dataset loaded = NÃO
- real dataset validated = NÃO
- commit = NÃO
- push realizado = NÃO
- deploy realizado = NÃO
- platform production ready = NÃO
- CONCURSOMESTRE_PRODUCTION_GO = NÃO
