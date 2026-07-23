# Capacidade e operacao para escala

## Estado desta entrega

Esta entrega conclui as partes que pertencem ao codigo e prepara os pontos que
dependem de infraestrutura externa. Ela nao transforma a VPS atual de 1 vCPU e
aproximadamente 4 GiB de RAM em uma plataforma para milhoes de usuarios ativos.

Implementado no codigo:

- conexao de leitura com fallback seguro para o primario;
- storage unico com drivers local e S3/R2;
- cursor keyset assinado nas bibliotecas pesadas de questoes, provas e leis;
- ingestao privada e outbox com claim concorrente, retry e dead-letter;
- contadores materializados de respostas;
- arquivamento retomavel de `user_answers`;
- sitemaps XML segmentados e materializados em disco;
- busca FULLTEXT e documentos de busca de questoes ja existentes no schema;
- unidades systemd parametrizadas para aumentar workers sem alterar codigo.

Dependencias externas ainda necessarias:

- contratar ou provisionar banco separado;
- criar uma replica MySQL e preencher `DB_READ_*`;
- criar bucket S3/R2 e preencher `OBJECT_STORAGE_*`;
- aumentar CPU, RAM e disco no provedor;
- adicionar CDN ao dominio publico do bucket.

## Ordem de implantacao

1. Gerar backup consistente do banco e dos uploads.
2. Ensaiar migrations em clone temporario do banco.
3. Aplicar `20260722_050000_async_events_and_answer_archive`.
4. Executar o backfill dos contadores em lotes pequenos.
5. Publicar o codigo.
6. Ativar um worker de ingestao e um worker de eventos na VPS atual.
7. Gerar os sitemaps e ativar o timer.
8. Rodar o arquivador primeiro em `--dry-run`.
9. Ativar o timer de arquivamento somente depois de conferir amostras.

## Banco separado e replica

O primario continua usando `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e
`DB_PASSWORD`. Consultas explicitamente marcadas como leitura usam:

```text
DB_READ_HOST
DB_READ_PORT
DB_READ_NAME
DB_READ_USER
DB_READ_PASSWORD
DB_READ_TIMEOUT_SECONDS
DB_READ_PERSISTENT
```

Sem `DB_READ_HOST`, a conexao de leitura cai deliberadamente no primario. Para
ativar uma replica, crie usuario somente leitura, teste atraso de replicacao e
adicione as variaveis acima. Escritas nunca usam essa conexao.

Rollback operacional: remova `DB_READ_HOST` e reinicie PHP-FPM. O codigo volta
ao primario sem deploy.

## Object storage e CDN

O driver local permanece como padrao. Para R2/S3:

```text
OBJECT_STORAGE_DRIVER=s3
OBJECT_STORAGE_ENDPOINT=https://...
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_BUCKET=...
OBJECT_STORAGE_ACCESS_KEY=...
OBJECT_STORAGE_SECRET_KEY=...
OBJECT_STORAGE_PUBLIC_BASE_URL=https://cdn.concursomestre.com
OBJECT_STORAGE_PATH_STYLE=true
```

Uploads novos de perfil, branding, imagens de questoes/contextos e arquivos de
provas passam pela mesma fronteira. Credenciais nunca devem entrar no Git.

Rollback operacional: volte `OBJECT_STORAGE_DRIVER=local`. Objetos gravados no
bucket durante a janela precisam ser sincronizados antes do rollback.

## Workers concorrentes

Instalacao das unidades:

```bash
sudo cp backend/ops/systemd/*.service backend/ops/systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now concursomestre-question-ingestion@1.service
sudo systemctl enable --now concursomestre-platform-events@1.service
sudo systemctl enable --now concursomestre-sitemap.timer
```

Na VPS atual, mantenha somente um slot de cada worker. Depois de ampliar CPU e
RAM, novos slots podem ser ligados com `@2`, `@3` etc. O claim usa
`FOR UPDATE SKIP LOCKED`, portanto os slots nao processam o mesmo item.

Operacao de dead-letter:

```bash
php backend/scripts/tasks/manage_platform_events.php --status
php backend/scripts/tasks/manage_platform_events.php --dead-letters --limit=25
php backend/scripts/tasks/manage_platform_events.php --requeue=123
```

## Sitemaps estaticos

O gerador grava arquivos atomicos em `backend/storage/sitemaps`. Inclua o
snippet `backend/scripts/seo/nginx-static-sitemaps.conf.example` no vhost e
execute:

```bash
php backend/scripts/seo/generate_static_sitemaps.php
sudo nginx -t && sudo systemctl reload nginx
```

O indice so e substituido depois de todos os segmentos terminarem. Em falha, o
ultimo conjunto valido continua servido.

## Arquivamento de respostas

Primeiro execute:

```bash
php backend/scripts/tasks/archive_user_answers.php --dry-run --days=730
```

Para aplicar um lote controlado:

```bash
php backend/scripts/tasks/archive_user_answers.php \
  --apply --days=730 --batch-size=1000 --max-batches=1
```

O script copia, verifica e somente entao remove do armazenamento quente, tudo
na mesma transacao. Historico e estatisticas consultam ativo + arquivo ou os
contadores materializados.

Rollback de dados de um lote:

```sql
START TRANSACTION;
INSERT IGNORE INTO user_answers (<colunas originais>)
SELECT <colunas originais>
FROM user_answers_archive
WHERE archive_batch_id = '<batch-id>';
DELETE FROM user_answers_archive WHERE archive_batch_id = '<batch-id>';
COMMIT;
```

## Limites de capacidade

O schema e os caminhos de leitura ficam aptos a um ensaio com milhoes de
questoes, mas producao nessa ordem de grandeza exige medir RPS e concorrencia em
infraestrutura equivalente a producao. Antes da carga definitiva:

- ensaiar 3 milhoes de questoes sinteticas;
- executar EXPLAIN nas consultas criticas;
- medir p95/p99 de API e banco;
- testar restauracao de backup;
- provisionar banco separado, replica, bucket/CDN e recursos de computacao;
- definir alertas para fila, dead-letter, atraso de replica, disco e conexoes.
