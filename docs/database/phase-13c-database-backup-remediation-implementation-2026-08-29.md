# Macroetapa 13C - Implementação de remediação de banco e backup

Data: 2026-08-29
Modo: implementação local + rehearsal descartável, sem escrita em produção

## A. Veredito executivo

`MACROSTEP_13C_IMPLEMENTATION = READY` para os contratos e rehearsals locais.
`MACROSTEP_13_COMPLETED = NÃO`: o Production GO continua bloqueado por gates
operacionais externos. Acesso SSH administrativo não autenticou nesta execução;
por isso nenhuma nova leitura privilegiada de produção foi tentada ou inferida.

As evidências de produção citadas abaixo são as capturadas no relatório
13B-R1, complementadas pelo probe público não mutante do sitemap, que retornou
HTTP 503 com `X-Robots-Tag: noindex, nofollow`.

## B. Contexto aprovado

`MACROSTEP_13A_DATABASE_BACKUP_INTEGRITY_BASELINE = PASS`
`MACROSTEP_13B_R1_RESTORE_REHEARSAL = PASS`
`DB13A-P1-08 = CLOSED`

`MACROSTEP_12_MANUAL_EXTERNAL_GATES = DEFERRED`
`SECURITY_PRE_GO_BLOCKER = SIM`

## C. Mudanças implementadas

- `BackupArtifactPublisher`: diretório privado, arquivo privado, checksum,
  manifest e publicação no mesmo diretório após sincronização; substituição
  atômica separada para health state mutável.
- `backup_mysql.php`: dump em arquivo parcial privado, validação de marcador,
  SHA-256, sidecar obrigatório e manifest não secreto; nomes únicos e retenção
  de sidecars.
- Verificação/restauração: checksum e manifest obrigatórios; legado só passa
  com `--allow-legacy-manifest=REVIEWED_LEGACY_BACKUP`.
- `AssetBackupManager` e CLIs de snapshot/restore para rehearsal local de
  assets, com manifest, checksum e rejeição de caminhos inseguros.
- `DatasetResetPolicyV2`: classificação explícita das 18 tabelas antes não
  classificadas; 131 resetáveis, 127 estritas, 4 recreáveis runtime, 12
  preservadas e 1 infraestrutura mutável.
- `SchemaMigrationRunner --audit`: reconciliação de aliases legados, checksum,
  identidades, prefixos ambíguos, ordem histórica e SQL manual ignorado.
- Migration aditiva `20260829_120000_provas_slug_uniqueness.php`, com abort
  antes de alteração se houver colisão, e rollback restrito ao próprio índice.
- Contratos candidatos de PITR e principals least-privilege, sem credenciais,
  em `backend/ops/mysql/`.

## D. Matriz de P1

| ID | Escopo local | Resultado | Gate de produção |
| --- | --- | --- | --- |
| DB13A-P1-01 | proteção de artefato | parcial implementado | off-host, imutabilidade e KMS ainda não comprovados |
| DB13A-P1-02 | atomicidade/checksum/manifest | fechado localmente | validar rotina operacional no host |
| DB13A-P1-03 | PITR | rehearsal PASS | binlog/durabilidade/retention produtivos ainda não alterados |
| DB13A-P1-04 | least privilege | rehearsal PASS | conta de aplicação antiga e grants produtivos não alterados |
| DB13A-P1-05 | RESET_POLICY | fechado | rerun operacional pós-carga definitiva |
| DB13A-P1-06 | unicidade `provas.slug` | migration pronta e rehearsal PASS | não aplicada; exige censo/backup/staging |
| DB13A-P1-07 | metadata/legacy SQL | audit contract PASS | executar no host com acesso autorizado |
| DB13A-P1-09 | DR de assets/config/provider | parcial implementado | off-host, secrets escrow e estado externo ainda abertos |

Não foi criada a migration da tabela `users`; a constraint de `provas.slug`
está no bloco correto de `provas` no schema-base.

## E. Matrizes solicitadas

### STRICT_REPOPULATION_MATRIX

