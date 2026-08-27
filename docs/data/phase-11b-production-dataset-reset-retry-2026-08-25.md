# Macroetapa 11B - Retry do reset real do dataset temporario em producao

## A. Resumo executivo

- Data UTC: 2026-08-25
- Run ID: `phase11b-retry-20260825-225208`
- Branch: `1.0.0`
- Baseline: `fbb34f83f94bbda0792bd861c20d137916566a58`
- Policy: `RESET_POLICY_V2`
- Freeze mechanism: `SYSTEMD_RUNTIME_DROPIN_V1`
- Launch mode efetivo: `PRELAUNCH`
- Resultado: `DATASET_RESET_EXECUTION_ABORTED_PRE_DML`
- Dataset: `TEST_DATASET_NOT_REMOVED`
- Systemd: `SYSTEMD_FREEZE_EXECUTION_PASS`
- Load: `REAL_DATA_LOAD_EXECUTION_NOT_READY`

O retry reconciliou o alvo, gerou backups novos, congelou os writers de producao e comprovou 32 segundos de quiescencia. A Evidence V2 foi recusada antes do primeiro DML porque a sentinela capturou o snapshot com timezone de sessao `SYSTEM/+00:00`, enquanto o manifesto e o reset tool usam `-03:00`. O dataset era o mesmo, mas o fingerprint temporal ficou diferente. O procedimento fail-closed foi respeitado: o modo `--execute` nao foi invocado, nenhum asset foi apagado e os servicos foram restaurados.

Classificacao: **Interromper**. O gate precisa ser corrigido e ensaiado antes de outra tentativa. Nao e seguro contornar o binding nem reemitir evidencias ad hoc durante uma janela destrutiva real.

## B. Blocker exato

```text
OBSERVED_TARGET_FINGERPRINT_MISMATCH
sentinel target fingerprint (SYSTEM/+00:00) = 77604855c2496146c57e0ada5e705cfec08676b4bfe5e021147f58b09203e811
manifest/reset target fingerprint (-03:00) = aadf8b18a21e6bbb331077695d8afc33b09b8b4dd58347fd01d38b72055d6c9f
```

Uma verificacao read-only controlada reproduziu a causa:

| Session timezone | Snapshot fingerprint |
| --- | --- |
| `SYSTEM` | `77604855c2496146c57e0ada5e705cfec08676b4bfe5e021147f58b09203e811` |
| `+00:00` | `77604855c2496146c57e0ada5e705cfec08676b4bfe5e021147f58b09203e811` |
| `-03:00` | `aadf8b18a21e6bbb331077695d8afc33b09b8b4dd58347fd01d38b72055d6c9f` |

O structural fingerprint permaneceu `7e9904fc21bfa27ec5fe108f5ba6c0e594bf677fed9a509425beb77043656741` nas tres sessoes. O dry-run congelado, que aplica `-03:00`, continuou pronto, com o fingerprint do manifesto e 311519 linhas planejadas. Logo, nao houve drift do dataset; houve inconsistencia de normalizacao temporal entre dois componentes do gate.

## RETRY_PREFLIGHT_MATRIX

| Gate | Expected | Actual | Result |
| --- | --- | --- | --- |
| branch | `1.0.0` | `1.0.0` | PASS |
| HEAD | baseline aprovada | `fbb34f83f94bbda0792bd861c20d137916566a58` | PASS |
| launch mode | PRELAUNCH | config ausente, fallback PRELAUNCH | PASS |
| new run ID | obrigatorio | `phase11b-retry-20260825-225208` | PASS |
| exclusive lock | novo e privado | adquirido e liberado | PASS |
| production DML before guards | 0 | 0 | PASS |

## TARGET_RECONCILIATION_MATRIX

| Metric | Actual | Result |
| --- | ---: | --- |
| database | `concursomestre` | PASS |
| engine | MySQL/Percona 8.4.10-10 | PASS |
| tables | 125 | PASS |
| PRESERVE | 12 | PASS |
| RESETTABLE | 113 | PASS |
| UNKNOWN / overlap | 0 / 0 | PASS |
| foreign keys / cycles | 91 / 0 | PASS |
| structural fingerprint | `7e9904fc...6741` | PASS |

## FRESH_BACKUP_MATRIX

| Artifact | Size | SHA-256 | Verification | Result |
| --- | ---: | --- | --- | --- |
| database dump | 6052830 bytes | `4c537abaf3528c93b54e85d3054495c216a40b83261c4acb16d15b02a07e2780` | gzip valid; 125-table dump | PASS |

O backup esta em diretorio privado fora do Git e do webroot. Nenhuma credencial ou dump foi versionado.

