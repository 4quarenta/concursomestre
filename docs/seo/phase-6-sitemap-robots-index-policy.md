# Fase 6 - Sitemap, Robots e Index Policy

Data: 2026-08-23
Baseline: `57a88ed239b71cefc6cc0b4f2d5b997225763fe2` (`1.0.0`)
Evidência: contratos e fixtures versionados; dataset real permanece gate futuro.
Estado operacional: `PRELAUNCH`; indexação, sitemap de produção e submissão a buscadores desativados.

## A. Resumo executivo

A Fase 6 consolidou um pipeline fail-closed para indexabilidade, `X-Robots-Tag`, `robots.txt` e sitemap. O Production Page Map é a autoridade de família; ambiente, publicação, readiness, quality quando exigida, resolução HTTP e canonical restringem cada instância.

## B. Baseline

Branch `1.0.0`, HEAD inicial `57a88ed239b71cefc6cc0b4f2d5b997225763fe2`, worktree inicialmente limpo.

## C. Diff

Escopo limitado a policy/configuração SEO, rotas de robots/sitemap, materializador/validator/reporter, fixtures, testes e documentação. Sem novas famílias, migrations, dependências ou alterações de banco.

## D. Family inventory

Production Page Map: 55 famílias; grafo da Fase 5: 44 famílias navegáveis; Structural Route Policy: 39 agrupamentos; App Router: 97 rotas descobertas. A diferença é de granularidade: o Page Map inclui resolução, facetas e superfícies privadas; o grafo cobre páginas navegáveis; a Structural Policy agrupa aliases e ações de rota. Divergências sem mapeamento: zero.

## E. Index policy architecture

Ordem: existência/resolução -> publicação -> launch mode -> ambiente/ativação -> elegibilidade da família -> readiness da instância -> quality quando declarada -> canonical/HTTP -> robots/indexabilidade -> sitemap.

## F. PublicationDecision

Draft, scheduled ainda não publicado, privado, interno, protegido ou arquivado não podem produzir `INDEX` nem sitemap.

## G. LaunchMode

Valores válidos: `PRELAUNCH`, `GO_CANDIDATE`, `PRODUCTION`; ausência ou valor inválido cai em `PRELAUNCH`.

## H. FamilyEligibility

`INDEXABLE` e `CONDITIONAL` expressam destino estratégico; `PERMANENT_NOINDEX` jamais é promovível.

## I. InstanceReadiness

`READY` é estrutural e por instância. `NOT_READY` e `NOT_APPLICABLE` bloqueiam sitemap e indexação com reason code.

## J. Quality

Quality não é gate de volume para famílias estruturais. Só `blog_category` e `marketing_landing` exigem `PASS` explícito; ausência de evidência fica fail-closed.

## K. Resolution

Somente `render`, HTTP 200 e canonical válida podem indexar. Redirect, 404 e 410 ficam fora.

## L. Canonical

Canonical usa identidade/slug persistido e origem confiável `https://concursomestre.com`; não deriva do header `Host`.

## M. PRELAUNCH

Todas as páginas públicas rastreáveis permanecem `noindex`; sitemap retorna 503 e não é anunciado em robots.

## N. GO_CANDIDATE

Permanece `noindex`; simulação materializada só pode usar diretório isolado e nunca o diretório servido.

## O. PRODUCTION simulation

Somente família ativa, target `INDEX`, publicação permitida, `READY`, quality aplicável `PASS`, ambiente canônico, ativações confirmadas, render 200 e canonical válida resultam em `INDEX`.

## P. Permanent NOINDEX families

Busca, facetas, auth, conta, ferramentas privadas, checkout, admin, APIs, setup, promo temporária, aliases, erros e demais entradas declaradas permanecem `NOINDEX`.

## Q. Marketplace

`PERMANENT_NOINDEX`, removido do inventário público auxiliar e rejeitado pelo validator de sitemap.

## R. Blog Tags

`PERMANENT_NOINDEX`; não entram no gerador nem no sitemap.