| Tabela | Rows do blocker | Primeira/última evidência | Causa comprovada | Política |
| --- | ---: | --- | --- | --- |
| `financial_ledger_entries` | 28 | 08:16:07 / 08:32:48 | 1:1 com transactions, `stripe_invoice_webhook` | `RESETTABLE_STRICT` |
| `notifications` | 56 | 08:16:10 / 08:32:51 | duas downstream por transaction | `RESETTABLE_STRICT` |
| `provider_webhook_events` | 3 | 08:15:33 / 08:16:07 | Stripe TEST, subscription + dois invoice events | `RESETTABLE_STRICT` |
| `transactions` | 28 | 08:16:07 / 08:32:48 | invoices/payment intents Stripe TEST | `RESETTABLE_STRICT` |
| `user_subscriptions` | 1 | 08:16:02 / 08:16:02 | sincronização da assinatura TEST | `RESETTABLE_STRICT` |

`STRICT_TOTAL_ROWS = 116`. A evidência consolidada do blocker identificou
`UNKNOWN_WRITERS = 0`: callback Stripe, worker, reconciliation, serviço de
subscriptions, ledger sync e notification producer. O root cause é Stripe TEST
reconciliado após o resume, agravado por dois agendamentos para a mesma
reconciliation. Nenhuma linha foi removida, alterada ou inserida nesta etapa.

### STRICT_WRITER_MATRIX

| Writer | Classe | Tabelas observadas | Situação |
| --- | --- | --- | --- |
| `stripe_webhook.php` | `EXTERNAL_CALLBACK`, inventariado | `provider_webhook_events` | conhecido |
| `process_stripe_webhook_jobs.php` | `BACKGROUND_JOB`, inventariado | subscription, transaction, ledger, notifications | conhecido |
| `reconcile_stripe_subscriptions.php` | `BACKGROUND_JOB`, misconfigurado | subscription, transaction, ledger, notifications | duplicado em dois schedules |
| `SubscriptionsService`/repository | serviço conhecido | quatro tabelas financeiras | conhecido |
| `FinancialLedger::syncTransactionById` | downstream conhecido | ledger | conhecido |
| notification producer | downstream conhecido | notifications | conhecido |

`UNKNOWN_WRITERS = 0` conforme a auditoria de blockers existente; a validação
operacional pós-remediação continua obrigatória antes de qualquer cleanup.

### BILLING_EVENT_TIMELINE_MATRIX

| Janela | Evento | Delta |
| --- | --- | ---: |
| 08:15 | schedules de reconciliation e worker ativos | início do ciclo |
| 08:15:33-08:16:07 | três webhooks Stripe TEST | webhook +3 |
| 08:16:02 | assinatura recriada/sincronizada | subscription +1 |
| 08:16:07-08:16:10 | primeiro conjunto financeiro | tx +1, ledger +1, notifications +2 |
| 08:30-08:32 | reconciliações duplicadas | tx +27, ledger +27, notifications +54 |

Somente métricas agregadas foram preservadas; payloads e PII não foram
registrados.

### PROVIDER_WEBHOOK_MATRIX

| Provider | Evento | Ambiente | Resultado |
| --- | --- | --- | --- |
| Stripe | `customer.subscription.updated` | TEST confirmado | processado |
| Stripe | `invoice.payment_succeeded` | TEST confirmado | processado |
| Stripe | `invoice.paid` | TEST confirmado | processado |

Não há payload integral, secret ou provider ID neste relatório.

### TRANSACTION_LEDGER_CORRELATION_MATRIX

| Medida | Resultado |
| --- | ---: |
| transactions | 28 |
| ledger entries | 28 |
| transactions com ledger | 28 |
| órfãos | 0 |
| cardinalidade observada | 1:1 |
| invoices/payment intents distintos | 28 / 28 |

### SUBSCRIPTION_MATRIX / NOTIFICATION_CAUSALITY_MATRIX

Uma assinatura Stripe TEST originou 28 transactions e 28 ledgers. As 56
notifications foram downstream: 28 finance e 28 marketplace, duas por
transaction. A policy permanece strict; nenhuma tabela foi promovida a runtime
recreatable.

### FREEZE_RESUME_MATRIX

