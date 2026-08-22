# SEO Fase 5 - Internal Linking, Breadcrumbs e Structured Data

Data: 2026-08-22

Baseline: `c97400e03254c775fb5780f46918fff2a06e3b75`

Branch: `1.0.0`
Dataset: temporario de desenvolvimento/teste; nao usado como criterio de elegibilidade de familia.

## A. Resumo executivo

A Fase 5 consolidou um contrato transversal para 44 familias publicas ou funcionalmente relevantes, 67 relacoes autorizadas e nove inferencias explicitamente rejeitadas. Breadcrumb visual e `BreadcrumbList` agora compartilham as mesmas entradas canonicas; structured data usa builders server-side conservadores; o harness extrai links, breadcrumbs e schemas do HTML bruto, do DOM hidratado e do RSC.

O gate final executou 36 rotas em desktop e mobile (72 execucoes): 63 `EQUIVALENT`, nove `INTERACTION_ONLY`, zero divergencias semanticas, zero divergencias de seguranca e zero falhas. Nenhuma familia, policy de indexacao, sitemap ou robots foi promovida. `SEO_LAUNCH_MODE` continua efetivamente `PRELAUNCH`.

## B. Baseline

- Branch confirmada: `1.0.0`.
- HEAD inicial confirmado: `c97400e03254c775fb5780f46918fff2a06e3b75`.
- Worktree inicial: limpo.

## C. Diff

O diff e incremental: contrato do grafo, helpers compartilhados, reporter somente leitura, extensao do harness, route builders, migracao das familias existentes e testes. Nao ha rota App Router nova, migration, schema, dependencia ou lockfile alterado. `out-of-scope = 0`; `uncertain = 0`.

## D. Family inventory

### FAMILY_INVENTORY

| Familia | Canonical route | Autoridade | Breadcrumb principal | Schema primario | Funcional |
| --- | --- | --- | --- | --- | --- |
| Home | `/` | pagina | nenhum | WebSite | nao |
| Questoes | `/questoes` | pagina | Inicio > Questoes | CollectionPage | nao |
| Questao | `/questoes/{id}/{slug}` | `questions.id` + slug publico | Inicio > Questoes > Questao | WebPage | nao |
| Disciplinas | `/disciplinas` | pagina | Inicio > Disciplinas | CollectionPage | nao |
| Disciplina | `/disciplinas/{slug}` | `filters`, materia | Inicio > Disciplinas > Disciplina | WebPage | nao |
| Topico | `/topicos/{slug}` | `filters`, topico | Inicio > Disciplinas > Disciplina > Topico | WebPage | nao |
| Assunto | `/assuntos/{slug}` | `filters`, assunto | Inicio > Disciplinas > Disciplina > Topico > Assunto | WebPage | nao |
| Bancas / Banca | `/bancas`, `/bancas/{slug}` | `filters.type=banca` | Inicio > Bancas > Banca | CollectionPage / WebPage | nao |
| Orgaos / Orgao | `/orgaos`, `/orgaos/{slug}` | `filters.type=orgao` | Inicio > Orgaos > Orgao | CollectionPage / WebPage | nao |
| Provas / Prova | `/provas`, `/provas/{slug}` | `provas.id` + slug | Inicio > Provas > Prova | CollectionPage / WebPage | nao |
| Concursos | `/concursos` | pagina | Inicio > Concursos | CollectionPage | nao |
| Concurso | `/concursos/{slug}` | `contests.id` + slug | Inicio > Concursos > Concurso | WebPage | nao |
| Concursos abertos | `/concursos-abertos` | status e datas do dominio | Inicio > Concursos > Abertos | CollectionPage | nao |
| Carreiras / Carreira | `/carreiras`, `/carreiras/{slug}` | `filters.type=carreira` | Inicio > Carreiras > Carreira | CollectionPage / WebPage | nao |
| Cargos / Cargo | `/cargos`, `/cargos/{slug}` | `filters.type=cargo` | Inicio > Cargos > Cargo | CollectionPage / WebPage | nao |
| Simulados / Simulado | `/simulados`, `/simulados/{slug}` | `public_simulations.id` + slug | Inicio > Simulados > Simulado | CollectionPage / WebPage | nao |
| Lei / Artigo | `/lei-comentada/{slug}[/{articleSlug}]` | IDs e slugs persistidos | Inicio > Lei Comentada > Lei > Artigo | WebPage | nao |
| Materiais / Material | `/materiais`, `/materiais/{slug}` | `materials.id` + slug | Inicio > Materiais > Material | CollectionPage / WebPage | nao |
| Marketplace | `/marketplace` | catalogo funcional | Inicio > Marketplace | nenhum primario | sim |
| Blog / Post | `/blog`, `/blog/{slug}` | artigo publicado | Inicio > Blog > Post | CollectionPage / NewsArticle | nao |
| Categoria | `/blog/categoria/{slug}` | categoria editorial | Inicio > Blog > Categoria | CollectionPage | nao |
| Tag / Autor | `/blog/tag/{slug}`, `/blog/autor/{id}` | relacao editorial | Inicio > Blog > entidade | CollectionPage | sim |
| Planos / FAQ / Novidades / Suporte | rotas persistidas | pagina/dados publicos | Inicio > pagina | WebPage, FAQPage ou CollectionPage | nao |
| Elite / Ranking | rotas existentes | pagina/identidade publica | Inicio > pagina | WebPage ou nenhum | piloto/funcional |
| Privacy / Terms | rotas persistidas | pagina | Inicio > documento | WebPage | nao |
| Landing editorial | `/l/{slug}` | slug editorial persistido | Inicio > landing | WebPage | nao |
| Busca / Facetas | `/busca`, `/questoes?...` | parametros funcionais | navegacao funcional | nenhum | sim |

`FamilyEligibility`, target, PRELAUNCH e sitemap continuam sob `seo-production-page-map.v1.json`. Em especial: Categoria permanece `INDEXABLE`; Tag e Marketplace permanecem `PERMANENT_NOINDEX`.

## E. Existing link graph

Os links existentes foram auditados por autoridade relacional, rota canonica, visibilidade e SSR. Hubs distribuem para detalhes; detalhes usam apenas relacoes explicitas e limitadas. Sitemap nao foi tratado como substituto de navegacao.

## F. Approved relation graph

### INTERNAL_LINK_MATRIX

| Source family | Relation | Target family | Allowed / implemented | Authority | SSR | Canonical / limite |
| --- | --- | --- | --- | --- | --- | --- |
| Home | strategic hub | Questoes, Disciplinas, Bancas, Blog | sim / sim | navegacao curada | sim | builders; 4 |
| Cada hub de entidade | directory | detalhe da mesma familia | sim / sim | diretorio publico tipado | sim | persisted slug; paginado |
| Concursos abertos | open directory | Concurso | sim / sim | status + datas canonicos | sim | READY; limitado |
| Questao | question filters | Disciplina, Topico, Assunto | sim / sim | `question_filters` + nivel/hierarquia | sim | READY; ate 8 |
| Questao | question filters | Cargo, Carreira | sim / sim | filtros tipados + readiness | sim | READY; ate 8 |
| Disciplina | parent/child | Topico | sim / sim | `parent_id` + hierarquia | sim | READY; ate 24 |
| Topico | descendant | Assunto | sim / sim | hierarquia canonica limitada | sim | READY; ate 24 |
| Taxonomias | question preview | Questao | sim / sim | questoes publicadas | sim | ate 10 |
| Banca | prova filters | Prova | sim / sim | `prova_filters` | sim | ate 12 |
| Orgao | relations | Questao, Cargo, Disciplina, Banca, Concurso, Prova | sim / sim | filtros, provas e relacoes explicitas | sim | READY; limites por bloco |
| Prova | prova/contest filters | Banca, Orgao, Concurso, Cargo, Carreira | sim / sim | `prova_filters`, `contest_exams`, `cargo_career` | sim | READY; limitado |
| Concurso | canonical relations | Orgao, Banca, Cargo, Prova, Questao | sim / sim | tabelas `contest_*` e questoes via provas | sim | READY; limitado |
| Carreira | cargo_career | Cargo | sim / sim | `filter_relationships` tipada | sim | ate 24 |
| Carreira | explicit joins | Concurso, Orgao, Questao | sim / sim | Cargo explicito como ponte | sim | ate 12 |
| Cargo | explicit joins | Carreira, Concurso, Orgao, Prova, Questao, Banca | sim / sim | relacoes tipadas e provas/concursos explicitos | sim | ate 12 |
| Simulado | explicit composition | Concurso, Prova, Questao | sim / sim | `public_simulation_*` | sim | composicao publicada |
| Lei | law articles | Artigo | sim / sim | `legal_commentary_articles.law_id` | sim | ordenado e limitado |
| Artigo | article siblings | Artigo anterior/proximo | sim / sim | mesma lei e ordem persistida | sim | 2 |
| Material | explicit taxonomy | Disciplina, Topico | sim / sim | `materials.subject_id/topic_id` | sim | no maximo 2 |
| Post | editorial relations | Categoria, Tag, Autor, Posts relacionados | sim / sim | relacoes editoriais publicadas | sim | limitado |
| Categoria/Tag/Autor | archive | Post | sim / sim | relacao editorial publicada | sim | paginado |

