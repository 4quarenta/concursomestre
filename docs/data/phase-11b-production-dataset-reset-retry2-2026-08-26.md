# Macroetapa 11B - Reset real do dataset temporario em producao

## A. Resumo executivo

- Data UTC: 2026-08-26
- Run ID: `phase11b-retry2-20260826-012400`
- Branch: `1.0.0`
- Baseline: `fbb34f83f94bbda0792bd861c20d137916566a58`
- Policy: `RESET_POLICY_V2`
- Freeze: `SYSTEMD_RUNTIME_DROPIN_V1`
- Launch mode efetivo: `PRELAUNCH`
- Reset: `DATASET_RESET_EXECUTION_COMPLETED`
- Dataset: `TEST_DATASET_REMOVED`
- Systemd: `SYSTEMD_FREEZE_EXECUTION_PASS`
- Real-data load: `REAL_DATA_LOAD_EXECUTION_NOT_READY`

O reset autorizado foi executado em uma unica transacao apos backup, freeze, quiescencia e Evidence V2. As 113 tabelas RESETTABLE ficaram zeradas; os 12 snapshots PRESERVE permaneceram identicos. Foram removidos 335 assets de conteudo e preservados 4 itens permitidos. Os servicos voltaram com health 100% e HTTP 200.

O contrato preservou integralmente a tabela `users`: 6 contas permaneceram. Nao houve tentativa ad hoc de identificar e apagar contas nao-admin. Uma eventual reducao para uma unica conta administrativa exige politica separada, identity-aware e explicitamente auditada.

## B. Remediacao do blocker anterior

`capture_write_sentinel.php` passou a normalizar `SET time_zone = '-03:00'`, igual ao reset tool. O rehearsal representativo foi repetido e passou com P0=0/P1=0. Na producao, sentinela e manifesto convergiram para `aadf8b18a21e6bbb331077695d8afc33b09b8b4dd58347fd01d38b72055d6c9f`.

## RETRY_PREFLIGHT_MATRIX

| Gate | Actual | Result |
| --- | --- | --- |
| branch / HEAD | `1.0.0` / `fbb34f83...658` | PASS |
| PRELAUNCH | config ausente, fallback seguro | PASS |
| exclusive run | novo ID e lock | PASS |
| stale drop-ins/masks | 0/0 | PASS |
| rehearsal representativo | 15/15 attacks; Evidence V2; resume 12/12 | PASS |

## TARGET_RECONCILIATION_MATRIX

| Metric | Actual | Result |
| --- | ---: | --- |
| database | `concursomestre` | PASS |
| MySQL/Percona | 8.4.10-10 | PASS |
| tables | 125 | PASS |
| PRESERVE / RESETTABLE | 12 / 113 | PASS |
| UNKNOWN / overlap | 0 / 0 | PASS |
| FKs / cycles | 91 / 0 | PASS |
| structural fingerprint | `7e9904fc...6741` | PASS |

## FRESH_BACKUP_MATRIX

| Artifact | Size | SHA-256 | Result |
| --- | ---: | --- | --- |
| database dump | 6052691 bytes | `96f6ed720ea50acb02839987202f8a29aae882d16e4b8d281d1848cffbd2a2b0` | PASS |

O dump contem 125 `CREATE TABLE`, passou `gzip -t` e solicitou routines, triggers e events. Ficou em diretorio privado fora do Git e webroot.

## FRESH_ASSET_BACKUP_MATRIX

| Class | Files | Bytes | Result |
| --- | ---: | ---: | --- |
| CONTENT_RESET_ASSET | 335 | 91014083 | BACKED_UP_AND_RESTORE_VERIFIED |
| PRESERVE_ASSET | 2 | 402067 | BACKED_UP_AND_RESTORE_VERIFIED |
| PRESERVE_STATIC_CONTRACT | 2 | 703 | BACKED_UP_AND_RESTORE_VERIFIED |
| UNKNOWN | 0 | 0 | PASS |

Archive: 75900987 bytes; SHA-256 `0863a674b395b7b41ff0e6bdb4fcd8ecf8dba1351d2ff5ae720e5be56f56f772`.

## PRESERVE_SNAPSHOT_MATRIX

| Table | Before | After | Result |
| --- | ---: | ---: | --- |
| addresses | 2 | 2 | MATCH |
| admin_audit_logs | 1926 | 1926 | MATCH |
| bank_accounts | 0 | 0 | MATCH |
| cache_settings | 0 | 0 | MATCH |
| filter_types | 10 | 10 | MATCH |
| plans | 14 | 14 | MATCH |
| schema_audit_runs | 0 | 0 | MATCH |
| schema_backfill_runs | 1 | 1 | MATCH |
| schema_migrations | 62 | 62 | MATCH |
| security_ip_bans | 0 | 0 | MATCH |
| system_settings | 99 | 99 | MATCH |
| users | 6 | 6 | MATCH |

Todos os 12 digests, nao apenas contagens, permaneceram identicos.

## EXPECTED_COUNT_MATRIX

| Scope | Expected before | Direct affected | Final residue |
| --- | ---: | ---: | ---: |
| 113 RESETTABLE tables | 311519 | 311518 | 0 |

