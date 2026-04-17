# Runbook de corte da web publica para Next.js

Este documento descreve como colocar o `web-next` na frente das rotas publicas sem quebrar a SPA Vite que ainda atende area logada, pratica, admin e checkout transacional.

## Estado validado

Validado localmente em `2026-04-16`:

- `npm --prefix web-next run typecheck`: ok
- `npm --prefix web-next run build`: ok
- `npm run web-next:cutover-check`: ok
- `http://localhost:3001/plans`: `308` para `/planos`
- `http://localhost:3001/checkout/termos-de-adesao`: `200`

## Validacao automatizada

Com o `web-next` rodando, execute:

```bash
npm run web-next:cutover-check
```

Por padrao, o script usa `http://localhost:3001`. Para validar staging ou producao:

```bash
WEB_NEXT_BASE_URL=https://staging.exemplo.com npm run web-next:cutover-check
```

Para validar redirects dinamicos de entidades reais, informe IDs existentes:

```bash
WEB_NEXT_CHECK_QUESTION_ID=123 WEB_NEXT_CHECK_RANKING_ID=abc WEB_NEXT_CHECK_MATERIAL_ID=xyz npm run web-next:cutover-check
```

Esses IDs sao opcionais porque dependem de dados reais do backend. Sem eles, o script valida:

- rotas publicas estaticas
- `<title>` das paginas publicas principais
- meta description das paginas publicas principais
- canonical das paginas publicas principais
- `robots.txt`
- `sitemap.xml`
- `/plans -> /planos`

Com os IDs reais configurados, ele tambem valida JSON-LD nas paginas dinamicas:

- questao: `Article`
- ranking: `ItemList`
- material: `Product`

## Servicos esperados

- `web-next`: Next.js App Router para rotas publicas e SEO-first
- `src/`: SPA Vite atual para produto autenticado e fluxos que dependem de sessao
- backend PHP/API: mantido como fonte dos endpoints publicos e autenticados

## Rotas para o Next

Encaminhar para `web-next`:

- `/`
- `/planos`
- `/plans`
- `/elite`
- `/faq`
- `/changelog`
- `/privacy`
- `/terms`
- `/checkout/termos-de-adesao`
- `/l/*`
- `/question/*`
- `/ranking/*`
- `/material/*`
- `/promo/*`
- `/robots.txt`
- `/sitemap.xml`

## Rotas para a SPA Vite

Encaminhar para a SPA atual:

- `/auth`
- `/dashboard`
- `/practice`
- `/admin`
- `/profile`
- `/checkout/*`, exceto `/checkout/termos-de-adesao`
- `/marketplace`
- `/read/*`
- demais rotas autenticadas ainda nao migradas

## Redirects e canonicals

Ja implementado no `web-next`:

- `/plans` -> `/planos` permanente
- `/question/[id]` -> `/question/[id]/[slug]`
- `/ranking/[id]` -> `/ranking/[id]/[slug]`
- `/material/[id]` -> `/material/[id]/[slug]`
- slug incorreto em questao/ranking/material -> canonical com slug correto
- `/l/planos` -> `/planos`
- `/l/elite` -> `/elite`

## Cache e revalidate

Politica inicial:

- landings dinamicas: `revalidate = 3600`
- questoes publicas: `revalidate = 3600`
- rankings publicos: `revalidate = 3600`
- materiais publicos: `revalidate = 3600`
- promocao publica: `revalidate = 900`
- changelog: ISR de 1 hora

Essa politica e conservadora: reduz carga no backend sem deixar promocao e conteudo publico congelados por tempo demais.

## Ordem segura de corte

1. Subir `web-next` em staging com a mesma `NEXT_PUBLIC_API_URL` que o dominio final usara.
2. Validar `robots.txt` e `sitemap.xml` em staging.
3. Rodar `npm run web-next:cutover-check` apontando para o ambiente de staging.
4. Validar uma URL real de cada grupo:
   - `/planos`
   - `/elite`
   - `/faq`
   - `/checkout/termos-de-adesao`
   - `/question/[id]`
   - `/ranking/[id]`
   - `/material/[id]`
   - `/promo/[slug]`, se houver promocao ativa
5. Configurar proxy por rota, mantendo a SPA como fallback para rotas autenticadas.
6. Testar redirects permanentes antes de abrir indexacao:
   - `/plans`
   - `/question/[id]`
   - `/ranking/[id]`
   - `/material/[id]`
7. Publicar o corte em producao.
8. Rodar `npm run web-next:cutover-check` apontando para o dominio final.
9. Submeter `/sitemap.xml` no Google Search Console.
10. Monitorar erros 404/500 e cobertura de indexacao nos primeiros dias.

## Regras de proxy

O proxy deve priorizar rotas mais especificas antes das genericas. Exemplo:

1. `/checkout/termos-de-adesao` -> `web-next`
2. `/checkout/*` -> SPA Vite
3. `/question/*`, `/ranking/*`, `/material/*`, `/promo/*`, `/l/*` -> `web-next`
4. rotas autenticadas -> SPA Vite
5. `/` e paginas publicas estaticas -> `web-next`

## Checklist pos-corte

- `/robots.txt` retorna 200 e aponta para o sitemap correto
- `/sitemap.xml` retorna 200 e lista rotas publicas
- `/plans` retorna redirect permanente para `/planos`
- paginas publicas tem `<title>`, description e canonical
- titulos publicos nao duplicam o nome da marca
- JSON-LD dinamico aparece nas paginas de questao/ranking/material testadas
- area logada continua abrindo na SPA
- checkout transacional continua na SPA
- `/checkout/termos-de-adesao` continua publico no Next
- Search Console recebeu o sitemap novo
- `npm run web-next:cutover-check` passa contra o dominio final