| Fase | Evidência | Resultado |
| --- | --- | --- |
| reset | `113/113 RESETTABLE = 0` no relatório retry2 | PASS |
| freeze | writers sem repopulação durante reset | PASS |
| resume | cron/worker reativados | operacional |
| pós-resume | Stripe TEST recriou billing | FAIL strict steady-state |
| schedules | cron direto + wrapper para mesma reconciliation | duplicidade ativa |

### POLICY_RECOMMENDATION_MATRIX

Todas as cinco tabelas permanecem `RESETTABLE_STRICT`. O veredito de dados é
`STRICT_REPOPULATION_WRITER_REMEDIATION_REQUIRED`: consolidar o schedule,
bloquear reconciliação de estado Stripe TEST descartado, controlar retry/test
clock e provar delta zero antes de cleanup.

## F. Migration inventory/dependency/compatibility

| Migration | DDL/DML | Dependências | Rehearsal |
| --- | --- | --- | --- |
| `20260819_120000_canonical_contests.php` | seis tabelas novas, FKs RESTRICT, índices | `filters`, `provas` | PASS |
| `20260819_130000_public_simulations.php` | seis tabelas novas, FKs RESTRICT, índices | `contests`, `questions`, `provas`, `filters` | PASS |
| `20260821_120000_public_materials.php` | colunas/índices em `materials` + `material_aliases` | tabela `materials` | PASS |
| `20260829_120000_provas_slug_uniqueness.php` | índice unique; aborta antes de colisão | tabela `provas` | PASS |

As três primeiras são as migrations de feature já existentes no checkpoint;
a quarta é a migration nova da remediação 13C. Nenhuma faz backfill. A ordem
rehearsada é contests, public simulations, public materials e, por fim,
unicidade de provas. A alteração de materials é expand-first; a constraint de
slug pode abortar sem modificar rows e exige validação do dataset antes do
rollout.

`MIGRATION_INVENTORY_MATRIX`, `MIGRATION_DEPENDENCY_MATRIX`,
`MIGRATION_COMPATIBILITY_MATRIX`, `MIGRATION_REHEARSAL_MATRIX`,
`MIGRATION_ROLLBACK_MATRIX`, `SCHEMA_DIFF_MATRIX` e
`CHECKPOINT_SCHEMA_REQUIREMENT_MATRIX` estão representadas por esta tabela e
pelos testes da rehearsal. Rollbacks existentes são restritos às estruturas
criadas/alteradas pelas respectivas migrations; o rollback novo só remove
`uq_provas_slug`.

## G. Rehearsals

### PITR e least privilege

`run_phase13c_mysql84_rehearsal.sh` passou:

```text
PITR_REHEARSAL=PASS
PITR_BASELINE_POSITION=concursomestre-bin.000001:976
PITR_RESTORED_ROWS=2
LEAST_PRIVILEGE_DDL_DENIED=PASS
```

Foi usado MySQL Community 8.4.11 descartável, socket local, `--skip-networking`
e binlog ROW com `sync_binlog=1` e `innodb_flush_log_at_trx_commit=1`.

### Migrations

```text
applied = 20260819_120000, 20260819_130000, 20260821_120000, 20260829_120000
tables_checked = 13
slug_unique = true
```

### Reset steady-state

```text
engineVersion = 8.4.11
classifiedTables = 144
preserveTables = 12
strictResettableTables = 127
runtimeRecreatableTables = 4
unknownWriterRejected = true
strictRepopulationRejected = true
resetCompletionAfterRegression = PASS
```

### Assets e backup

`BackupArtifactPublisherTest`, `AssetBackupManagerTest` e `BackupMysqlWiringTest`
passaram. O publisher também foi testado em segunda escrita do health state.

## H. Production-readonly matrix

| Item | Resultado |
| --- | --- |
| SSH administrativo | tentativa read-only recusada por `Permission denied (publickey,password)` |
| sitemap público | HTTP 503; `X-Robots-Tag: noindex, nofollow` |
| produção DML/DDL/migration | 0 nesta execução |
| launch mode | permanece PRELAUNCH conforme evidência 13B-R1 |
| dataset real | não carregado |
| REAL_DATA_INSERTION_AUTHORIZED | NÃO |

