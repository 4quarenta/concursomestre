# Ingestao privada de questoes

O crawler roda somente na maquina controlada pela equipe. Ele nao envia cookies,
URLs de origem ou credenciais de terceiros para a plataforma. O unico artefato
aceito e um JSON `question-import.v2` ja extraido localmente.

Configure, fora do repositorio:

```text
QUESTION_INGESTION_SECRET=<segredo longo e exclusivo>
QUESTION_INGESTION_CLIENT_KEY=local-crawler
QUESTION_INGESTION_ACTOR_ID=<id de um usuario administrador tecnico>
```

Envio local:

```powershell
python tools/local-question-crawler/ingest_client.py exam.json https://concursomestre.com/api/internal/questions/ingest.php
```

Processamento na infraestrutura privada, por cron ou worker supervisionado:

```text
php backend/scripts/workers/process_question_ingestion_jobs.php 10
```

O endpoint exige HTTPS, assinatura HMAC SHA-256, timestamp com tolerancia de
cinco minutos, nonce de uso unico e chave de idempotencia. Nao o exponha por
proxy sem TLS e nao versione os valores de ambiente.