## S. Functional/private routes

Rotas privadas permanecem em `Disallow` onde bloquear crawl é apropriado e recebem `X-Robots-Tag` em APIs/uploads/downloads cobertos pelo Next.

## T. Search/query policy

Parâmetros funcionais geram `noindex,follow`; tracking não cria canonical alternativa.

## U. Facets

Facetas são ferramentas, não landings canônicas, e ficam permanentemente fora do sitemap.

## V. Pagination

Somente paginação estrutural explicitamente aprovada pode ser canonical; paginação funcional continua governada pela família e nunca é descoberta automaticamente pelo sitemap.

## W. Robots meta

PRELAUNCH/GO emitem meta `noindex,follow`. Em produção elegível, o meta `index` explícito é omitido e vale o default do crawler; um `noindex` explícito de instância, faceta ou publication/readiness é sempre preservado.

## X. X-Robots-Tag

O proxy aplica `noindex` por launch mode, família, query e origem real. APIs, storage, uploads e downloads recebem `noindex,nofollow` por header.

## Y. Meta/header parity

Não há par `meta index` versus header `noindex`: produção elegível omite diretiva positiva; host alternativo pode ser restringido pelo header sem contradição.

## Z. robots.txt

Rota dinâmica canônica, `Allow: /`, sem `Disallow: /`; não bloqueia páginas públicas que precisam expor `noindex`.

## AA. Crawlable NOINDEX

Conteúdo público pré-lançamento continua rastreável para que crawlers observem `noindex`.

## AB. Canonical host

Origem canônica vem do contrato versionado e configuração confiável, nunca da requisição.

## AC. Noncanonical hosts

Host de request divergente bloqueia indexação e publicação do sitemap.

## AD. Preview/staging

Ambiente diferente de `PRODUCTION` ou `VERCEL_ENV` preview bloqueia indexação mesmo com launch mode incorretamente configurado.

## AE. Sitemap architecture

Uma árvore estática validada e promovida atomicamente; geração pesada nunca ocorre no request.

## AF. Sitemap index

Única autoridade canônica: `/sitemap.xml`. `/sitemap-index.xml` é apenas redirect legado 308 após ativação completa.

## AG. Child sitemaps

Filhos em `/sitemaps/{section-NNNNN.xml}` e todos referenciados pelo índice. XML órfão invalida a árvore.

## AH. Batching

Keyset por ID e lotes determinísticos; não usa OFFSET para entidades de alto volume.

## AI. URL/size limits

Máximo operacional de 45.000 URLs por filho e 50 MB descompactados; validator também limita o índice.

## AJ. Static/dynamic generation

Geração é CLI/offline; rotas Next apenas leem artefatos validados.

## AK. Sitemap cache

Produção: `s-maxage=300, must-revalidate`; estados bloqueados e artefatos ausentes: `private, no-store`.

## AL. PRELAUNCH sitemap

HTTP 503, `X-Robots-Tag: noindex,nofollow`, zero divulgação em robots.

## AM. GO_CANDIDATE sitemap

Público continua 503. Simulação exige output isolado.

## AN. Production simulation sitemap

Fixture confirma inclusão apenas de `INDEX + READY + public + render 200 + canonical`.

## AO. Family sitemap policies

Cada família dinâmica é validada contra `ACTIVE + target INDEX + INCLUDE_WHEN_READY`; Page Map não é duplicado como lista permissiva independente.

## AP. Questions

Somente `published|scheduled`, públicas e com `published_sort_at <= NOW()`; a canonical existente é preservada e a query replica a cláusula pública do runtime.

## AQ. Practice taxonomies

Disciplinas, tópicos e assuntos usam cadeia estrutural válida; subtópico não recebe URL própria.

## AR. Bancas

Readiness estrutural substitui o antigo threshold temporário de conteúdo.

## AS. Órgãos

`filters.type=orgao`, slug persistido e exposição pública; cobertura adicionada ao sitemap futuro.

## AT. Provas

Somente publicadas/públicas, sem arquivo arquivado e com slug persistido.