As 67 arestas completas, respectivas autoridades e limites estao versionadas em `config/seo/internal-link-graph.v1.json`.

## G. Rejected inferred relations

Rejeitados: similaridade de nome/slug; orgao+banca+cargo+ano como Concurso; Questao para Concurso sem prova explicita; Questao para Artigo por texto; Questao para Material por keyword; Post para entidade de dominio por texto; Material para Concurso/Carreira pelo titulo; Carreira pelo nome do Cargo; Prova por coincidencia isolada de ano.

## H-T. Grafos por dominio

- **H. Question graph:** links tipados para taxonomias profissionais e de conhecimento; sem Contest/Law/Material inferidos.
- **I. Taxonomy graph:** Disciplina > Topico > Assunto respeita readiness e cadeia; subtópico permanece contexto sem URL propria.
- **J. Banca graph:** Provas por `prova_filters`; nenhuma equivalencia Banca=Orgao.
- **K. Orgao graph:** filtros e tabelas explicitas sustentam Provas, Concursos e Cargos.
- **L. Prova graph:** Banca, Orgao, Concurso, Cargo e Carreira por relacoes canonicas.
- **M. Concurso graph:** apenas `contests` e tabelas `contest_*`; identidade sintetica segue proibida.
- **N. Carreira graph:** Cargo e demais alvos passam por `cargo_career` explicita.
- **O. Cargo graph:** fatos de Concurso, Prova, Orgao e Questao permanecem relacionais.
- **P. Simulado graph:** apenas composicao e relacoes publicas explicitas.
- **Q. Law graph:** Lei > Artigo e anterior/proximo; sem recomendacao textual inferida.
- **R. Material graph:** somente taxonomias persistidas; assets privados permanecem fora.
- **S. Marketplace graph:** link funcional para Material; nao e autoridade canonica nem indexavel.
- **T. Blog graph:** Post > Categoria/Tag/Autor e relacionados editoriais; Tag segue funcional NOINDEX.

## U. Link direction decisions

Direcao e bidirecionalidade sao declaradas aresta a aresta. Uma relation table nao implica retorno automatico. Pais, filhos e hubs usam direcao de navegacao; siblings de artigo sao contextuais; facetas e marketplace sao destinos funcionais, nao distribuidores SEO.

## V-Z. Integridade de links

- **V. Anchor policy:** labels factuais e visiveis; sem keyword stuffing ou arvore oculta.
- **W. Canonical href:** builders TS/PHP validam paths persistidos; href estrutural conhecido aponta direto ao canonical.
- **X. Alias/redirect:** fixture detecta alias e 308; harness final encontrou zero redirects estruturais.
- **Y. Broken links:** fixture negativa prova o detector; crawl final encontrou zero 404 inesperados.
- **Z. Nonpublic targets:** readiness/publication precede renderizacao do link; sentinela negativa foi detectada pelo reporter.

## AA-AD. Readiness, orphans e hubs

- **AA. NOT_READY:** nao e promovido em hubs/listas estruturais; links funcionais excepcionais nao contam como aresta SEO.
- **AB. Orphan:** entidade `INDEXABLE + READY`, nao-hub, sem incoming estrutural a partir de navegacao publica prevista.
- **AC. Reporter:** audita orphans, targets quebrados/privados/alias/redirect, duplicacao, excesso, breadcrumbs e schemas; usa `Database('read')` e falha sem replica dedicada.
- **AD. Home/hubs:** Home mantem quatro hubs estrategicos; cada diretorio pagina seus detalhes sem footer massivo.

## AE-AI. Breadcrumbs e schemas

`CanonicalBreadcrumbs` e `buildBreadcrumbList` recebem a mesma lista server-side. O item atual visual nao e link, mas carrega `aria-current` e path canonico; JSON-LD inclui sua URL absoluta.

### BREADCRUMB_MATRIX

| Family | Hierarchy | Visual | JSON-LD | Canonical URLs | Status |
| --- | --- | --- | --- | --- | --- |
| Home | nenhum | nao exigido | nao cria lista vazia | `/` | PASS |
| Hubs | Inicio > Hub | sim | sim | builder do hub | PASS |
| Questao | Inicio > Questoes > Questao | sim | sim | id + slug publico | PASS |
| Disciplina | Inicio > Disciplinas > Disciplina | sim | sim | persisted slug | PASS |
| Topico | Inicio > Disciplinas > Disciplina > Topico | sim | sim | cadeia valida | PASS |
| Assunto | Inicio > Disciplinas > Disciplina > Topico > Assunto | sim | sim | cadeia valida | PASS |
| Banca/Orgao/Prova/Concurso | Inicio > Hub > Detail | sim | sim | canonical persistido | PASS |
| Carreira/Cargo/Simulado | Inicio > Hub > Detail | sim | sim | canonical persistido | PASS |
| Lei | Inicio > Lei Comentada > Lei | sim | sim | canonical persistido | PASS |
| Artigo | Inicio > Lei Comentada > Lei > Artigo | sim | sim | canonical persistido | PASS |
| Material | Inicio > Materiais > Material | sim | sim | canonical persistido | PASS |
| Post | Inicio > Blog > Post | sim | sim | canonical persistido | PASS |
| Categoria/Tag/Autor | Inicio > Blog > Archive | sim | sim | canonical persistido | PASS |
| Planos/FAQ/Novidades/Suporte/legais | Inicio > Pagina | sim | sim | rota canonica | PASS |
| Marketplace | Inicio > Marketplace | sim | sim | rota funcional | PASS; NOINDEX |

### STRUCTURED_DATA_MATRIX

| Family | Primary schema | BreadcrumbList | ItemList | Other schema | Authority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Home | WebSite | nao | nao | nenhum | pagina | PASS |
| Hubs/diretorios | CollectionPage | sim | quando lista visivel | nenhum | colecao SSR | PASS |
| Details genericos | WebPage | sim | quando lista visivel | Organization apenas para Banca/Orgao sustentados | projecao publica | PASS |
| Questao | WebPage | sim | nao | nenhum Quiz inventado | questao publica | PASS |
| Post | NewsArticle | sim | relacionados quando visiveis | autor publico | artigo publicado | PASS |
| FAQ | FAQPage | sim | nao | Question/Answer visiveis | `FAQ_DATA` compartilhado | PASS |
| Lei/Artigo | WebPage | sim | artigos visiveis quando aplicavel | nenhum Article/LearningResource exagerado | texto oficial publico | PASS |
| Marketplace | nenhum primario | sim | nao | nenhum Product/Offer | funcional | PASS; NOINDEX |
| Tag | CollectionPage factual | sim | posts visiveis | nenhum | relacao editorial | PASS; PERMANENT_NOINDEX |

## AJ-AK. Schema audit e seguranca

- **AJ. Duplicate schema:** o harness conta tipos primarios; conflitos duplicados = 0.
- **AK. JSON-LD security:** serializer neutraliza `<`, `>`, `&`, U+2028 e U+2029; URLs canonicas recusam query/hash/host externo; dados privados nas seis superficies = 0.

## AL-AP. Autoridade e performance

- **AL. SSR authority:** links estruturais, breadcrumb e JSON-LD importantes estao no HTML inicial.
- **AM. Client authority:** mutacao client de title/canonical/robots e JSON-LD paralelo introduzida ou consumida pelas familias tocadas nesta fase = 0. O piloto preexistente de Ranking ainda usa `useDocumentSeo` em CSR e permanece P2 fora do escopo desta fase; ele nao foi alterado e continua `NOINDEX` pelo layout server-side.
- **AN. Route builders:** TS e PHP receberam builders de hubs e Blog autor/post; concatenação estrutural foi reduzida.
- **AO. Query budget:** a fase reutiliza projections/colecoes ja carregadas; reporter usa agregacoes constantes.
- **AP. N+1:** nenhuma query por card foi adicionada; `new N+1 = 0`.