## FRESH_ASSET_BACKUP_MATRIX

| Class | Files | Bytes | Result |
| --- | ---: | ---: | --- |
| CONTENT_RESET_ASSET | 335 | 91014083 | BACKED_UP_AND_RESTORE_VERIFIED |
| PRESERVE_ASSET | 2 | 402067 | BACKED_UP_AND_RESTORE_VERIFIED |
| PRESERVE_STATIC_CONTRACT | 2 | 703 | BACKED_UP_AND_RESTORE_VERIFIED |
| UNKNOWN | 0 | 0 | PASS |

Archive: 75900987 bytes; SHA-256 `32356b0093dba1ee78d1a7ac72bc60cca0bc518094bb7dd6ad1b8cb31e1e5b4a`; tar valid; restore verificado.

## PRESERVE_SNAPSHOT_MATRIX

| Table | Rows | Result before DML |
| --- | ---: | --- |
| addresses | 2 | MATCH |
| admin_audit_logs | 1926 | MATCH |
| bank_accounts | 0 | MATCH |
| cache_settings | 0 | MATCH |
| filter_types | 10 | MATCH |
| plans | 14 | MATCH |
| schema_audit_runs | 0 | MATCH |
| schema_backfill_runs | 1 | MATCH |
| schema_migrations | 62 | MATCH |
| security_ip_bans | 0 | MATCH |
| system_settings | 99 | MATCH |
| users | 6 | MATCH |

Os 12 digests foram vinculados ao manifesto. A ferramenta de reset executou zero writes. Depois do resume, writers normais voltaram a operar; por isso atividade legitima posterior nao e apresentada como snapshot estatico de um pos-reset inexistente.

## EXPECTED_COUNT_MATRIX

| Scope | Tables | Rows | Fingerprint | Result |
| --- | ---: | ---: | --- | --- |
| full target | 125 | 313639 | `aadf8b18...d6c9f` | RECONCILED |
| reset candidates | 113 | 311519 | bound to manifest | READY_BEFORE_EVIDENCE |
| actual deleted | 113 | 0 | n/a | NOT_EXECUTED |

## WRITER_INVENTORY_MATRIX

| Metric | Actual | Result |
| --- | ---: | --- |
| known writers | 25 | PASS |
| MUST_FREEZE writers | 20 | PASS |
| UNKNOWN writers | 0 | PASS |
| covered / uncovered policy tables | 125 / 0 | PASS |
| inventory hash | `41ce3c2ca0cfdfc0ceed5081845491810d9f60fcc77f52bcf0da98476a8024a9` | MATCH |

## SYSTEMD_RUNTIME_DROPIN_MATRIX

| Check | Actual | Result |
| --- | --- | --- |
| mechanism | `SYSTEMD_RUNTIME_DROPIN_V1` | PASS |
| runtime drop-ins armed | 15/15 | PASS |
| `RefuseManualStart` effective | 15/15 yes | PASS |
| service autorestart suppression | all services `Restart=no` | PASS |
| runtime masks during freeze | 0 | PASS |
| stale drop-ins / masks after recovery | 0 / 0 | PASS |

## SYSTEMD_UNIT_STATE_MATRIX

| Phase | Active | Inactive | Result |
| --- | ---: | ---: | --- |
| frozen | 0 | 15 | PASS |
| resumed | 12 | 3 one-shot services | PASS |

The 15-unit inventory included nginx, CloudPanel nginx, PHP-FPM 8.4, frontend, two ingestion workers, platform events, extractor, cron, three timers and their three one-shot services.

## TRIGGER_FREEZE_MATRIX

| Surface | State during freeze | Final state | Result |
| --- | --- | --- | --- |
| cron | inactive and start-suppressed | active | PASS |
| sitemap timer | inactive and start-suppressed | active | PASS |
| blog sitemap timer | inactive and start-suppressed | active | PASS |
| answer archive timer | inactive and start-suppressed | active | PASS |

## MYSQL_SESSION_MATRIX

| Check | Actual | Result |
| --- | ---: | --- |
| non-system sessions after freeze | 0 | PASS |
| established TCP/Unix MySQL sessions at evidence capture | 0 | PASS |
| reset execution session | not started | PASS |

## QUIESCENCE_MATRIX

| Check | Actual | Result |
| --- | --- | --- |
| observation window | 32 seconds | PASS |
| before / after global fingerprint | `ba74c3b4...769` / same | MATCH |
| unexpected mutations | 0 | PASS |
| observed target fingerprint | `77604855...811` | STABLE_BUT_WRONG_TIMEZONE |

## FREEZE_EVIDENCE_V2_MATRIX

