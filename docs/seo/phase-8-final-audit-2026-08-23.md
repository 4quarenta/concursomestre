# Fase 8 — Auditoria Final: Full Crawl + Final SEO Gate

- Data: 2026-08-23
- Baseline: `8c6e88ce051c72495293912068c2b2eb4b4349d1`
- Evidência: CONTRACT, FIXTURE, LAB
- Veredito: SEO_GO arquitetural

## A. Resumo executivo

Auditoria independente confirma `SEO_GO` arquitetural. P0=0, P1=0, P2=0; OPEN_REAL_DATA_GATES=20. Nenhuma autorização operacional foi emitida.

## B. Baseline

Branch `1.0.0`; HEAD `8c6e88ce051c72495293912068c2b2eb4b4349d1`, igual à baseline exigida.

## C. Diff

Escopo reconciliado arquivo a arquivo. 22 arquivos finais previstos: 11 modificados e 11 novos; sem remoção ou rename. Out-of-scope=0; uncertain=0.

## D. File-by-file

| Arquivo | Categoria | Baseline | Fase 8 | Impacto funcional | Impacto SEO | Segurança | Testes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| backend/tests/SeoPayloadEnvelopeTest.php | tests; correction | Assertion expected two taxonomy envelope integrations. | Recognizes directory, hierarchy and child expansion. | Test-only | Restores accurate security contract coverage. | Covered/strengthened | Self-verifying |
| config/seo/structural-route-policy.v1.json | route coverage; correction | Search modeled as /questoes?q. | Search authority reconciled to existing /busca family. | Functional route policy | Permanent NOINDEX remains explicit. | No boundary expansion | Covered by Vitest/PHP/harness/build |
| package.json | final SEO reporter | No Phase 8 command. | Adds deterministic reporter command. | Developer tooling | No runtime policy change. | Covered/strengthened | Covered by Vitest/PHP/harness/build |
| scripts/seo/ssr-hydration-fixture-api.mjs | fixtures; error coverage | Unknown blog slug reused the fixture article. | Unknown slug returns hard 404. | Fixture only | Prevents false soft-404 PASS. | Covered/strengthened | Covered by Vitest/PHP/harness/build |
| scripts/seo/ssr-hydration-harness.mjs | crawl harness | Single baseline file only. | Supports bounded baseline inheritance. | Harness only | Extends audit coverage without duplicating routes. | No boundary expansion | Covered by Vitest/PHP/harness/build |
| src/app/practice/PracticeClient.tsx | correction | Only keyword query initialized search. | q also initializes keyword. | Functional search compatibility | No indexability change. | No boundary expansion | Covered by Vitest/PHP/harness/build |
| src/app/practice/PracticePage.tsx | correction; route coverage | Fixed /questoes semantic identity. | Accepts server-defined semantic identity for /busca. | Shared SSR rendering | Distinct canonical/H1/JSON-LD for permanent-NOINDEX search. | No boundary expansion | Covered by Vitest/PHP/harness/build |
| src/app/practice/__tests__/practiceServerData.test.ts | tests | No q mapping assertion. | Covers q→keyword. | Test only | Protects functional search contract. | Covered/strengthened | Self-verifying |
| src/app/practice/practiceServerData.ts | correction | q was not forwarded to backend keyword. | Maps q to keyword once. | One existing request | No crawl expansion. | No boundary expansion | Covered by Vitest/PHP/harness/build |
| src/services/routes/publicRoutes.test.ts | tests | No search builder assertion. | Covers canonical /busca builder. | Test only | Prevents route-policy drift. | Covered/strengthened | Self-verifying |
| src/services/routes/publicRoutes.ts | route coverage | No typed search builder. | Adds builder for already mapped search family. | Shared route helper | Uses persisted route contract; no new family. | No boundary expansion | Covered by Vitest/PHP/harness/build |
| config/seo/phase-8-full-crawl.v1.json | family/route/redirect/error/security coverage | No Phase 8 crawl manifest. | Defines bounded seeds, representatives, aliases, errors and 20 real-data gates. | Audit configuration | Fail-closed coverage authority. | Covered/strengthened | Covered by Vitest/PHP/harness/build |
| config/seo/ssr-hydration-phase-8.v1.json | harness | Phase 5 baseline only. | Extends baseline with functional search. | Audit configuration | 37-route desktop/mobile coverage. | No boundary expansion | Covered by Vitest/PHP/harness/build |
| docs/seo/phase-8-full-crawl-final-seo-gate-2026-08-23.md | docs | No Phase 8 result. | Versioned implementation report with ten matrices. | Documentation | States architecture-only GO. | No boundary expansion | Covered by Vitest/PHP/harness/build |
| scripts/seo/__tests__/phase8FinalGateReporter.test.mjs | tests | No reporter tests. | Covers normalization, matching, fail-closed decisions, contracts, crawl and report completeness. | Test only | Blocks false GO. | Covered/strengthened | Self-verifying |
| scripts/seo/lib/phase8-final-gate.mjs | final SEO reporter; machine gate | No transversal evaluator. | Read-only crawl, contract validation and ten matrices. | Audit tooling | Computes P0/P1/P2 and GO deterministically. | Covered/strengthened | Covered by Vitest/PHP/harness/build |
| scripts/seo/lib/phase8-final-report.mjs | docs; final SEO reporter | No human Phase 8 renderer. | Renders A–DF and integral matrices. | Audit tooling | No runtime side effect. | Covered/strengthened | Covered by Vitest/PHP/harness/build |
| scripts/seo/phase8-full-crawl-final-gate.mjs | machine-readable gate | No Phase 8 CLI. | Writes controlled JSON and Markdown outputs. | Audit tooling | Fails closed on NO_GO. | Covered/strengthened | Covered by Vitest/PHP/harness/build |
| src/app/busca/layout.tsx | correction; route coverage | Mapped search family had no physical App Router route. | Provides existing provider boundary. | Functional public route | Permanent NOINDEX inherited. | No boundary expansion | Covered by Vitest/PHP/harness/build |
| src/app/busca/page.tsx | correction; route coverage | Mapped /busca returned 404. | Real SSR functional search route. | Closes architectural gap | Server metadata, self canonical, permanent NOINDEX. | No boundary expansion | Covered by Vitest/PHP/harness/build |
| src/app/busca/searchPage.test.ts | tests | No search-route static contract test. | Covers SSR metadata, q mapping and no client SEO authority. | Test only | Prevents missing route/client authority regression. | Covered/strengthened | Self-verifying |
| docs/seo/phase-8-final-audit-2026-08-23.md | docs | No independent checkpoint audit. | A–CF audit with integral evidence and open real-data gates. | Documentation only | No runtime effect. | No boundary expansion | Covered by Vitest/PHP/harness/build |

## E. Dataset status

`DATASET_TEMPORARIO_DE_TESTE`. Fixture não fecha gate REAL_DATA, REAL_DB, FIELD ou PRODUCTION.

## F. SEO_GO semantics

`SEO_GO = architecture/contract gate only`. Não equivale a REAL_DATASET_SEO_VALIDATED, FINAL_PRODUCTION_SEO_VALIDATED, PLATFORM_PRODUCTION_READY ou CONCURSOMESTRE_PRODUCTION_GO.

## G. 55-family inventory