## AQ-AS. Reporters

- **AQ. Graph reporter:** contrato, relacoes, orphans, aliases, redirects, links quebrados/privados/duplicados/excessivos.
- **AR. Breadcrumb reporter:** missing, parent/order, duplicacao, path nao canonico, current mismatch e divergencia visual/JSON-LD.
- **AS. Structured-data reporter:** JSON invalido, schema ausente/duplicado/nao permitido, URL nao canonica, marker privado e fato nao visivel.

Todos sao somente leitura, exigem conexao `read` dedicada e falham fechados sem replica/read user confirmado.

## AT. Real-data graph gates

- `INTERNAL_LINK_GRAPH_REAL_DATA_VALIDATION_REQUIRED`
- `SEO_ORPHAN_REAL_DATA_VALIDATION_REQUIRED`
- `BREADCRUMB_REAL_DATA_VALIDATION_REQUIRED`
- `STRUCTURED_DATA_REAL_DATA_VALIDATION_REQUIRED`

Esses gates devem rodar depois do reset e da carga definitiva. Contagens atuais nao promovem nem desqualificam familias.

## AU-AV. Fixtures

### ORPHAN_FIXTURE_MATRIX

| Family | READY count | Linked count | Orphan count | Expected |
| --- | ---: | ---: | ---: | --- |
| discipline_detail | 2 | 2 | 0 | canonical e alias exercitados |
| topic_detail | 1 | 0 | 1 | orphan detectado |
| law_article_detail | 1 | 0 | 1 | orphan detectado |
| question_detail | 1 | 0 | 1 | orphan detectado |
| material_detail | 1 | 0 | 1 | orphan detectado |
| career_detail | 1 | 0 | 1 | orphan detectado |
| blog_article | 1 | 0 | 1 | orphan detectado |
| contest_detail | 1 | 0 | 1 | orphan detectado |
| subject_detail privado | 0 | 1 | 0 | nonpublic target detectado |
| organization_detail | 1 | 1 | 0 | hub canonico distribui para READY |
| position_detail | 1 | 1 | 0 | hub canonico distribui para READY |
| simulation_detail | 1 | 1 | 0 | hub canonico distribui para READY |
| blog_category | 1 | 1 | 0 | Blog distribui por relacao editorial |
| material_detail privado READY | 0 estrategico | 0 | 0 | entidade privada excluida do universo orphan |

Fixture negativa tambem prova: um broken target, um alias, um redirect, um link duplicado, breadcrumb divergente/nao canonico e schemas duplicado, ausente, nao suportado, invalido, privado e sem correspondencia visivel. Relacoes ausentes negativas: Artigo -> Questao, Material -> Carreira e Post -> Concurso. As entidades READY de Organization, Cargo, Simulation e Blog Category possuem incoming canonico; Contest, Career, Law e Material exercitam deliberadamente deteccao de orphan; entidades privadas e hubs funcionais sao excluidos corretamente.

## AW-BA. Harness, acessibilidade e hidratacao

- **AW. Link crawl:** normaliza hrefs estruturais SSR e verifica status/redirect; query links funcionais nao sao classificados como arestas estruturais.
- **AX. Breadcrumb:** compara DOM visual, JSON-LD e canonical.
- **AY. Structured data:** parseia JSON, tipos, identificadores canonicos e duplicacao primaria.
- **AZ. Accessibility/mobile:** `nav` nomeado, `aria-current`, foco nativo, labels e overflow horizontal defensivo.
- **BA. Hydration:** auditoria final em build de producao: 72 execucoes; 58 equivalentes e 14 apenas interacao, distribuidas em sete rotas nos dois viewports. A unica diferenca e o link `Entrar` (`/auth`) inserido pelo shell apos hidratacao; nenhum crawl path estrutural depende dele. Divergencias semanticas/seguranca, warnings e errors bloqueantes = 0.

`INTERACTION_ONLY`: `exam_detail` desktop/mobile, `blog_hub` desktop/mobile, `blog_article` desktop/mobile, `blog_category` desktop/mobile, `blog_tag` desktop/mobile, `blog_author` desktop/mobile e `news` desktop/mobile. Componente responsavel: navegacao autenticavel do shell. Conteudo exclusivo do client: comando funcional `Entrar`; dependencia de crawl estrutural = 0.

## BB-BC. Security e XSS

- **BB. Sentinelas:** answer key, comentario de professor, importer/admin notes, draft, author email, storage key e signed URL = 0 em HTML, RSC, JSON-LD e DOM.
- **BC. XSS:** labels e anchors sao escapados pelo React; JSON-LD usa serializer endurecido; fixtures hostis permanecem texto inerte.

## BD-BI. Regressoes e policies

- **BD. Previous STARTs:** smokes de Questoes, taxonomias, Bancas, Orgaos, Provas, Concursos, Carreira/Cargo, Simulados, Lei, Materiais e Blog passaram.
- **BE. Family policy:** nenhuma elegibilidade/target foi alterada.
- **BF. PRELAUNCH:** preservado; paginas publicas seguem `NOINDEX,follow`.
- **BG. Sitemap:** policy e materializacao nao foram alteradas.
- **BH. Robots:** policy global nao foi alterada.
- **BI. `@seo`:** runtime consumers = 0.

## BJ-BL. Dependencias, migration e banco

- **BJ. Dependencies:** npm/composer/lockfiles alterados = 0.
- **BK. Migration:** `phase 5 migration created = NÃO`; schema changes = 0.
- **BL. Production DB:** `phase 5 migration applied production = NÃO`; `production DB writes = 0`; `phase 5 backfill writes = 0`.

## BM. Tests

- Vitest completo: 147 arquivos, 883 testes, todos PASS.
- Harness: 36 rotas, 72 execucoes, 58 equivalentes, 14 `INTERACTION_ONLY`, zero falhas, zero links quebrados/redirects, zero schemas primarios duplicados.
- PHP: sete suites SEO focadas PASS; lints dos arquivos PHP alterados/novos PASS.
- Launch validator: 55 familias, 40 TARGET_INDEX, 15 PERMANENT_NOINDEX, PASS.
- Typecheck e route types: PASS.
- Build Next 16.2.11: PASS, 53 paginas estaticas geradas no gate.
- ESLint sobre a lista exata de 862 fontes rastreadas e novas: PASS, zero erros e 177 warnings historicos. Artefatos `.tmp`, `.next`, `.codex` e `.codex-tmp` foram excluidos da evidencia.
- Secret scan, encoding, generated artifacts e `git diff --check`: PASS.

## BN-BO. P0/P1

- **BN. P0:** 0.
- **BO. P1:** 0 apos correcoes estritamente locais durante a auditoria. Foram corrigidos: rota contratual de busca `/buscar` para `/busca`; validacao obrigatoria de paridade entre grafo e Production Page Map; duplicacao de `ItemList` em sete superficies; canonical/breadcrumb paths permissivos; e descricao excessiva das capacidades do reporter sem dados reais. Todos os gates afetados foram reexecutados.

## BP. P2

1. Executar os quatro gates com o dataset definitivo.
2. Revisar contagens reais de orphan, limites e cobertura das 67 arestas.
3. Medir queries/payload com volume real; enriquecer links contextuais apenas com autoridade explicita.
4. Reavaliar o piloto Elite, que permanece CSR e ficou fora do gate SSR estrito desta fase.
5. Ajustar o script global de lint para excluir explicitamente `.tmp`, `.codex` e `.codex-tmp`; a auditoria por lista Git ja passa sem erros.
6. Aprofundar WCAG e tuning de breadcrumbs longos na fase apropriada.
7. Migrar o detalhe piloto de Ranking de metadata CSR para autoridade server-side antes de qualquer elegibilidade real de producao.

## BQ-BU. Estado final

- **BQ. Diffstat:** 62 arquivos, 49 modificados, 13 novos, zero removidos/renomeados, `+2300/-588`. A diferenca de insercoes contra a referencia inicial vem das correcoes P1, da fixture ampliada e das matrizes exaustivas; o escopo permanece Fase 5.
- **BR. Worktree:** permanece sujo apenas com a Fase 5, pois commit e proibido.
- **BS. Push:** `push realizado = NÃO`.
- **BT. Deploy:** `deploy realizado = NÃO`.
- **BU. Proximo passo:** auditar e criar o checkpoint Git da Fase 5 somente apos autorizacao explicita; nao iniciar Fase 6.

## Declaracoes obrigatorias