| Gate | Actual | Result |
| --- | --- | --- |
| run/host/boot binding | captured | PASS |
| signed systemd state | `FROZEN` | PASS |
| approved rehearsal SHA | matched | PASS |
| quiescence | stable | PASS |
| target binding | observed `776...`, expected `aadf...` | REFUSED |
| Evidence V2 output | not created | FAIL_CLOSED |
| validator-only mode | not reached | NOT_EXECUTED |

Formal refusal: `Freeze observation is not bound to the target: OBSERVED_TARGET_FINGERPRINT_MISMATCH`.

## FINAL_PRE_DML_GUARD_MATRIX

| Guard | Result |
| --- | --- |
| target/schema/policy | PASS |
| fresh DB backup | PASS |
| fresh asset backup/restore | PASS |
| expected counts | PASS |
| writer inventory | PASS |
| systemd freeze | PASS |
| no writer DB sessions | PASS |
| quiescence | PASS |
| Evidence V2 target binding | FAIL |
| execution token release | NOT_EXECUTED |
| final P0/P1 | P0=0; P1=1 |

## RESET_EXECUTION_MATRIX

| Step | State | Writes |
| --- | --- | ---: |
| read-only dry-runs | PASS | 0 |
| freeze | PASS | 0 |
| Evidence V2 capture | REFUSED | 0 |
| `--validate-freeze-evidence-only` | NOT_EXECUTED | 0 |
| reset `--execute` | NOT_INVOKED | 0 |
| reset audit log | absent | 0 |

## EXPECTED_ACTUAL_MATRIX

| Scope | Expected delete | Actual delete | Result |
| --- | ---: | ---: | --- |
| 113 RESETTABLE tables | 311519 rows | 0 rows | ABORTED_PRE_DML |

## PRESERVE_POST_RESET_MATRIX

| Check | Result |
| --- | --- |
| post-reset snapshot | NOT_APPLICABLE_NO_RESET |
| preserve state at final pre-DML gate | MATCH |
| users removed by operation | 0 |
| settings changed by operation | 0 |
| schema/migration writes by operation | 0 |

## POST_RESET_RESIDUE_MATRIX

| Check | Result |
| --- | --- |
| residue reporter | NOT_EXECUTED_NO_RESET |
| test dataset empty | NO |
| test dataset removed | NO |

## ASSET_RESET_MATRIX

| Check | Actual | Result |
| --- | ---: | --- |
| asset backup | 339 files verified | PASS |
| content assets deleted | 0 | NOT_EXECUTED |
| preserve assets deleted | 0 | PASS |
| unknown assets deleted | 0 | PASS |

## DB_INTEGRITY_MATRIX

| Check | Actual | Result |
| --- | --- | --- |
| normal read queries | PASS | PASS |
| structural fingerprint | unchanged | PASS |
| critical rows after recovery | questions 1130; filters 63073; provas 100 | DATASET_INTACT |
| DDL/migrations | 0 | PASS |

## EMPTY_DATASET_SMOKE_MATRIX

| Check | Result |
| --- | --- |
| empty hubs | NOT_EXECUTED_NO_RESET |
| detail hard 404 on empty dataset | NOT_EXECUTED_NO_RESET |
| empty dataset 5xx scan | NOT_EXECUTED_NO_RESET |

## SYSTEMD_RESUME_MATRIX

| Check | Actual | Result |
| --- | --- | --- |
| signed state transition | `FROZEN` to `RESUMED` | PASS |
| restored units | 12 active | PASS |
| one-shot services | 3 inactive as designed | PASS |
| freeze drop-ins removed | 15/15 | PASS |
| exclusive lock removed | yes | PASS |

## RESUME_HEALTH_MATRIX

| Check | Actual | Result |
| --- | --- | --- |
| manager health | 100% | PASS |
| listeners | 80, 443, 3000, 8010, 19000 | PASS |
| public HTTPS | 200 | PASS |
| stale drop-ins / masks | 0 / 0 | PASS |

## DUPLICATE_EFFECT_MATRIX

| Effect | Actual | Result |
| --- | ---: | --- |
| reset-generated jobs | 0 | PASS |
| reset-generated imports | 0 | PASS |
| reset-generated outbox effects | 0 | PASS |
| duplicate reset execution | 0 | PASS |

## FINAL_SYSTEMD_CLEANUP_MATRIX

| Artifact/state | Actual | Result |
| --- | ---: | --- |
| runtime freeze drop-ins | 0 | PASS |
| runtime masks | 0 | PASS |
| operation lock | absent | PASS |
| state | `RESUMED` | PASS |
| public service | HTTP 200 | PASS |

## LOAD_BLOCKERS_MATRIX