| Family | Route | Identity | Slug | Publication | Eligibility | Target | Readiness | Quality | Canonical | Resolution | PRELAUNCH | GO_CANDIDATE | PRODUCTION | Sitemap | Breadcrumb | Schema | Links | SSR/client |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home | / | page | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/ | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | not applicable | WebSite | source:4; target:0; structural/contract | EQUIVALENT |
| questions_hub | /questoes | page | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/questoes | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > questions_hub | CollectionPage | source:0; target:1; structural/contract | EQUIVALENT |
| question_detail | /questoes/{id}/{slug}, /questoes/{id} | questions.id + persisted public slug | questions.id + persisted public slug | PublicationDecision | INDEXABLE | INDEX | entity.public_ready | NOT_REQUIRED | https://concursomestre.com/questoes/{id}/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > questions_hub > question_detail | WebPage | source:5; target:8; structural/contract | EQUIVALENT |
| discipline_hub | /disciplinas | page | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/disciplinas | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > discipline_hub | CollectionPage | source:1; target:1; structural/contract | EQUIVALENT |
| discipline_detail | /disciplinas/{slug} | filters.id type=assunto level=materia; filters.slug | filters.id type=assunto level=materia; filters.slug | PublicationDecision | INDEXABLE | INDEX | taxonomy.hierarchy_ready | NOT_REQUIRED | https://concursomestre.com/disciplinas/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > discipline_hub > discipline_detail | WebPage | source:2; target:4; structural/contract | EQUIVALENT |
| board_hub | /bancas | page | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/bancas | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > board_hub | CollectionPage | source:1; target:1; structural/contract | contract only |
| board_detail | /bancas/{slug} | filters.id type=banca; filters.slug | filters.id type=banca; filters.slug | PublicationDecision | INDEXABLE | INDEX | entity.public_ready | NOT_REQUIRED | https://concursomestre.com/bancas/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > board_hub > board_detail | WebPage | source:1; target:5; structural/contract | EQUIVALENT |
| exam_hub | /provas | page | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/provas | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > exam_hub | CollectionPage | source:1; target:0; structural/contract | contract only |
| exam_detail | /provas/{slug} | provas.id; persisted slug | provas.id; persisted slug | PublicationDecision | INDEXABLE | INDEX | entity.public_ready | NOT_REQUIRED | https://concursomestre.com/provas/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > exam_hub > exam_detail | WebPage | source:5; target:6; structural/contract | INTERACTION_ONLY |
| contest_hub | /concursos | page | literal route | PublicationDecision | INDEXABLE | INDEX | contest.catalog_ready | NOT_REQUIRED | https://concursomestre.com/concursos | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > contest_hub | CollectionPage | source:1; target:0; structural/contract | EQUIVALENT |
| law_hub | /lei-comentada | page | literal route | PublicationDecision | INDEXABLE | INDEX | module.public_ready | NOT_REQUIRED | https://concursomestre.com/lei-comentada | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > law_hub | CollectionPage | source:1; target:0; structural/contract | EQUIVALENT |
| law_detail | /lei-comentada/{slug} | legal_commentaries.id; persisted slug | legal_commentaries.id; persisted slug | PublicationDecision | INDEXABLE | INDEX | entity.public_ready | NOT_REQUIRED | https://concursomestre.com/lei-comentada/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > law_hub > law_detail | WebPage | source:1; target:1; structural/contract | EQUIVALENT |
| blog_hub | /blog | page | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/blog | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > blog_hub | CollectionPage | source:1; target:1; structural/contract | INTERACTION_ONLY |
| blog_article | /blog/{slug} | blog_articles.id; persisted slug | blog_articles.id; persisted slug | PublicationDecision | INDEXABLE | INDEX | entity.public_ready | NOT_REQUIRED | https://concursomestre.com/blog/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > blog_hub > blog_article | NewsArticle | source:4; target:5; structural/contract | INTERACTION_ONLY |
| blog_category | /blog/categoria/{slug} | blog_categories.id; persisted slug | blog_categories.id; persisted slug | PublicationDecision | INDEXABLE | INDEX | blog_taxonomy.public_posts_ready | REQUIRED_BY_INDEX_POLICY | https://concursomestre.com/blog/categoria/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > blog_hub > blog_category | CollectionPage | source:1; target:1; structural/contract | INTERACTION_ONLY |
| blog_tag | /blog/tag/{slug} | blog_tags.id; persisted slug | blog_tags.id; persisted slug | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | blog_taxonomy.functional_archive | NOT_REQUIRED | https://concursomestre.com/blog/tag/{slug} | render when resolvable | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | home > blog_hub > blog_tag | CollectionPage | source:1; target:1; functional | INTERACTION_ONLY |
| blog_author | /blog/autor/{id} | public editorial author id | persisted route identity | PublicationDecision | CONDITIONAL | INDEX | author.editorial_identity_ready | NOT_REQUIRED | https://concursomestre.com/blog/autor/{id} | render when resolvable | NOINDEX | NOINDEX | NOINDEX | INCLUDE_WHEN_READY | home > blog_hub > blog_author | CollectionPage | source:1; target:1; functional | INTERACTION_ONLY |
| plans | /planos | page | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/planos | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > plans | WebPage | source:0; target:0; structural/contract | EQUIVALENT |
| faq | /faq | page + visible FAQ_DATA | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/faq | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > faq | FAQPage | source:0; target:0; structural/contract | EQUIVALENT |
| news | /novidades | page + published changelog entries | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/novidades | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > news | CollectionPage | source:0; target:0; structural/contract | INTERACTION_ONLY |
| support | /support | page | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/support | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > support | WebPage | source:0; target:0; structural/contract | EQUIVALENT |
| elite | /elite | page | literal route | PublicationDecision | INDEXABLE | INDEX | page.ssr_ready | NOT_REQUIRED | https://concursomestre.com/elite | render when resolvable | NOINDEX | NOINDEX | NOINDEX | INCLUDE_WHEN_READY | home > elite | WebPage | source:0; target:0; structural/contract | contract only |
| materials_hub | /materiais | page | literal route | PublicationDecision | INDEXABLE | INDEX | material.directory_ready | NOT_REQUIRED | https://concursomestre.com/materiais | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > materials_hub | CollectionPage | source:1; target:0; structural/contract | EQUIVALENT |
| material_detail | /materiais/{slug} | materials.id; materials.slug | materials.id; materials.slug | PublicationDecision | INDEXABLE | INDEX | material.public_ready | NOT_REQUIRED | https://concursomestre.com/materiais/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > materials_hub > material_detail | WebPage | source:2; target:1; structural/contract | EQUIVALENT |
| material_legacy | /material/{id}, /material/{id}/{*slug} | not_applicable | persisted route identity | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | not_applicable | NOT_REQUIRED | https://concursomestre.com/material/{id} | redirect | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | not applicable | none | source:0; target:0; structural/contract | contract only |
| marketplace | /marketplace | functional catalog | literal route | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | not_applicable | NOT_REQUIRED | https://concursomestre.com/marketplace | render when resolvable | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | home > marketplace | none | source:0; target:0; functional | EQUIVALENT |
| ranking | /ranking, /ranking/{id}, /ranking/{id}/{*slug} | public ranking id when a detail is resolved | persisted route identity | PublicationDecision | CONDITIONAL | INDEX | ranking.public_privacy_ready | NOT_REQUIRED | https://concursomestre.com/ranking | render when resolvable | NOINDEX | NOINDEX | NOINDEX | INCLUDE_WHEN_READY | home > ranking | none | source:0; target:0; functional | contract only |
| privacy | /privacy | page | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/privacy | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > privacy | WebPage | source:0; target:0; structural/contract | EQUIVALENT |
| terms | /terms | page | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/terms | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > terms | WebPage | source:0; target:0; structural/contract | EQUIVALENT |
| marketing_landing | /l/{slug} | persisted editorial landing slug | persisted editorial landing slug | PublicationDecision | CONDITIONAL | INDEX | landing.editorial_ready | REQUIRED_BY_INDEX_POLICY | https://concursomestre.com/l/{slug} | render when resolvable | NOINDEX | NOINDEX | NOINDEX | INCLUDE_WHEN_READY | home > marketing_landing | WebPage | source:0; target:0; structural/contract | contract only |
| topic_detail | /topicos/{slug} | filters.id type=assunto level=topico; filters.slug | filters.id type=assunto level=topico; filters.slug | PublicationDecision | INDEXABLE | INDEX | taxonomy.hierarchy_ready | NOT_REQUIRED | https://concursomestre.com/topicos/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > discipline_hub > discipline_detail > topic_detail | WebPage | source:2; target:3; structural/contract | EQUIVALENT |
| subject_detail | /assuntos/{slug} | filters.id type=assunto level=assunto; filters.slug | filters.id type=assunto level=assunto; filters.slug | PublicationDecision | INDEXABLE | INDEX | taxonomy.hierarchy_ready | NOT_REQUIRED | https://concursomestre.com/assuntos/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > discipline_hub > discipline_detail > topic_detail > subject_detail | WebPage | source:1; target:2; structural/contract | EQUIVALENT |
| organizations_hub | /orgaos | page | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/orgaos | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > organizations_hub | CollectionPage | source:1; target:0; structural/contract | contract only |
| organization_detail | /orgaos/{slug} | filters.id type=orgao; filters.slug | filters.id type=orgao; filters.slug | PublicationDecision | INDEXABLE | INDEX | entity.public_ready | NOT_REQUIRED | https://concursomestre.com/orgaos/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > organizations_hub > organization_detail | WebPage | source:6; target:5; structural/contract | EQUIVALENT |
| contest_detail | /concursos/{slug} | contests.id; contests.slug | contests.id; contests.slug | PublicationDecision | INDEXABLE | INDEX | contest.public_ready | NOT_REQUIRED | https://concursomestre.com/concursos/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > contest_hub > contest_detail | WebPage | source:5; target:7; structural/contract | EQUIVALENT |
| open_contests | /concursos-abertos | contest domain status and dates | literal route | PublicationDecision | INDEXABLE | INDEX | contest.catalog_ready | NOT_REQUIRED | https://concursomestre.com/concursos-abertos | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > contest_hub > open_contests | CollectionPage | source:1; target:0; structural/contract | EQUIVALENT |
| careers_hub | /carreiras | page | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/carreiras | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > careers_hub | CollectionPage | source:1; target:0; structural/contract | EQUIVALENT |
| career_detail | /carreiras/{slug} | filters.id type=carreira; filters.slug | filters.id type=carreira; filters.slug | PublicationDecision | INDEXABLE | INDEX | professional.public_ready | NOT_REQUIRED | https://concursomestre.com/carreiras/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > careers_hub > career_detail | WebPage | source:4; target:4; structural/contract | EQUIVALENT |
| positions_hub | /cargos | page | literal route | PublicationDecision | INDEXABLE | INDEX | page.public_ready | NOT_REQUIRED | https://concursomestre.com/cargos | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > positions_hub | CollectionPage | source:1; target:0; structural/contract | EQUIVALENT |
| position_detail | /cargos/{slug} | filters.id type=cargo; filters.slug | filters.id type=cargo; filters.slug | PublicationDecision | INDEXABLE | INDEX | professional.public_ready | NOT_REQUIRED | https://concursomestre.com/cargos/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > positions_hub > position_detail | WebPage | source:6; target:6; structural/contract | EQUIVALENT |
| simulations_hub | /simulados | page | literal route | PublicationDecision | INDEXABLE | INDEX | simulation.catalog_ready | NOT_REQUIRED | https://concursomestre.com/simulados | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > simulations_hub | CollectionPage | source:1; target:0; structural/contract | EQUIVALENT |
| simulation_detail | /simulados/{slug} | public_simulations.id; persisted slug | public_simulations.id; persisted slug | PublicationDecision | INDEXABLE | INDEX | simulation.public_ready | NOT_REQUIRED | https://concursomestre.com/simulados/{slug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > simulations_hub > simulation_detail | WebPage | source:3; target:1; structural/contract | EQUIVALENT |
| law_article_detail | /lei-comentada/{lawSlug}/{articleSlug} | legal_commentary_articles.id; persisted slug | legal_commentary_articles.id; persisted slug | PublicationDecision | INDEXABLE | INDEX | law_article.official_text_ready | NOT_REQUIRED | https://concursomestre.com/lei-comentada/{lawSlug}/{articleSlug} | render when resolvable | NOINDEX | NOINDEX | INDEX | INCLUDE_WHEN_READY | home > law_hub > law_detail > law_article_detail | WebPage | source:1; target:2; structural/contract | EQUIVALENT |
| search | /busca | functional search query | literal route | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | not_applicable | NOT_REQUIRED | https://concursomestre.com/busca | render when resolvable | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | home > search | none | source:0; target:0; functional | contract only |
| facet | /questoes | functional filter parameters | literal route | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | not_applicable | NOT_REQUIRED | https://concursomestre.com/questoes | render when resolvable | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | home > questions_hub | none | source:0; target:0; functional | contract only |
| auth | /auth, /activate, /activation, /confirm, /confirm-email, /forgot-password, /reset-password, /recover, /reset, /verify-email | not_applicable | literal route | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | not_applicable | NOT_REQUIRED | https://concursomestre.com/auth | protected/private | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | not applicable | none | source:0; target:0; structural/contract | private |
| account | /profile/{*path}, /dashboard, /notifications, /subscription/{*path}, /plans, /read/{*path}, /partner-dashboard | not_applicable | persisted route identity | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | not_applicable | NOT_REQUIRED | https://concursomestre.com/profile/{*path} | protected/private | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | not applicable | none | source:0; target:0; structural/contract | private |
| private_tools | /simulation, /cronograma, /flashcards, /x-ray, /bank-analysis, /performance/{*path}, /levels | not_applicable | persisted route identity | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | not_applicable | NOT_REQUIRED | https://concursomestre.com/simulation | protected/private | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | not applicable | none | source:0; target:0; structural/contract | private |
| checkout | /checkout/{*path} | not_applicable | persisted route identity | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | not_applicable | NOT_REQUIRED | https://concursomestre.com/checkout/{*path} | protected/private | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | not applicable | none | source:0; target:0; structural/contract | private |
| admin | /admin/{*path} | not_applicable | persisted route identity | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | not_applicable | NOT_REQUIRED | https://concursomestre.com/admin/{*path} | protected/private | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | not applicable | none | source:0; target:0; structural/contract | private |
| api | /api/{*path} | not_applicable | persisted route identity | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | not_applicable | NOT_REQUIRED | https://concursomestre.com/api/{*path} | protected/private | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | not applicable | none | source:0; target:0; structural/contract | private |
| setup | /setup | not_applicable | literal route | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | not_applicable | NOT_REQUIRED | https://concursomestre.com/setup | protected/private | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | not applicable | none | source:0; target:0; structural/contract | private |
| temporary_promo | /promo/{slug} | not_applicable | persisted route identity | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | not_applicable | NOT_REQUIRED | https://concursomestre.com/promo/{slug} | render when resolvable | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | not applicable | none | source:0; target:0; structural/contract | contract only |
| legacy_alias | /practice, /questions, /question/{*path}, /blog/provas/{*path}, /changelog | not_applicable | persisted route identity | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | not_applicable | NOT_REQUIRED | https://concursomestre.com/practice | redirect | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | not applicable | none | source:0; target:0; structural/contract | contract only |
| not_found | /{*path} | not_applicable | persisted route identity | permanent policy / route access | PERMANENT_NOINDEX | NOINDEX | not_applicable | NOT_REQUIRED | https://concursomestre.com/{*path} | render when resolvable | NOINDEX | NOINDEX | NOINDEX | EXCLUDE | not applicable | none | source:0; target:0; structural/contract | contract only |