```text
phase 5 migration created = NÃO
phase 5 migration applied production = NÃO
production DB writes = 0
phase 5 backfill writes = 0
new SEO families created = 0
commit = NÃO
push realizado = NÃO
deploy realizado = NÃO
```
+
## Audit appendices: exhaustive matrices

These appendices are generated from the versioned graph contract and cross-checked against `seo-production-page-map.v1.json`. They replace grouped summaries as the exhaustive audit evidence.

### FULL_DIFF_INVENTORY_62

## Final audit report A-CA

| Section | Finding |
| --- | --- |
| **A** | Approved with P0=0 and P1=0 after local audit fixes. |
| **B** | branch 1.0.0; HEAD c97400e03254c775fb5780f46918fff2a06e3b75. |
| **C** | 62 files: 49 modified, 13 new, 0 removed/renamed. |
| **D** | 44-family exhaustive inventory appended. |
| **E** | Production Page Map, eligibility, launch and sitemap policies unchanged. |
| **F** | Versioned explicit graph; sitemap is not navigation authority. |
| **G** | 67 approved relations appended. |
| **H** | Every edge declares persisted/curated authority; no name matching. |
| **I** | 9 rejected inference rules appended. |
| **J** | No structural runtime inference added. |
| **K** | Question links only through explicit typed/public relations. |
| **L** | Discipline, Topic and Subject preserve persisted hierarchy. |
| **M** | Board graph uses canonical exam/filter relations. |
| **N** | Organization graph uses typed filters and explicit joins. |
| **O** | Exam graph uses persisted exam relations. |
| **P** | Contest graph remains contests plus contest_* only. |
| **Q** | Career/Cargo preserves cargo_career and explicit bridges. |
| **R** | Simulation graph uses explicit public_simulation_* composition. |
| **S** | Law links only Law, Article and persisted siblings. |
| **T** | Material links only persisted taxonomy relations. |
| **U** | Marketplace remains functional PERMANENT_NOINDEX. |
| **V** | Blog uses published editorial relations; Tag remains PERMANENT_NOINDEX. |
| **W** | Direction is declared per edge; no automatic bidirectionality. |
| **X** | All high-cardinality edges have maxLinks/pagination contracts. |
| **Y** | Important structural links are present in initial SSR HTML. |
| **Z** | 14 interaction-only executions: auth command only; structural dependency 0. |
| **AA** | Elite remains preexisting CSR pilot; no Phase 5 policy regression. |
| **AB** | Fixture crawl found canonical direct hrefs; aliases/redirects 0. |
| **AC** | Known alias and legacy structural hrefs 0. |
| **AD** | Structural internal 404 = 0. |
| **AE** | Public structural links to nonpublic targets = 0. |
| **AF** | NOT_READY entities are excluded from strategic distribution. |
| **AG** | Orphan means public READY INDEXABLE non-hub without structural incoming. |
| **AH** | Fixture covers positive, orphan, private and functional cases. |
| **AI** | Reporter exposes canonical/readiness/indexability/alias/broken evidence. |
| **AJ** | Visual breadcrumb and BreadcrumbList share one server-side item source. |
| **AK** | 44-family breadcrumb matrix appended. |
| **AL** | Visual versus JSON-LD breadcrumb mismatch = 0. |
| **AM** | Current item is visible non-link with aria-current and canonical JSON-LD URL. |
| **AN** | Shared builders, component and hardened serializer are authoritative. |
| **AO** | 44-family structured-data matrix appended. |
| **AP** | Duplicate primary schema and duplicate BreadcrumbList = 0. |
| **AQ** | JSON-LD fields map to visible/public facts. |
| **AR** | Private sentinel hits in HTML/RSC/JSON-LD/DOM = 0. |
| **AS** | XSS matrix passed; script breakout is escaped. |
| **AT** | Primary schemas and breadcrumbs are emitted in SSR HTML. |
| **AU** | Phase 5 introduces no client canonical/robots/schema authority; Ranking CSR is preexisting P2. |
| **AV** | Canonical TS and PHP route builders are used. |
| **AW** | TS/PHP parity tests pass. |
| **AX** | Canonical path validation rejects query/hash/trailing/dot/control variants. |
| **AY** | Anchors are visible factual labels; no hidden link farm. |
| **AZ** | No repository/query additions; existing budgets preserved. |
| **BA** | New N+1 = 0; relation blocks reuse loaded/batched projections. |
| **BB** | Production-equivalent fixture GET database writes = 0. |
| **BC** | Reporter uses Database(read) and exits 2 without DB_READ_*. |
| **BD** | Home keeps four strategic hubs and no mass footer directory. |
| **BE** | Previous START smokes passed in 36-route harness and Vitest. |
| **BF** | Tag/Marketplace permanent NOINDEX; all frozen family policies preserved. |
| **BG** | SEO_LAUNCH_MODE absent; effective PRELAUNCH. |
| **BH** | robots policy diff = 0. |
| **BI** | sitemap policy/materializer diff = 0. |
| **BJ** | 36-route crawl: broken 0, redirects 0, failures 0. |
| **BK** | Breadcrumb DOM/JSON-LD/canonical equivalence passed. |
| **BL** | All JSON-LD parsed; canonical/type/duplicate/private checks passed. |
| **BM** | Named nav, aria-current and responsive breadcrumb contracts passed harness. |
| **BN** | Hydration warnings/errors/divergences = 0. |
| **BO** | Security divergences and sentinel occurrences = 0. |
| **BP** | 862 tracked/new source files linted: 0 errors, 177 historical warnings. |
| **BQ** | App Router @seo runtime tree/consumers = 0. |
| **BR** | npm/composer/lockfile changes = 0. |
| **BS** | Vitest 147/147 and 883/883; PHP, typecheck, build, launch, secrets, encoding and diff checks pass. |
| **BT** | P0 = 0. |
| **BU** | P1 = 0 after route parity, schema duplication, validator and reporter fixes. |
| **BV** | P2: real-data validation, Ranking/Elite CSR, payload/WCAG and lint script excludes. |
| **BW** | Four REQUIRED real-data gates preserved. |
| **BX** | All four mandatory matrices are attached in this report. |
| **BY** | Final diff: 62 files, 49 modified, 13 new, 0 removed/renamed, +2300/-588. |
| **BZ** | No staging, commit, push or deploy; worktree contains Phase 5 only. |
| **CA** | Ready to freeze in a separate Git checkpoint; do not start Phase 6. |


