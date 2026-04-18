# Google Search Console

Este runbook cobre a abertura de indexacao da plataforma Next depois da consolidacao na raiz.

Nota em `2026-04-18`: os comandos `web-next:*` continuam como aliases operacionais, mas o codigo Next ativo fica em `src/` e roda a partir da raiz do repositorio.

## Objetivo

- submeter os sitemaps canonicos novos
- confirmar que Googlebot enxerga o Next como origem das rotas publicas
- monitorar cobertura, canonicals e rich results nos primeiros dias

## Pre-condicoes

- `npm run typecheck` passa na raiz
- `npm run build` passa na raiz
- `npm run web-next:stage5-smoke` passa
- `npm run web-next:stage5-validate` passa com a config local da macro 5
- `npm run web-next:stage5-status` deixa a macro 5 em `config-validated` ou acima antes do launch real
- `npm run web-next:cutover-check` passa contra o dominio final
- quando estiver validando staging/producao, preferir `WEB_NEXT_EXPECTED_CANONICAL_BASE_URL` para garantir que o host do canonical tambem ficou correto
- em staging/producao, preferir `WEB_NEXT_REQUIRE_ENTITY_IDS=1` com uma URL real de questao, ranking e material antes de abrir indexacao
- em Windows, o atalho `npm run web-next:staging-gate -- ...` consolida essa validacao num relatorio unico
- se algum ambiente temporario ainda estiver em modo hibrido, incluir tambem `LegacyWebBaseUrl` no gate ajuda a validar o comportamento real do proxy antes da abertura de indexacao
- `npm run web-next:stage4-smoke` deve passar para confirmar que os scripts da macro 4 estao operacionais localmente
- `.github/workflows/web-next-stage4-smoke.yml` pode validar esse smoke em CI sem staging real
- `npm run web-next:stage4-init-config` pode gerar a config local da macro 4 a partir dos valores reais de staging
- `npm run web-next:stage4-proxy-check` deve passar quando a referencia de proxy for um arquivo local
- `npm run web-next:stage4-status` deve indicar `macro5-ready` antes de abrir Search Console
- `npm run web-next:stage4-readiness` deve passar como trava final antes da macro 5
- `npm run web-next:stage4-config-check` deve passar antes de acionar o rollout real da macro 4
- antes da abertura final, `npm run web-next:stage4-rollout` deve passar com a config local real da macro 4
- em GitHub Actions, `.github/workflows/web-next-stage4-rollout.yml` gera artifact com a evidencia completa da macro 4
- em GitHub Actions, o workflow manual `.github/workflows/web-next-staging-gate.yml` gera artifact com o relatorio final para `staging` ou `production`, alem de um resumo curto no job
- `robots.txt` publico referencia:
  - `/sitemap.xml`
  - `/question-sitemap.xml`
- proxy por rota ja esta em producao

## Sitemaps para enviar

Enviar os dois sitemaps na propriedade correta do dominio:

- `https://concursomestre.com.br/sitemap.xml`
- `https://concursomestre.com.br/question-sitemap.xml`

## Checklist de abertura

1. Abrir a propriedade do dominio no Search Console.
2. Confirmar que a propriedade e do dominio canonico final, sem depender de URL-prefix errado.
3. Enviar `/sitemap.xml`.
4. Enviar `/question-sitemap.xml`.
5. Validar manualmente no inspetor de URL:
   - `/`
   - `/planos`
   - `/elite`
   - uma URL real de questao
   - uma URL real de ranking
   - uma URL real de material
6. Confirmar:
   - canonical apontando para a propria URL final
   - pagina acessivel para Google
   - indexacao permitida
   - rich result elegivel quando houver JSON-LD

## Monitoramento dos primeiros 7 dias

Olhar diariamente:

- Cobertura e indexacao:
  - paginas descobertas versus indexadas
  - exclusoes por redirect, `noindex`, `soft 404` ou canonical alternativo
- Sitemaps:
  - quantidade enviada
  - quantidade lida
  - erros de leitura
- Inspecao de URL:
  - pagina canonica escolhida pelo Google
  - ultima data de rastreamento
- Melhorias:
  - FAQ, Article, Product ou outros rich results quando aplicavel

## Alertas que exigem acao

- `robots.txt` sem os dois sitemaps novos
- aumento de `Crawled - currently not indexed` nas paginas comerciais
- canonical escolhida pelo Google apontando para URL antiga da SPA
- muitos `Alternate page with proper canonical` em rotas que deveriam ser canonicas
- `Soft 404` em questoes, rankings ou materiais publicos
- queda brusca de paginas validas logo apos o corte

## Evidencias recomendadas

Guardar em `docs/reports/` quando fizer o go-live:

- relatorio da macro 5:
  - `npm run web-next:stage5-launch`
- relatorio de status da macro 5:
  - `npm run web-next:stage5-status`
- relatorio do cutover:
  - `npm run web-next:cutover-report`
- screenshots ou export simples do Search Console:
  - confirmacao dos dois sitemaps enviados
  - inspecao de pelo menos uma URL por tipo publico

## Observacao operacional

O Search Console nao substitui o `cutover-check`. A ordem profissional e:

1. validar HTTP/SEO/canonicals no dominio final
2. abrir sitemaps
3. monitorar cobertura e canonicals reais do Google