## AU. Concursos

Somente entidade canônica publicada/pública/READY; combinações sintéticas não participam.

## AV. Careers/Cargos

Filtros canônicos `carreira`/`cargo`, readiness estrutural e slugs persistidos.

## AW. Simulados

Somente simulados públicos, publicados, com definição e itens públicos READY.

## AX. Laws

Leis públicas válidas; `lastmod` apenas de timestamps persistidos.

## AY. Law Articles

Artigos oficiais válidos ligados a lei pública, slugs persistidos e status sustentado.

## AZ. Materials

Somente materiais aprovados/públicos/READY; Marketplace não é confundido com material indexável.

## BA. Blog

Artigos publicados entram como filhos do índice canônico; `blog-sitemap.xml` paralelo foi removido.

## BB. Blog Categories

Target continua `INDEX`, mas sem quality real materializada ficam fora do sitemap e `NOINDEX`.

## BC. Blog Tags

Exclusão permanente confirmada.

## BD. Static pages

Somente famílias `ACTIVE + INDEX + INCLUDE_WHEN_READY` do Page Map são emitidas; `lastmod` é omitido sem fonte factual.

## BE. Lastmod

Sem `NOW()` ou mtime de deploy; datas futuras e inválidas são rejeitadas.

## BF. XML validation

DOM XML com `LIBXML_NONET`, namespaces válidos, origem HTTPS e paths canônicos.

## BG. Duplicate URLs

Duplicatas no conjunto completo invalidam a publicação.

## BH. Redirect/404/410 audit

Validação HTTP opcional exige 200 sem redirect; fixtures cobrem redirect, 404 e 410 como inelegíveis.

## BI. NOINDEX sitemap audit

Validação HTTP rejeita meta/header `noindex` e conflito de diretivas.

## BJ. Canonical mismatch

Canonical ausente ou divergente invalida URL durante crawl HTTP.

## BK. Private/NOT_READY audit

Prefixes privados e permanentes são rejeitados; fixture `NOT_READY` nunca entra.

## BL. Host validation

Índice e filhos exigem origem canônica HTTPS, sem query ou fragment.

## BM. Sitemap robots directive

Robots anuncia exatamente um `/sitemap.xml` somente após todos os gates e após confirmar que a árvore estática versionada existe e foi validada.

## BN. Cache transition

TTL curto, `must-revalidate`, ausência de cache nos estados bloqueados e verificação do artefato eliminam anúncio antecipado durante a transição.

## BO. Activation procedure

Após auditorias finais: gerar e validar árvore em simulação isolada; confirmar origem; definir ambiente `PRODUCTION`; ativar indexação; confirmar sitemap separadamente; materializar/promover a árvore validada; validar HTTP; só então submeter. Enquanto a árvore corrente não existir, `robots.txt` não a anuncia e a rota retorna 503.

## BP. Rollback/failback

Reverter `SEO_PRODUCTION_SITEMAP`, depois `SEO_PRODUCTION_INDEXING`, e retornar `SEO_LAUNCH_MODE=PRELAUNCH`; respostas passam imediatamente a noindex/503 após revalidação curta.

## BQ. Atomicity

Publisher gera staging imutável, valida e promove por rename/symlink atômico; status versionado identifica a árvore.

## BR. Reporters

`report_index_policy_phase_6.php` roda por fixture sem DB ou, explicitamente, com `Database('read')`; nenhum comando de escrita existe.

## BS. Real-data gates

Permanecem obrigatórios: consistência real, coverage, performance, escala, crawl HTTP e EXPLAIN com dataset definitivo.

## BT. Search-engine submission gate

Nenhuma notificação nesta fase; submissão ocorre somente após SEO GO e validação pós-deploy.

## BU. Fixtures

19 casos cobrem PRELAUNCH, GO, produção, draft, permanent noindex, privado, redirect, 404, 410, faceta, canonical, host, ativação e quality.

## BV. Harness

