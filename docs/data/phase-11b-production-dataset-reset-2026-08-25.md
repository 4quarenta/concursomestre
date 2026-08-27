# Macroetapa 11B - Reset real do dataset temporario em producao

## A. Resumo executivo

- Data UTC: 2026-08-25
- Run ID: `phase11b-20260825-082737`
- Branch: `1.0.0`
- Baseline: `fbb34f83f94bbda0792bd861c20d137916566a58`
- Policy: `RESET_POLICY_V2`
- Launch mode efetivo: `PRELAUNCH`
- Resultado: `DATASET_RESET_EXECUTION_ABORTED_PRE_DML`
- Dataset: `TEST_DATASET_NOT_REMOVED`
- Load: `REAL_DATA_LOAD_EXECUTION_NOT_READY`

O alvo, schema, policy, contagens, backups e dry-run foram revalidados. A operacao abortou no primeiro passo do freeze porque o systemd de producao recusou a configuracao runtime de `RefuseManualStart`. A falha ocorreu antes de fechar ingressos, antes de gerar freeze evidence e antes do primeiro DML. O recovery foi executado e a aplicacao voltou com 12/12 units ativas e HTTP 200.

## B. Decisao critica

Classificacao: **Interromper**. Nao e seguro substituir o mecanismo ensaiado por mask, drop-in ou outra tecnica diretamente na mesma janela. A alternativa deve ser implementada, auditada e ensaiada de forma representativa antes de uma nova tentativa, que exigira novos backups e snapshots.

## C. Evidencia principal

| Evidencia | Resultado |
| --- | --- |
| production target | identificado e reconciliado |
| MySQL | 8.4.10-10 |
| tabelas | 125 |
| PRESERVE | 12 |
| RESETTABLE | 113 |
| UNKNOWN / overlap | 0 / 0 |
| FKs / cycles | 91 / 0 |
| writer inventory hash | `41ce3c2ca0cfdfc0ceed5081845491810d9f60fcc77f52bcf0da98476a8024a9` |
| expected reset rows | 311518 |
| dry-run writes | 0 |
| DB backup | PASS, 125 tables, checksum valid |
| asset backup | PASS, 339 files, restore verified |
| pre-DML blocker | `SYSTEMD_REFUSE_MANUAL_START_RUNTIME_PROPERTY_UNSUPPORTED` |
| reset tool `--execute` invocations | 0 |
| DELETE statements | 0 |

Os artefatos privados usam identificadores seguros. Nenhuma credencial, host, PII, row dump ou conteudo protegido foi versionado.

## D. PRODUCTION_TARGET_MATRIX

| Gate | Expected | Actual | Result |
| --- | --- | --- | --- |
| environment | PRODUCTION | PRODUCTION | PASS |
| database | approved schema | `concursomestre` | PASS |
| engine | MySQL 8.4 | 8.4.10-10 | PASS |
| schema fingerprint | approved/current | `7e9904fc...6741` | PASS |
| launch mode | PRELAUNCH | PRELAUNCH | PASS |

## E. PREFLIGHT_MATRIX

| Gate | Actual | Result |
| --- | --- | --- |
| branch / HEAD | expected / expected | PASS |
| worktree | Macroetapa 11 changes only | PASS |
| P0_RESET / P1_RESET before window | 0 / 0 | PASS |
| policy validation | true | PASS |
| exclusive run lock | acquired, later released | PASS |
| secret handling | private operation env, removed after abort | PASS |

## F. TABLE_RECONCILIATION_MATRIX

| Metric | Expected | Actual | Result |
| --- | ---: | ---: | --- |
| tables | 125 | 125 | PASS |
| preserve | 12 | 12 | PASS |
| resettable | 113 | 113 | PASS |
| unknown | 0 | 0 | PASS |
| preserve/reset overlap | 0 | 0 | PASS |

## G. PRESERVE_MATRIX

| Surface | Before | After abort | Result |
| --- | ---: | ---: | --- |
| users | 6 | 6 | MATCH |
| system_settings | 99 | 99 | MATCH |
| schema_migrations | 62 | 62 | MATCH |
| all 12 preserve digests | captured | identical | MATCH |

## H. RESET_EXECUTION_MATRIX

| Step | State | Writes |
| --- | --- | ---: |
| dry-run | PASS | 0 |
| freeze | ABORTED at RefuseManualStart gate | 0 |
| freeze evidence | NOT_EXECUTED | 0 |
| validate evidence | NOT_EXECUTED | 0 |
| reset `--execute` | NOT_EXECUTED | 0 |

## I. EXPECTED_ACTUAL_COUNT_MATRIX

| Scope | Expected pre-reset | Actual deleted | Result |
| --- | ---: | ---: | --- |
| 113 resettable tables | 311518 | 0 | NOT_EXECUTED |

O detalhe das 113 contagens esta em `.tmp/data/phase-11b-reset-expected-counts.json`. As contagens antes e depois do aborto permaneceram identicas.

## J. FK_EXECUTION_MATRIX

