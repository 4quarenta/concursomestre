# Phase 13-X consolidated production contract

## Principal authority

| Principal | Function | Target grants | DML | DDL | Grant option |
| --- | --- | --- | --- | --- | --- |
| runtime | application | `SELECT, INSERT, UPDATE, DELETE` on app schema | limited | denied | denied |
| migration | reviewed migrations | explicit app DML and schema DDL | app schema | app schema | denied |
| backup | logical backup | `SELECT, SHOW VIEW, TRIGGER, EVENT` plus global `SHOW_ROUTINE` | denied | denied | denied |
| readonly | audit | `SELECT, SHOW VIEW` | denied | denied | denied |

`SHOW_ROUTINE` is required by MySQL 8.4 when `mysqldump --routines` reads routine
definitions. It exposes metadata but permits no DML, DDL, routine execution,
user administration or delegation. `--no-tablespaces` removes the otherwise
unnecessary `PROCESS` privilege, and `--single-transaction` removes the need
for `LOCK TABLES` from the backup principal.

## PITR target and restart

The target file is `pitr-candidate.cnf.example`. Enabling `log_bin` requires a
controlled MySQL restart. The sequence is: health/free-space precheck; verified
recovery backup; configuration validation; ingress/writer freeze; restart;
verify MySQL, durability variables, binlog and application health; resume; keep
the prechange file for rollback.

Initial guardrails use the observed 48 GiB filesystem with 28 GiB free:

- retention: 7 days (`604800` seconds), reviewed again before real ingestion;
- alert: 15 GiB free;
- hard rollout/ingestion guard: 10 GiB free;
- emergency purge: operator-only, never the active binlog, and only after a
  verified full backup plus recorded replay boundary.

GTID remains OFF because this is a single primary without replication.
File/position replay is the authoritative PITR mechanism.

## Off-host, encryption and immutability

No provider, KMS or immutable repository is evidenced. Phase 13-X cannot claim
completion until the operator selects a real provider and supplies credentials
for encrypted immutable retention and a restore from that copy.

```text
OFF_HOST_PROVIDER_DECISION_REQUIRED = YES
KMS_DECISION_REQUIRED = YES
OFF_HOST_KMS_IMMUTABILITY_READY_FOR_13X = NO
```

## Strict final sequence

1. create and verify a recovery backup;
2. freeze authenticated application/practice ingress;
3. freeze billing reconciliation and webhook consumers;
4. freeze cron/systemd schedulers and manual ingestion entrypoints;
5. hold incoming webhooks fail-closed without acknowledging unpersisted work;
6. neutralize/reconcile Stripe TEST state without touching LIVE;
7. prove active and unknown writers are zero;
8. execute the approved strict cleanup;
9. observe strict zero for 26 hours;
10. resume controlled writers in the recorded order;
11. observe for a second 26-hour window and require strict zero.

The 26-hour window crosses minute, 15-minute, hourly and daily writer cycles
with a two-hour margin. Any mutation restarts the gate.

## Final recovery evidence

Completion requires one bundle proving local backup, off-host copy, checksum,
immutable retention, full restore, PITR replay, application smoke on the
restored database and strict-zero persistence after resume.
