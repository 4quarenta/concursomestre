# Auditoria de SEO e Descoberta no Google

Data: `2026-04-19`

## Escopo

Esta auditoria cobre a base tecnica de SEO da plataforma web apos a consolidacao Next na raiz do projeto.

O foco desta rodada foi deixar a aplicacao pronta para descoberta por buscadores sem alterar a UI nem depender de dominio comprado neste momento.

## Implementado nesta rodada

- URL canonica centralizada em `src/config/siteUrl.ts`
- `metadataBase` do Next agora usa ambiente configuravel em vez de depender apenas do manifesto estatico
- `sitemap.xml` dinamico em `src/app/sitemap.ts`
- `robots.txt` dinamico em `src/app/robots.ts`
- endpoint interno de status em `src/app/api/seo/sitemap-status/route.ts`
- painel admin passa a consultar `/api/seo/sitemap-status`
- `public/site.webmanifest` passou a iniciar em `/` e ganhou `scope: "/"`
- `public/sitemap-status.json` estatico foi removido para nao existir fonte de verdade duplicada
- metadados publicos por rota foram adicionados via layouts Next
- areas privadas, login, checkout interno e ferramentas logadas receberam `noindex`

## URL canonica

Ordem de resolucao:

1. `NEXT_PUBLIC_SITE_URL`
2. `NEXT_PUBLIC_APP_URL`
3. `SITE_URL`
4. `APP_URL`
5. `VERCEL_PROJECT_PRODUCTION_URL`
6. `VERCEL_URL`
7. manifesto da plataforma em producao
8. `http://localhost:3000/` em desenvolvimento

Enquanto nao houver dominio, o ambiente local usa `http://localhost:3000/`. Quando o dominio for adquirido, basta configurar `NEXT_PUBLIC_SITE_URL` com a URL final.

## Sitemap

Rotas institucionais indexaveis nesta rodada:

- `/`
- `/planos`
- `/concursos`
- `/faq`
- `/lei-comentada`
- `/elite`
- `/marketplace`
- `/changelog`
- `/privacy`
- `/terms`
- `/checkout/termos-de-adesao`

Rotas dinamicas incluidas quando o backend responde:

- `/question/{id}/{slug}`
- `/ranking/{id}/{slug}`
- `/material/{id}/{slug}`

O sitemap possui fallback: se o backend estiver indisponivel, as rotas institucionais continuam sendo servidas.

## Robots e noindex

`robots.txt` permite rastreamento geral e aponta para `/sitemap.xml`.

Foram bloqueadas no robots as areas sem valor de indexacao publica:

- `/admin`
- `/auth`
- `/confirm-email`
- `/dashboard`
- `/bank-analysis`
- `/flashcards`
- `/notifications`
- `/partner-dashboard`
- `/performance/`
- `/plans`
- `/practice`
- `/profile`
- `/read/`
- `/reset-password`
- `/simulation`
- `/subscription/`
- `/support`
- `/x-ray`
- `/api/`

Layouts com `noindex` tambem foram adicionados para areas privadas e rotas operacionais. Isso evita indexacao acidental mesmo quando uma URL privada for descoberta.

## Validacao local

- `npm run typecheck`: ok
- `npm run check:text-encoding`: ok
- `GET http://localhost:3000/robots.txt`: 200
- `GET http://localhost:3000/sitemap.xml`: 200
- `GET http://localhost:3000/api/seo/sitemap-status`: 200

Resultado do status local:

- total: 51 URLs
- institucionais: 11/11
- questoes: 40/40
- rankings: 0/0
- materiais: 0/0

Nao foi executado `npm run build`, conforme orientacao atual do projeto.

## Pendencias para producao

- configurar `NEXT_PUBLIC_SITE_URL` quando o dominio for adquirido
- conectar Google Search Console apos DNS e deploy publico
- enviar `/sitemap.xml` no Search Console
- criar imagem oficial Open Graph
- adicionar dados estruturados JSON-LD para organizacao, FAQ, breadcrumbs e paginas de questao/material
- evoluir metadata dinamica por item quando o backend expuser endpoints publicos otimizados para SEO
- validar indexacao real apos deploy publico; localhost nao prova rastreamento externo
