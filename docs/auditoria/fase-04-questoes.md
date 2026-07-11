# Fase 04 - Questoes, provas, importacao e crawler

Data: 2026-07-11

## Escopo

Esta fase consolida o contrato `question-import.v2` para criacao manual e importacao em massa. O objetivo e manter questoes, alternativas, contextos, assets e editoriais em estruturas normalizadas, sem remover a leitura do snapshot legado durante a transicao.

Fora de escopo: Lei Comentada, financeiro, marketplace, performance ampla e mudancas de credenciais de IA.

## Diagnostico confirmado

- A persistencia de questoes dependia de JSON legado e de DDL em tempo de requisicao em alguns repositorios.
- A importacao precisava isolar falhas por item e rejeitar contratos sem versao conhecida.
- O crawler HTTP publico legado ja estava desativado e deve permanecer assim.
- As estatisticas misturavam contagem por ultima resposta com contagem de todas as tentativas, produzindo numeros inconsistentes.

## Implementacao

### Migrations aditivas

Foram criadas as migrations:

1. `20260711_010000_questions_import_canonical.php`
2. `20260711_010010_questions_exams_compatibility.php`
3. `20260711_010020_question_import_identity_constraints.php`

Elas criam ou completam, sem apagar dados, as estruturas:

- `question_options`;
- `question_contexts` e `question_context_questions` para relacao N:N;
- `question_assets` para enunciado, apoio, alternativa e contexto;
- `question_editorials` para comentario do professor e analise detalhada;
- `prova_extracao_itens` para auditoria de importacao;
- tabelas de idempotencia e fila da ingestao privada;
- tabelas e colunas de compatibilidade de provas, cadernos, filtros e grupos.

A migration de identidade cria chaves unicas somente quando nao existirem duplicatas preexistentes. Se houver duplicidade, ela falha de forma segura e exige conciliacao manual: nao remove nem escolhe registros automaticamente.

### Contrato e compatibilidade

`QuestionsValidator` aceita e preserva o contrato `question-import.v2`, incluindo `source`, `content`, `assets`, `filters`, `alternatives`, `answer`, `editorial`, `publication` e `review`.

O payload manual e o lote importado usam o mesmo contrato. `questions.data_json` continua apenas como snapshot legado e leitura de compatibilidade. Depois de aplicadas as migrations, alternativas, assets, editoriais e contextos sao persistidos nas tabelas normalizadas.

Compatibilidade durante rollout:

- Leitura: agrega tabelas normalizadas quando disponiveis; do contrario, usa o snapshot legado.
- Escrita canonica: exige schema pronto. Nao ha fallback silencioso para JSON quando a migration estiver faltando.
- Filtros legados continuam alimentados para que telas existentes nao percam comportamento durante a transicao.

### Importacao em massa

- O lote exige `schemaVersion: question-import.v2`.
- Cada questao usa um savepoint proprio: falha de um item e registrada em `itemFailures`, sem desfazer os itens validos do lote.
- Contextos sao gravados em formato canonico e vinculados N:N pelas questoes indicadas no contrato.
- Itens importados sao auditados em `prova_extracao_itens`.
- A identidade de origem usa fingerprint e, quando existir, o par `source_exam_key/source_question_number`.

### Estatisticas e sinais do aluno

A politica adotada para a distribuicao da questao e **todas as tentativas persistidas**. As consultas de alternativas, acertos e erros agora usam a mesma regra; nao misturam ultima tentativa por usuario com o total de votos.

Favoritos e anotacoes continuam identificados pelo usuario autenticado nos servicos existentes. A Fase 4 nao remove nem torna globais esses dados.

### Crawler e ingestao privada

O crawler publico legado continua encerrado. Foi adicionado o canal privado:

- cliente local: `tools/local-question-crawler/ingest_client.py`;
- endpoint interno: `backend/api/internal/questions/ingest.php`;
- fila: `private_ingestion_requests`, `private_ingestion_jobs`;
- worker: `backend/scripts/workers/process_question_ingestion_jobs.php`.

O endpoint exige HTTPS, HMAC SHA-256, timestamp com janela de cinco minutos, nonce de uso unico e chave de idempotencia. Nao aceita cookies nem autentica como usuario publico. O segredo fica somente em `QUESTION_INGESTION_SECRET`; o cliente envia `X-Question-Ingest-Key`, timestamp, nonce, assinatura e `Idempotency-Key`.

Comando sugerido para o cron apos configurar variaveis de ambiente:

```bash
/usr/bin/php /var/www/concursomestre/backend/scripts/workers/process_question_ingestion_jobs.php --limit=25
```

## Rollout e rollback

1. Fazer backup do banco e confirmar a versao atual da aplicacao.
2. Aplicar as tres migrations em ambiente de homologacao.
3. Executar importacao pequena com `question-import.v2` e validar leitura, assets, contextos, editoriais e filtros.
4. Configurar as variaveis da ingestao privada e executar o worker manualmente antes de agendar o cron.
5. Liberar em producao com monitoramento de `itemFailures` e jobs falhos.

Rollback da aplicacao: reverter para o commit anterior. As migrations sao aditivas e nao removem dados; nao ha rollback SQL automatico destrutivo nesta fase. Desabilite o cron e o endpoint privado se for necessario interromper novas entradas. O snapshot `data_json` permite que a versao anterior continue lendo questoes existentes.

## Validacao executada

- `C:\\xampp\\php\\php.exe backend/tests/QuestionsPhase04WiringTest.php`
- `C:\\xampp\\php\\php.exe backend/tests/QuestionCanonicalContractValidatorTest.php`
- `C:\\xampp\\php\\php.exe backend/tests/PrivateQuestionIngestionWiringTest.php`
- `npm run typecheck`
- `npm run build`
- lint PHP dos arquivos modificados e das migrations.

## Limitacoes e acompanhamento

- As migrations nao foram aplicadas localmente porque o MySQL local nao estava disponivel. Nenhum schema de producao foi alterado nesta fase.
- Nao foi executado backfill de snapshots legados para as novas tabelas. A leitura de compatibilidade permanece ativa ate que haja plano de migracao e validacao em banco real.
- O worker privado nao foi agendado nem recebeu segredos nesta fase.
- A verificacao `py_compile` do cliente local ficou bloqueada por uma falha da
  instalacao local do Python: o modulo padrao `encodings` esta indisponivel.
  Os testes PHP de wiring cobrem o contrato do cliente e do endpoint; a
  validacao Python deve ser repetida em um runtime funcional antes do cron.
- A leitura normalizada por questao pode gerar consultas adicionais em listas grandes; essa otimizacao deve ser tratada na Fase 9, apos metricas reais.
- Alias e fusao de taxonomias exigem a estrutura `filter_aliases` da Fase 3 e continuam fora do escopo desta fase.
