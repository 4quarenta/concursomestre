# Contratos e shadow policy SEO v1

Os contratos permanecem sem enforcement de quality, indexability ou publication.
As Fases 1 e 2 adicionaram envelopes publicos aditivos em shadow mode e concluiram
o cutover de URLs, canonical e sitemap. O envelope calculado ainda nao controla
publicacao, acesso, robots ou a renderizacao publica.

## Responsabilidades

- `PublicationDecision`: descreve publicacao, visibilidade e acesso. Proveniencia, direitos, embargo, moderacao e restricoes juridicas pertencem a esta politica.
- `SeoDecision`: descreve existencia, qualidade SEO, indexabilidade, resolucao HTTP, canonical, robots e elegibilidade de sitemap.
- `SeoFacts`: contem somente fatos publicos. O Next podera usa-los futuramente para compor title, description, Open Graph, Twitter e JSON-LD, sem recalcular decisoes do backend.
- `Structural Route Policy`: cataloga familias de rotas e parametros. Nao contem entidades ou promocao editorial.
- `Quality Gates`: configuracao declarativa por recurso, com enforcement desativado. Nao decide publicacao.
- `Slug Contract`: vetores normativos comuns a TypeScript e PHP. O contrato define os slugs canonicos das questoes; provas preservam o slug persistido.

## Fontes de verdade

- Schemas: `contracts/seo` e `contracts/publication`.
- Catalogo de motivos: `contracts/seo/reason-codes.v1.json`.
- Vetores de slug: `contracts/seo/slug-vectors.v1.json`.
- Configuracoes inativas: `config/seo`.
- Fixtures cruzadas: `contracts/seo/fixtures/contract-fixtures.v1.json`.
- Fixture do relatorio: `backend/tests/fixtures/seo/shadow-projections.v1.json`.

Os validadores TypeScript e PHP consomem o mesmo catalogo e as mesmas fixtures. `SeoFacts` proibe gabarito, comentarios protegidos, editorial pago e metadata pronta.

## Versionamento

Uma versao futura deve ser introduzida em arquivos paralelos (`*.v2.*`), com novos identificadores de versao e fixtures proprias. Consumidores migram explicitamente; os contratos v1 nao mudam de significado depois de publicados.

## Shadow mode

O fluxo interno e `Existence -> ContentPublicationPolicy -> SeoFactsAssembler ->
SeoQualityPolicy -> SeoPolicyService`. Endpoints publicos selecionados anexaram
o envelope de forma aditiva. O resultado e validado e observado, mas quality,
indexability e publication nao exercem enforcement sobre o runtime.

O relatorio CLI pode ler projecoes do banco por lotes ou uma fixture:

```bash
php backend/scripts/seo/report_seo_shadow.php --resource=all --limit=1000 --batch-size=500
php backend/scripts/seo/report_seo_shadow.php --fixture=backend/tests/fixtures/seo/shadow-projections.v1.json
```

O modo banco utiliza conexao de leitura. Para questions, executa no maximo seis
queries por lote; exam, no maximo tres; taxonomy/board, tres; law, duas. Nao ha
query por entidade. Duplicidade e apenas candidato por fingerprint exato, sem
merge ou redirect aplicado.

Direitos e proveniencia ausentes geram motivos genericos de Publication Policy.
Eles nao bloqueiam automaticamente registros publicos no shadow mode. O acesso
recebido pela policy e o resultado contextual do RBAC existente; a policy nao
autentica nem autoriza.

Taxonomias ainda nao possuem contagem persistida de entidades com quality PASS.
Por isso o check correspondente fica `NOT_EVALUATED` em dados do banco, mesmo
quando existe contagem de itens publicados. Isso evita promover uma aproximacao
como se fosse evidencia.

Uma futura chave de cache deve combinar `resource.updated_at`, estado de
publicacao, `seo-policy.v1` e `quality-gates.v1`. Decisoes contextuais de acesso
nao podem compartilhar cache entre publico, autenticado e restrito.

## Limites atuais

A remocao da arvore paralela `@seo`, a apresentacao de metadata por `SeoFacts`,
a contagem persistida de entidades com quality PASS e qualquer enforcement de
quality/indexability/publication pertencem a fases posteriores.