| Gate | Actual | Result |
| --- | --- | --- |
| FK count | 91 | PASS |
| cycles | 0 | PASS |
| preserved child dependencies | 0 | PASS |
| ordered DELETE | not reached | NOT_EXECUTED |
| `FOREIGN_KEY_CHECKS=0` | not used | PASS |

## K. FRESH_BACKUP_MATRIX

| Artifact | Size | Verification | Result |
| --- | ---: | --- | --- |
| database dump | 6052670 bytes | gzip valid, SHA-256, 125 CREATE TABLE | PASS |
| restore path | representative MySQL 8.4 rehearsal already approved | tooling compatible | PASS |

Safe identifier: `phase11b/database.sql.gz`. The private path is outside Git and webroot.

## L. FRESH_ASSET_BACKUP_MATRIX

| Class | Files | Bytes | Result |
| --- | ---: | ---: | --- |
| CONTENT_RESET_ASSET | 335 | 91014083 | BACKED_UP |
| PRESERVE_ASSET | 2 | 402067 | BACKED_UP |
| PRESERVE_STATIC_CONTRACT | 2 | 703 | BACKED_UP |
| UNKNOWN | 0 | 0 | PASS |

Archive: 75871452 bytes, SHA-256 valid, extraction and all 339 file checksums verified. No asset was deleted.

## M. USER_SNAPSHOT_MATRIX

| Metric | Before | After abort | Delta |
| --- | ---: | ---: | ---: |
| users rows | 6 | 6 | 0 |
| safe aggregate fingerprint | captured | equal | 0 |
| users removed | 0 | 0 | 0 |

## N. SETTINGS_SNAPSHOT_MATRIX

| Metric | Before | After abort | Result |
| --- | ---: | ---: | --- |
| settings rows | 99 | 99 | MATCH |
| safe aggregate fingerprint | captured | equal | MATCH |
| unexpected changes | 0 | 0 | PASS |

## O. FREEZE_EXECUTION_MATRIX

| Order | Step | Result |
| ---: | --- | --- |
| 1 | record 12 service/timer states | PASS |
| 2 | require runtime RefuseManualStart | FAIL |
| 3 | close nginx ingress | NOT_EXECUTED |
| 4 | stop schedules/writers | NOT_EXECUTED |
| 5 | capture quiescence | NOT_EXECUTED |
| 6 | recovery/resume | PASS |

Exact failure: `Cannot set property RefuseManualStart, or unknown property.` The failure was returned for the first unit, before any stop command.

## P. MYSQL_SESSION_MATRIX

| Check | Result |
| --- | --- |
| post-freeze TCP sessions | NOT_EXECUTED |
| post-freeze Unix socket sessions | NOT_EXECUTED |
| reset SQL client | NOT_STARTED |

The session gate was not bypassed; the operation stopped earlier.

## Q. QUIESCENCE_MATRIX

| Check | Result |
| --- | --- |
| ingress blocked | NOT_EXECUTED |
| 20/20 writers frozen | NOT_EXECUTED |
| two stable sentinels | NOT_EXECUTED |
| unexpected writes during freeze | NOT_EVALUATED |

## R. FREEZE_EVIDENCE_MATRIX

| Check | Result |
| --- | --- |
| fresh production HMAC evidence | NOT_CREATED |
| target/host/run binding | NOT_EXECUTED |
| evidence validation | NOT_EXECUTED |
| evidence file after abort | absent |

## S. PRE_DML_GUARD_MATRIX

| Guard | Result |
| --- | --- |
| backup/checksum | PASS |
| asset backup/restore | PASS |
| manifest/counts | PASS |
| writer hash | PASS |
| RefuseManualStart | FAIL |
| final fingerprint | NOT_EXECUTED |
| destructive token release | NOT_EXECUTED |

## T. TABLE_RESET_RESULT_MATRIX

| Tables | Operation | Result |
| ---: | --- | --- |
| 113 | DELETE | NOT_EXECUTED_PRE_DML_ABORT |

## U. PRESERVE_INTEGRITY_MATRIX

| Check | Result |
| --- | --- |
| schema fingerprint before/after abort | MATCH |
| all table counts before/after abort | MATCH |
| 12 preserve snapshots before/after abort | MATCH |
| preserve writes by reset tool | 0 |

## V. POST_RESET_RESIDUE_MATRIX

| Check | Result |
| --- | --- |
| resettable residue | NOT_EXECUTED |
| dataset empty | NO |
| test dataset removed | NO |

## W. ASSET_RESET_MATRIX

| Check | Result |
| --- | --- |
| approved backup | PASS |
| resettable assets deleted | 0 |
| preserve assets changed | 0 |
| unknown assets deleted | 0 |

## X. EMPTY_DATASET_SMOKE_MATRIX

| Check | Result |
| --- | --- |
| empty hubs | NOT_EXECUTED |
| detail hard 404 | NOT_EXECUTED |
| unexpected 5xx | NOT_EVALUATED |

## Y. POST_RESET_DB_INTEGRITY_MATRIX

