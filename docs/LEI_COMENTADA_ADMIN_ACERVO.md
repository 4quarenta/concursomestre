# Lei Comentada - Admin do Acervo Legislativo

## Objetivo

O modulo administra o acervo legislativo persistente da plataforma. O fluxo principal e:

1. admin acessa `/admin/operation/lei-comentada`;
2. visualiza leis ja salvas;
3. adiciona uma lei por URL oficial do Planalto;
4. revisa o preview importado;
5. salva no banco;
6. edita conteudo editorial por artigo;
7. sincroniza a lei quando quiser verificar mudancas oficiais;
8. consulta o historico em `/admin/operation/lei-comentada/[lawId]/updates`.

## Backend

Dominio PHP: `C:\xampp\htdocs\questao-pro-backend\modules\legal_commentary`.

Principais responsabilidades:

- `PlanaltoImportService`: valida URL oficial, baixa HTML, extrai metadados, quebra artigos, classifica materia/assunto e calcula diferencas.
- `LegalCommentaryRepository`: garante schema local, persiste leis/artigos/editorial, registra logs, versiona snapshots e monta a resposta compativel com a UI.
- `routes.php`: expoe rotas publicas, rotas admin, importacao, sincronizacao e historico.

## Tabelas principais

- `legal_areas`: areas do direito.
- `laws`: metadados da lei, URL oficial, status e indicadores de sync.
- `law_versions`: snapshot oficial por sincronizacao com hash do HTML.
- `law_articles`: artigos ativos e vinculos com materia/assunto.
- `law_article_versions`: historico por artigo em cada versao.
- `teacher_comments`: comentarios de professores.
- `article_sumulas`: sumulas vinculadas ao artigo.
- `article_jurisprudence`: jurisprudencia editorial.
- `article_exam_tips`: macetes.
- `article_doutrina`: estrutura preparada para doutrina granular.
- `law_updates`: eventos de alteracao encontrados na sincronizacao.
- `legal_sync_logs`: logs de tentativas de sincronizacao.
- `sync_errors`: erros tecnicos de sincronizacao.

## Endpoints admin

- `GET /legal-commentary/admin/list.php`: lista o acervo.
- `GET /legal-commentary/admin/detail.php?id=:id`: carrega uma lei para edicao.
- `POST /legal-commentary/admin/import.php`: importa por URL oficial; `persist=false` gera preview, `persist=true` salva/sincroniza.
- `POST /legal-commentary/admin/save.php`: salva metadados, artigos e editorial.
- `POST /legal-commentary/admin/sync.php`: sincroniza uma lei ja cadastrada por `id`.
- `GET /legal-commentary/admin/updates.php?id=:id`: retorna `law`, `updates` e `syncLogs`.
- `POST /legal-commentary/admin/delete.php?id=:id`: remove lei do acervo.

## Contrato de saida compativel

A API mantem os campos atuais da UI (`LawSummary`, `LawArticle`, `TeacherComment`) e tambem expostos no formato mais proximo do produto:

```ts
AreaDireito[] -> leis[] -> artigos[]
```

Campos relevantes:

- `Lei`: `id`, `sigla`, `nome`, `numero`, `ano`, `descricao`, `ementa`, `totalArtigos`, `artigosComentados`, `urlPlanalto`, `artigos`.
- `Artigo`: `numero`, `titulo`, `texto`, `paragrafos`, `comentarios`, `jurisprudencia`, `sumulas`, `doutrina`, `macete`, `questoesRelacionadas`.

## Sincronizacao

A sincronizacao por lei:

1. usa a URL oficial salva;
2. baixa novamente o HTML;
3. extrai a estrutura atual;
4. compara hashes por artigo;
5. salva nova versao se houver mudanca;
6. marca artigos alterados recentemente;
7. cria eventos em `law_updates`;
8. sempre registra uma tentativa em `legal_sync_logs`;
9. em falha, registra `sync_errors` sem corromper a versao ativa.

## Editorial

O texto oficial fica separado do conteudo editorial. O admin pode enriquecer cada artigo com:

- comentario de professor;
- sumula;
- jurisprudencia;
- doutrina;
- macete;
- quantidade ou vinculo futuro de questoes relacionadas.

A IA gera apenas rascunhos editoriais. O fluxo exige revisao antes de salvar.
