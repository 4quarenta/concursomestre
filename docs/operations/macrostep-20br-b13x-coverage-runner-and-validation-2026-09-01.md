# Macrostep 20B-R - B13X Coverage Runner And Validation

Date: 2026-09-01

## Executive result

The canonical B13X coverage runner was implemented in a clean worktree based on
`origin/1.0.0`, aligned to the real availability-safe state format collected
read-only from the VPS, and passed focused local syntax, wiring, and state
validation gates.

SSH access to the VPS was subsequently validated with the existing
`concursomestre_vps_ed25519` key, so the original environment-access blocker no
longer applies. The remaining work is operational: create the checkpoint from
the clean branch, package the exact commit, deploy it to production PRELAUNCH,
run `inventory` / `preflight` / `dry-run`, then perform the methodology
supersession and full writer coverage run.

```text
MACROSTEP_20BR = PARTIAL
B13X_RUNNER_IMPLEMENTATION = PASS
B13X_RUNNER_PRODUCTION_SMOKE = NOT_RUN
OLD_B13X_METHOD = REMAINS_AUTHORITATIVE
NEW_B13X_VALIDATION_METHOD = NOT_ACTIVATED
WRITER_COVERAGE = 0%
UNKNOWN_WRITERS = 0
UNEXPECTED_STRICT_DIFFS = 0
FINAL_STRICT_NONZERO = 0
MACROSTEP_13_FINAL_STATUS = IN_PROGRESS
MACRO16_BLOCKER = REMAINS
PRIMARY_MONITOR_BLOCKER = REMAINS
DR_20D3_BLOCKER = REMAINS
PRODUCTION_GO = NAO
```

## Implemented locally

1. Added canonical coverage metadata without changing the legacy writer
   inventory hash that still binds the active frozen production run.
2. Added signed availability-safe state validation helper:
   `backend/scripts/data/DatasetAvailabilitySafeFreezeState.php`.
3. Added signed coverage state helper:
   `backend/scripts/data/DatasetWriterCoverageState.php`.
4. Added canonical runner CLI:
   `backend/scripts/data/b13x_coverage_runner.php`.
5. Added reviewed `--coverage-noop` modes for mutating cron entrypoints that
   lacked a safe coverage invocation path.
6. Added focused coverage-state, availability-safe state, and runner wiring
   tests.
7. Added versioned shell entrypoints for coverage-based resume and rollback so
   the methodology transition no longer depends on ad hoc scripts that exist
   only on the VPS.

## Local validation

- PHP lint: PASS
- `DatasetWriterFreezeReporterTest.php`: PASS
- `DatasetWriterCoverageStateTest.php`: PASS
- `DatasetAvailabilitySafeFreezeStateTest.php`: PASS
- `B13XCoverageRunnerWiringTest.php`: PASS
- `DatasetWriterSystemdFreezePolicyTest.php`: PASS
- `b13x_coverage_runner.php --mode=inventory`: PASS

## Current blocker

The first production access attempt failed, but the correct existing key was
then identified locally:

```text
~/.ssh/concursomestre_vps_ed25519
```

Read-only SSH confirmation:

```text
root@76.13.163.93 -> PASS
```

The remaining blocked items were intentionally not run yet from this worktree:

- commit of the clean coverage-runner branch;
- package/deploy of the new runner;
- production `inventory` / `preflight` / `dry-run`;
- canonical supersession of the old time-based run;
- controlled resume of the frozen availability-safe state;
- per-writer coverage execution;
- final strict verification in production.

## Changed files

- `backend/scripts/data/DatasetWriterFreezeReporter.php`
- `backend/scripts/data/DatasetAvailabilitySafeFreezeState.php`
- `backend/scripts/data/DatasetWriterCoverageState.php`
- `backend/scripts/data/b13x_coverage_runner.php`
- `backend/scripts/data/b13x_coverage_resume.sh`
- `backend/scripts/data/b13x_coverage_rollback.sh`
- `backend/scripts/tasks/process_stripe_webhook_jobs.php`
- `backend/scripts/tasks/reconcile_stripe_subscriptions.php`
- `backend/scripts/tasks/check_subscription_card_expiry.php`
- `backend/scripts/tasks/process_referral_rewards.php`
- `backend/scripts/tasks/operational_log_alerts.php`
- `backend/tests/DatasetWriterFreezeReporterTest.php`
- `backend/tests/DatasetAvailabilitySafeFreezeStateTest.php`
- `backend/tests/DatasetWriterCoverageStateTest.php`
- `backend/tests/B13XCoverageRunnerWiringTest.php`

## Counters

```text
PRODUCTION_DML = 0
REAL_DATA_INSERTIONS = 0
PRODUCTION_DDL = 0
PRODUCTION_DCL = 0
STRIPE_TEST_MUTATIONS = 0
STRIPE_LIVE_MUTATIONS = 0
APPLICATION_DEPLOYS = 0
CLOUDFLARE_MUTATIONS = 0
COMMIT = NAO
PUSH = NAO
DEPLOY = NAO
```