Harness existente permanece a autoridade SSR/hydration; Phase 6 adiciona matriz de rotas e respostas de robots/sitemap sem alterar UI.

## BW. Cross-matrix validation

Validator cruza 55 famílias do Page Map, 44 do grafo, 39 grupos estruturais, fixtures e rotas App Router; ausências não explicadas são erro.

## BX. Production sitemap crawl

Crawl real fica gate pós-carga/pós-deploy; validator já suporta status, canonical, robots e redirects por HTTP.

## BY. PRELAUNCH crawl

Fixtures confirmam noindex e sitemap indisponível; nenhum crawl externo foi disparado.

## BZ. Security

Sem segredos, dados pessoais, DTOs privados ou conteúdo protegido nos contratos/reports.

## CA. XSS/XML injection

URLs e `lastmod` são escapados com `ENT_XML1`; slugs são validados e XML é carregado com rede desabilitada.

## CB. Query budget

Uma consulta keyset por lote/seção; geração offline. Request de sitemap faz apenas leitura de status e arquivo.

## CC. N+1

Zero query por card; número de queries cresce por lote/seção, não por entidade individual.

## CD. Migration

`phase 6 migration created = NÃO`; `phase 6 migration applied production = NÃO`.

## CE. Production DB

`production DB writes = 0`; `phase 6 backfill writes = 0`.

## CF. Previous phase regressions

Page Map, launch control, grafo, canonical, hard 404 e famílias existentes permanecem; testes históricos de sitemap foram atualizados para a autoridade única.

## CG. @seo

Runtime consumers permanecem zero; nenhuma árvore SEO paralela foi recriada.

## CH. Dependencies

Sem alterações em `package.json`, lockfiles ou Composer.

## CI. Tests

Auditoria final: Vitest completo `149/149` arquivos e `890/890` testes; build Next completo; typecheck/route types; nove suites PHP; lint de 16 arquivos PHP; reporter 19/19; launch validator; ESLint focado; secret scan; encoding; artefatos e `git diff --check` passaram. Smoke HTTP confirmou PRELAUNCH fail-closed. O harness executou 62/62 snapshots com zero divergencia semantica ou de seguranca; as 14 expectativas antigas de tipo JSON-LD falham identicamente na baseline. `SeoPayloadEnvelopeTest` tambem mantem falha preexistente identica: exige dois consumidores de taxonomia, embora baseline e worktree tenham tres.

## CJ. P0

Zero identificado.

## CK. P1

Zero após o gate de ambiente e a rejeição de árvores estáticas antigas.

## CL. P2

Validacao com dataset real; crawl produtivo; escala final; quality editorial de categorias; rehearsal de ativacao/cache; avaliacao futura de Google News; cobertura de headers na borda/Nginx; auditoria pos-deploy; correcao isolada da assercao legada de `SeoPayloadEnvelopeTest`; alinhamento das 14 expectativas JSON-LD preexistentes do harness; sete advisories existentes no lock de dependencias.

## CM. Matrices

Matrizes executáveis: `config/seo/index-policy-phase-6-fixtures.v1.json`; relatório: `backend/scripts/seo/report_index_policy_phase_6.php --evidence=fixture`.

## CN. Diffstat

Auditoria final: 57 arquivos, 41 modificados, 15 novos, 1 removido, 0 renomeados, `+2199/-540`. O delta em relacao ao informe inicial inclui quatro testes regressivos corrigidos e o relatorio final de auditoria. O diff permanece restrito a Fase 6; nenhuma familia/rota de produto, migration ou dependencia foi adicionada. A remocao de `src/app/robots.ts` e substituicao direta pela rota canonica `src/app/robots.txt/route.ts`.

## CO. Worktree

Permanece deliberadamente não commitado para auditoria.

## CP. Push

`push realizado = NÃO`.

## CQ. Deploy

`deploy realizado = NÃO`.

## CR. Próximo passo

Auditar a Fase 6, carregar/validar o dataset definitivo em etapa própria e aguardar autorização antes de checkpoint Git, produção ou Fase 7.
