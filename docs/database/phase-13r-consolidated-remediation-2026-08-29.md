# Macroetapa 13-R - Consolidated database and backup remediation

Date: 2026-08-29

## Executive decision

The technical remediation package is complete and independently rehearsed in
the dedicated clean worktree based on `38c3925daef9b9f5ca1cd92380eaa1ae0965383c`.
Production was read-only throughout this phase.

The remaining blocker is external, not a code defect: no off-host provider,
KMS or immutable-retention mechanism has been selected or evidenced. The
candidate may be committed and pushed, but Macrostep 13-X must not execute
until that decision and its credentials are supplied.

```text
CONSOLIDATED_REMEDIATION_AUDIT = PASS
OFF_HOST_KMS_IMMUTABILITY_READY_FOR_13X = NO
SAFE_TO_EXECUTE_MACROSTEP_13_X = NO
FIRST_MATERIAL_BLOCKER = OFF_HOST_PROVIDER_KMS_IMMUTABILITY_DECISION_REQUIRED
```

## A. Dedicated backup credential boundary

`BackupDatabaseConfig` resolves `BACKUP_DB_*` from the private backup file or
explicit backup environment without modifying application `DB_*`. Dedicated
mode is the default and fails closed on missing, partial, invalid or
world-readable configuration. Runtime reuse requires both explicit
`runtime_compat` mode and explicit fallback authorization.

The production contract uses `/etc/concursomestre/backup-db.env`, outside the
release and Git, with mode `0600`. The existing single cron entrypoint remains
`/home/concursomestre/bin/cm-cron mysql-backup` at 02:20 UTC.

```text
DEDICATED_BACKUP_CREDENTIAL_BOUNDARY = PASS
APPLICATION_DB_CONFIG_BEHAVIOR_UNCHANGED = YES
BACKUP_CONFIG_BOUNDARY_TESTS = PASS
```

## B. Backup grant contract

The exact backup target is:

```text
schema: SELECT, SHOW VIEW, TRIGGER, EVENT
global: SHOW_ROUTINE
```

`SHOW_ROUTINE` is required by MySQL 8.4 for `mysqldump --routines`. The tooling
now uses `--no-tablespaces`, avoiding `PROCESS`; `--single-transaction` avoids
`LOCK TABLES`. The principal has no DML, DDL, `ALL PRIVILEGES`, `PROCESS`,
`GRANT OPTION` or routine execution.

```text
SHOW_ROUTINE_REQUIRED = YES
BACKUP_GRANT_CONTRACT = PASS
BACKUP_LEAST_PRIVILEGE_REHEARSAL = PASS
```

## C. Manifest completeness

Manifest format v2 makes these fields mandatory: release SHA, database name,
engine/version, table/trigger/foreign-key counts, applied/pending/drift migration
counts, dump size and SHA-256. Missing or invalid mandatory data fails the
backup. Legacy v1 recovery sets remain readable for previously approved
recovery operations.

```text
MANIFEST_SELF_CONTAINED_INVENTORY = PASS
MANIFEST_MUST_HAVE_UNKNOWN_OR_NULL = 0
```

## D. Scheduler and secret wiring

The scheduler remains unique. Phase 13-X installs the private file before the
release switch, validates mode/ownership, then runs the normal cron entrypoint
manually. Secrets never enter a command line, cron line, report or repository.

## E-G. Principal targets

| Principal | Exact target | Rehearsal |
| --- | --- | --- |
| runtime | schema `SELECT, INSERT, UPDATE, DELETE` | PASS; DDL/GRANT denied |
| migration | explicit app DML and schema DDL listed in the SQL contract | PASS; runner applied synthetic migration, GRANT denied |
| readonly | schema `SELECT, SHOW VIEW` | PASS; mutation denied |

No production grants were changed.

## H. PITR and durability

Target: binlog enabled, ROW format, `sync_binlog=1`,
`innodb_flush_log_at_trx_commit=1`, seven-day retention,
`server-id=130001`, GTID OFF. A MySQL restart is required to enable the target.

The clean rehearsal restored a full baseline, replayed ROW binlog only to the
recorded target position and excluded a later write.

```text
PITR_REHEARSAL = PASS
GTID_TARGET = OFF
MYSQL_RESTART_REQUIRED = YES
BINLOG_RETENTION_SECONDS = 604800
MIN_FREE_DISK_GIB = 10
ALERT_THRESHOLD_GIB = 15
```

## I. Off-host, KMS and immutability

No provider or managed-key infrastructure is evidenced. Requirements are
fully specified in `backend/ops/mysql/phase13x-rollout-contract.md`, but no
provider was invented and no external resource was created.

```text
OFF_HOST_PROVIDER_DECISION_REQUIRED = YES
KMS_DECISION_REQUIRED = YES
OFF_HOST_KMS_IMMUTABILITY_READY_FOR_13X = NO
```

## J. Stripe TEST and strict writer contract

Unknown strict writers remain zero. The final sequence covers ingress,
practice, reconciliation, webhook consumers, schedulers, Stripe TEST external
state, strict cleanup and controlled resume. One 26-hour observation window is
used before resume and repeated after resume, crossing every daily writer
cycle with margin.

```text
UNKNOWN_STRICT_WRITERS = 0
STRICT_ZERO_OBSERVATION_WINDOW = 26 hours
STRICT_FINAL_RUNBOOK = READY
```

## K. Final recovery verification

Phase 13-X must prove local backup, off-host encrypted immutable copy,
checksum, full restore, point-in-time replay, application smoke and strict-zero
persistence. Missing any component fails Macrostep 13.

## Clean-room evidence

- PHP lint: PASS
- backup boundary unit tests: PASS
- manifest v2 tests: PASS
- backup/grant/principal MySQL 8.4 rehearsal: PASS
- recovery failure contract: PASS
- PITR target-point rehearsal: PASS
- strict runbook validation: PASS
- typecheck and route types: PASS
- production build: PASS
- secret scan: PASS
- encoding scan: PASS
- `git diff --check`: PASS
- Vitest: 153 files and 908 tests passed; one preexisting ESM/CJS performance
  reporter suite failed in an untouched file; new regressions: zero

## Scope and production invariants

All candidate files are backup/database contracts, implementations, tests or
this consolidated report.

```text
OUT_OF_SCOPE = 0
UNCERTAIN = 0
APPLICATION_DML_EXECUTED_THIS_RUN = 0
APPLICATION_DDL_EXECUTED_THIS_RUN = 0
APPLICATION_MIGRATIONS_APPLIED_THIS_RUN = 0
GRANTS_CHANGED_IN_PRODUCTION = 0
MYSQL_CONFIG_CHANGED_IN_PRODUCTION = 0
STRIPE_MUTATIONS = 0
STRICT_CLEANUP = 0
REAL_DATA_INSERTION_AUTHORIZED = NO
REAL_DATA_LOADED = NO
PRODUCTION_GO = NO
```
