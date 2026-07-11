# Fase 04 - Questoes, provas, importacao e crawler

Data: 2026-07-11

## Escopo

Esta fase consolida o contrato `question-import.v2` para criacao manual e
importacao em massa. O contrato cobre questoes, alternativas, contextos,
assets, editoriais, filtros e publicacao, preservando a leitura do snapshot
legado durante a transicao.

Fora de escopo: Lei Comentada, financeiro, marketplace, performance ampla e
credenciais de provedores de IA.

## Migrations aplicadas em producao

Depois do backup completo e dos preflights, a VPS recebeu:

1. `20260711_010000_questions_import_canonical`
2. `20260711_010010_questions_exams_compatibility`
3. `20260711_010020_question_import_identity_constraints`

As tres migrations foram aplicadas sem apagar dados. O runner agora possui 22
registros, checksums conferidos e zero migrations pendentes.

Elas criam ou completam:

- `question_options`;
- `question_contexts` e `question_context_questions`;
- `question_assets`;
- `question_editorials`;
- `prova_extracao_itens`;
- tabelas de idempotencia e fila da ingestao privada;
- estruturas de compatibilidade para provas, cadernos, filtros e grupos.

As chaves unicas de identidade somente sao criadas depois de preflight de
duplicidade. Nenhum registro existente e removido ou escolhido
automaticamente em caso de conflito.

## Contrato e persistencia

`QuestionsValidator` aceita o contrato `question-import.v2`. A escrita
canonica exige schema pronto e persiste alternativas, assets, editoriais e
contextos nas tabelas normalizadas. `questions.data_json` permanece apenas
como snapshot de compatibilidade para a transicao.

Cada item importado usa savepoint proprio. Falhas aparecem em `itemFailures`
sem desfazer itens validos. Contextos sao vinculados por relacao N:N e os
itens de extracao sao auditados em `prova_extracao_itens`.

## Estatisticas

Distribuicao de alternativas, acertos e erros usam a mesma regra: todas as
tentativas persistidas. A fase nao altera a propriedade de favoritos e
anotacoes, que continuam vinculados ao usuario autenticado.

## Ingestao privada e crawler

O crawler HTTP publico legado permanece desativado. A ingestao privada esta
operacional na VPS com:

- cliente local `tools/local-question-crawler/ingest_client.py`;
- endpoint interno `backend/api/internal/questions/ingest.php`;
- fila `private_ingestion_requests` e `private_ingestion_jobs`;
- worker `backend/scripts/workers/process_question_ingestion_jobs.php`;
- cron por minuto, executado pelo usuario do site e protegido por `flock`.

O endpoint exige HTTPS, HMAC SHA-256, timestamp com janela curta, nonce de uso
unico e chave de idempotencia. Ele nao aceita cookies nem autenticacao de
usuario publico. O segredo foi configurado fora do repositorio e a copia local
do cliente possui ACL exclusiva do operador.

Validacoes executadas em producao:

- endpoint sem assinatura: `403`;
- endpoint com assinatura valida e contrato propositalmente invalido: `400`;
- worker manual: sucesso;
- cron ativo, com execucoes registradas e fila vazia;
- PHP-FPM e frontend ativos; health local da aplicacao: `200`.

Nenhuma questao ou prova de teste foi criada durante essas validacoes.

## Deploy e rollback

O frontend e os arquivos de runtime desta fase foram publicados apos backup
integral e validacao remota de `npm run typecheck` e `npm run build`. O
frontend respondeu `200` depois do restart controlado; PHP-FPM foi recarregado.

Rollback de aplicacao: restaurar o backup do frontend/backend ou retornar ao
commit anterior. As migrations sao aditivas; nao use rollback SQL destrutivo.
Para interromper novas entradas, desabilite o cron e o endpoint privado antes
de qualquer restauracao.

## Validacao executada

- `C:\\xampp\\php\\php.exe backend/tests/QuestionsPhase04WiringTest.php`
- `C:\\xampp\\php\\php.exe backend/tests/QuestionCanonicalContractValidatorTest.php`
- `C:\\xampp\\php\\php.exe backend/tests/PrivateQuestionIngestionWiringTest.php`
- `npm run typecheck`
- `npm run build`
- lint PHP dos arquivos modificados e das migrations.

## Pendencias deliberadas

- Nao houve backfill de snapshots legados para as tabelas canonicas. A leitura
  de compatibilidade permanece ativa ate existir plano, amostragem e rollback
  de dados.
- Nenhum payload real foi enfileirado para validar a publicacao de questoes;
  isso deve ocorrer primeiro em homologacao ou com lote editorial aprovado.
- O Python global deste workspace continua com o modulo padrao `encodings`
  indisponivel. Para nao depender dele, o mesmo cliente foi copiado apenas
  para validacao temporaria e passou em `python3 -m py_compile` na VPS; o
  arquivo temporario foi removido em seguida.
- Leituras normalizadas por questao podem exigir otimizacao de listas grandes;
  acompanhar na Fase 09 com metricas reais.

## Estado da fase

Fase concluida quanto a schema, contrato, deploy controlado e canal privado de
ingestao. Backfill e primeiro lote editorial permanecem passos operacionais,
nao bloqueios do contrato ou da infraestrutura.
