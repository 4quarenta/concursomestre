# Fase 09 - Performance, SEO, sitemap, notificacoes e integracoes

Data: 2026-07-11

## Escopo deste checkpoint

O primeiro checkpoint da fase trata apenas de gargalos comprovados no sitemap
publico e registra a linha de base observada na VPS. Nenhuma alteracao de
notificacao, integracao ou banco foi feita sem evidencia e sem migration
compativel.

## Linha de base medida na VPS

| Item | Evidencia |
| --- | --- |
| Questoes | 10 registros no momento da medicao. |
| Notificacoes | 546 registros. |
| Listagem de notificacoes | `idx_notifications_user_visible` e backward index scan; sem filesort no `EXPLAIN`. |
| Listagem publica de questoes | `idx_questions_publication` e `Using filesort` em `ORDER BY updated_at DESC`. |
| Sitemap anterior | Gerado dinamicamente, buscava questoes por paginas de 500, em serie, e repetia todas as leituras a cada request. |

## Correcao implementada

`src/services/seo/sitemapData.ts` agora:

1. busca a primeira pagina de questoes para calcular a cobertura;
2. busca as paginas restantes em lotes de quatro, sem centenas de chamadas
   sequenciais;
3. mantem cache de processo de dez minutos e compartilha uma unica geracao em
   andamento para requests concorrentes;
4. expoe `invalidateSeoSitemapCache()` para mutacoes editoriais futuras;
5. usa `updatedAt`, `updated_at`, `publishedAt`, `published_at`, `createdAt` ou
   `created_at` como `lastmod`, usando o instante de geracao apenas como
   fallback.

O cache nao e fonte de verdade e nao inclui dados privados. A invalidacao
explicita esta pronta para ser chamada pelos fluxos editoriais quando houver
uma fila de publicacao centralizada.

## Notificacoes

A Fase 08 ja interrompeu polling e cancelou requests em abas ocultas. A
auditoria desta fase confirmou que a persistencia atual ainda possui apenas
`type` e `category`; uma taxonomia completa de evento, severidade, canal,
entidade e acao requer migration compativel e uma migracao gradual dos
produtores. Ela permanece pendente para evitar gravar metadados que a tabela
atual ainda nao suporta.

## SEO e sitemap restantes

- O sitemap atual continua em uma unica URL (`/sitemap.xml`). A arquitetura de
  indice e arquivos segmentados deve ser entregue junto de um endpoint de dados
  proprio ou de uma fila de geracao, antes de o catalogo chegar a dezenas de
  milhares de URLs.
- O subdominio de sitemap nao foi configurado porque nenhum hostname foi
  definido no DNS. Quando houver o nome, apontar o registro A/AAAA para a VPS,
  adicionar `server_name`/TLS no Nginx e informar o sitemap index no
  `robots.txt` e Search Console.
- Upload seguro de imagem OG e logo padrao de e-mail depende do contrato de
  configuracoes de arquivos e sera tratado sem reutilizar uploads publicos sem
  validacao de MIME, tamanho e ownership.

## Validacao local

- Vitest: 17 testes de SEO, URL canonica e notificacoes aprovados.
- `npm run typecheck` aprovado.
- `npm run build` aprovado.

## Rollback

Reverter somente `src/services/seo/sitemapData.ts` remove o cache e restaura a
estrategia de coleta anterior, sem schema, migration ou alteracao de dados.
