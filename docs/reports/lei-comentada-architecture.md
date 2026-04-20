# Lei Comentada - arquitetura do módulo

## Objetivo

Criar um Vade Mecum inteligente dentro da plataforma, com legislação oficial do Portal do Planalto, comentários editoriais voltados para concursos, jurisprudência, macetes, favoritos, comentários de usuários, progresso e monitoramento diário de alterações.

## Rotas de produto

- `/lei-comentada`
  - Página principal.
  - Busca global.
  - Atalhos para mais acessadas.
  - Filtros simples por área, seguindo o raciocínio visual do protótipo Lovable.
  - Listagem agrupada por área do direito.
  - UI integrada ao shell da plataforma, com cabeçalho, cards e largura de desktop consistentes com as demais páginas internas.

- `/lei-comentada/[slug]`
  - Detalhe da lei.
  - Cabeçalho da lei, fonte oficial, status de atualização e progresso.
  - Índice lateral de artigos.
  - Busca interna por artigo.
  - Texto legal estruturado.
  - Conteúdos complementares em sanfonas: comentário do professor, doutrina, jurisprudência, súmulas, macete, anotações e comentários da comunidade.
  - Atualizações da Lei.
  - Alternância entre modo `Lei seca` e modo `Comentada`.

## Modos de leitura

- `Lei seca`
  - Mostra apenas o texto oficial estruturado por artigo, parágrafo, inciso, alínea e item.
  - Usa maior respiro tipográfico para leitura literal e revisão rápida.
  - Mantém favoritos e progresso, mas oculta blocos editoriais e comunidade durante a leitura.

- `Comentada`
  - Mantém a experiência completa de estudo para concursos.
  - Exibe comentários de professores, doutrina, jurisprudência, súmulas, macetes, anotações, comentários dos alunos e questões relacionadas.
  - É o modo padrão ao abrir uma lei.

## Serviços e domínio

- O contrato editorial segue o formato do protótipo Lovable:
  - `AreaDireito`: `id`, `nome`, `cor`, `icone`, `totalLeis`, `leis`.
  - `Lei`: `id`, `sigla`, `nome`, `numero`, `ano`, `descricao`, `ementa`, `totalArtigos`, `artigosComentados`, `urlPlanalto`, `artigos`.
  - `Artigo`: `numero`, `titulo`, `texto`, `paragrafos`, `comentarios`, `jurisprudencia`, `sumulas`, `doutrina`, `macete`, `questoesRelacionadas`.
  - No banco relacional, esse contrato é preservado em colunas explícitas em português e complementado por IDs internos, versionamento e índices.

- `src/types/legalCommentary.ts`
  - Tipos do domínio: áreas, leis, versões, artigos, comentários, jurisprudência, favoritos, progresso, updates e logs.
  - Inclui campos compatíveis com `leis.ts`, como `acronym`, `year`, `description`, `paragraphs`, `syllabi`, `doctrine`, `examTip` e `relatedQuestionCount`.

- `src/services/legal-commentary/legalCommentaryData.ts`
  - Base inicial de leis prioritárias para concursos.
  - Dados editoriais iniciais para validar a experiência.
  - Links oficiais do Planalto preservados em cada lei.

- `src/services/legal-commentary/legalCommentaryService.ts`
  - Fachada de produto usada pelo frontend.
  - Gera snapshot da home.
  - Executa busca global.
  - Carrega detalhe da lei.
  - Controla favoritos, comentários de usuário e progresso em `localStorage` no modo preview.
  - As mesmas operações viram chamadas HTTP quando o backend relacional entrar.

- `src/services/legal-commentary/planaltoSyncService.ts`
  - Base de sincronização oficial.
  - Aceita apenas hosts do Planalto.
  - Busca HTML oficial.
  - Estrutura artigos.
  - Compara hashes de dispositivos.
  - Gera logs de inserted/changed/revoked.

## Endpoints Next

- `GET /api/lei-comentada`
  - Lista snapshot principal.
  - Query params:
    - `q`: busca por lei, artigo, termo, comentário ou jurisprudência.
    - `updated=1`: filtra leis atualizadas.
    - `userId`: aplica favoritos/progresso quando houver backend.

- `GET /api/lei-comentada/[slug]`
  - Retorna detalhe completo da lei.

- `GET /api/lei-comentada/articles/[articleId]/comments`
  - Lista comentários do artigo.
  - Hoje usa armazenamento volátil de preview.

- `POST /api/lei-comentada/articles/[articleId]/comments`
  - Cria comentário no contrato esperado.
  - Em produção deve persistir em `user_comments`.

- `GET /api/lei-comentada/sync?limit=6`
  - Executa preview de sincronização.
  - Usado pelo cron diário.

- `POST /api/lei-comentada/sync`
  - Permite reprocessamento manual pelo admin.

## Cron diário

`vercel.json` agenda:

- Caminho: `/api/lei-comentada/sync?limit=6`
- Horário: 08:00 UTC diariamente

Em produção, esse job deve:

1. Carregar leis monitoradas.
2. Buscar HTML oficial no Planalto.
3. Extrair artigos/dispositivos.
4. Gerar hash normalizado por dispositivo.
5. Comparar contra a versão atual.
6. Criar `law_versions` e `law_article_versions`.
7. Criar entradas em `law_updates`.
8. Atualizar `laws.last_synced_at`.
9. Marcar dispositivos alterados como recentes pelo período configurável.
10. Criar `sync_logs`.

## Regras de negócio

- Toda lei deve manter `official_url` do Planalto.
- Toda lei também deve manter `url_planalto` no contrato editorial, para compatibilidade com o catálogo importado.
- Conteúdo principal é HTML/texto estruturado dentro da plataforma, nunca PDF como experiência principal.
- Leis são exibidas agrupadas por área.
- Mais acessadas usam métrica real de visualização.
- Usuário autenticado pode favoritar leis, artigos, jurisprudências e comentários editoriais.
- Usuário autenticado pode comentar em artigo.
- Usuário só edita ou exclui o próprio comentário.
- Comentários de professores são conteúdo editorial e não se misturam visualmente com comentários da comunidade.
- Apenas admin/editor cadastra comentário de professor, jurisprudência e macetes.
- Alterações recentes exibem selo e destaque no dispositivo.
- Histórico de versão nunca é sobrescrito; toda alteração cria versão.

## Admin necessário

O painel administrativo deve expor:

- Cadastro/edição de leis.
- Associação de lei com área.
- Gestão de monitoramento Planalto.
- Cadastro de comentários de professores.
- Cadastro de jurisprudência.
- Cadastro de macetes.
- Moderação de comentários de usuários.
- Fila de dispositivos alterados recentemente.
- Logs de sincronização.
- Botão de reprocessar sincronização.

## Próximas camadas

- Persistir dados no PostgreSQL conforme `docs/examples/lei-comentada-schema.sql`.
- Criar importador que receba o DTO `areasDireito` e alimente `legal_areas`, `laws`, `law_articles`, `teacher_comments`, `article_sumulas`, `article_doutrina`, `article_jurisprudence` e `article_exam_tips`.
- Substituir `localStorage` por endpoints autenticados.
- Indexar busca com PostgreSQL full-text ou Meilisearch/OpenSearch quando o volume crescer.
- Adicionar highlights e notas privadas por trecho.
- Criar telas administrativas completas.
- Adicionar fila Redis/BullMQ se a sincronização passar de poucas dezenas de leis.