A diferenca de uma linha foi causada por FK cascade: `comments` tinha 4 linhas, mas o DELETE direto afetou 3 porque uma linha ja havia sido removida por cascata. O tooling verificou zero residuo antes do commit e o snapshot independente confirmou todas as 113 tabelas vazias.

## WRITER_INVENTORY_MATRIX

| Metric | Actual | Result |
| --- | ---: | --- |
| known writers | 25 | PASS |
| MUST_FREEZE | 20 | PASS |
| UNKNOWN | 0 | PASS |
| policy tables covered | 125/125 | PASS |
| inventory hash | `41ce3c2c...2a9` | MATCH |

## SYSTEMD_RUNTIME_DROPIN_MATRIX

| Check | Actual | Result |
| --- | --- | --- |
| drop-ins armed | 15/15 | PASS |
| RefuseManualStart | 15/15 | PASS |
| runtime masks | 0 | PASS |
| final stale drop-ins/masks | 0/0 | PASS |

## SYSTEMD_UNIT_STATE_MATRIX

| Phase | Active | Inactive | Result |
| --- | ---: | ---: | --- |
| frozen | 0 | 15 | PASS |
| resumed | 12 | 3 one-shot | PASS |

## TRIGGER_FREEZE_MATRIX

| Surface | Frozen | Resumed | Result |
| --- | --- | --- | --- |
| cron | yes | active | PASS |
| sitemap timer | yes | active | PASS |
| blog sitemap timer | yes | active | PASS |
| answer archive timer | yes | active | PASS |

## MYSQL_SESSION_MATRIX

| Check | Actual | Result |
| --- | ---: | --- |
| non-system sessions before evidence | 0 | PASS |
| reset session before authorization | 0 | PASS |
| unexpected SQL clients | 0 | PASS |

## QUIESCENCE_MATRIX

| Check | Actual | Result |
| --- | --- | --- |
| observation | 32 seconds | PASS |
| global before/after | identical | PASS |
| unexpected mutations | 0 | PASS |
| target fingerprint | manifest exact match | PASS |

## FREEZE_EVIDENCE_V2_MATRIX

| Gate | Result |
| --- | --- |
| signed state/run/host/boot | PASS |
| rehearsal hash | PASS |
| target binding | PASS |
| freshness/HMAC | PASS |
| validate-only writes | 0 |
| validate-only transaction | false |

## FINAL_PRE_DML_GUARD_MATRIX

| Guard | Result |
| --- | --- |
| backups and restore verification | PASS |
| manifest/counts/fingerprints | PASS |
| asset hash inventory | PASS |
| freeze/session/quiescence | PASS |
| Evidence V2 | PASS |
| P0/P1 | 0/0 |

## RESET_EXECUTION_MATRIX

| Metric | Actual | Result |
| --- | ---: | --- |
| policy | RESET_POLICY_V2 | EXECUTED |
| transaction | single committed transaction | PASS |
| direct affected rows | 311518 | PASS |
| logical pre-reset rows | 311519 | PASS_WITH_EXPLAINED_CASCADE |
| resettable residue | 0 | PASS |

## EXPECTED_ACTUAL_MATRIX

| Table scope | Expected final | Actual final | Result |
| --- | ---: | ---: | --- |
| 113 RESETTABLE | 0 | 0 | MATCH |
| 12 PRESERVE digests | unchanged | unchanged | MATCH |

## PRESERVE_POST_RESET_MATRIX

| Check | Actual | Result |
| --- | --- | --- |
| users | 6; digest unchanged | PASS |
| system settings | 99; digest unchanged | PASS |
| schema migrations | 62; digest unchanged | PASS |
| static contracts | unchanged | PASS |

## POST_RESET_RESIDUE_MATRIX

| Check | Actual | Result |
| --- | ---: | --- |
| resettable rows while frozen | 0 | PASS |
| resettable rows after resume/smoke | 0 | PASS |
| nonzero resettable tables | 0 | PASS |

## ASSET_RESET_MATRIX

| Check | Actual | Result |
| --- | ---: | --- |
| manifest revalidation before delete | 339/339 | PASS |
| content assets deleted | 335 | PASS |
| reset assets remaining | 0 | PASS |
| preserve assets/static contracts | 4 | PASS |
| unknown assets deleted | 0 | PASS |

## DB_INTEGRITY_MATRIX

| Check | Actual | Result |
| --- | --- | --- |
| table inventory | 125 | PASS |
| structural fingerprint | unchanged | PASS |
| preserve snapshots | exact match | PASS |
| critical `CHECK TABLE QUICK` | questions, filters, provas, users, settings, migrations OK | PASS |

## EMPTY_DATASET_SMOKE_MATRIX

| Route | HTTP | Result |
| --- | ---: | --- |
| `/` | 200 | PASS |
| `/questoes` | 200 | PASS |
| `/disciplinas` | 200 | PASS |
| `/provas` | 200 | PASS |
| `/concursos` | 200 | PASS |
| `/orgaos` | 200 | PASS |
| `/blog` | 200 | PASS |
| missing discipline detail | 404 | PASS |

