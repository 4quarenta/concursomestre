# Macrostep 20G - Post-B13X consolidated technical closure

Date: 2026-09-02
Environment: production PRELAUNCH
Status: PARTIAL - production PITR anchor gate blocked

## Executive result

The local implementation for a canonical launch-mode authority and a
fail-closed PITR-aware backup manifest passed its available local gates. The
production change was not deployed because the existing backup principal could
not read the binary-log position and the authorized administrative connection
needed to grant the narrowly required `REPLICATION CLIENT` privilege was not
available. No production data or schema was changed.

The safe decision is to stop before deployment and before the one authorized
production backup. A release that requires a same-snapshot anchor must not be
installed while that capability remains unproven.

## Identity and current production state

| Field | Result |
| --- | --- |
| Current production release | `557d8b6e99a7f31b4ca5622ba12ac8ba625bb5dc` |
| Rollback release | `557d8b6e99a7f31b4ca5622ba12ac8ba625bb5dc` |
| Host | `srv1754980` |
| Application path | `/home/concursomestre/htdocs/concursomestre.com` |
| Launch mode | `PRELAUNCH` by fail-safe default; canonical file absent |
| Home / health / readiness | PASS / PASS / PASS |
| Production sitemap | HTTP 503, `noindex, nofollow` |
| MySQL | Percona Server 8.4.10-10 |
| Binlog | ON, ROW, seven-day configured retention |
| GTID | OFF |
| Durable commit settings observed | `sync_binlog=1`, `innodb_flush_log_at_trx_commit=1` |

Candidate identity was not changed. The implementation was tested from the
current isolated worktree based on the active release. No production release
switch occurred.

## Backup authority and PITR finding

The only active canonical scheduler identified is the production cron entry:

```text
20 2 * * * concursomestre /home/concursomestre/bin/cm-cron mysql-backup
```

The wrapper invokes `backend/scripts/tasks/backup_mysql.php`. The credential
file is `/etc/concursomestre/backup-db.env`, with private file permissions.
The current backup principal is `concursomestre_backup@localhost` and its
observed grants are limited to `SHOW_ROUTINE` globally and
`SELECT, SHOW VIEW, EVENT, TRIGGER` on the application schema.

`SHOW BINARY LOG STATUS` failed with the server's missing `SUPER`/
`REPLICATION CLIENT` privilege error. Therefore:

```text
PRODUCTION_BACKUP_PITR_ANCHOR = FAIL
PRODUCTION_PITR_CHAIN_CONSTRUCTIBLE = FAIL
```

The code change adds Percona-supported `--source-data=2`, extracts the
position from the dump, validates it before publication, and emits manifest v3
PITR fields. It publishes no dump when the anchor is absent. The production
backup was intentionally not executed before the missing privilege was
resolved.

The attempted administrative connection using the existing application
configuration failed authentication before the `GRANT` statement ran. No
privilege was changed:

```text
PRODUCTION_DCL = 0
BACKUP_PRINCIPAL_GRANT_CHANGE = NOT_APPLIED
PRODUCTION_BACKUP_ARTIFACTS_CREATED = 0
```

The next operator action must use an already authorized migration/DBA
principal to grant only the audited binary-log read capability, then prove the
grant with `SHOW GRANTS` and run exactly one corrected backup.

## Local implementation

- `BackupPitrAnchor` extracts the native same-snapshot source position and
  fails closed when it is missing or malformed.
- `backup_mysql.php` uses `--source-data=2` and records the anchor and binary
  log format in manifest v3.
- `BackupManifestContract` preserves v2 verification compatibility and adds
  v3 identity, timing, tool, file, result, and PITR fields.
- `SeoLaunchModeAuthority` is the shared PHP/Next authority. Missing, invalid,
  or unreadable values resolve to `PRELAUNCH`.
- The admin endpoint and settings control separate `APP_ENV` from launch mode,
  require an explicit transition confirmation, and write an audit record.

## Verification

```text
Vitest: 159 files, 928 tests, PASS
TypeScript typecheck: PASS
Webpack production build: PASS
Turbopack build: blocked by the worktree's node_modules junction pointing
  outside the filesystem root; no source error was reported
PHP lint of changed files: PASS (remote temporary copy)
Backup manifest v2/v3 tests: PASS
PITR anchor tests: PASS
Launch-mode authority tests: PASS
Secret scan: PASS
Encoding scan: PASS
```

The repository-wide header script reports many pre-existing missing headers;
that result is not attributable solely to this change and was not expanded
into an unrelated repository-wide edit.

## Admin launch control

The local implementation is fail-safe and keeps the owner decision separate
from technical readiness:

```text
ADMIN_LAUNCH_MODE_AUTHORITY = PASS (local)
ADMIN_PRODUCTION_CONTROL = NOT_PROVEN (not deployed)
MISSING_CONFIG_DEFAULTS_TO_PRELAUNCH = PASS
OWNER_PRODUCTION_DECISION = NOT_INFERRED
```

The production launch-mode file remains absent, which preserves the effective
`PRELAUNCH` behavior. No transition to `GO_CANDIDATE` or `PRODUCTION` was
performed.

## Macro 12, legal, and external gates

```text
MACROSTEP_12_LOCAL_TECHNICAL = PARTIAL
RECAPTCHA_PROVIDER_ROTATION = PROVIDER_ACCESS_REQUIRED
RECAPTCHA_SECRET_EXPOSURE = 0 in the checked repository/report surface
LEGAL_TECHNICAL_READINESS = PARTIAL
FINAL_HUMAN_LEGAL_APPROVAL = PENDING
PRIMARY_EXTERNAL_MONITOR = PROVIDER_ACCESS_REQUIRED
TLS_RENEWAL_TIMED_GATE = WAITING_WINDOW
MACRO20F_PRODUCT = PENDING_IMPLEMENTATION
```

No secret, Stripe mutation, real-data insertion, sitemap publication, or
launch-mode promotion was performed.

## Safety counters

```text
PRODUCTION_DML = 0
SYNTHETIC_DML = 0
REAL_DATA_INSERTIONS = 0
PRODUCTION_DDL = 0
PRODUCTION_DCL = 0
STRIPE_TEST_MUTATIONS = 0
STRIPE_LIVE_MUTATIONS = 0
APPLICATION_DEPLOYS = 0
LAUNCH_MODE_MUTATIONS = 0
PRODUCTION_BACKUP_ARTIFACTS_CREATED = 0
```

## Governance result

```text
MACROSTEP_20G = PARTIAL
MACROSTEP_13 = PASS (previously established)
BILLING_OPERATIONAL_SCHEDULER_GATE = PASS (previously established)
ACTUAL_LAUNCH_MODE = PRELAUNCH
TECHNICAL_READINESS = NOT_READY
RELEASE_RECOMMENDATION = NO_GO_RECOMMENDED
OWNER_PRODUCTION_DECISION = NOT_INFERRED
```

## Exact blockers

1. Provide an already authorized DB/migration principal or equivalent secure
   operator path to grant and verify the minimum binary-log read privilege for
   `concursomestre_backup`; do not use the runtime account ad hoc.
2. Run and validate one corrected production backup, including the native
   same-snapshot anchor, manifest, checksum, private permissions, and
   referenced-binlog existence. Do not restore in production.
3. Deploy the approved package through the canonical PRELAUNCH release flow,
   then verify admin launch status and public noindex behavior.
4. Resolve the independent reCAPTCHA provider gate, external monitor access,
   and pending human legal approval before any Production GO decision.

Until blockers 1-3 are closed, `SAFE_TO_DEPLOY = NÃO` and
`PRODUCTION_GO = NÃO`.