| Blocker | Reset impact | Load impact |
| --- | --- | --- |
| sentinel timezone binding mismatch | BLOCKER | prerequisite reset incomplete |
| test dataset remains | BLOCKER | BLOCKER |
| 27 BINARY REGEXP occurrences from prior audit | none in this retry | BLOCKER |
| definitive sources not approved/loaded | none in this retry | BLOCKER |
| rights/provenance gates | none in this retry | BLOCKER |
| pending production migrations from prior audit | none in this retry | BLOCKER |
| real-data validation gates | none in this retry | BLOCKER |

## OPEN_REAL_DATA_GATES_MATRIX

| Gate group | State | Result |
| --- | --- | --- |
| reset completion | OPEN | BLOCKER |
| reset tooling timezone consistency | OPEN | BLOCKER |
| definitive source/provenance | OPEN | BLOCKER |
| load rehearsal and validation | OPEN | BLOCKER |
| SEO/production GO | CLOSED/PRELAUNCH | SAFE |

The detailed 20-gate load inventory from 11A remains open and was not recalculated as READY by this retry.

## FINAL_SAFETY_MATRIX

| Assertion | Actual | Result |
| --- | --- | --- |
| wrong target | no | PASS |
| unexplained divergence ignored | no | PASS |
| DML before all guards | 0 | PASS |
| reset `--execute` invoked | no | PASS |
| DELETE/TRUNCATE/UPDATE/INSERT | 0/0/0/0 | PASS |
| asset deletion | 0 | PASS |
| migration/schema change | 0 | PASS |
| freeze evidence bypass | no | PASS |
| recovery after refusal | complete | PASS |
| operational leftovers | 0 | PASS |
| P0_11B | 0 | PASS |
| P1_11B | 1 | BLOCKER |

## C. Artefatos e seguranca

- Artefatos operacionais privados: `/root/concursomestre-ops/phase11b-retry-20260825-225208`.
- Machine output local ignorado: `.tmp/data/phase-11b-production-dataset-reset-retry.json`.
- Nenhuma senha, connection string, PII, row dump ou conteudo protegido foi incluido neste relatorio.
- O operation environment permaneceu privado com modo 0600.
- Nenhum backup foi colocado no Git ou no webroot.

## D. Correcao exigida antes de novo retry

1. Fazer `capture_write_sentinel.php` normalizar explicitamente `SET time_zone = '-03:00'`, igual a `reset_definitive_dataset.php`, ou tornar o snapshot independente de timezone.
2. Adicionar teste de contrato que compare os fingerprints produzidos pelos dois entrypoints sob timezone global UTC.
3. Reexecutar o rehearsal representativo completo com o tooling corrigido.
4. Submeter a correcao a auditoria independente.
5. Iniciar outro run com novo ID, backups, manifests, sentinelas, HMAC e Evidence V2. Nenhum artefato desta retry autoriza DML futuro.

## E. Testes finais

| Gate | Result |
| --- | --- |
| PHP focused | 9/9 PASS |
| PHP lint | 11/11 PASS |
| Vitest completo | 154/154 files; 910/910 tests PASS |
| route types | PASS |
| typecheck | PASS |
| production build | PASS; 52/52 static pages generated |
| ESLint | PASS; 0 errors, 96 pre-existing warnings |
| launch-control validator | PASS |
| secret scan | PASS |
| encoding | PASS |
| JSON machine output | PASS |
| required report matrices | 28/28 present |
| `git diff --check` | PASS |

Os gates Node foram executados com Node 22.22.0, compativel com o engine minimo do projeto. Os warnings de ESLint permanecem backlog preexistente e nao foram alterados nesta operacao.

## F. Declaracoes finais

```text
baseline = fbb34f83f94bbda0792bd861c20d137916566a58
RESET_POLICY_V2 = NOT_EXECUTED
SYSTEMD_FREEZE_MECHANISM = SYSTEMD_RUNTIME_DROPIN_V1
production target = IDENTIFIED_NOT_RESET
production DB writes = 0
production DELETE = 0
production TRUNCATE = 0
production UPDATE = 0
production INSERT = 0
production migrations applied = 0
asset deletes = 0
backfill writes = 0
test dataset removed = NAO
users removed = 0
settings unexpected changes by reset = 0
schema preserved = SIM
migration history preserved = SIM
services recovered = SIM
stale runtime drop-ins = 0
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

## G. Vereditos

```text
DATASET_RESET_EXECUTION_ABORTED_PRE_DML
TEST_DATASET_NOT_REMOVED
SYSTEMD_FREEZE_EXECUTION_PASS
REAL_DATA_LOAD_EXECUTION_NOT_READY
```
