# Capacidade para carga inicial - 2026-07-22

## Veredito

A plataforma esta aprovada para carga controlada em lotes. Ela nao esta
aprovada para inserir tres milhoes de questoes de uma vez nem para receber
milhares de usuarios simultaneos na VPS atual.

O limite e de infraestrutura, nao mais de contrato: a VPS possui 1 vCPU,
3,8 GiB de RAM, 2 GiB de swap e aproximadamente 17 GiB livres. O banco deve
migrar para volume/servidor dedicado antes da etapa de milhoes.

## Escopo auditado

Foram auditados schema, indices e caminhos de leitura dos seguintes dominios:

- usuarios, sessoes, refresh tokens e verificacao de e-mail;
- questoes, alternativas, imagens, contextos, editoriais, filtros e busca;
- respostas, questoes salvas, anotacoes, sessoes de estudo e simulados;
- leis, versoes, artigos, blocos, comentarios, favoritos, progresso, notas,
  marcacoes e reacoes;
- comentarios da comunidade, likes, denuncias e moderacao;
- notificacoes e contagem de nao lidas;
- provas, cadernos, extracoes e fila privada de importacao;
- marketplace, materiais, avaliacoes e vendas;
- transacoes, ledger, assinaturas, webhooks e indicacoes;
- analytics, auditoria administrativa e relatorios.

## Correcoes materializadas

- Read model de questoes com ordenacao keyset e flags denormalizadas.
- Documento de busca `question_search_documents` com indice FULLTEXT.
- Resposta canonica por `selected_option_id` e idempotencia de resposta.
- Sigla, logo, aliases e hierarquia de filtros materializados.
- Indices keyset para comentarios, notificacoes, Lei Comentada, favoritos,
  sessoes, simulados, salvos, transacoes, materiais, relatorios e auditoria.
- Fila de importacao com reserva concorrente, retry, backoff e dead letter.
- Paginacao keyset e limites defensivos nos caminhos de comunidade,
  marketplace e moderacao.
- Remocao de N+1 em materiais e previews de denuncias.
- IDs de usuario normalizados nos joins quentes e FKs adicionadas onde os
  dados permitiram.
- Migration de reconciliacao para corrigir drift entre `schema_migrations` e
  DDL realmente existente.
- Backfill concluido: 12 questoes no read model e 19 respostas convertidas para
  alternativa canonica, sem correspondencias perdidas.

## Evidencias

- Backup verificado antes da alteracao:
  `/var/backups/concursomestre/mysql/concursomestre-20260722-172032.sql`.
- Migrations pendentes depois da aplicacao: 0.
- EXPLAIN: 15 de 15 consultas criticas sem full scan e sem filesort.
- Banco clone: migrations executadas duas vezes sem erro.
- Backend: 746 arquivos PHP validos e 151 testes aprovados.
- Frontend: 82 arquivos e 487 testes aprovados.
- TypeScript: aprovado.
- Build Next.js: aprovado.
- `npm audit`: 0 vulnerabilidades.
- Otimizacao de imagem com Sharp 0.35.3: HTTP 200.
- Readiness da API: banco, migrations, storage, runtime store e worker Stripe
  prontos.
- Release implantado em producao:
  `1.0.0-scale-readiness-79f62fc7261f-20260722204240`.
- Worker de ingestao executado manualmente e pelo cron sem erro; fila vazia no
  momento da verificacao.
- Ensaio isolado: 50.000 questoes e 250.000 alternativas inseridas em 16,389
  segundos, sem tocar na base de producao.
- Piloto HTTP com concorrencia 5: questoes 45,92 req/s (p95 148 ms),
  comentarios 45,23 req/s (p95 98 ms) e leis 13,28 req/s (p95 271 ms), todos
  sem falhas.
- Retencao de releases corrigida: cinco versoes preservadas e disco passou de
  31% para 57% livre, sem remover uploads, banco ou backups.

## Divida controlada

- 36 tabelas ainda usam `utf8mb4_0900_ai_ci`; os joins quentes auditados usam
  collation compativel. A conversao global deve ser ensaiada separadamente para
  detectar colisoes de unicidade.
- 52 campos historicos com nome de JSON permanecem em TEXT/LONGTEXT. Eles nao
  participam dos filtros criticos da carga inicial.
- Imagens devem permanecer no storage compartilhado/CDN; base64 nao deve ser
  mantido no banco depois da importacao.
- A VPS atual precisa de banco/volume maior e mais CPU antes da carga em escala
  de milhoes.
- No ensaio de 50 mil, filtros taxonomicos muito seletivos foram resolvidos
  pelo indice reverso, mas o MySQL aplicou filesort ao pequeno conjunto
  resultante. Isso nao bloqueia os lotes iniciais; antes de filtros com centenas
  de milhares de vinculos, adotar feed materializado por filtro ou mecanismo
  dedicado de busca/facetas.

## Plano de carga

1. Inserir 1.000 questoes e aguardar o processamento completo da fila.
2. Validar contagem, alternativas, filtros, contextos, editoriais e imagens.
3. Executar EXPLAIN, medir tamanho do banco e consultar slow query log.
4. Inserir 10.000 questoes em lotes de ate 250 por request.
5. Repetir validacoes e um teste leve de leitura concorrente.
6. Avancar para 50.000 somente se todos os gates permanecerem verdes.
7. Dimensionar armazenamento e banco dedicado com a taxa real de bytes por
   questao antes de planejar 100 mil, 1 milhao e 3 milhoes.

## Stop conditions

Interromper a carga quando ocorrer qualquer item:

- disco livre abaixo de 30%;
- swap acima de 50% por mais de 10 minutos;
- fila cresce continuamente por 15 minutos;
- jobs em dead letter;
- erro de FK, duplicidade nao idempotente ou perda de contexto/alternativa;
- p95 de leitura acima de 800 ms ou p95 de escrita acima de 1.500 ms;
- conexoes MySQL acima de 80% do limite;
- slow query nova sem indice;
- health/readiness diferente de HTTP 200.

## Rollback

- Codigo: repontar os symlinks para o release anterior.
- Banco: as migrations sao aditivas e permanecem compativeis com o release
  anterior.
- Dados: restaurar o backup verificado apenas se houver corrupcao comprovada.
- Carga: parar o produtor; os jobs pendentes permanecem retomaveis e os jobs
  falhos preservam o erro para reprocessamento.