O probe HTTP não enviou corpo nem alterou estado. Não houve tentativa de
contornar a autenticação SSH.

## I. Gates externos antes do Production GO

1. configurar e provar cópia off-host imutável, criptografia/KMS e escrow de
   segredos;
2. aplicar grants least-privilege em janela autorizada;
3. configurar durabilidade/PITR, retenção, alertas e teste de recovery no host;
4. executar censo e rehearsal da migration `provas.slug` com schema/dados
   produtivos atuais;
5. revisar migration metadata/legacy SQL com acesso operacional;
6. concluir CRUD/admin seguro e o rollout migration -> app.

`FINAL_PRODUCTION_GO_BLOCKERS`:

- configuração operacional de backup/PITR/off-host;
- grants produtivos e revisão de writers strict;
- rehearsal real da migration em staging compatível;
- rollout autorizado e observável.

## J. Segurança e não mutação

Nenhuma credencial foi adicionada. O secret scan oficial passou. Não foram
executados `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `TRUNCATE`, grants ou
migrations contra produção. As strings de DDL/DML em testes, migrations e
documentação são código de rehearsal/contrato, não execução produtiva.

## K. Testes finais

Passaram: PHP lint focado, `BackupMysqlWiringTest`, publisher, assets,
unicidade, auditoria do runner, RESET_POLICY, reset steady-state MySQL 8.4,
PITR/least privilege, rehearsal das migrations, `npm run typecheck`,
`npm run check:secrets`, `npm run check:text-encoding`, `git diff --check` e
shell syntax.

Vitest completo: 152 suites executadas, 898 testes aprovados; duas suítes de
SEO falharam por erro ESM pré-existente em
`@csstools/css-calc` carregado por `@asamuzakjp/css-color`. Não houve mudança
de dependências nesta etapa e a falha não toca os caminhos 13C; permanece um
gate de ambiente/CI a corrigir antes do GO.

## L. Estado final obrigatório

```text
CHECKPOINT_SHA = NOT_CREATED
DEPLOYED_SHA = 916e6254d9ff0ef678bd59cca2bc04b706cc6be2
STRICT_POSITIVE_TABLES = 5
STRICT_TOTAL_ROWS = 116
STRICT_REPOPULATION_ROOT_CAUSE = STRIPE_TEST_RECONCILIATION_AFTER_RESUME
UNKNOWN_WRITERS = 0
POLICY_ACTION = STRICT_REPOPULATION_WRITER_REMEDIATION_REQUIRED
PENDING_MIGRATIONS = 20260829_120000_provas_slug_uniqueness (candidate local)
MIGRATION_REHEARSAL = PRODUCTION_MIGRATION_REHEARSAL_READY

MACROSTEP_13C_IMPLEMENTATION = READY
MACROSTEP_13_COMPLETED = NÃO
MACROSTEP_12_MANUAL_EXTERNAL_GATES = DEFERRED
SECURITY_PRE_GO_BLOCKER = SIM

REAL_DATA_INSERTION_AUTHORIZED = NÃO
REAL_DATA_LOADED = NÃO
PRODUCTION_GO = NÃO

PRODUCTION_DML_EXECUTED_THIS_RUN = 0
PRODUCTION_DDL_EXECUTED_THIS_RUN = 0
PRODUCTION_MIGRATIONS_APPLIED_THIS_RUN = 0

COMMIT = NÃO
PUSH = NÃO
DEPLOY = NÃO

P0 = 0
P1 = production external gates remain open; no new local P1
PRODUCTION_WRITES = 0
REAL_DATA_INSERTION_AUTHORIZED = NÃO
```

`SAFE_TO_AUTHORIZE_PRODUCTION_MIGRATIONS = NÃO`
`SAFE_TO_CLEAN_STRICT_ROWS = NÃO`

### Próximo passo

Parar. Solicitar autorização separada somente depois de fechar os gates
externos, sem limpar strict rows, aplicar migration, fazer deploy, commit,
push ou Production GO nesta etapa.
