# START #8 - Taxonomias do Blog

Data da decisao: 2026-08-21.

## Decisoes

- `BLOG_CATEGORY_INDEX_POLICY = INDEXABLE`
- `BLOG_TAG_INDEX_POLICY = PERMANENT_NOINDEX`
- `BLOG_CATEGORY_CANONICAL_ROUTE = /blog/categoria/{persistedSlug}`
- `BLOG_TAG_CANONICAL_ROUTE = /blog/tag/{persistedSlug}`
- `CATEGORY_HUB_CREATED = NAO`
- `TAG_HUB_CREATED = NAO`
- `COMBINATORIAL_BLOG_SEO_CREATED = NAO`

Categorias possuem identidade persistida, slug unico e relacao obrigatoria explicita com posts. Uma categoria fica READY quando a identidade e o slug sao validos e existe ao menos um post efetivamente publico. Nao existe threshold de volume.

Tags possuem identidade persistida e relacao N:N, mas o editor ainda aceita criacao livre durante a edicao de posts. Como nao ha publication state, aliases, merge ou consolidacao editorial, promover tags criaria risco desnecessario de sinonimos, typos e explosao de URLs. A rota funcional permanece SSR e `NOINDEX,follow`; tags ficam sempre fora do sitemap.

## Publicacao e paginacao

Somente posts sem `deleted_at`, com `status` publicado/agendado, `published_at` preenchido e `published_at <= NOW()` entram nos arquivos. A ordem e `published_at DESC, id DESC`, com cursor keyset assinado. Cursor, busca e demais parametros funcionais sao `NOINDEX,follow` e mantem canonical limpo.

O contrato atual e deliberadamente temporal: um post com `status = scheduled` torna-se publico automaticamente quando `published_at <= NOW()`, sem exigir promocao previa da coluna de status. Posts `published` com data futura, drafts, archived e removidos continuam fora da leitura publica. A autoridade e o relogio do backend/MySQL; o frontend nao recalcula publicacao.

`PRELAUNCH` mantem Blog, categorias e tags em `NOINDEX`. Em simulacao `PRODUCTION`, apenas categoria READY pode resultar em `INDEX` e sitemap. Tag permanece `PERMANENT_NOINDEX`.

## Governanca antes do SEO GO

- `BLOG_TAXONOMY_REAL_DATA_VALIDATION`: executar reporter no dataset definitivo.
- `BLOG_TAXONOMY_REAL_DATA_QUALITY_GATE`: revisar zero/one-post, descricoes, duplicidades, sinonimos e typos.
- `BLOG_TAXONOMY_REAL_DATA_EXPLAIN_REQUIRED`: medir as consultas no dataset definitivo com acesso read-only.
- `BLOG_CATEGORY_GOVERNANCE_REQUIRED`: definir publicacao, despublicacao e responsabilidade editorial da categoria.
- `BLOG_CATEGORY_SLUG_CHANGE_CONTROL_REQUIRED`: tratar o slug de categoria publicada como imutavel ate existir controle de mudanca.
- `BLOG_CATEGORY_MERGE_ALIAS_STRATEGY_REQUIRED`: definir alias one-hop e merge antes de qualquer alteracao de URL publicada.
- `BLOG_TAG_GOVERNANCE_REQUIRED`: conter criacao livre, sinonimos e typos antes de qualquer reconsideracao da policy.

O fluxo administrativo atual cria e atribui categorias e tags; tags tambem podem ser criadas por string ao salvar um post. Nao ha modelo de alias, merge, visibility ou depublication especifico para taxonomias. Por isso, categorias so podem receber o SEO GO depois dos gates acima, e tags permanecem `PERMANENT_NOINDEX`.

O reporter `backend/scripts/seo/report_blog_taxonomies.php` e somente leitura. Nenhuma migration ou backfill integra este START.
