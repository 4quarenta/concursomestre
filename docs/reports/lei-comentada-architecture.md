# Lei Comentada - arquitetura normalizada

Atualizado em: `2026-05-25`

## Objetivo

O modulo de Lei Comentada deve funcionar como um acervo juridico estudavel, nao como uma lista simples de normas. A estrutura oficial do Planalto e importada, normalizada e enriquecida com comentarios, doutrina, jurisprudencia, sumulas, macetes, analise de capitulo, progresso e favoritos.

## Regra de taxonomia

A regra oficial do modulo e unica:

- **Lei:** possui `materia/disciplina` e `topico`.
- **Capitulo da lei:** pertence a uma lei, herda materia/topico e define `subtopico` quando houver Titulo na norma.
- **Artigo:** pertence a um capitulo e nao possui taxonomia independente. Ele herda materia/topico da lei, herda subtopico/estrutura da secao e recebe como `assunto` o nome do Capitulo da secao.
- Quando a lei nao possui Titulo, o capitulo pode ficar sem subtopico.
- Quando a lei nao possui Capitulo, os artigos ficam ligados diretamente ao topico da lei, sem criar assunto artificial.
- `PARTE`, `LIVRO`, `SECAO` e `SUBSECAO` sao contexto estrutural do Planalto, mas nao substituem a taxonomia principal usada pela plataforma.

## Banco de dados

Fonte de verdade:

- `laws`: dados da lei, URL oficial, materia e topico da lei.
- `law_sections`: capitulos/blocos de estudo da lei, com titulo, capitulo, intervalo de artigos, ordem, subtopico e assunto.
- `law_articles`: artigos vinculados por `section_id`, com numero, titulo interno, texto oficial, ordem e `assunto_filter_id` sincronizado a partir da secao/capitulo.
- `law_article_blocks`: caput, paragrafos, incisos, alineas, itens e notas oficiais separados do texto bruto.
- `law_section_editorials`: analise detalhada propria do capitulo por `section_id`.
- Tabelas editoriais por artigo: comentario do professor, sumula, doutrina, jurisprudencia e macete.

Nao usar mais como fonte de verdade:

- `hierarchy_json`.
- `section_key`.
- `subject_filter_id`/`topic_filter_id` em artigo.
- Fallbacks que inferem capitulos a partir de dados antigos.

## Importador Planalto

O parser deve:

1. Buscar HTML oficial apenas de hosts permitidos do Planalto.
2. Extrair metadados da lei, ementa completa e preambulo quando existir.
3. Classificar materia e topico da lei por regras conhecidas e heuristica segura.
4. Reconhecer `PARTE`, `LIVRO`, `TITULO`, `CAPITULO`, `SECAO` e `SUBSECAO`.
5. Agrupar a arvore de estudo por Titulo/Capitulo, priorizando Capitulo como bloco exibido ao aluno.
6. Separar cada artigo em blocos (`caput`, `paragraph`, `inciso`, `alinea`, `item`, `note`).
7. Preencher `law_sections` diretamente, sem depender de `hierarchy_json`.
8. Vincular cada artigo ao `section_id` do capitulo correspondente e sincronizar o assunto do artigo a partir do capitulo, nunca por campo manual solto.

Leis de regressao obrigatoria:

- Constituicao Federal.
- Codigo Penal.
- Codigo de Processo Penal.
- Codigo Civil.
- Lei Maria da Penha.
- Lei 9.784.
- Lei 9.455.
- Lei 13.869.

## Admin

A tela de add/edit Lei Comentada segue o padrao WordPress Admin:

- Box `Importar Lei do Planalto`.
- Box `Classificacao da Lei`, com apenas `Disciplina/Materia` e `Topico/Nome da lei`.
- Box `Estrutura da Lei`, com arvore de capitulos e artigos.
- Cada capitulo permite editar:
  - Nome exibido.
  - Subtopico.
  - Assunto.
  - Artigos pertencentes.
  - Analise detalhada propria.
- Cada artigo permite editar apenas dados proprios:
  - Numero.
  - Titulo interno.
  - Texto oficial.
  - Blocos legais.
  - Conteudos editoriais por artigo.
- A classificacao exibida no artigo e herdada: materia/topico da lei, subtopico da secao e assunto do capitulo.
- O painel lateral contem Publicar, Agendar, Atualizacoes da Lei e IA.

## Aluno

A pagina `/lei-comentada`:

- Lista leis por materia.
- Abre capitulos/artigos sem loader infinito.
- Usa favoritos por capitulo, nao pela lei inteira quando a acao estiver dentro da arvore.
- Mostra progresso de leitura por capitulo/artigo.

A pagina `/lei-comentada/[slug]`:

- Usa o mesmo formato normalizado do admin.
- Renderiza a leitura em modo foco, com toolbar funcional.
- Exibe comentarios de usuarios na aba `Comentarios`.
- Exibe conteudo legal na aba `Conteudo da lei`.
- Exibe questoes relacionadas pelos filtros do capitulo/artigo.
- Mostra `Analise detalhada` apenas quando existir `law_section_editorials` para o capitulo ativo.

## Validacoes atuais

Comandos usados nesta etapa:

- `npm run typecheck`
- `npm run check:text-encoding`
- `php -l` nos arquivos PHP do modulo.
- `validate-planalto-parser.php --only=CF88,LMP,ABUSO,TORTURA,CC,PA,CP,CPP`
- `validate-planalto-parser.php --save-check=PA`
- `validate-planalto-parser.php --save-check=CP`

Resultado local:

- Parser critico aprovado para as 8 leis-alvo.
- `save-check` aprovou importacao, salvamento, recarregamento e limpeza temporaria para Lei 9.784 e Codigo Penal.
- A validacao visual logada no navegador ficou bloqueada pela tela de login local, mas o fluxo de servico e persistencia passou.

## Pendencias de homologacao

- Validar visualmente o admin logado em `/admin/operation/lei-comentada/new/edit`.
- Reimportar as leis reais depois da migracao destrutiva/limpeza do formato antigo.
- Executar smoke de leitura do aluno com leis reimportadas.
- Rodar o parser completo sobre o catalogo ampliado quando o Planalto estiver estavel.
