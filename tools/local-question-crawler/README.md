# Coleta local e ingestao privada de questoes

O coletor roda somente na maquina controlada pela equipe. Ele nao envia cookies,
URLs de origem ou credenciais de terceiros para a plataforma. O unico artefato
aceito pela VPS e um JSON `question-import.v2` produzido e revisado localmente.

## Crawler Gran local

O crawler legado hospedado no backend continua desativado (`HTTP 410`). O novo
fluxo usa um Chrome local dedicado e captura uma requisicao que a propria sessao
autorizada realizou. Nao existe campo de bearer, captura de storage, bypass de
CAPTCHA ou credencial da Gran trafegando pelo ConcursoMestre.

Use somente em conteudo que sua conta esteja autorizada a acessar e respeite os
termos e limites do provedor.

1. Feche outras instancias do perfil dedicado, se houver.
2. Inicie uma coleta pequena:

```powershell
npm run crawler:gran -- --confirm-authorized-access --max-pages 1 --title "Lote inicial Gran"
```

3. No Chrome aberto pelo programa, faca login manualmente.
4. Abra a lista de questoes e aplique os filtros desejados.
5. Quando a lista carregar, o coletor reutiliza a requisicao somente em memoria,
   coleta a quantidade de paginas autorizada e fecha o Chrome.
6. Revise o JSON gravado em `.tmp/local-question-crawler/`.

Para ampliar um lote depois do teste:

```powershell
npm run crawler:gran -- --confirm-authorized-access --start-page 1 --max-pages 5 --per-page 20 --delay-ms 2000 --year 2024 --title "Gran 2024 - lote 01"
```

Protecoes operacionais:

- origem e endpoint da API possuem allowlist fixa;
- apenas requisicoes `GET` observadas no Chrome sao reutilizadas;
- credenciais ficam somente em memoria e nunca aparecem em logs ou JSON;
- o perfil do Chrome fica fora do repositorio, em `%LOCALAPPDATA%`;
- execucao inicial limitada a uma pagina;
- no maximo 50 itens por pagina e 100 paginas por execucao;
- intervalo minimo de um segundo;
- `401`, `403` e `429` interrompem a coleta;
- todas as questoes saem privadas, em rascunho e exigindo revisao.

Teste do mapper e das regras de seguranca:

```powershell
npm run test:crawler:gran
```

## Envio para a fila privada

Configure fora do repositorio:

```text
QUESTION_INGESTION_SECRET=<segredo longo e exclusivo>
QUESTION_INGESTION_CLIENT_KEY=local-crawler
QUESTION_INGESTION_ACTOR_ID=<id de um usuario administrador tecnico>
```

Envio local, somente depois da revisao:

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