| # | Status | File | Classification |
| -: | --- | --- | --- |
| 1 | modified | `backend/modules/seo/routes/PublicRouteBuilder.php` | route builders |
| 2 | modified | `backend/tests/PublicRouteBuilderTest.php` | tests |
| 3 | modified | `scripts/seo/lib/semantic-page-snapshot.mjs` | harness |
| 4 | modified | `scripts/seo/ssr-hydration-fixture-api.mjs` | fixtures |
| 5 | modified | `scripts/seo/ssr-hydration-harness.mjs` | harness |
| 6 | modified | `src/app/__tests__/phase3MetadataAuthority.test.ts` | tests |
| 7 | modified | `src/app/__tests__/publicInformationSsr.test.ts` | tests |
| 8 | modified | `src/app/__tests__/publicSeoLaunchReadiness.test.ts` | tests |
| 9 | modified | `src/app/bancas/[slug]/page.tsx` | breadcrumbs / structured data |
| 10 | modified | `src/app/blog/BlogTaxonomyArchivePage.tsx` | breadcrumbs / structured data |
| 11 | modified | `src/app/blog/[slug]/page.tsx` | breadcrumbs / structured data |
| 12 | modified | `src/app/blog/__tests__/blogEditorialExperience.test.ts` | tests |
| 13 | modified | `src/app/blog/autor/[id]/page.tsx` | breadcrumbs / structured data |
| 14 | modified | `src/app/blog/page.tsx` | breadcrumbs / structured data |
| 15 | modified | `src/app/blog/provas/[slug]/page.tsx` | breadcrumbs / structured data |
| 16 | modified | `src/app/blog/provas/page.tsx` | breadcrumbs / structured data |
| 17 | modified | `src/app/concursos/ContestDirectoryView.tsx` | relation adapters / internal linking |
| 18 | modified | `src/app/concursos/[slug]/page.tsx` | breadcrumbs / structured data |
| 19 | modified | `src/app/elite/layout.tsx` | breadcrumbs / structured data |
| 20 | modified | `src/app/faq/layout.tsx` | breadcrumbs / structured data |
| 21 | modified | `src/app/faq/page.tsx` | breadcrumbs / structured data |
| 22 | modified | `src/app/lei-comentada/[slug]/[articleSlug]/page.tsx` | breadcrumbs / structured data |
| 23 | modified | `src/app/lei-comentada/[slug]/page.tsx` | breadcrumbs / structured data |
| 24 | modified | `src/app/lei-comentada/__tests__/legalCommentaryServerData.test.ts` | tests |
| 25 | modified | `src/app/lei-comentada/page.tsx` | breadcrumbs / structured data |
| 26 | modified | `src/app/marketplace/layout.tsx` | breadcrumbs / structured data |
| 27 | modified | `src/app/materiais/MaterialDetail.tsx` | breadcrumbs / structured data |
| 28 | modified | `src/app/materiais/MaterialsDirectory.tsx` | breadcrumbs / structured data |
| 29 | modified | `src/app/novidades/page.tsx` | breadcrumbs / structured data |
| 30 | modified | `src/app/orgaos/[slug]/page.tsx` | breadcrumbs / structured data |
| 31 | modified | `src/app/page.tsx` | breadcrumbs / structured data |
| 32 | modified | `src/app/planos/page.tsx` | breadcrumbs / structured data |
| 33 | modified | `src/app/practice/PracticePage.tsx` | breadcrumbs / structured data |
| 34 | modified | `src/app/privacy/layout.tsx` | breadcrumbs / structured data |
| 35 | modified | `src/app/profissoes/ProfessionalDetail.tsx` | breadcrumbs / structured data |
| 36 | modified | `src/app/profissoes/ProfessionalDirectory.tsx` | breadcrumbs / structured data |
| 37 | modified | `src/app/question/QuestionPublicPage.tsx` | relation adapters / internal linking |
| 38 | modified | `src/app/questoes/[id]/[[...slug]]/page.tsx` | breadcrumbs / structured data |
| 39 | modified | `src/app/simulados/SimulationDetail.tsx` | breadcrumbs / structured data |
| 40 | modified | `src/app/simulados/SimulationsDirectory.tsx` | breadcrumbs / structured data |
| 41 | modified | `src/app/support/layout.tsx` | breadcrumbs / structured data |
| 42 | modified | `src/app/taxonomias/KnowledgeTaxonomyDetail.tsx` | breadcrumbs / structured data |
| 43 | modified | `src/app/taxonomias/PublicTaxonomyDirectory.tsx` | breadcrumbs / structured data |
| 44 | modified | `src/app/taxonomias/__tests__/publicTaxonomyDirectory.test.ts` | tests |
| 45 | modified | `src/app/terms/layout.tsx` | breadcrumbs / structured data |
| 46 | modified | `src/components/shared/layout/Footer.tsx` | internal linking |
| 47 | modified | `src/services/routes/publicRoutes.test.ts` | tests |
| 48 | modified | `src/services/routes/publicRoutes.ts` | route builders |
| 49 | modified | `src/services/seo/structuredData.ts` | structured data / serializers |
| 50 | new | `backend/modules/seo/reports/InternalLinkGraphReporter.php` | reporters |
| 51 | new | `backend/scripts/seo/report_internal_link_graph.php` | reporters |
| 52 | new | `backend/tests/InternalLinkGraphReporterTest.php` | tests |
| 53 | new | `backend/tests/fixtures/seo/internal-link-graph-phase-5.v1.json` | fixtures |
| 54 | new | `config/seo/internal-link-graph.v1.json` | internal linking |
| 55 | new | `config/seo/ssr-hydration-phase-5.v1.json` | fixtures |
| 56 | new | `docs/seo/phase-5-internal-linking-breadcrumbs-structured-data-2026-08-22.md` | docs |
| 57 | new | `src/components/seo/CanonicalBreadcrumbs.test.tsx` | tests |
| 58 | new | `src/components/seo/CanonicalBreadcrumbs.tsx` | breadcrumbs |
| 59 | new | `src/components/seo/StructuredData.tsx` | structured data / serializers |
| 60 | new | `src/services/seo/internalLinkGraph.test.ts` | tests |
| 61 | new | `src/services/seo/internalLinkGraph.ts` | internal linking |
| 62 | new | `src/services/seo/structuredData.test.ts` | tests |

`out-of-scope = 0`; `uncertain = 0`.

### FULL_FAMILY_INVENTORY_44

| # | Family ID | Route | Canonical/entity authority | Eligibility | Target | PRELAUNCH | Sitemap | Functional/private | Breadcrumb | Primary schema |
| -: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `home` | `/` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | none | `WebSite` |
| 2 | `questions_hub` | `/questoes` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > questions_hub | `CollectionPage` |
| 3 | `question_detail` | `/questoes/{id}/{slug}` | questions.id + persisted public slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > questions_hub > question_detail | `WebPage` |
| 4 | `discipline_hub` | `/disciplinas` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > discipline_hub | `CollectionPage` |
| 5 | `discipline_detail` | `/disciplinas/{slug}` | filters.id type=assunto level=materia; filters.slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > discipline_hub > discipline_detail | `WebPage` |
| 6 | `topic_detail` | `/topicos/{slug}` | filters.id type=assunto level=topico; filters.slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > discipline_hub > discipline_detail > topic_detail | `WebPage` |
| 7 | `subject_detail` | `/assuntos/{slug}` | filters.id type=assunto level=assunto; filters.slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > discipline_hub > discipline_detail > topic_detail > subject_detail | `WebPage` |
| 8 | `board_hub` | `/bancas` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > board_hub | `CollectionPage` |
| 9 | `board_detail` | `/bancas/{slug}` | filters.id type=banca; filters.slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > board_hub > board_detail | `WebPage` |
| 10 | `organizations_hub` | `/orgaos` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > organizations_hub | `CollectionPage` |
| 11 | `organization_detail` | `/orgaos/{slug}` | filters.id type=orgao; filters.slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > organizations_hub > organization_detail | `WebPage` |
| 12 | `exam_hub` | `/provas` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > exam_hub | `CollectionPage` |
| 13 | `exam_detail` | `/provas/{slug}` | provas.id; persisted slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > exam_hub > exam_detail | `WebPage` |
| 14 | `contest_hub` | `/concursos` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > contest_hub | `CollectionPage` |
| 15 | `contest_detail` | `/concursos/{slug}` | contests.id; contests.slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > contest_hub > contest_detail | `WebPage` |
| 16 | `open_contests` | `/concursos-abertos` | contest domain status and dates | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > contest_hub > open_contests | `CollectionPage` |
| 17 | `careers_hub` | `/carreiras` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > careers_hub | `CollectionPage` |
| 18 | `career_detail` | `/carreiras/{slug}` | filters.id type=carreira; filters.slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > careers_hub > career_detail | `WebPage` |
| 19 | `positions_hub` | `/cargos` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > positions_hub | `CollectionPage` |
| 20 | `position_detail` | `/cargos/{slug}` | filters.id type=cargo; filters.slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > positions_hub > position_detail | `WebPage` |
| 21 | `simulations_hub` | `/simulados` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > simulations_hub | `CollectionPage` |
| 22 | `simulation_detail` | `/simulados/{slug}` | public_simulations.id; persisted slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > simulations_hub > simulation_detail | `WebPage` |
| 23 | `law_hub` | `/lei-comentada` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > law_hub | `CollectionPage` |
| 24 | `law_detail` | `/lei-comentada/{slug}` | legal_commentaries.id; persisted slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > law_hub > law_detail | `WebPage` |
| 25 | `law_article_detail` | `/lei-comentada/{lawSlug}/{articleSlug}` | legal_commentary_articles.id; persisted slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > law_hub > law_detail > law_article_detail | `WebPage` |
| 26 | `materials_hub` | `/materiais` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > materials_hub | `CollectionPage` |
| 27 | `material_detail` | `/materiais/{slug}` | materials.id; materials.slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > materials_hub > material_detail | `WebPage` |
| 28 | `marketplace` | `/marketplace` | functional catalog | `PERMANENT_NOINDEX` | `NOINDEX` | `NOINDEX` | `EXCLUDE` | functional | home > marketplace | `none` |
| 29 | `blog_hub` | `/blog` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > blog_hub | `CollectionPage` |
| 30 | `blog_article` | `/blog/{slug}` | blog_articles.id; persisted slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > blog_hub > blog_article | `NewsArticle` |
| 31 | `blog_category` | `/blog/categoria/{slug}` | blog_categories.id; persisted slug | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > blog_hub > blog_category | `CollectionPage` |
| 32 | `blog_tag` | `/blog/tag/{slug}` | blog_tags.id; persisted slug | `PERMANENT_NOINDEX` | `NOINDEX` | `NOINDEX` | `EXCLUDE` | functional | home > blog_hub > blog_tag | `CollectionPage` |
| 33 | `blog_author` | `/blog/autor/{id}` | public editorial author id | `CONDITIONAL` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | functional | home > blog_hub > blog_author | `CollectionPage` |
| 34 | `plans` | `/planos` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > plans | `WebPage` |
| 35 | `faq` | `/faq` | page + visible FAQ_DATA | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > faq | `FAQPage` |
| 36 | `news` | `/novidades` | page + published changelog entries | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > news | `CollectionPage` |
| 37 | `support` | `/support` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > support | `WebPage` |
| 38 | `elite` | `/elite` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > elite | `WebPage` |
| 39 | `ranking` | `/ranking` | public ranking id when a detail is resolved | `CONDITIONAL` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | functional | home > ranking | `none` |
| 40 | `privacy` | `/privacy` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > privacy | `WebPage` |
| 41 | `terms` | `/terms` | page | `INDEXABLE` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > terms | `WebPage` |
| 42 | `marketing_landing` | `/l/{slug}` | persisted editorial landing slug | `CONDITIONAL` | `INDEX` | `NOINDEX` | `INCLUDE_WHEN_READY` | public/content | home > marketing_landing | `WebPage` |
| 43 | `search` | `/busca` | functional search query | `PERMANENT_NOINDEX` | `NOINDEX` | `NOINDEX` | `EXCLUDE` | functional | home > search | `none` |
| 44 | `facet` | `/questoes` | functional filter parameters | `PERMANENT_NOINDEX` | `NOINDEX` | `NOINDEX` | `EXCLUDE` | functional | home > questions_hub | `none` |

