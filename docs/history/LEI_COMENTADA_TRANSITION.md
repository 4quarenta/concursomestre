# Transição - Lei Comentada

## 2026-04-20

Implementada a base inicial do módulo Lei Comentada.

### O que entrou

- Página principal em `/lei-comentada`.
- Página de detalhe em `/lei-comentada/[slug]`.
- Domínio tipado em `src/types/legalCommentary.ts`.
- Serviço de produto em `src/services/legal-commentary/legalCommentaryService.ts`.
- Base editorial inicial em `src/services/legal-commentary/legalCommentaryData.ts`.
- Sync preview do Portal do Planalto em `src/services/legal-commentary/planaltoSyncService.ts`.
- Endpoints Next:
  - `GET /api/lei-comentada`
  - `GET /api/lei-comentada/[slug]`
  - `GET /api/lei-comentada/articles/[articleId]/comments`
  - `POST /api/lei-comentada/articles/[articleId]/comments`
  - `GET /api/lei-comentada/sync`
  - `POST /api/lei-comentada/sync`
- Cron diário em `vercel.json`.
- Schema relacional em `docs/examples/lei-comentada-schema.sql`.
- Documento de arquitetura em `docs/reports/lei-comentada-architecture.md`.

### Decisões

- A experiência principal não usa PDF.
- Todo card de lei preserva link oficial para o Planalto.
- Comentário do professor, jurisprudência, macete e comentário da comunidade são blocos visual e semanticamente separados.
- Favoritos, progresso e comentários usam persistência local no preview para liberar a experiência antes da implantação relacional.
- A integração Planalto foi criada como preview seguro: busca HTML oficial, estrutura artigos, compara hashes e gera logs. A persistência definitiva deve criar versões no banco.

### Próximo passo recomendado

Implantar o schema PostgreSQL, trocar a persistência local pelos endpoints autenticados e criar a área administrativa editorial.

## 2026-04-20 - Ajuste visual Lovable

### O que mudou

- A tela principal foi simplificada para seguir o raciocínio do protótipo Lovable: cabeçalho direto, busca, filtros apenas por área, bloco de mais acessadas e leis agrupadas em fluxo único.
- A tela de detalhe ficou mais linear para estudo: card da lei, busca interna, índice lateral no desktop e artigos com texto oficial seguido por sanfonas de professor, doutrina, jurisprudência, súmulas, macete, anotações e comentários dos alunos.
- O contrato de dados agora preserva campos equivalentes ao `leis.ts`: `catalogId`, `acronym`, `year`, `description`, `ementa`, `paragraphs`, `syllabi`, `doctrine`, `examTip` e `relatedQuestionCount`.
- As anotações por artigo passaram a ter persistência local real na experiência de preview, em vez de um texto de placeholder.

### Decisão

O banco deve aceitar o formato editorial simples do Lovable como entrada, mas manter IDs internos, versionamento e logs de sincronização para escalar sem perder histórico legislativo.

## 2026-04-20 - Identidade da plataforma e modos de leitura

### O que mudou

- A tela principal deixou de se comportar como um app mobile isolado e passou a usar a estrutura visual da plataforma: largura `max-w-7xl`, cards `PLATFORM_SURFACE_CARD_CLASS`, cabeçalho interno, métricas e grid desktop.
- Os filtros de área foram movidos para uma coluna lateral no desktop, enquanto as leis aparecem em grade ampla no conteúdo principal.
- A tela de detalhe passou a usar cabeçalho da plataforma, bloco lateral de fonte oficial e índice fixo de artigos no desktop.
- Foi adicionado o seletor de modo de leitura:
  - `Comentada`: exibe texto legal, comentários de professores, doutrina, jurisprudência, súmulas, macetes, anotações, comentários e questões relacionadas.
  - `Lei seca`: exibe apenas o texto oficial dos artigos, com espaçamento maior para leitura literal e revisão rápida.

### Decisão

O protótipo Lovable continua servindo como referência de organização, mas a interface final deve seguir a identidade real do ConcursoMestre em cores, cabeçalho, superfícies, espaçamento e comportamento desktop.
