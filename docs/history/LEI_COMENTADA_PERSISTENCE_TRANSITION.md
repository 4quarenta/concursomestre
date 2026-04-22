# Transicao - Lei Comentada Persistente

## 2026-04-20

### O que mudou

- O modulo deixou de depender do preview local como fonte principal e passou a consumir a API PHP em `legal-commentary/*`.
- O backend recebeu o dominio `legal_commentary`, com tabelas MySQL para areas, leis, artigos, comentarios de professor, jurisprudencia, sumulas, macetes, favoritos, comentarios de usuarios, progresso, atualizacoes e logs de sincronizacao.
- A criacao do schema acontece no primeiro acesso local, mantendo tambem a rota pronta para evoluir para migracoes formais.
- A tela publica `/lei-comentada` e a tela de detalhe `/lei-comentada/[slug]` agora leem leis, favoritos, progresso e comentarios pelo backend.
- A area `/admin/operation/lei-comentada` foi adicionada ao painel de Operacao para listar leis persistidas no banco.
- A pagina `/admin/operation/lei-comentada/[lawId]/edit` foi criada para editar metadados da lei, texto dos artigos, vinculo com materia/assunto, comentarios de professor, jurisprudencia, sumulas e macetes.
- O editor administrativo ganhou botoes de IA para gerar rascunhos de comentario, macete, jurisprudencia e sumula, sempre exigindo revisao editorial antes do salvamento.

### Decisao

A partir desta etapa, dados editoriais da Lei Comentada devem ser tratados como produto real persistido no banco. O seed/localStorage fica apenas como historico de transicao e nao deve ser usado como fonte oficial da experiencia.

### Atualizacao da sincronizacao Planalto

- O editor administrativo passou a ter importacao por URL oficial do Planalto no proprio campo da lei.
- A consulta de sincronizacao no admin deixou de importar tudo automaticamente. Agora ela:
  - consulta o catalogo oficial;
  - identifica quais leis ainda nao existem na plataforma;
  - mostra botao de adicionar para as leis pendentes;
  - verifica quais leis ja salvas possuem atualizacoes disponiveis;
  - exibe progresso visivel tanto da consulta quanto da importacao.
- O backend passou a comparar a URL oficial do Planalto com a base persistida para marcar leis ja integradas, com `lastSyncedAt` e `lastUpdatedAt`.
- O importador ganhou fallback via cURL para o ambiente local XAMPP, porque o fetch HTTP padrao do PHP estava falhando ao ler o Planalto.
- A classificacao automatica por materia/assunto foi mantida na importacao, de forma que os artigos ja entram vinculados para uso futuro com questoes e filtros.

### Acervo legislativo administravel

- O schema recebeu suporte a versionamento com `law_versions` e `law_article_versions`, preservando snapshots oficiais por sincronizacao.
- A sincronizacao por item agora registra o resultado em `legal_sync_logs`, atualiza `sync_status`/`sync_message` na lei e grava eventos em `law_updates` quando artigos sao incluidos, alterados ou revogados.
- A pagina administrativa de listagem ganhou acao direta para sincronizar uma lei especifica e acesso ao historico de atualizacoes.
- Foi criada a tela `/admin/operation/lei-comentada/[lawId]/updates`, com diff de redacao anterior/atual e logs recentes da sincronizacao.
- O editor da lei passou a permitir cadastro de doutrina por artigo, alem de comentarios de professor, jurisprudencia, sumulas e macetes.
- A resposta da API segue compatibilizando os nomes usados pela UI atual (`LawSummary`, `LawArticle`) e tambem aliases proximos ao formato de produto (`nome`, `numero`, `totalArtigos`, `artigosComentados`, `urlPlanalto`, `comentarios`, `sumulas`, `doutrina`, `macete`).

### Correcao do parser para leis alteradoras

- Corrigido o parser do Planalto para nao tratar referencias internas como `art. 129` em minusculo como se fossem novos artigos reais.
- O importador agora preserva trechos de leis alteradoras, como `Art. 44` da Lei Maria da Penha, com o texto completo e paragrafos vinculados ao mesmo artigo.
- Caracteres de controle usados pelo HTML do Planalto em trechos citados agora sao normalizados antes da quebra em linhas.
- Artigos que alteram outro dispositivo recebem titulo interno sugerido, por exemplo `Altera o art. 129...`, evitando titulos herdados incorretamente no editor.

### Parser estrutural do Planalto

- O importador passou a ler o HTML oficial como DOM, preservando a ordem real de titulos, capitulos, secoes, artigos, paragrafos, incisos, alineas e itens.
- HTML em UTF-16LE/UTF-16BE agora e convertido para UTF-8 antes da leitura, o que evita perda de acentos e marcadores como `Art. 9º` e `§ 2º`.
- Trechos revogados ou substituidos dentro de `strike`, `s`, `del` ou estilos equivalentes deixam de entrar no acervo ativo.
- Notas oficiais como `Redacao dada`, `Incluido`, `Vide` e `Vigencia` passam a ser salvas como blocos `note`, separadas do texto legal principal.
- `blocks_json` passa a guardar tambem `parentBlockId`, `anchor`, `notes` e `sourceNote`, permitindo leitura hierarquica e edicao editorial mais segura.
- `hierarchy_json` passou a registrar pares de label/nome, como `titleLabel`/`title` e `chapterLabel`/`chapter`, para manter `TITULO II` separado de `DA VIOLENCIA...`.
- O salvamento administrativo ganhou guarda defensiva para slugs de artigos duplicados, retornando erro claro antes do banco em vez de `Duplicate entry`.