### FULL_INTERNAL_LINK_MATRIX_67

| # | Source family/entity | Relation | Target family | Authority / schema-table-FK-source | Direction | SSR | Implemented | Canonical target | Target eligibility | Notes |
| -: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `home` / page | `strategic_hub` | `questions_hub` | curated primary navigation | `outgoing` | yes | yes | `/questoes` | `INDEXABLE` | max 1; persisted/current builder |
| 2 | `home` / page | `strategic_hub` | `discipline_hub` | curated primary navigation | `outgoing` | yes | yes | `/disciplinas` | `INDEXABLE` | max 1; persisted/current builder |
| 3 | `home` / page | `strategic_hub` | `board_hub` | curated primary navigation | `outgoing` | yes | yes | `/bancas` | `INDEXABLE` | max 1; persisted/current builder |
| 4 | `home` / page | `strategic_hub` | `blog_hub` | curated primary navigation | `outgoing` | yes | yes | `/blog` | `INDEXABLE` | max 1; persisted/current builder |
| 5 | `discipline_hub` / page | `directory` | `discipline_detail` | public taxonomy directory type=assunto level=materia | `outgoing` | yes | yes | `/disciplinas/{slug}` | `INDEXABLE` | max 50; persisted/current builder |
| 6 | `board_hub` / page | `directory` | `board_detail` | public taxonomy directory type=banca | `outgoing` | yes | yes | `/bancas/{slug}` | `INDEXABLE` | max 50; persisted/current builder |
| 7 | `organizations_hub` / page | `directory` | `organization_detail` | public taxonomy directory type=orgao | `outgoing` | yes | yes | `/orgaos/{slug}` | `INDEXABLE` | max 50; persisted/current builder |
| 8 | `exam_hub` / page | `directory` | `exam_detail` | public exam directory | `outgoing` | yes | yes | `/provas/{slug}` | `INDEXABLE` | max 24; persisted/current builder |
| 9 | `contest_hub` / page | `directory` | `contest_detail` | published canonical contests | `outgoing` | yes | yes | `/concursos/{slug}` | `INDEXABLE` | max 24; persisted/current builder |
| 10 | `open_contests` / contest domain status and dates | `open_directory` | `contest_detail` | canonical contest status and dates | `outgoing` | yes | yes | `/concursos/{slug}` | `INDEXABLE` | max 24; persisted/current builder |
| 11 | `careers_hub` / page | `directory` | `career_detail` | public filters type=carreira | `outgoing` | yes | yes | `/carreiras/{slug}` | `INDEXABLE` | max 50; persisted/current builder |
| 12 | `positions_hub` / page | `directory` | `position_detail` | public filters type=cargo | `outgoing` | yes | yes | `/cargos/{slug}` | `INDEXABLE` | max 50; persisted/current builder |
| 13 | `simulations_hub` / page | `directory` | `simulation_detail` | published public simulations | `outgoing` | yes | yes | `/simulados/{slug}` | `INDEXABLE` | max 24; persisted/current builder |
| 14 | `law_hub` / page | `directory` | `law_detail` | public legal commentaries | `outgoing` | yes | yes | `/lei-comentada/{slug}` | `INDEXABLE` | max 50; persisted/current builder |
| 15 | `materials_hub` / page | `directory` | `material_detail` | published public materials | `outgoing` | yes | yes | `/materiais/{slug}` | `INDEXABLE` | max 24; persisted/current builder |
| 16 | `blog_hub` / page | `directory` | `blog_article` | published blog articles | `outgoing` | yes | yes | `/blog/{slug}` | `INDEXABLE` | max 24; persisted/current builder |
| 17 | `question_detail` / questions.id + persisted public slug | `question_filters` | `discipline_detail` | question_filters + taxonomy level | `outgoing` | yes | yes | `/disciplinas/{slug}` | `INDEXABLE` | max 1; persisted/current builder |
| 18 | `question_detail` / questions.id + persisted public slug | `question_filters` | `topic_detail` | question_filters + valid hierarchy | `outgoing` | yes | yes | `/topicos/{slug}` | `INDEXABLE` | max 6; persisted/current builder |
| 19 | `question_detail` / questions.id + persisted public slug | `question_filters` | `subject_detail` | question_filters + valid hierarchy | `outgoing` | yes | yes | `/assuntos/{slug}` | `INDEXABLE` | max 6; persisted/current builder |
| 20 | `question_detail` / questions.id + persisted public slug | `question_filters` | `position_detail` | question_filters type=cargo + readiness | `outgoing` | yes | yes | `/cargos/{slug}` | `INDEXABLE` | max 6; persisted/current builder |
| 21 | `question_detail` / questions.id + persisted public slug | `question_filters` | `career_detail` | question_filters type=carreira + readiness | `outgoing` | yes | yes | `/carreiras/{slug}` | `INDEXABLE` | max 6; persisted/current builder |
| 22 | `discipline_detail` / filters.id type=assunto level=materia; filters.slug | `taxonomy_parent_child` | `topic_detail` | filters.parent_id + hierarchy readiness | `outgoing` | yes | yes | `/topicos/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 23 | `topic_detail` / filters.id type=assunto level=topico; filters.slug | `taxonomy_descendant` | `subject_detail` | bounded canonical hierarchy | `outgoing` | yes | yes | `/assuntos/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 24 | `discipline_detail` / filters.id type=assunto level=materia; filters.slug | `question_preview` | `question_detail` | public question_filters | `outgoing` | yes | yes | `/questoes/{id}/{slug}` | `INDEXABLE` | max 10; persisted/current builder |
| 25 | `topic_detail` / filters.id type=assunto level=topico; filters.slug | `question_preview` | `question_detail` | public question_filters | `outgoing` | yes | yes | `/questoes/{id}/{slug}` | `INDEXABLE` | max 10; persisted/current builder |
| 26 | `subject_detail` / filters.id type=assunto level=assunto; filters.slug | `question_preview` | `question_detail` | public question_filters | `outgoing` | yes | yes | `/questoes/{id}/{slug}` | `INDEXABLE` | max 10; persisted/current builder |
| 27 | `board_detail` / filters.id type=banca; filters.slug | `prova_filters` | `exam_detail` | prova_filters | `outgoing` | yes | yes | `/provas/{slug}` | `INDEXABLE` | max 20; persisted/current builder |
| 28 | `organization_detail` / filters.id type=orgao; filters.slug | `question_filters` | `question_detail` | public question_filters type=orgao | `outgoing` | yes | yes | `/questoes/{id}/{slug}` | `INDEXABLE` | max 10; persisted/current builder |
| 29 | `organization_detail` / filters.id type=orgao; filters.slug | `cargo_organization` | `position_detail` | filter_relationships relation_type=cargo_organization | `bidirectional` | yes | yes | `/cargos/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 30 | `organization_detail` / filters.id type=orgao; filters.slug | `question_taxonomy` | `discipline_detail` | public questions joined to canonical materia | `outgoing` | yes | yes | `/disciplinas/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 31 | `organization_detail` / filters.id type=orgao; filters.slug | `exam_board` | `board_detail` | public provas explicitly related to organization and banca | `outgoing` | yes | yes | `/bancas/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 32 | `organization_detail` / filters.id type=orgao; filters.slug | `contest_organizations` | `contest_detail` | contest_organizations | `bidirectional` | yes | yes | `/concursos/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 33 | `organization_detail` / filters.id type=orgao; filters.slug | `prova_filters` | `exam_detail` | prova_filters | `bidirectional` | yes | yes | `/provas/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 34 | `exam_detail` / provas.id; persisted slug | `prova_filters` | `board_detail` | prova_filters type=banca | `outgoing` | yes | yes | `/bancas/{slug}` | `INDEXABLE` | max 1; persisted/current builder |
| 35 | `exam_detail` / provas.id; persisted slug | `prova_filters` | `organization_detail` | prova_filters type=orgao | `outgoing` | yes | yes | `/orgaos/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 36 | `exam_detail` / provas.id; persisted slug | `contest_exams` | `contest_detail` | contest_exams | `bidirectional` | yes | yes | `/concursos/{slug}` | `INDEXABLE` | max 1; persisted/current builder |
| 37 | `exam_detail` / provas.id; persisted slug | `prova_filters` | `position_detail` | prova_filters type=cargo | `outgoing` | yes | yes | `/cargos/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 38 | `exam_detail` / provas.id; persisted slug | `cargo_career` | `career_detail` | exam cargo filters joined to explicit cargo_career | `outgoing` | yes | yes | `/carreiras/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 39 | `contest_detail` / contests.id; contests.slug | `contest_organizations` | `organization_detail` | contest_organizations | `bidirectional` | yes | yes | `/orgaos/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 40 | `contest_detail` / contests.id; contests.slug | `contest_board` | `board_detail` | contests.board_filter_id | `outgoing` | yes | yes | `/bancas/{slug}` | `INDEXABLE` | max 1; persisted/current builder |
| 41 | `contest_detail` / contests.id; contests.slug | `contest_positions` | `position_detail` | contest_positions.role_filter_id | `bidirectional` | yes | yes | `/cargos/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 42 | `contest_detail` / contests.id; contests.slug | `contest_exams` | `exam_detail` | contest_exams | `bidirectional` | yes | yes | `/provas/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 43 | `contest_detail` / contests.id; contests.slug | `exam_questions` | `question_detail` | contest_exams joined to public question_provas | `outgoing` | yes | yes | `/questoes/{id}/{slug}` | `INDEXABLE` | max 10; persisted/current builder |
| 44 | `career_detail` / filters.id type=carreira; filters.slug | `cargo_career` | `position_detail` | filter_relationships relation_type=cargo_career | `bidirectional` | yes | yes | `/cargos/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 45 | `career_detail` / filters.id type=carreira; filters.slug | `career_contests` | `contest_detail` | explicit career cargo joined to contest_positions | `outgoing` | yes | yes | `/concursos/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 46 | `career_detail` / filters.id type=carreira; filters.slug | `career_organizations` | `organization_detail` | explicit career cargo joined to cargo_organization | `outgoing` | yes | yes | `/orgaos/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 47 | `career_detail` / filters.id type=carreira; filters.slug | `career_questions` | `question_detail` | question cargo filter joined to explicit cargo_career | `outgoing` | yes | yes | `/questoes/{id}/{slug}` | `INDEXABLE` | max 10; persisted/current builder |
| 48 | `position_detail` / filters.id type=cargo; filters.slug | `cargo_career` | `career_detail` | filter_relationships relation_type=cargo_career | `bidirectional` | yes | yes | `/carreiras/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 49 | `position_detail` / filters.id type=cargo; filters.slug | `contest_positions` | `contest_detail` | contest_positions.role_filter_id | `bidirectional` | yes | yes | `/concursos/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 50 | `position_detail` / filters.id type=cargo; filters.slug | `cargo_organization` | `organization_detail` | filter_relationships relation_type=cargo_organization | `bidirectional` | yes | yes | `/orgaos/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 51 | `position_detail` / filters.id type=cargo; filters.slug | `prova_filters` | `exam_detail` | prova_filters type=cargo | `outgoing` | yes | yes | `/provas/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 52 | `position_detail` / filters.id type=cargo; filters.slug | `question_filters` | `question_detail` | public question_filters type=cargo | `outgoing` | yes | yes | `/questoes/{id}/{slug}` | `INDEXABLE` | max 10; persisted/current builder |
| 53 | `position_detail` / filters.id type=cargo; filters.slug | `exam_or_contest_board` | `board_detail` | explicit related public provas or contests | `outgoing` | yes | yes | `/bancas/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 54 | `simulation_detail` / public_simulations.id; persisted slug | `public_simulation_contests` | `contest_detail` | public_simulation_contests | `outgoing` | yes | yes | `/concursos/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 55 | `simulation_detail` / public_simulations.id; persisted slug | `public_simulation_exams` | `exam_detail` | public_simulation_exams | `outgoing` | yes | yes | `/provas/{slug}` | `INDEXABLE` | max 12; persisted/current builder |
| 56 | `simulation_detail` / public_simulations.id; persisted slug | `public_simulation_questions` | `question_detail` | published simulation question composition | `outgoing` | yes | yes | `/questoes/{id}/{slug}` | `INDEXABLE` | max 10; persisted/current builder |
| 57 | `law_detail` / legal_commentaries.id; persisted slug | `law_articles` | `law_article_detail` | legal_commentary_articles.law_id | `bidirectional` | yes | yes | `/lei-comentada/{lawSlug}/{articleSlug}` | `INDEXABLE` | max 50; persisted/current builder |
| 58 | `law_article_detail` / legal_commentary_articles.id; persisted slug | `article_siblings` | `law_article_detail` | ordered articles in same law | `contextual` | yes | yes | `/lei-comentada/{lawSlug}/{articleSlug}` | `INDEXABLE` | max 2; persisted/current builder |
| 59 | `material_detail` / materials.id; materials.slug | `material_taxonomy` | `discipline_detail` | materials.subject_id explicit level | `outgoing` | yes | yes | `/disciplinas/{slug}` | `INDEXABLE` | max 1; persisted/current builder |
| 60 | `material_detail` / materials.id; materials.slug | `material_taxonomy` | `topic_detail` | materials.topic_id explicit level | `outgoing` | yes | yes | `/topicos/{slug}` | `INDEXABLE` | max 1; persisted/current builder |
| 61 | `blog_article` / blog_articles.id; persisted slug | `editorial_category` | `blog_category` | blog article category relation | `outgoing` | yes | yes | `/blog/categoria/{slug}` | `INDEXABLE` | max 1; persisted/current builder |
| 62 | `blog_article` / blog_articles.id; persisted slug | `editorial_tag` | `blog_tag` | blog article tag relation | `functional` | yes | yes | `/blog/tag/{slug}` | `PERMANENT_NOINDEX` | max 12; persisted/current builder |
| 63 | `blog_article` / blog_articles.id; persisted slug | `editorial_author` | `blog_author` | published article author identity | `outgoing` | yes | yes | `/blog/autor/{id}` | `CONDITIONAL` | max 1; persisted/current builder |
| 64 | `blog_article` / blog_articles.id; persisted slug | `related_articles` | `blog_article` | editorial related article collection | `contextual` | yes | yes | `/blog/{slug}` | `INDEXABLE` | max 6; persisted/current builder |
| 65 | `blog_category` / blog_categories.id; persisted slug | `archive` | `blog_article` | published article category relation | `outgoing` | yes | yes | `/blog/{slug}` | `INDEXABLE` | max 24; persisted/current builder |
| 66 | `blog_tag` / blog_tags.id; persisted slug | `functional_archive` | `blog_article` | published article tag relation | `functional` | yes | yes | `/blog/{slug}` | `INDEXABLE` | max 24; persisted/current builder |
| 67 | `blog_author` / public editorial author id | `functional_archive` | `blog_article` | published article author identity | `functional` | yes | yes | `/blog/{slug}` | `INDEXABLE` | max 24; persisted/current builder |