`/materiais` e `/simulados` retornaram 404 porque o release implantado e anterior a essas familias, fato ja identificado antes do reset. Nao houve deploy nesta operacao e esses status nao foram causados por dados residuais.

## SYSTEMD_RESUME_MATRIX

| Check | Actual | Result |
| --- | --- | --- |
| signed state | `RESUMED` | PASS |
| original active units | 12/12 | PASS |
| one-shot units | 3 inactive | PASS |
| drop-ins removed | 15/15 | PASS |

## RESUME_HEALTH_MATRIX

| Check | Actual | Result |
| --- | --- | --- |
| manager health | 100% | PASS |
| listeners | 80, 443, 3000, 8010, 19000 | PASS |
| HTTPS | 200 | PASS |

## DUPLICATE_EFFECT_MATRIX

| Surface | Final rows | Result |
| --- | ---: | --- |
| platform event outbox | 0 | PASS |
| private ingestion jobs | 0 | PASS |
| private ingestion requests | 0 | PASS |
| provider webhook events | 0 | PASS |

## FINAL_SYSTEMD_CLEANUP_MATRIX

| Artifact | Actual | Result |
| --- | ---: | --- |
| runtime drop-ins | 0 | PASS |
| runtime masks | 0 | PASS |
| exclusive lock | absent | PASS |
| public HTTP | 200 | PASS |

## LOAD_BLOCKERS_MATRIX

| Blocker | State |
| --- | --- |
| real dataset sources/provenance | OPEN |
| BINARY REGEXP remediation | OPEN |
| pending production migrations/rehearsal | OPEN |
| controlled load plan | OPEN |
| real-data validation | OPEN |

## OPEN_REAL_DATA_GATES_MATRIX

| Gate group | State | Result |
| --- | --- | --- |
| temporary reset | COMPLETE | PASS |
| definitive source/provenance | OPEN | BLOCKER |
| load rehearsal | OPEN | BLOCKER |
| post-load validation | OPEN | BLOCKER |
| production/SEO GO | PRELAUNCH | SAFE |

## FINAL_SAFETY_MATRIX

| Assertion | Actual | Result |
| --- | --- | --- |
| wrong target | no | PASS |
| DML before guards | 0 | PASS |
| authorized reset DML only | yes | PASS |
| users/settings/migrations damaged | no | PASS |
| schema changed | no | PASS |
| unknown asset deleted | no | PASS |
| freeze bypass | no | PASS |
| stale operational state | 0 | PASS |
| P0_11B / P1_11B | 0 / 0 | PASS |

## C. Testes finais

| Gate | Result |
| --- | --- |
| rehearsal representativo | PASS, P0=0/P1=0 |
| PHP focused | 9/9 PASS |
| PHP lint | 11/11 PASS |
| Vitest completo | 154/154 files; 910/910 tests PASS |
| route types / typecheck | PASS |
| production build | PASS; 52/52 static pages |
| ESLint | 0 errors; 96 pre-existing warnings |
| launch validator | PASS |
| secret scan | PASS |
| encoding | PASS |
| `git diff --check` | PASS |

Os gates Node completos foram executados nesta mesma sessao antes da remediacao PHP; a mudanca posterior ficou restrita ao entrypoint PHP da sentinela e foi coberta novamente pelos gates PHP, lint, secret, encoding, launch e diff.

## D. Artefatos

- Operacao privada: `/root/concursomestre-ops/phase11b-retry2-20260826-012400`.
- Machine output ignorado: `.tmp/data/phase-11b-production-dataset-reset-retry2.json`.
- Nenhum dump, segredo, PII ou conteudo protegido foi versionado.
- Nenhum commit, push, deploy, migration ou carga real foi executado.

## E. Declaracoes finais

```text
baseline = fbb34f83f94bbda0792bd861c20d137916566a58
RESET_POLICY_V2 = EXECUTED
SYSTEMD_FREEZE_MECHANISM = SYSTEMD_RUNTIME_DROPIN_V1
production target = RESET_COMPLETED
production DB writes = YES_AUTHORIZED_11B_ONLY
direct affected rows = 311518
logical reset rows = 311519
production DELETE statements = 113
production TRUNCATE = 0
production UPDATE = 0
production INSERT = 0
production migrations applied = 0
asset deletes = 335_AUTHORIZED_CONTENT_ASSETS_ONLY
backfill writes = 0
test dataset removed = SIM
users removed = 0
users preserved = 6
settings unexpected changes = 0
schema preserved = SIM
migration history preserved = SIM
real dataset loaded = NAO
real dataset validated = NAO
effective launch mode = PRELAUNCH
production indexing activated = NAO
production sitemap published = NAO
search engines notified = NAO
platform production ready = NAO
CONCURSOMESTRE_PRODUCTION_GO = NAO
commit = NAO
push = NAO
deploy = NAO
```

## F. Vereditos

```text
DATASET_RESET_EXECUTION_COMPLETED
TEST_DATASET_REMOVED
SYSTEMD_FREEZE_EXECUTION_PASS
REAL_DATA_LOAD_EXECUTION_NOT_READY
```