## H. 40 TARGET_INDEX

| Family | Route | Contract |
| --- | --- | --- |
| home | / | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| questions_hub | /questoes | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| question_detail | /questoes/{id}/{slug}, /questoes/{id} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| discipline_hub | /disciplinas | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| discipline_detail | /disciplinas/{slug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| board_hub | /bancas | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| board_detail | /bancas/{slug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| exam_hub | /provas | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| exam_detail | /provas/{slug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| contest_hub | /concursos | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| law_hub | /lei-comentada | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| law_detail | /lei-comentada/{slug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| blog_hub | /blog | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| blog_article | /blog/{slug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| blog_category | /blog/categoria/{slug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| blog_author | /blog/autor/{id} | CONDITIONAL/INDEX/INCLUDE_WHEN_READY |
| plans | /planos | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| faq | /faq | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| news | /novidades | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| support | /support | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| elite | /elite | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| materials_hub | /materiais | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| material_detail | /materiais/{slug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| ranking | /ranking, /ranking/{id}, /ranking/{id}/{*slug} | CONDITIONAL/INDEX/INCLUDE_WHEN_READY |
| privacy | /privacy | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| terms | /terms | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| marketing_landing | /l/{slug} | CONDITIONAL/INDEX/INCLUDE_WHEN_READY |
| topic_detail | /topicos/{slug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| subject_detail | /assuntos/{slug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| organizations_hub | /orgaos | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| organization_detail | /orgaos/{slug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| contest_detail | /concursos/{slug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| open_contests | /concursos-abertos | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| careers_hub | /carreiras | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| career_detail | /carreiras/{slug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| positions_hub | /cargos | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| position_detail | /cargos/{slug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| simulations_hub | /simulados | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| simulation_detail | /simulados/{slug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |
| law_article_detail | /lei-comentada/{lawSlug}/{articleSlug} | INDEXABLE/INDEX/INCLUDE_WHEN_READY |

## I. 15 PERMANENT_NOINDEX

| Family | Route | PRELAUNCH | GO_CANDIDATE | PRODUCTION |
| --- | --- | --- | --- | --- |
| blog_tag | /blog/tag/{slug} | NOINDEX | NOINDEX | NOINDEX |
| material_legacy | /material/{id}, /material/{id}/{*slug} | NOINDEX | NOINDEX | NOINDEX |
| marketplace | /marketplace | NOINDEX | NOINDEX | NOINDEX |
| search | /busca | NOINDEX | NOINDEX | NOINDEX |
| facet | /questoes | NOINDEX | NOINDEX | NOINDEX |
| auth | /auth, /activate, /activation, /confirm, /confirm-email, /forgot-password, /reset-password, /recover, /reset, /verify-email | NOINDEX | NOINDEX | NOINDEX |
| account | /profile/{*path}, /dashboard, /notifications, /subscription/{*path}, /plans, /read/{*path}, /partner-dashboard | NOINDEX | NOINDEX | NOINDEX |
| private_tools | /simulation, /cronograma, /flashcards, /x-ray, /bank-analysis, /performance/{*path}, /levels | NOINDEX | NOINDEX | NOINDEX |
| checkout | /checkout/{*path} | NOINDEX | NOINDEX | NOINDEX |
| admin | /admin/{*path} | NOINDEX | NOINDEX | NOINDEX |
| api | /api/{*path} | NOINDEX | NOINDEX | NOINDEX |
| setup | /setup | NOINDEX | NOINDEX | NOINDEX |
| temporary_promo | /promo/{slug} | NOINDEX | NOINDEX | NOINDEX |
| legacy_alias | /practice, /questions, /question/{*path}, /blog/provas/{*path}, /changelog | NOINDEX | NOINDEX | NOINDEX |
| not_found | /{*path} | NOINDEX | NOINDEX | NOINDEX |

## J. 60-URL coverage

| URL | Family | Source | Depth | HTTP | Resolution | Canonical | Robots | X-Robots | SSR | H1 | Breadcrumbs | JSON-LD | Sitemap | Security | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | home | seed | 0 | 200 | render | https://concursomestre.com | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Se você quer passar, precisa estudar com estratégia. |  | Organization, WebSite | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /questoes | questions_hub | seed | 0 | 200 | render | https://concursomestre.com/questoes | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Questões de concursos para praticar | Início, Questões | CollectionPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /disciplinas | discipline_hub | seed | 0 | 200 | render | https://concursomestre.com/disciplinas | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Disciplinas | Início, Disciplinas | CollectionPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /bancas | board_hub | seed | 0 | 200 | render | https://concursomestre.com/bancas | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Bancas | Início, Bancas | CollectionPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /orgaos | organizations_hub | seed | 0 | 200 | render | https://concursomestre.com/orgaos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Órgãos | Início, Órgãos | CollectionPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /provas | exam_hub | seed | 0 | 200 | render | https://concursomestre.com/provas | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Provas de concursos | Início, Provas | CollectionPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /concursos | contest_hub | seed | 0 | 200 | render | https://concursomestre.com/concursos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Concursos públicos | Início, Concursos públicos | CollectionPage, BreadcrumbList, ItemList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /concursos-abertos | open_contests | seed | 0 | 200 | render | https://concursomestre.com/concursos-abertos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Concursos abertos | Início, Concursos, Concursos abertos | CollectionPage, BreadcrumbList, ItemList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /carreiras | careers_hub | seed | 0 | 200 | render | https://concursomestre.com/carreiras | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Carreiras | Início, Carreiras | CollectionPage, BreadcrumbList, ItemList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /cargos | positions_hub | seed | 0 | 200 | render | https://concursomestre.com/cargos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Cargos | Início, Cargos | CollectionPage, BreadcrumbList, ItemList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /simulados | simulations_hub | seed | 0 | 200 | render | https://concursomestre.com/simulados | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Simulados | Início, Simulados | CollectionPage, BreadcrumbList, ItemList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /lei-comentada | law_hub | seed | 0 | 200 | render | https://concursomestre.com/lei-comentada | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Lei comentada | Início, Lei Comentada | CollectionPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /materiais | materials_hub | seed | 0 | 200 | render | https://concursomestre.com/materiais | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Materiais para concursos | Início, Materiais | CollectionPage, BreadcrumbList, ItemList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /blog | blog_hub | seed | 0 | 200 | render | https://concursomestre.com/blog | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Concursos públicos em pauta | Início, Blog | CollectionPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /planos | plans | seed | 0 | 200 | render | https://concursomestre.com/planos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Estude com mais estratégia e escolha o plano adequado à sua rotina | Início, Planos | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /faq | faq | seed | 0 | 200 | render | https://concursomestre.com/faq | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Tudo o que você precisa saber | Início, Dúvidas frequentes | FAQPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /novidades | news | seed | 0 | 200 | render | https://concursomestre.com/novidades | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Novidades | Início, Novidades | CollectionPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /support | support | seed | 0 | 200 | render | https://concursomestre.com/support | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Como podemos ajudar? | Início, Suporte | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /privacy | privacy | seed | 0 | 200 | render | https://concursomestre.com/privacy | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Política de Privacidade | Início, Política de Privacidade | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /terms | terms | seed | 0 | 200 | render | https://concursomestre.com/terms | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Termos de Uso | Início, Termos de Uso | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /questoes/67813/art-5o-acao-e-controle | question_detail | representative | 0 | 200 | render | https://concursomestre.com/questoes/67813/art-5o-acao-e-controle | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Questão de concurso CEBRASPE 2026 Direitos fundamentais: Art. 5º — Ação & Controle | Início, Questões, Questão 67813 | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /disciplinas/direito-constitucional | discipline_detail | representative | 0 | 200 | render | https://concursomestre.com/disciplinas/direito-constitucional | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Questões de Direito Constitucional | Início, Disciplinas, Direito Constitucional | WebPage, BreadcrumbList, ItemList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /topicos/controle-de-constitucionalidade | topic_detail | representative | 0 | 200 | render | https://concursomestre.com/topicos/controle-de-constitucionalidade | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Questões de Controle de Constitucionalidade | Início, Disciplinas, Direito Constitucional, Controle de Constitucionalidade | WebPage, BreadcrumbList, ItemList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /assuntos/controle-concentrado | subject_detail | representative | 0 | 200 | render | https://concursomestre.com/assuntos/controle-concentrado | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Questões de Controle concentrado | Início, Disciplinas, Direito Constitucional, Controle de Constitucionalidade, Controle concentrado | WebPage, BreadcrumbList, ItemList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /bancas/cebraspe | board_detail | representative | 0 | 200 | render | https://concursomestre.com/bancas/cebraspe | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | CEBRASPE - Centro Brasileiro de Pesquisa em Avaliação | Início, Bancas, CEBRASPE - Centro Brasileiro de Pesquisa em Avaliação | WebPage, BreadcrumbList, Organization | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /orgaos/orgao-de-teste | organization_detail | representative | 0 | 200 | render | https://concursomestre.com/orgaos/orgao-de-teste | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Órgão de Teste (ODT) | Início, Órgãos, Órgão de Teste | WebPage, Organization, BreadcrumbList, ItemList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /provas/prova-ssr-2026 | exam_detail | representative | 0 | 200 | render | https://concursomestre.com/provas/prova-ssr-2026 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Prova SSR 2026 | Início, Provas, Prova SSR 2026 | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /concursos/concurso-canonico-2026 | contest_detail | representative | 0 | 200 | render | https://concursomestre.com/concursos/concurso-canonico-2026 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Concurso Canônico 2026 | Início, Concursos, Concurso Canônico 2026 | WebPage, BreadcrumbList, ItemList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /carreiras/carreira-fiscal | career_detail | representative | 0 | 200 | render | https://concursomestre.com/carreiras/carreira-fiscal | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Carreira Fiscal | Início, Carreiras, Carreira Fiscal | WebPage, BreadcrumbList, ItemList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /cargos/analista | position_detail | representative | 0 | 200 | render | https://concursomestre.com/cargos/analista | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Analista | Início, Cargos, Analista | WebPage, BreadcrumbList, ItemList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /simulados/simulado-publico-constitucional | simulation_detail | representative | 0 | 200 | render | https://concursomestre.com/simulados/simulado-publico-constitucional | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Simulado de Direito Constitucional | Início, Simulados, Simulado de Direito Constitucional | WebPage, BreadcrumbList, ItemList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /lei-comentada/constituicao-federal | law_detail | representative | 0 | 200 | render | https://concursomestre.com/lei-comentada/constituicao-federal | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | CF | Início, Lei Comentada, CF | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /lei-comentada/constituicao-federal/artigo-5 | law_article_detail | representative | 0 | 200 | render | https://concursomestre.com/lei-comentada/constituicao-federal/artigo-5 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Art. 5º da Constituição Federal | Início, Lei Comentada, Constituição Federal, Art. 5º | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /materiais/guia-publico-de-estudo | material_detail | representative | 0 | 200 | render | https://concursomestre.com/materiais/guia-publico-de-estudo | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Guia público de estudo | Início, Materiais, Guia público de estudo | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /blog/noticia-ssr | blog_article | representative | 0 | 200 | render | https://concursomestre.com/blog/noticia-ssr | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Notícia SSR de teste | Início, Blog, Notícia SSR de teste | NewsArticle, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /blog/categoria/concursos | blog_category | representative | 0 | 200 | render | https://concursomestre.com/blog/categoria/concursos | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Concursos | Início, Blog, Concursos | CollectionPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /blog/autor/staff-1 | blog_author | representative | 0 | 200 | render | https://concursomestre.com/blog/autor/staff-1 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Equipe ConcursoMestre | Início, Blog, Equipe ConcursoMestre | CollectionPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /elite | elite | representative | 0 | 200 | render | https://concursomestre.com/elite | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=0; H1=0 |  | Início, Elite | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /ranking | ranking | representative | 0 | 200 | render |  | noindex, nofollow, noindex, nofollow | noindex, follow | initial HTML; main=1; H1=1 | Rankings |  |  | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /l/fixture-nao-publicada | marketing_landing | representative | 0 | 404 | notFound |  |  | noindex, follow | not applicable |  |  |  | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | EXPECTED_404/NOT_READY |
| /blog/tag/nordeste | blog_tag | representative | 0 | 200 | render | https://concursomestre.com/blog/tag/nordeste | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Nordeste | Início, Blog, Nordeste | CollectionPage, BreadcrumbList | EXCLUDE | PASS | PASS |
| /material/501/guia-publico-de-estudo | material_legacy | representative | 0 | 404 | notFound |  |  | noindex, nofollow | not applicable |  |  |  | EXCLUDE | PASS | EXPECTED_404/NOT_READY |
| /marketplace | marketplace | representative | 0 | 200 | render | https://concursomestre.com/marketplace | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Materiais | Início, Marketplace | BreadcrumbList | EXCLUDE | PASS | PASS |
| /busca | search | representative | 0 | 200 | render | https://concursomestre.com/busca | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Busca de questões de concursos | Início, Busca | CollectionPage, BreadcrumbList | EXCLUDE | PASS | PASS |
| /auth | auth | representative | 0 | 200 | render |  | noindex, nofollow, noindex, nofollow | noindex, nofollow | initial HTML; main=1; H1=1 | Prepare-se para ser aprovado. |  |  | EXCLUDE | PASS | PASS |
| /profile | account | representative | 0 | 200 | render |  | noindex, nofollow, noindex, nofollow | noindex, nofollow | initial HTML; main=0; H1=0 |  |  |  | EXCLUDE | PASS | PASS |
| /simulation | private_tools | representative | 0 | 200 | render |  | noindex, nofollow, noindex, nofollow | noindex, nofollow | initial HTML; main=1; H1=0 |  |  |  | EXCLUDE | PASS | PASS |
| /checkout/elite | checkout | representative | 0 | 200 | render |  | noindex, nofollow, noindex, nofollow | noindex, nofollow | initial HTML; main=1; H1=1 | Assinatura identificada |  |  | EXCLUDE | PASS | PASS |
| /admin | admin | representative | 0 | 404 | notFound |  |  | noindex, nofollow | not applicable |  |  |  | EXCLUDE | PASS | EXPECTED_404/NOT_READY |
| /api/seo/sitemap-status | api | representative | 0 | 503 | protected/non-html |  |  | noindex, nofollow | not applicable |  |  |  | EXCLUDE | PASS | PROTECTED |
| /setup | setup | representative | 0 | 404 | notFound |  |  | noindex, nofollow | not applicable |  |  |  | EXCLUDE | PASS | EXPECTED_404/NOT_READY |
| /promo/fixture-inativa | temporary_promo | representative | 0 | 200 | render | https://concursomestre.com/promo | noindex, nofollow, noindex, nofollow | noindex, follow | initial HTML; main=0; H1=1 | Promocao indisponivel |  |  | EXCLUDE | PASS | PASS |
| /practice | legacy_alias | representative | 0 | 308 | redirect |  |  |  | not applicable |  |  |  | EXCLUDE | PASS | REDIRECT |
| /fase-8-rota-inexistente | not_found | representative | 0 | 404 | notFound |  |  | noindex, nofollow | not applicable |  |  |  | EXCLUDE | PASS | EXPECTED_404/NOT_READY |
| /materiais/material-gratuito-publico | material_detail | /materiais | 1 | 200 | render | https://concursomestre.com/materiais/material-gratuito-publico | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Material gratuito público | Início, Materiais, Material gratuito público | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /materiais/material-historico | material_detail | /materiais | 1 | 200 | render | https://concursomestre.com/materiais/material-historico | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Material histórico | Início, Materiais, Material histórico | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /blog/feed.xml | blog_article | /blog | 1 | 200 | render |  |  | noindex, follow | not applicable |  |  |  | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /lei-comentada/constituicao-federal/artigo-5-a | law_article_detail | /lei-comentada/constituicao-federal/artigo-5 | 1 | 200 | render | https://concursomestre.com/lei-comentada/constituicao-federal/artigo-5-a | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Art. 5º-A da Constituição Federal | Início, Lei Comentada, Constituição Federal, Art. 5º-A | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /lei-comentada/constituicao-federal/artigo-5-b | law_article_detail | /lei-comentada/constituicao-federal/artigo-5-a | 2 | 200 | render | https://concursomestre.com/lei-comentada/constituicao-federal/artigo-5-b | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Art. 5º-B da Constituição Federal | Início, Lei Comentada, Constituição Federal, Art. 5º-B | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |
| /lei-comentada/constituicao-federal/artigo-6 | law_article_detail | /lei-comentada/constituicao-federal/artigo-5-b | 3 | 200 | render | https://concursomestre.com/lei-comentada/constituicao-federal/artigo-6 | noindex, follow, noarchive, noindex, follow, noarchive | noindex, follow | initial HTML; main=1; H1=1 | Art. 6º da Constituição Federal | Início, Lei Comentada, Constituição Federal, Art. 6º | WebPage, BreadcrumbList | PRELAUNCH excluded; PRODUCTION READY eligible | PASS | PASS |

## K. 37-route harness

| Key | Route | HTTP | Viewports | Classifications | Canonical | Schemas | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| home | / | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | / | Organization, WebSite | PASS |
| questions_hub | /questoes | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /questoes | BreadcrumbList, CollectionPage, ItemList, ListItem | PASS |
| question_detail | /questoes/67813/art-5o-acao-e-controle | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /questoes/67813/art-5o-acao-e-controle | BreadcrumbList, ListItem, WebPage | PASS |
| discipline_hub | /disciplinas | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /disciplinas | BreadcrumbList, CollectionPage, ItemList, ListItem | PASS |
| discipline_detail | /disciplinas/direito-constitucional | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /disciplinas/direito-constitucional | BreadcrumbList, ItemList, ListItem, WebPage | PASS |
| topic_detail | /topicos/controle-de-constitucionalidade | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /topicos/controle-de-constitucionalidade | BreadcrumbList, ItemList, ListItem, WebPage | PASS |
| subject_detail | /assuntos/controle-concentrado | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /assuntos/controle-concentrado | BreadcrumbList, ItemList, ListItem, WebPage | PASS |
| board_detail | /bancas/cebraspe | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /bancas/cebraspe | BreadcrumbList, ListItem, Organization, WebPage | PASS |
| organization_detail | /orgaos/orgao-de-teste | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /orgaos/orgao-de-teste | BreadcrumbList, ItemList, ListItem, Organization, WebPage | PASS |
| exam_detail | /provas/prova-ssr-2026 | 200 | desktop, mobile | INTERACTION_ONLY, INTERACTION_ONLY | /provas/prova-ssr-2026 | BreadcrumbList, ListItem, WebPage | PASS |
| contest_hub | /concursos | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /concursos | BreadcrumbList, CollectionPage, ItemList, ListItem | PASS |
| contest_detail | /concursos/concurso-canonico-2026 | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /concursos/concurso-canonico-2026 | BreadcrumbList, ItemList, ListItem, WebPage | PASS |
| open_contests | /concursos-abertos | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /concursos-abertos | BreadcrumbList, CollectionPage, ItemList, ListItem | PASS |
| careers_hub | /carreiras | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /carreiras | BreadcrumbList, CollectionPage, ItemList, ListItem | PASS |
| career_detail | /carreiras/carreira-fiscal | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /carreiras/carreira-fiscal | BreadcrumbList, ItemList, ListItem, WebPage | PASS |
| positions_hub | /cargos | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /cargos | BreadcrumbList, CollectionPage, ItemList, ListItem | PASS |
| position_detail | /cargos/analista | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /cargos/analista | BreadcrumbList, ItemList, ListItem, WebPage | PASS |
| simulations_hub | /simulados | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /simulados | BreadcrumbList, CollectionPage, ItemList, ListItem | PASS |
| simulation_detail | /simulados/simulado-publico-constitucional | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /simulados/simulado-publico-constitucional | BreadcrumbList, ItemList, ListItem, WebPage | PASS |
| law_hub | /lei-comentada | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /lei-comentada | BreadcrumbList, CollectionPage, ItemList, ListItem | PASS |
| law_detail | /lei-comentada/constituicao-federal | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /lei-comentada/constituicao-federal | BreadcrumbList, ListItem, WebPage | PASS |
| law_article | /lei-comentada/constituicao-federal/artigo-5 | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /lei-comentada/constituicao-federal/artigo-5 | BreadcrumbList, ListItem, WebPage | PASS |
| materials_hub | /materiais | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /materiais | BreadcrumbList, CollectionPage, ItemList, ListItem | PASS |
| material_detail | /materiais/guia-publico-de-estudo | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /materiais/guia-publico-de-estudo | BreadcrumbList, ListItem, WebPage | PASS |
| marketplace | /marketplace | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /marketplace | BreadcrumbList, ListItem | PASS |
| blog_hub | /blog | 200 | desktop, mobile | INTERACTION_ONLY, INTERACTION_ONLY | /blog | BreadcrumbList, CollectionPage, ItemList, ListItem | PASS |
| blog_article | /blog/noticia-ssr | 200 | desktop, mobile | INTERACTION_ONLY, INTERACTION_ONLY | /blog/noticia-ssr | BreadcrumbList, ImageObject, ListItem, NewsArticle, Organization, Person | PASS |
| blog_category | /blog/categoria/concursos | 200 | desktop, mobile | INTERACTION_ONLY, INTERACTION_ONLY | /blog/categoria/concursos | BreadcrumbList, CollectionPage, ItemList, ListItem | PASS |
| blog_tag | /blog/tag/nordeste | 200 | desktop, mobile | INTERACTION_ONLY, INTERACTION_ONLY | /blog/tag/nordeste | BreadcrumbList, CollectionPage, ItemList, ListItem | PASS |
| blog_author | /blog/autor/staff-1 | 200 | desktop, mobile | INTERACTION_ONLY, INTERACTION_ONLY | /blog/autor/staff-1 | BreadcrumbList, CollectionPage, ItemList, ListItem | PASS |
| plans | /planos | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /planos | BreadcrumbList, ListItem, WebPage | PASS |
| faq | /faq | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /faq | Answer, BreadcrumbList, FAQPage, ListItem, Question | PASS |
| news | /novidades | 200 | desktop, mobile | INTERACTION_ONLY, INTERACTION_ONLY | /novidades | BreadcrumbList, CollectionPage, ListItem | PASS |
| support | /support | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /support | BreadcrumbList, ListItem, WebPage | PASS |
| privacy | /privacy | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /privacy | BreadcrumbList, ListItem, WebPage | PASS |
| terms | /terms | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /terms | BreadcrumbList, ListItem, WebPage | PASS |
| search | /busca?q=controle | 200 | desktop, mobile | EQUIVALENT, EQUIVALENT | /busca | BreadcrumbList, CollectionPage, ItemList, ListItem | PASS |

## L. 74 executions

37 rotas × desktop/mobile = 74. EQUIVALENT=60; INTERACTION_ONLY permitido=14; semantic/security divergence=0; failures=0.

## M. Full crawl

Validação HTTP independente do Chromium + browser/hydration. URLs=60; canonicals únicos=47; noindex docs=52.

## N. Crawl seeds

`/`, `/questoes`, `/disciplinas`, `/bancas`, `/orgaos`, `/provas`, `/concursos`, `/concursos-abertos`, `/carreiras`, `/cargos`, `/simulados`, `/lei-comentada`, `/materiais`, `/blog`, `/planos`, `/faq`, `/novidades`, `/support`, `/privacy`, `/terms`

## O. Crawl graph

Seeds=20; descobertas por links=6; profundidade limite=4; máximo=300. Hubs, details, taxonomias, editorial, comercial, funcional, privado, aliases, query variants, hard 404 e NOT_READY foram cobertos. Não havia caso real aplicável de 410.

## P. 1245-link analysis

Raw links=1245; unique normalized targets=204; unique source→target pairs=970; structural=640; functional/nonstructural=605. Links foram extraídos de `a[href]` do HTML inicial, normalizados e classificados por família/policy.

## Q. Internal-link health

broken structural=0; redirects=0; aliases=0; private=0.

## R. Redirects

Loops=0; chains inesperadas >1=0; 5 casos resolvem em 308 one-hop para canonical atual.

## S. Aliases

| Alias | Target | Status | Hops | Final |
| --- | --- | --- | --- | --- |
| /practice | /questoes | 308 | 1 | 200 |
| /questions | /questoes | 308 | 1 | 200 |
| /question/67813/art-5o-acao-e-controle | /questoes/67813/art-5o-acao-e-controle | 308 | 1 | 200 |
| /blog/provas | /provas | 308 | 1 | 200 |
| /blog/provas/prova-ssr-2026 | /provas/prova-ssr-2026 | 308 | 1 | 200 |

## T. Canonical

Missing em render TARGET_INDEX=0; canonical→redirect=0; canonical→404=0; mismatch=0; query pollution=0. Host confiável vem de index policy, nunca do Host header arbitrário.

## U. HTTP statuses

| URL | Expected | Actual | Canonical | Robots |
| --- | --- | --- | --- | --- |
| /questoes/999999/nao-existe | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow |
| /disciplinas/nao-existe | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow |
| /orgaos/nao-existe | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow |
| /concursos/nao-existe | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow |
| /simulados/nao-existe | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow |
| /lei-comentada/constituicao-federal/artigo-999 | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow |
| /materiais/nao-existe | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow |
| /blog/nao-existe | 404 | 404 |  | noindex, noindex, nofollow, noindex, nofollow |

## V. Hard 404

8 fixtures negativas retornaram HTTP 404 real e canonical ausente.

## W. Soft 404

Novos defeitos arquiteturais=0. O slug desconhecido de blog foi corrigido no fixture para não gerar falso 200.

## X. PRELAUNCH

Modo efetivo PRELAUNCH; effective INDEX=0; páginas rastreáveis permanecem crawlable NOINDEX.

## Y. GO_CANDIDATE

Effective INDEX=0. Continua audit-only e fail-closed.

## Z. Production simulation

Somente fixture isolada. READY INDEX=36; runtime operacional permaneceu PRELAUNCH.

## AA. Explicit NOINDEX

Regressão da Fase 6 passou: explicit NOINDEX permanece NOINDEX mesmo em PRODUCTION + canonical host + confirmation. NOT_READY, quality FAIL e PERMANENT_NOINDEX também permanecem fora de index/sitemap. Launch mode inválido normaliza para PRELAUNCH.

## AB. Canonical host

Autoridade configurada: `https://concursomestre.com`.

## AC. Noncanonical hosts

Preview, staging, local, IP e host não canônico permanecem NOINDEX inclusive na simulação PRODUCTION.

## AD. Robots meta

Meta robots validado em 60 URLs; PRELAUNCH INDEX=0.

## AE. X-Robots

Headers coerentes; conflito meta/header=0.

## AF. robots.txt

HTTP 200, sintaticamente válido, sem `Disallow: /` global e sem exposição prematura de sitemap.

## AG. Sitemap state

production sitemap published=NÃO; PRELAUNCH endpoint=503 fail-closed e zero URLs reais publicadas.

## AH. Sitemap simulation

PRODUCTION simulation inclui somente TARGET_INDEX + public + READY + canonical 200 sem redirect.

## AI. Sitemap intersections

NOINDEX=0; redirect=0; 404/410=0; private=0; NOT_READY=0; PERMANENT_NOINDEX=0; alias=0; canonical mismatch=0; query URL=0.

## AJ. Sitemap duplicates

within child=0; cross-child=0; cross-family=0; contract duplicate families=0.

## AK. Lastmod/XML

Lastmod fact-based only; sem NOW artificial. XML foi coberto pelos contratos PHP; escala real permanece gate aberto.

## AL. Internal-link graph

Famílias no grafo=44; Page Map divergence=0; inferred relations promoted=0.

## AM. 67 relations

| ID | Source | Target | Authority |
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

## AN. 9 rejected inferences

| ID | Source | Target | Reason |
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

## AO. Orphans

Detector de fixture está ativo e nenhum orphan arquitetural foi introduzido. `SEO_ORPHAN_REAL_DATA_VALIDATION_REQUIRED` permanece OPEN.

## AP. Breadcrumbs

Visual/JSON-LD usam a mesma autoridade; divergence=0; fake hubs=0; alias/redirect breadcrumb targets=0.

## AQ. Structured data

Primary schema conflicts=0; BreadcrumbList duplicates=0; ItemList duplicates=0; private JSON-LD=0; invalid JSON-LD/XSS=0; fatos visíveis somente.

## AR. SSR

TARGET_INDEX representatives possuem conteúdo crítico no HTML inicial. CSR-only regressions=0. Casos client pilot conhecidos: elite e ranking, protegidos por launch/readiness e não promovidos.

## AS. Hydration

Warnings=0; errors=0; semantic divergence=0; security divergence=0.

## AT. Client authority

Canonical mutations=0; robots mutations=0; client indexability authority=0; client sitemap authority=0.

## AU. Performance regression

Matriz com 74 execuções; regressões bloqueantes=0; hard 404 e dimensões de imagem preservados.

## AV. Billing

Subscriptions implementation continua ausente do startup público; gate da Fase 7 passou na suíte completa.

## AW. Tracker

Anônimo não monta; autenticado monta conforme contrato; gate da Fase 7 passou.

## AX. Cache security

Cross-user leak=0 no escopo de laboratório. Validação de cache/CDN em produção permanece OPEN.

## AY. N+1

Novo N+1=0; Fase 8 não adicionou query por card.

## AZ. Security

Sentinels privados/premium/tokens/signed URLs/storage keys/personal/transaction data=0. Secret URL discovery=0.

## BA. Query/facet traps

8 variantes auditadas; unlimited crawl space=0; unknown params/tracking/search/filter/cursor/sort não criam identidade indexável; cursor inválido permanece fail-closed.

## BB. Matrices

### FULL_CRAWL_MATRIX

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

### FAMILY_COVERAGE_MATRIX

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

### REDIRECT_MATRIX

| Alias | Esperado | Target esperado | Real | Target real | Hops | Final |
| --- | --- | --- | --- | --- | --- | --- |
| /practice | 308 | /questoes | 308 | /questoes | 1 | 200 |
| /questions | 308 | /questoes | 308 | /questoes | 1 | 200 |
| /question/67813/art-5o-acao-e-controle | 308 | /questoes/67813/art-5o-acao-e-controle | 308 | /questoes/67813/art-5o-acao-e-controle | 1 | 200 |
| /blog/provas | 308 | /provas | 308 | /provas | 1 | 200 |
| /blog/provas/prova-ssr-2026 | 308 | /provas/prova-ssr-2026 | 308 | /provas/prova-ssr-2026 | 1 | 200 |

### ERROR_MATRIX

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

### SEO_SIGNAL_MATRIX

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

### INDEXABILITY_MATRIX

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

### SITEMAP_MATRIX

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

### INTERNAL_LINK_MATRIX

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

### PERFORMANCE_REGRESSION_MATRIX

| Rota | Key | Viewport | Classificação | HTML raw | HTML hydrated | RSC | Server fetches | Browser fetches | Console | Page errors | Hydration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | home | desktop | EQUIVALENT | 250190 | 250267 | 164033 |  | 0 | 0 | 0 | 0 |
| / | home | mobile | EQUIVALENT | 250190 | 250267 | 164033 |  | 0 | 0 | 0 | 0 |
| /questoes | questions_hub | desktop | EQUIVALENT | 263541 | 264654 | 191 |  | 0 | 0 | 0 | 0 |
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
| /provas/prova-ssr-2026 | exam_detail | desktop | INTERACTION_ONLY | 232843 | 235375 | 208 |  | 0 | 0 | 0 | 0 |
| /provas/prova-ssr-2026 | exam_detail | mobile | INTERACTION_ONLY | 232843 | 235375 | 208 |  | 0 | 0 | 0 | 0 |
| /concursos | contest_hub | desktop | EQUIVALENT | 232703 | 233983 | 193 |  | 0 | 0 | 0 | 0 |
| /concursos | contest_hub | mobile | EQUIVALENT | 232703 | 233983 | 193 |  | 0 | 0 | 0 | 0 |
| /concursos/concurso-canonico-2026 | contest_detail | desktop | EQUIVALENT | 246149 | 247439 | 251 |  | 0 | 0 | 0 | 0 |
| /concursos/concurso-canonico-2026 | contest_detail | mobile | EQUIVALENT | 246149 | 247439 | 251 |  | 0 | 0 | 0 | 0 |
| /concursos-abertos | open_contests | desktop | EQUIVALENT | 232028 | 233308 | 180 |  | 0 | 0 | 0 | 0 |
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
| /simulados/simulado-publico-constitucional | simulation_detail | desktop | EQUIVALENT | 243905 | 245187 | 231 |  | 0 | 0 | 0 | 0 |
| /simulados/simulado-publico-constitucional | simulation_detail | mobile | EQUIVALENT | 243905 | 245264 | 231 |  | 0 | 0 | 0 | 0 |
| /lei-comentada | law_hub | desktop | EQUIVALENT | 229479 | 230018 | 168000 |  | 0 | 0 | 0 | 0 |
| /lei-comentada | law_hub | mobile | EQUIVALENT | 229479 | 230018 | 168000 |  | 0 | 0 | 0 | 0 |
| /lei-comentada/constituicao-federal | law_detail | desktop | EQUIVALENT | 257691 | 258285 | 257 |  | 0 | 0 | 0 | 0 |
| /lei-comentada/constituicao-federal | law_detail | mobile | EQUIVALENT | 257691 | 258285 | 257 |  | 0 | 0 | 0 | 0 |
| /lei-comentada/constituicao-federal/artigo-5 | law_article | desktop | EQUIVALENT | 233892 | 235173 | 308 |  | 0 | 0 | 0 | 0 |
| /lei-comentada/constituicao-federal/artigo-5 | law_article | mobile | EQUIVALENT | 233892 | 235173 | 308 |  | 0 | 0 | 0 | 0 |
| /materiais | materials_hub | desktop | EQUIVALENT | 233349 | 234630 | 164 |  | 0 | 0 | 0 | 0 |
| /materiais | materials_hub | mobile | EQUIVALENT | 233349 | 234630 | 164 |  | 0 | 0 | 0 | 0 |
| /materiais/guia-publico-de-estudo | material_detail | desktop | EQUIVALENT | 232468 | 233937 | 222 |  | 0 | 0 | 0 | 0 |
| /materiais/guia-publico-de-estudo | material_detail | mobile | EQUIVALENT | 232468 | 233815 | 222 |  | 0 | 0 | 0 | 0 |
| /marketplace | marketplace | desktop | EQUIVALENT | 233894 | 235047 | 167731 |  | 0 | 0 | 0 | 0 |
| /marketplace | marketplace | mobile | EQUIVALENT | 233894 | 235047 | 167731 |  | 0 | 0 | 0 | 0 |
| /blog | blog_hub | desktop | INTERACTION_ONLY | 248734 | 253433 | 183 |  | 0 | 0 | 0 | 0 |
| /blog | blog_hub | mobile | INTERACTION_ONLY | 248734 | 253433 | 183 |  | 0 | 0 | 0 | 0 |
| /blog/noticia-ssr | blog_article | desktop | INTERACTION_ONLY | 233717 | 236218 | 230 |  | 0 | 0 | 0 | 0 |
| /blog/noticia-ssr | blog_article | mobile | INTERACTION_ONLY | 233717 | 236218 | 230 |  | 0 | 0 | 0 | 0 |
| /blog/categoria/concursos | blog_category | desktop | INTERACTION_ONLY | 224577 | 227106 | 255 |  | 0 | 0 | 0 | 0 |
| /blog/categoria/concursos | blog_category | mobile | INTERACTION_ONLY | 224577 | 227106 | 255 |  | 0 | 0 | 0 | 0 |
| /blog/tag/nordeste | blog_tag | desktop | INTERACTION_ONLY | 224651 | 227180 | 248 |  | 0 | 0 | 0 | 0 |
| /blog/tag/nordeste | blog_tag | mobile | INTERACTION_ONLY | 224651 | 227180 | 248 |  | 0 | 0 | 0 | 0 |
| /blog/autor/staff-1 | blog_author | desktop | INTERACTION_ONLY | 223196 | 223652 | 247 |  | 0 | 0 | 0 | 0 |
| /blog/autor/staff-1 | blog_author | mobile | INTERACTION_ONLY | 223196 | 223530 | 247 |  | 0 | 0 | 0 | 0 |
| /planos | plans | desktop | EQUIVALENT | 203534 | 265127 | 167241 |  | 0 | 0 | 0 | 0 |
| /planos | plans | mobile | EQUIVALENT | 203534 | 265127 | 167241 |  | 0 | 0 | 0 | 0 |
| /faq | faq | desktop | EQUIVALENT | 276283 | 277432 | 173366 |  | 0 | 0 | 0 | 0 |
| /faq | faq | mobile | EQUIVALENT | 276283 | 277432 | 173366 |  | 0 | 0 | 0 | 0 |
| /novidades | news | desktop | INTERACTION_ONLY | 219396 | 219856 | 193 |  | 0 | 0 | 0 | 0 |
| /novidades | news | mobile | INTERACTION_ONLY | 219396 | 220100 | 193 |  | 0 | 0 | 0 | 0 |
| /support | support | desktop | EQUIVALENT | 222095 | 233642 | 166886 |  | 0 | 0 | 0 | 0 |
| /support | support | mobile | EQUIVALENT | 222095 | 233642 | 166886 |  | 0 | 0 | 0 | 0 |
| /privacy | privacy | desktop | EQUIVALENT | 223061 | 223109 | 165789 |  | 0 | 0 | 0 | 0 |
| /privacy | privacy | mobile | EQUIVALENT | 223061 | 223109 | 165789 |  | 0 | 0 | 0 | 0 |
| /terms | terms | desktop | EQUIVALENT | 221000 | 221078 | 165684 |  | 0 | 0 | 0 | 0 |
| /terms | terms | mobile | EQUIVALENT | 221000 | 221078 | 165684 |  | 0 | 0 | 0 | 0 |
| /busca?q=controle | search | desktop | EQUIVALENT | 264123 | 265236 | 217 |  | 0 | 0 | 0 | 0 |
| /busca?q=controle | search | mobile | EQUIVALENT | 264123 | 265236 | 217 |  | 0 | 0 | 0 | 0 |

### SECURITY_MATRIX

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



## BC. Cross-matrix consistency

Contradictions=0: nenhum NOINDEX incluído no sitemap, 404 com self canonical ou private target como structural public link.

## BD. Machine-readable result

`.tmp/seo/phase-8-final-audit-gate.json` contém todos os campos obrigatórios: phase, baseline, families, targetIndexFamilies, permanentNoindexFamilies, crawlStats, p0, p1, p2, architectureSeoGo, realDataValidationPending, productionActivated, productionSitemapPublished, searchEnginesNotified, blockingGates.

## BE. Machine-readable determinism

Duas execuções com mesma config/fixture produziram SHA-256 idêntico: `79EA1C3A481AE0A5C13D581C0B2DECA655BAD74C2832448639C4A763EDC1E786` (campos operacionais externos ao JSON não participam).

## BF. 20 real-data gates

| Gate | Origin | Evidence | Timing | Fixture closes? | Status | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| INTERNAL_LINK_GRAPH_REAL_DATA_VALIDATION_REQUIRED | Fase 5 | REAL_DATA | after definitive load | NO | OPEN | REAL_DATASET_SEO_VALIDATED |
| SEO_ORPHAN_REAL_DATA_VALIDATION_REQUIRED | Fase 5 | REAL_DATA | after definitive load | NO | OPEN | REAL_DATASET_SEO_VALIDATED |
| BREADCRUMB_REAL_DATA_VALIDATION_REQUIRED | Fase 5 | REAL_DATA | after definitive load | NO | OPEN | REAL_DATASET_SEO_VALIDATED |
| STRUCTURED_DATA_REAL_DATA_VALIDATION_REQUIRED | Fase 5 | REAL_DATA | after definitive load | NO | OPEN | REAL_DATASET_SEO_VALIDATED |
| BLOG_TAXONOMY_REAL_DATA_VALIDATION | Fase 4 START #8 | REAL_DATA | after definitive blog load | NO | OPEN | REAL_DATASET_SEO_VALIDATED |
| BLOG_TAXONOMY_REAL_DATA_QUALITY_GATE | Fase 4 START #8 | REAL_DATA | after editorial load | NO | OPEN | FINAL_PRODUCTION_SEO_VALIDATED |
| BLOG_TAXONOMY_REAL_DATA_EXPLAIN_REQUIRED | Fase 4 START #8 | REAL_DB | staging/replica with real volume | NO | OPEN | PLATFORM_PRODUCTION_GO |
| SITEMAP_REAL_DATA_VALIDATION_REQUIRED | Fase 6 | REAL_DATA | after definitive load | NO | OPEN | FINAL_PRODUCTION_SEO_VALIDATED |
| INDEX_POLICY_REAL_DATA_VALIDATION_REQUIRED | Fase 6 | REAL_DATA | after definitive load | NO | OPEN | FINAL_PRODUCTION_SEO_VALIDATED |
| ROBOTS_PRODUCTION_VALIDATION_REQUIRED | Fase 6 | PRODUCTION | release candidate | NO | OPEN | PLATFORM_PRODUCTION_GO |
| CANONICAL_HOST_PRODUCTION_VALIDATION_REQUIRED | Fase 6 | PRODUCTION | release candidate | NO | OPEN | PLATFORM_PRODUCTION_GO |
| SITEMAP_PRODUCTION_SCALE_VALIDATION_REQUIRED | Fase 6 | REAL_DB | staging at production scale | NO | OPEN | PLATFORM_PRODUCTION_GO |
| SEARCH_ENGINE_SUBMISSION_AFTER_SEO_GO | Fase 6 | FIELD | after integrated Production GO | NO | OPEN | SEARCH_ENGINE_SUBMISSION |
| PERFORMANCE_REAL_DATA_QUERY_VALIDATION_REQUIRED | Fase 7 | REAL_DB | after definitive load | NO | OPEN | PLATFORM_PRODUCTION_GO |
| PERFORMANCE_REAL_DATA_EXPLAIN_REQUIRED | Fase 7 | REAL_DB | after definitive load | NO | OPEN | PLATFORM_PRODUCTION_GO |
| CORE_WEB_VITALS_REAL_USER_VALIDATION_REQUIRED | Fase 7 | FIELD | after controlled traffic | NO | OPEN | FINAL_PRODUCTION_SEO_VALIDATED |
| PRODUCTION_PERFORMANCE_SMOKE_REQUIRED | Fase 7 | PRODUCTION | release candidate | NO | OPEN | PLATFORM_PRODUCTION_GO |
| CDN_CACHE_PRODUCTION_VALIDATION_REQUIRED | Fase 7 | PRODUCTION/FIELD | release candidate | NO | OPEN | PLATFORM_PRODUCTION_GO |
| FONT_DELIVERY_PRODUCTION_VALIDATION_REQUIRED | Fase 7 | PRODUCTION/FIELD | release candidate | NO | OPEN | PLATFORM_PRODUCTION_GO |
| IMAGE_DELIVERY_REAL_DATA_VALIDATION_REQUIRED | Fase 7 | REAL_DATA/FIELD | after definitive media load | NO | OPEN | FINAL_PRODUCTION_SEO_VALIDATED |

## BG. Gate classification

Todos os requirements REAL_DATA, REAL_DB, FIELD ou PRODUCTION permanecem OPEN; fixture closes=NO para 20/20.

## BH. Test dataset

test dataset removed=NÃO.

## BI. Real dataset

real dataset loaded=NÃO; real dataset validated=NÃO.

## BJ. Platform readiness

platform production ready=NÃO.

## BK. Production GO

CONCURSOMESTRE_PRODUCTION_GO=NÃO.

## BL. Reporter

Reporter é read-only, fail-closed, não usa DB nem muda env; outputs controlados em `.tmp` e documentação explícita.

## BM. Side effects

Network mutations=0; search engine contact=0; sitemap publication=0; DB mutation=0; env mutation persistente=0.

## BN. Dependencies

npm dependency changes=0; Composer dependency changes=0; unexpected lockfile changes=0.

## BO. Migration

phase 8 migration created=NÃO; phase 8 migration applied production=NÃO; schema changes=0.

## BP. Production DB

production DB writes=0; phase 8 backfill writes=0.

## BQ. @seo

runtime consumers=0.

## BR. Vitest

PASS: 154 files, 910 tests.

## BS. Build

PASS: clean Next.js 16.2.11 build; 52 static pages generated.

## BT. Typecheck/route types

PASS: `next typegen` + `tsc --noEmit`.

## BU. PHP

PASS: 7 focused tests; PHP lint PASS em 9 arquivos. Baseline assertion delta corrigido apenas no teste para refletir 3 integrações já existentes.

## BV. ESLint

PASS: 0 errors. Duas warnings preexistentes em PracticeClient, fora das linhas alteradas; não são regressão da Fase 8.

## BW. Launch validator

PASS: 55 families, 40 TARGET_INDEX, 15 PERMANENT_NOINDEX, 19 fixtures.

## BX. Security scan

PASS: secrets, encoding, generated artifacts e protected sentinels.

## BY. P0

0.

## BZ. P1

0.

## CA. P2

0 no delta arquitetural da Fase 8. Limitações de dados reais são contabilizadas separadamente como OPEN_REAL_DATA_GATES=20; warnings ESLint são baseline preexistente.

## CB. Open real-data gates

| Gate | Status | Evidence required | Future milestone |
| --- | --- | --- | --- |
| INTERNAL_LINK_GRAPH_REAL_DATA_VALIDATION_REQUIRED | OPEN | REAL_DATA | REAL_DATASET_SEO_VALIDATED |
| SEO_ORPHAN_REAL_DATA_VALIDATION_REQUIRED | OPEN | REAL_DATA | REAL_DATASET_SEO_VALIDATED |
| BREADCRUMB_REAL_DATA_VALIDATION_REQUIRED | OPEN | REAL_DATA | REAL_DATASET_SEO_VALIDATED |
| STRUCTURED_DATA_REAL_DATA_VALIDATION_REQUIRED | OPEN | REAL_DATA | REAL_DATASET_SEO_VALIDATED |
| BLOG_TAXONOMY_REAL_DATA_VALIDATION | OPEN | REAL_DATA | REAL_DATASET_SEO_VALIDATED |
| BLOG_TAXONOMY_REAL_DATA_QUALITY_GATE | OPEN | REAL_DATA | FINAL_PRODUCTION_SEO_VALIDATED |
| BLOG_TAXONOMY_REAL_DATA_EXPLAIN_REQUIRED | OPEN | REAL_DB | PLATFORM_PRODUCTION_GO |
| SITEMAP_REAL_DATA_VALIDATION_REQUIRED | OPEN | REAL_DATA | FINAL_PRODUCTION_SEO_VALIDATED |
| INDEX_POLICY_REAL_DATA_VALIDATION_REQUIRED | OPEN | REAL_DATA | FINAL_PRODUCTION_SEO_VALIDATED |
| ROBOTS_PRODUCTION_VALIDATION_REQUIRED | OPEN | PRODUCTION | PLATFORM_PRODUCTION_GO |
| CANONICAL_HOST_PRODUCTION_VALIDATION_REQUIRED | OPEN | PRODUCTION | PLATFORM_PRODUCTION_GO |
| SITEMAP_PRODUCTION_SCALE_VALIDATION_REQUIRED | OPEN | REAL_DB | PLATFORM_PRODUCTION_GO |
| SEARCH_ENGINE_SUBMISSION_AFTER_SEO_GO | OPEN | FIELD | SEARCH_ENGINE_SUBMISSION |
| PERFORMANCE_REAL_DATA_QUERY_VALIDATION_REQUIRED | OPEN | REAL_DB | PLATFORM_PRODUCTION_GO |
| PERFORMANCE_REAL_DATA_EXPLAIN_REQUIRED | OPEN | REAL_DB | PLATFORM_PRODUCTION_GO |
| CORE_WEB_VITALS_REAL_USER_VALIDATION_REQUIRED | OPEN | FIELD | FINAL_PRODUCTION_SEO_VALIDATED |
| PRODUCTION_PERFORMANCE_SMOKE_REQUIRED | OPEN | PRODUCTION | PLATFORM_PRODUCTION_GO |
| CDN_CACHE_PRODUCTION_VALIDATION_REQUIRED | OPEN | PRODUCTION/FIELD | PLATFORM_PRODUCTION_GO |
| FONT_DELIVERY_PRODUCTION_VALIDATION_REQUIRED | OPEN | PRODUCTION/FIELD | PLATFORM_PRODUCTION_GO |
| IMAGE_DELIVERY_REAL_DATA_VALIDATION_REQUIRED | OPEN | REAL_DATA/FIELD | FINAL_PRODUCTION_SEO_VALIDATED |

## CC. Diffstat

22 files; modified=11; new=11; removed=0; renamed=0; insertions=6247; deletions=14.

## CD. Worktree

Sem staging, commit, push ou deploy. Worktree contém somente Fase 8 e estes dois relatórios versionados.

## CE. SEO_GO decision

`SEO_GO` mantido: architectureSeoGo=true, P0=0, P1=0, 20 real-data gates OPEN e nenhuma ativação operacional.

## CF. Recommendation

Aprovada com ressalvas operacionais: congelar a Fase 8 em checkpoint Git somente após revisão deste relatório. Depois, manter PRELAUNCH e executar a remoção controlada do dataset de teste, carga real e gates pendentes antes de Production GO.

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
- platform production ready = NÃO
- CONCURSOMESTRE_PRODUCTION_GO = NÃO
- commit = NÃO
- push realizado = NÃO
- deploy realizado = NÃO