### FULL_REJECTED_INFERENCE_MATRIX_9

| # | Rule | Source | Target | Why tempting | Why forbidden | Proof |
| -: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `name_or_slug_similarity` | arbitrary entity | arbitrary entity | Names/slugs can look equivalent | Identity collisions and false relations | Negative scan plus rejected graph contract |
| 2 | `organization_board_position_year_as_contest_identity` | unknown | unknown | Potential convenience | No canonical authority | Fail-closed contract |
| 3 | `question_to_contest_without_explicit_exam_relation` | unknown | unknown | Potential convenience | No canonical authority | Fail-closed contract |
| 4 | `question_to_law_article_by_text` | question_detail | law_article_detail | Text may mention a law/article | Text match is not persisted identity | Rejected edge and no runtime textual matcher |
| 5 | `question_to_material_by_keyword` | question_detail | material_detail | Keywords can overlap | No explicit persisted relation | Rejected edge and fixture negative |
| 6 | `post_to_domain_entity_by_text` | unknown | unknown | Potential convenience | No canonical authority | Fail-closed contract |
| 7 | `material_to_contest_or_career_by_title` | material_detail | contest/career details | Title may contain entity names | Title is not relationship authority | Only explicit material taxonomy links |
| 8 | `career_from_position_name` | position_detail | career_detail | Position label may imply a career | Career is cargo_career persisted relation | No name/regex inference |
| 9 | `exam_relation_from_shared_year_only` | unknown | unknown | Potential convenience | No canonical authority | Fail-closed contract |

