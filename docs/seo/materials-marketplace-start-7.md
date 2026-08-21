# Materiais e Marketplace - START #7

Data arquitetural: 2026-08-21
Baseline: `2ca4888eeba2ef526d9281a29a811797fa294284`

## Decisao canonica

- `MATERIAL_CANONICAL_ROUTE = /materiais/{persistedSlug}`
- `MARKETPLACE_LISTING_CANONICAL_ROUTE = NONE`
- `MARKETPLACE_HUB_SEO_FAMILY = NO`

`materials.id` continua sendo a identidade de dominio. O Marketplace atual nao possui uma entidade Listing independente: oferta, preco e disponibilidade sao fatos comerciais do mesmo Material. Por isso, `/marketplace` permanece uma ferramenta comercial SSR e permanentemente `NOINDEX`, enquanto `/materiais` e `/materiais/{slug}` sao as superficies editoriais canonicas. A rota legada `/material/{id}/...` apenas redireciona para o slug persistido.

Material, arquivo, oferta, compra, entitlement, item da biblioteca e download sao conceitos separados. Nenhuma compra, pagamento, direito de acesso ou caminho privado participa da projection publica.

## Extensao de schema

A migration aditiva `20260821_120000_public_materials.php` estende a tabela existente. Ela separa publicacao, visibilidade, direitos e disponibilidade comercial, adiciona slug persistido e aliases, e falha fechada para registros existentes e novos. Nao ha backfill.

- migration aplicada em producao: NAO
- writes em producao: 0
- writes de backfill: 0

Antes do rollout, a migration deve ser ensaiada em staging MySQL 8.4 com snapshot descartavel e rollback validado. Nenhuma inferencia a partir do titulo ou preco deve preencher os novos campos.

## Regras publicas

Material `READY` exige identidade, slug, titulo, moderacao aprovada, publicacao `published`, visibilidade `public`, direitos aprovados e asset anexado. Disponibilidade comercial nao apaga uma landing historica valida.

Oferta `READY` exige Material `READY` e estado comercial valido. Gratuidade depende de `is_free=1`; `NULL` ou ausencia de preco nunca significa gratis. Oferta paga exige preco decimal positivo e moeda valida. O valor publico e convertido para minor units sem float no boundary PHP.

No contrato comercial atual, ofertas pagas usam exclusivamente `BRL`, que e a moeda suportada pelo checkout. `is_free=1` com preco positivo e uma contradicao e permanece `NOT_READY`. `visibility_status=unlisted` tem semantica fail-closed neste START: nao resolve landing publica, nao aparece no diretorio e nao entra no sitemap.

Preview e capa so atravessam a projection quando explicitamente publicos e quando usam URL HTTPS estavel. URLs assinadas/tokenizadas, credenciais, localhost e hosts privados/reservados sao rejeitados. O arquivo completo continua no fluxo autenticado e autorizado existente.

## Launch e sitemap

- `materials_hub`: `ACTIVE`, `INDEXABLE`, target `INDEX`, PRELAUNCH `NOINDEX`, sitemap quando READY.
- `material_detail`: `ACTIVE`, `INDEXABLE`, target `INDEX`, PRELAUNCH `NOINDEX`, sitemap quando READY.
- `marketplace`: `PERMANENT_NOINDEX`, sitemap excluido.
- `material_legacy`: redirect e `PERMANENT_NOINDEX`, sitemap excluido.

O sitemap materializa detalhes em lotes somente em `PRODUCTION` ou simulacao isolada autorizada, com publicacao, direitos, slug e asset validados. `lastmod` usa data persistida; `NOW()` nao e usado como lastmod.

## Gate de dados reais

`MATERIALS_MARKETPLACE_REAL_DATA_VALIDATION` deve ser executado depois da carga definitiva. O reporter read-only mede estados, slugs, duplicacoes, direitos, ofertas, moeda, assets e relacoes de taxonomia. O dataset temporario nao decide elegibilidade permanente da familia.

## Production-GO blockers

1. Ensaiar migration e rollback em staging MySQL 8.4.
2. Integrar os novos estados ao workflow editorial/admin sem publicacao implicita.
3. Validar proveniencia e direitos antes da carga publica real.
4. Validar entrega privada, autorizacao de download e ciclo completo de entitlement.
5. Revalidar pagamento, webhook e lifecycle de compra sem cobranca real no ensaio.
6. Revisar malware scanning operacional antes de habilitar uploads de terceiros em producao.
7. Executar reporter, `EXPLAIN` e testes de carga com o dataset definitivo.

Perfis publicos de vendedor, reviews estruturados, `Product`/`Offer` JSON-LD, recomendacoes e filtros avancados permanecem fora deste START.