| Check | Result |
| --- | --- |
| post-reset integrity | NOT_EXECUTED |
| post-abort schema/policy | PASS |
| post-abort migrations | MATCH |

## Z. RESUME_MATRIX

| Component | Initial | Final | Result |
| --- | --- | --- | --- |
| nginx ingress | active | active | PASS |
| PHP-FPM | active | active | PASS |
| frontend | active | active | PASS |
| platform worker | active | active | PASS |
| ingestion workers | active | active | PASS |
| extractor | active | active | PASS |
| timers/cron | active | active | PASS |

## AA. RESUME_HEALTH_MATRIX

| Check | Actual | Result |
| --- | --- | --- |
| required units | 12/12 active | PASS |
| expected listeners | 80, 443, 3000, 8010, 19000 | PASS |
| application home | HTTP 200 | PASS |
| temporary RefuseManualStart | 0 units | PASS |
| exclusive lock | released | PASS |

## AB. DUPLICATE_PROCESSING_MATRIX

| Check | Result |
| --- | --- |
| reset-generated jobs | 0 |
| reset-generated imports | 0 |
| reset-generated outbox effects | 0 |
| provider redelivery window | no maintenance ingress outage occurred |

## AC. LOAD_BLOCKERS_MATRIX

| Blocker | Reset impact | Load impact |
| --- | --- | --- |
| `SYSTEMD_REFUSE_MANUAL_START_RUNTIME_PROPERTY_UNSUPPORTED` | BLOCKER | n/a |
| 27 BINARY REGEXP occurrences | none | BLOCKER |
| definitive sources | none | BLOCKER |
| rights/provenance | none | BLOCKER |
| 3 production migrations | none | BLOCKER |
| real-data gates | none | BLOCKER |

## AD. OPEN_REAL_DATA_GATES_MATRIX

| Gates | State | Reset impact | Load impact |
| ---: | --- | --- | --- |
| 20 | OPEN | none | BLOCKER |

## AE. FINAL_SAFETY_MATRIX

| Assertion | Actual | Result |
| --- | --- | --- |
| wrong target | no | PASS |
| DML before guards | 0 | PASS |
| legacy reset executed | no | PASS |
| migration applied | no | PASS |
| backup failure ignored | no | PASS |
| freeze failure ignored | no | PASS |
| recovery after abort | complete | PASS |
| P0_11B | 0 | PASS |
| P1_11B | 1 | BLOCKER |

## AF. Regressao e operacao

O codigo de aplicacao nao foi alterado pela tentativa. O reset tool nao entrou em modo execute. O post-abort dry-run executou zero writes e confirmou 125 tabelas, policy valida, fingerprints preservados e contagens identicas.

| Gate | Result |
| --- | --- |
| PHP focused | 9/9 PASS |
| PHP lint | 16/16 PASS |
| Vitest | 154/154 files, 910/910 tests PASS |
| typecheck / route types | PASS |
| production build | PASS |
| ESLint | 0 errors, 96 pre-existing warnings |
| launch validator | PASS |
| secret scan | PASS |
| encoding | PASS |
| `git diff --check` | PASS |

O Vitest foi inicialmente chamado pelo Node local 20.12.2, abaixo do minimo `>=20.19.0`, e duas suites nao carregaram uma dependencia ESM. A repeticao autoritativa com o Node empacotado 24.19.0 passou integralmente. O lint ignorou explicitamente `.tmp/**`, que contem bundles historicos gerados e havia causado varredura sem progresso util.

## AG. Blocker e remediacao exigida

Antes de repetir 11B:

1. Definir uma supressao de start compativel com o systemd real, sem depender de `systemctl set-property RefuseManualStart=yes`.
2. Implementar a alternativa como tooling auditavel e fail-closed.
3. Repetir o rehearsal representativo completo, incluindo falha e resume.
4. Executar nova auditoria independente do freeze.
5. Iniciar uma nova run 11B com run ID, backups, snapshots, contagens e HMAC novos.

Nao e aceitavel reutilizar os manifests ou backups desta tentativa como autorizacao destrutiva futura.

## AH. Declaracoes finais

```text
RESET_POLICY_V2 = NOT_EXECUTED
production target = IDENTIFIED_NOT_RESET
production DB writes = 0
production DELETE = 0
production TRUNCATE = 0
production UPDATE = 0
production INSERT = 0
production migrations applied = 0
asset deletes = 0
backfill writes = 0
test dataset removed = NÃO
users removed = 0
settings unexpected changes = 0
schema preserved = SIM
migration history preserved = SIM
real dataset loaded = NÃO
real dataset validated = NÃO
effective launch mode = PRELAUNCH
production indexing activated = NÃO
production sitemap published = NÃO
search engines notified = NÃO
platform production ready = NÃO
CONCURSOMESTRE_PRODUCTION_GO = NÃO
commit = NÃO
push realizado = NÃO
deploy realizado = NÃO
```

## AI. Vereditos

```text
DATASET_RESET_EXECUTION_ABORTED_PRE_DML
TEST_DATASET_NOT_REMOVED
REAL_DATA_LOAD_EXECUTION_NOT_READY
```