### FULL_BREADCRUMB_MATRIX_44

| # | Family | Visual hierarchy | JSON-LD hierarchy | Canonical URLs | Current item | Status |
| -: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `home` | none | same server-side source | `/` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 2 | `questions_hub` | home > questions_hub | same server-side source | `/questoes` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 3 | `question_detail` | home > questions_hub > question_detail | same server-side source | `/questoes/{id}/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 4 | `discipline_hub` | home > discipline_hub | same server-side source | `/disciplinas` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 5 | `discipline_detail` | home > discipline_hub > discipline_detail | same server-side source | `/disciplinas/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 6 | `topic_detail` | home > discipline_hub > discipline_detail > topic_detail | same server-side source | `/topicos/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 7 | `subject_detail` | home > discipline_hub > discipline_detail > topic_detail > subject_detail | same server-side source | `/assuntos/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 8 | `board_hub` | home > board_hub | same server-side source | `/bancas` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 9 | `board_detail` | home > board_hub > board_detail | same server-side source | `/bancas/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 10 | `organizations_hub` | home > organizations_hub | same server-side source | `/orgaos` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 11 | `organization_detail` | home > organizations_hub > organization_detail | same server-side source | `/orgaos/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 12 | `exam_hub` | home > exam_hub | same server-side source | `/provas` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 13 | `exam_detail` | home > exam_hub > exam_detail | same server-side source | `/provas/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 14 | `contest_hub` | home > contest_hub | same server-side source | `/concursos` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 15 | `contest_detail` | home > contest_hub > contest_detail | same server-side source | `/concursos/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 16 | `open_contests` | home > contest_hub > open_contests | same server-side source | `/concursos-abertos` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 17 | `careers_hub` | home > careers_hub | same server-side source | `/carreiras` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 18 | `career_detail` | home > careers_hub > career_detail | same server-side source | `/carreiras/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 19 | `positions_hub` | home > positions_hub | same server-side source | `/cargos` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 20 | `position_detail` | home > positions_hub > position_detail | same server-side source | `/cargos/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 21 | `simulations_hub` | home > simulations_hub | same server-side source | `/simulados` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 22 | `simulation_detail` | home > simulations_hub > simulation_detail | same server-side source | `/simulados/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 23 | `law_hub` | home > law_hub | same server-side source | `/lei-comentada` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 24 | `law_detail` | home > law_hub > law_detail | same server-side source | `/lei-comentada/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 25 | `law_article_detail` | home > law_hub > law_detail > law_article_detail | same server-side source | `/lei-comentada/{lawSlug}/{articleSlug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 26 | `materials_hub` | home > materials_hub | same server-side source | `/materiais` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 27 | `material_detail` | home > materials_hub > material_detail | same server-side source | `/materiais/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 28 | `marketplace` | home > marketplace | same server-side source | `/marketplace` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 29 | `blog_hub` | home > blog_hub | same server-side source | `/blog` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 30 | `blog_article` | home > blog_hub > blog_article | same server-side source | `/blog/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 31 | `blog_category` | home > blog_hub > blog_category | same server-side source | `/blog/categoria/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 32 | `blog_tag` | home > blog_hub > blog_tag | same server-side source | `/blog/tag/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 33 | `blog_author` | home > blog_hub > blog_author | same server-side source | `/blog/autor/{id}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 34 | `plans` | home > plans | same server-side source | `/planos` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 35 | `faq` | home > faq | same server-side source | `/faq` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 36 | `news` | home > news | same server-side source | `/novidades` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 37 | `support` | home > support | same server-side source | `/support` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 38 | `elite` | home > elite | same server-side source | `/elite` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 39 | `ranking` | home > ranking | same server-side source | `/ranking` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 40 | `privacy` | home > privacy | same server-side source | `/privacy` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 41 | `terms` | home > terms | same server-side source | `/terms` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 42 | `marketing_landing` | home > marketing_landing | same server-side source | `/l/{slug}` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 43 | `search` | home > search | same server-side source | `/busca` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |
| 44 | `facet` | home > questions_hub | same server-side source | `/questoes` | visible, non-link, aria-current when breadcrumb exists | CONTRACT_PASS; harness subset PASS |

### FULL_STRUCTURED_DATA_MATRIX_44

| # | Family | Primary schema | BreadcrumbList | ItemList | Other schema | Authority | SSR/client | Status |
| -: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `home` | `WebSite` | no/empty forbidden | only when visible related collection exists | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 2 | `questions_hub` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 3 | `question_detail` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | questions.id + persisted public slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 4 | `discipline_hub` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 5 | `discipline_detail` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | filters.id type=assunto level=materia; filters.slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 6 | `topic_detail` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | filters.id type=assunto level=topico; filters.slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 7 | `subject_detail` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | filters.id type=assunto level=assunto; filters.slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 8 | `board_hub` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 9 | `board_detail` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | filters.id type=banca; filters.slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 10 | `organizations_hub` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 11 | `organization_detail` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | filters.id type=orgao; filters.slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 12 | `exam_hub` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 13 | `exam_detail` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | provas.id; persisted slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 14 | `contest_hub` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 15 | `contest_detail` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | contests.id; contests.slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 16 | `open_contests` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | contest domain status and dates | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 17 | `careers_hub` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 18 | `career_detail` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | filters.id type=carreira; filters.slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 19 | `positions_hub` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 20 | `position_detail` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | filters.id type=cargo; filters.slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 21 | `simulations_hub` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 22 | `simulation_detail` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | public_simulations.id; persisted slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 23 | `law_hub` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 24 | `law_detail` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | legal_commentaries.id; persisted slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 25 | `law_article_detail` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | legal_commentary_articles.id; persisted slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 26 | `materials_hub` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 27 | `material_detail` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | materials.id; materials.slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 28 | `marketplace` | `none` | yes | only when visible related collection exists | page-specific public facts only | functional catalog | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 29 | `blog_hub` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 30 | `blog_article` | `NewsArticle` | yes | only when visible related collection exists | page-specific public facts only | blog_articles.id; persisted slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 31 | `blog_category` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | blog_categories.id; persisted slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 32 | `blog_tag` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | blog_tags.id; persisted slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 33 | `blog_author` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | public editorial author id | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 34 | `plans` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 35 | `faq` | `FAQPage` | yes | only when visible related collection exists | page-specific public facts only | page + visible FAQ_DATA | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 36 | `news` | `CollectionPage` | yes | visible ordered collection only | page-specific public facts only | page + published changelog entries | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 37 | `support` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 38 | `elite` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 39 | `ranking` | `none` | yes | only when visible related collection exists | page-specific public facts only | public ranking id when a detail is resolved | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 40 | `privacy` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 41 | `terms` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | page | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 42 | `marketing_landing` | `WebPage` | yes | only when visible related collection exists | page-specific public facts only | persisted editorial landing slug | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 43 | `search` | `none` | yes | only when visible related collection exists | page-specific public facts only | functional search query | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
| 44 | `facet` | `none` | yes | only when visible related collection exists | page-specific public facts only | functional filter parameters | server/SSR | CONTRACT_PASS; duplicate primary = 0 |
