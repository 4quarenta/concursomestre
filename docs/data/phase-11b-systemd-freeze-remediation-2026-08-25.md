# Macroetapa 11B-R - Systemd freeze remediation

Measured at: 2026-08-25 (America/Sao_Paulo)
Branch: `1.0.0`
Baseline: `fbb34f83f94bbda0792bd861c20d137916566a58`
Previous 11B result: `DATASET_RESET_EXECUTION_ABORTED_PRE_DML`

## A. Executive decision

The freeze defect that aborted 11B before DML is remediated. The next 11B attempt may be planned from a fresh preflight, but this remediation did not execute that retry.

Selected mechanism: `SYSTEMD_RUNTIME_DROPIN_V1`.

The manager writes per-unit drop-ins only below `/run/systemd/system`, reloads systemd while writers remain active, verifies start and autorestart suppression, then stops units in a fixed order. The reset preflight now requires signed Evidence V2, the signed runtime state file, and a live systemd inspection immediately before any transaction.

Final gates:

```text
SYSTEMD_FREEZE_REMEDIATION_READY
DATASET_RESET_RETRY_READY
REAL_DATA_LOAD_EXECUTION_NOT_READY
```

No production service was stopped, masked, restarted or reconfigured. No production DML or DDL was executed.

## B. Root cause

Production runs systemd `255 (255.4-1ubuntu8.16)`. `RefuseManualStart` exists as a unit-file directive and as a D-Bus property, but D-Bus introspection exposes the property as `const`. `SetUnitProperties` cannot write it. The failed command used `systemctl set-property` for a non-writable runtime property.

The old assumption was therefore conceptually invalid. It was removed from executable tooling and superseded in the production runbook.

### SYSTEMD_VERSION_MATRIX

| Environment | OS | Kernel | systemd | Use |
| --- | --- | --- | --- | --- |
| production | Ubuntu 24.04.4 LTS | 6.8.0-124-generic | 255.4-1ubuntu8.16 | read-only fingerprint only |
| disposable rehearsal | Ubuntu 24.04 WSL2 | 6.6.87.2 WSL2 | 255.4-1ubuntu8.17 | active freeze/attack/resume tests |

The one Ubuntu package revision difference does not affect the exercised interfaces: runtime drop-in loading, `RefuseManualStart` unit-file semantics, `ConditionPathExists`, `Restart=no`, start/restart denial, dependency activation and runtime masks were behaviorally exercised. Production D-Bus inspection separately confirmed the read-only property semantics.

### ROOT_CAUSE_MATRIX

| Question | Evidence | Result |
| --- | --- | --- |
| directive exists | systemd loads `RefuseManualStart` from a runtime drop-in | YES |
| property exists | production `busctl introspect` lists it | YES |
| property writable | D-Bus signature marks it `const` | NO |
| `set-property` valid | property is not runtime writable | NO |
| unit type material | same read-only unit property; drop-in applies to service and timer units | NO blocker |
| exact failure class | command/API misuse, not missing systemd support | PROVEN |

## C. Mechanism selection

### FREEZE_MECHANISM_COMPARISON_MATRIX

| Mechanism | Temporary | Manual start | Dependency start | Autorestart | Local `/etc` units | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `set-property RefuseManualStart` | yes | unsupported | unsupported | unsupported | unsupported | REJECTED |
| `mask --runtime --now` | yes | yes for vendor unit | yes for vendor unit | yes for vendor unit | bypass observed | REJECTED |
| runtime drop-in with `RefuseManualStart=yes`, missing allow marker and `Restart=no` | yes | denied | condition prevents activation | suppressed | passed | SELECTED |

### RUNTIME_MASK_MATRIX

| Unit origin | mask command RC | LoadState | UnitFileState | later start | Result |
| --- | ---: | --- | --- | ---: | --- |
| `/usr/lib/systemd/system` | 0 | masked | masked-runtime | RC 1 | effective |
| `/etc/systemd/system` | 0 | loaded | static | RC 0, active | ineffective despite success RC |

Runtime masking is not safe for the mixed production inventory because local units in `/etc/systemd/system` took precedence over the generated `/run` symlink in the representative systemd build. The manager rejects stale runtime masks instead of combining mechanisms.

### Race analysis

The approved order is:

1. inspect exact fragments, names, aliases and triggers;
2. snapshot original unit states;
3. atomically publish all runtime drop-ins;
4. `daemon-reload`;
5. verify `RefuseManualStart=yes`, `Restart=no` and exact drop-in hashes while writers are still active;
6. stop timers, ingress and writers in the policy order;
7. verify all units inactive/failed;
8. capture signed state and Evidence V2.

There is no `stop -> autorestart -> suppression` window. Suppression is armed and verified before the first stop.

## D. Unit inventory

### UNIT_ALIAS_TRIGGER_MATRIX

| Unit group | Count | Alias policy | Trigger policy | Restart policy |
| --- | ---: | --- | --- | --- |
| ingress/runtimes | 6 | exact `Names` only | none | forced `no` during freeze |
| consumers | 3 | exact template instance names | none | forced `no` |
| timers | 3 | exact names | exact service target | not applicable |
| timer services | 3 | exact names | reverse timer relation captured before stop | forced `no` |
| total | 15 | drift aborts | drift aborts | verified live |

No `.socket` or `.path` trigger exists for the production writer inventory. No PM2, Supervisor, Docker or Podman supervisor was detected. Cron is controlled through `cron.service` plus process/session scans.

### MUST_FREEZE_SUPPRESSION_MATRIX

| Writer ID | Suppression controls | Result |
| --- | --- | --- |
| http-auth-account | nginx, clp-nginx, php-fpm | PASS |
| http-practice-user-activity | nginx, clp-nginx, php-fpm | PASS |
| http-content-interactions | nginx, clp-nginx, php-fpm | PASS |
| http-admin-editorial | nginx, clp-nginx, php-fpm | PASS |
| http-private-ingestion-producer | nginx, clp-nginx, php-fpm | PASS |
| http-stripe-webhook-producer | nginx, clp-nginx, php-fpm | PASS |
| cron-stripe-webhook-consumer | cron | PASS |
| cron-stripe-reconciliation | cron | PASS |
| cron-card-expiry | cron | PASS |
| cron-marketing-automations | cron | PASS |
| cron-referral-rewards | cron | PASS |
| cron-legal-commentary-sync | cron | PASS |
| cron-operational-alerts | cron | PASS |
| systemd-platform-event-consumer | platform-events instance | PASS |
| systemd-question-ingestion-consumers | ingestion instances 1 and 2 | PASS |
| systemd-answer-archive | timer and triggered service | PASS |
| manual-gran-crawler-taxonomy | ingress, operator lock, process scan | PASS |
| manual-exam-import-extraction | ingress, extractor, operator lock, process scan | PASS |
| manual-planalto-import | ingress, cron, operator lock, process scan | PASS |
| manual-backfills-migrations-reset | operator lock, SQL client scan, DB session scan | PASS |

Coverage is `20/20`. The inventory hash is `41ce3c2ca0cfdfc0ceed5081845491810d9f60fcc77f52bcf0da98476a8024a9`.

## E. Attack and restart tests

### AUTO_RESTART_MATRIX

| Scenario | Observation | Result |
| --- | --- | --- |
| kill `Restart=always` service before freeze | PID changed and service returned | control proven |
| kill/start after drop-in and stop | service stayed unavailable | PASS |
| service drop-in state | `Restart=no` for all 12 services | PASS |

### MANUAL_START_ATTACK_MATRIX

| Attack | Coverage | Expected | Observed |
| --- | ---: | --- | --- |
| `systemctl start` | 15/15 units | denied | denied |
| `systemctl restart` | 15/15 units | denied | denied |
| alias drift | one injected alias | pre-freeze abort | aborted |

### DEPENDENCY_TRIGGER_MATRIX

| Attack | Coverage | Result |
| --- | ---: | --- |
| transient dependency `Wants=<protected unit>` | 15/15 | protected unit stayed inactive |
| target command itself | may complete | not treated as proof; protected state is authoritative |

### TIMER_SOCKET_TRIGGER_MATRIX

| Trigger | Inventory | Result |
| --- | --- | --- |
| sitemap timer/service | both suppressed | PASS |
| blog sitemap timer/service | both suppressed | PASS |
| answer archive timer/service | both suppressed | PASS |
| socket/path | none found | NOT_APPLICABLE |
| cron | scheduler stopped plus process/session scan | PASS |

## F. Evidence V2

`DatasetWriterFreezeEvidence::SCHEMA_VERSION` is now `WRITER_FREEZE_EVIDENCE_V2`. V1 evidence is invalid for execution.

Evidence V2 binds:

- run ID and target kind;
- target snapshot fingerprint;
- host fingerprint;
- boot ID hash;
- exact systemd version;
- mechanism version;
- writer inventory hash;
- signed freeze-state hash and status;
- 15 per-unit states and drop-in proof;
- trigger/cron states and DB session scans;
- a minimum 30-second stable database fingerprint;
- expiry and HMAC.

The reset tool additionally reopens the signed freeze state and runs a live systemd validation. Evidence is unusable immediately after resume even if its expiry has not elapsed.

### FREEZE_EVIDENCE_V2_MATRIX

| Field/gate | Captured | Reset validates | Result |
| --- | ---: | ---: | --- |
| run/target/host | yes | yes | PASS |
| boot ID | yes | current boot | PASS |
| systemd version | yes | current version | PASS |
| mechanism version | yes | exact policy constant | PASS |
| signed runtime state hash | yes | file + HMAC + status | PASS |
| exact unit coverage | 15 | exact match | PASS |
| drop-ins and hashes | yes | live | PASS |
| masks absent | yes | live | PASS |
| triggers/cron frozen | yes | live | PASS |
| MySQL sessions | zero | required zero | PASS |
| quiescence | 32 s | stable fingerprints | PASS |
| validate-only writes | 0 | output assertion | PASS |
| validate-only transaction | false | output assertion | PASS |

### INVALID_EVIDENCE_MATRIX

| Case | Expected | Result |
| --- | --- | --- |
| missing | abort | PASS |
| V1 schema | abort | PASS |
| stale/expired | abort | PASS |
| wrong host | abort | PASS |
| wrong boot | abort | PASS |
| wrong target | abort | PASS |
| wrong writer hash | abort | PASS |
| wrong systemd version | abort | PASS |
| wrong mechanism | abort | PASS |
| active unit | abort | PASS |
| partial/missing drop-in | abort | PASS |
| runtime mask conflict | abort | PASS |
| active trigger/cron | abort | PASS |
| MySQL writer session | abort | PASS |
| tampered HMAC | abort | PASS |
| signed state resumed | abort | PASS |
| live suppression removed after capture | abort | PASS |

## G. Quiescence and resume

### QUIESCENCE_MATRIX

| Database | Window | Before | After | Unexpected mutations | Result |
| --- | ---: | --- | --- | ---: | --- |
| disposable MySQL 8.0.46, 125 policy tables | 32 s | `1bbed336...5267` | `1bbed336...5267` | 0 | PASS |

### RESUME_MATRIX

| Step | Behavior | Result |
| --- | --- | --- |
| validate signed FROZEN state | required | PASS |
| remove `/run` drop-ins | exact allowlist only | PASS |
| daemon reload | required | PASS |
| restore originally active services only | fixed order | PASS |
| run resume again | no additional changes | PASS |

### RESUME_HEALTH_MATRIX

| Measurement | Expected | Observed |
| --- | ---: | ---: |
| required active services/timers | 12 | 12 |
| health | 100% | 100% |
| duplicate effects | 0 | 0 |

### FAILURE_INJECTION_MATRIX

| Failure | Fail-closed proof | Recovery proof | Result |
| --- | --- | --- | --- |
| alias remains startable | freeze aborts before arm | remove alias, clean retry | PASS |
| partial drop-in | evidence capture aborts | restore exact drop-in | PASS |
| stale runtime state | second freeze aborts | explicit resume/cleanup | PASS |
| tampered HMAC | reset preflight aborts | fresh evidence required | PASS |
| boot mismatch | policy/evidence test aborts | new run required | PASS |
| resumed evidence | live reset preflight aborts | new freeze/evidence required | PASS |
| service fails resume | resume aborts | repair, retry, 12/12 | PASS |

## H. Runbook delta

### PRODUCTION_RUNBOOK_DELTA_MATRIX

| Old step | New step | Reason |
| --- | --- | --- |
| `systemctl set-property ... RefuseManualStart=yes` | `manage_writer_systemd_freeze.php --mode=freeze` | old property is not D-Bus writable |
| asserted unit list | policy-derived 15-unit exact inventory | drift/alias/trigger fail closed |
| freeze evidence V1 | V2 plus signed runtime state | boot/systemd/mechanism/live binding |
| clear property and start all | policy resume of originally active units | deterministic recovery |

Future 11B retry requirements:

1. new run ID;
2. fresh database and asset backups (do not reuse the aborted run's freshness claim);
3. fresh target fingerprint, table counts, preserved snapshots and writer inventory;
4. arm and verify `SYSTEMD_RUNTIME_DROPIN_V1` on production;
5. fresh Evidence V2 HMAC and live validation;
6. independent operator approval before reset execution.

### RECOVERY_MATRIX

| State | Recovery |
| --- | --- |
| arm fails before stop | remove any published drop-ins, daemon reload, verify original units |
| partial stop | keep suppression armed, finish deterministic stop or invoke signed resume |
| resume service failure | report failure, retain signed state, repair service, retry resume |
| second resume | idempotent success |
| reboot during freeze | runtime state disappears; boot mismatch invalidates evidence; reset aborts |

### RESET_RETRY_REQUIREMENTS_MATRIX

| Requirement | State |
| --- | --- |
| remediation gate | READY |
| P0 freeze remediation | 0 |
| P1 freeze remediation | 0 |
| previous reset gates regressed | NO |
| next run artifacts fresh | REQUIRED IN RETRY |
| retry executed here | NO |

## I. Safety and production state

### FINAL_SAFETY_MATRIX

| Control | Result |
| --- | --- |
| production inspection only | PASS |
| production service interruptions | 0 |
| production DB writes | 0 |
| production DELETE/TRUNCATE/UPDATE/INSERT/DROP | 0 |
| asset deletes | 0 |
| test dataset removed | NO |
| real dataset loaded/validated | NO |
| effective SEO launch mode | PRELAUNCH (configuration absent, fail-safe) |
| production indexing/sitemap/search notification | NO |
| commit/push/deploy | NO |

Production post-remediation inspection: 12/12 required units active, HTTP 200, zero remediation drop-ins/runtime masks, and no PM2/Supervisor/Docker/Podman supervisors.

## J. Files and limitations

Implementation added the systemd freeze policy/manager and updated only the freeze-evidence gate of the reset tool. The destructive allowlist, ordering and DML implementation were not broadened.

Machine-readable evidence is local and ignored by Git:

`/.tmp/data/phase-11b-systemd-freeze-remediation.json`

The representative environment is disposable WSL2 and uses systemd package revision `.17`, while production uses `.16`. Active destructive systemd tests were intentionally not run in production. This is accepted because the relevant semantics were behaviorally exercised and the production interface was separately fingerprinted read-only. A new 11B run must still perform its own preflight and live state verification before DML.

### Worktree and remediation delta

The accumulated 11A/11B worktree against baseline `fbb34f83f94bbda0792bd861c20d137916566a58` contains 9 tracked modified files and 27 untracked files. None is staged. Those earlier changes were preserved and were not reverted or hidden by this remediation.

Remediation-specific additions:

- `backend/scripts/data/DatasetWriterSystemdFreezePolicy.php`;
- `backend/scripts/data/manage_writer_systemd_freeze.php`;
- `backend/tests/DatasetWriterSystemdFreezePolicyTest.php`;
- `backend/tests/DatasetWriterSystemdFreezeManagerWiringTest.php`;
- this report.

Remediation-specific updates to the accumulated worktree:

- `backend/scripts/data/DatasetWriterFreezeEvidence.php`;
- `backend/scripts/data/capture_writer_freeze_evidence.php`;
- `backend/scripts/data/reset_definitive_dataset.php`;
- `backend/tests/DatasetWriterFreezeEvidenceTest.php`;
- `backend/tests/DatasetWriterFreezeCaptureWiringTest.php`;
- `backend/tests/DatasetResetToolWiringTest.php`;
- `docs/data/phase-11a-final-reset-readiness-audit-2026-08-25.md`.

Ignored local-only rehearsal artifacts remain under `/.tmp/data/`; they are not staged or versioned.

### Mandatory declarations

| Declaration | Value |
| --- | --- |
| baseline | `fbb34f83f94bbda0792bd861c20d137916566a58` |
| previous 11B result | `DATASET_RESET_EXECUTION_ABORTED_PRE_DML` |
| production target | `IDENTIFIED_BUT_NOT_MUTATED` |
| production DB writes | 0 |
| production DELETE | 0 |
| production TRUNCATE | 0 |
| production UPDATE | 0 |
| production INSERT | 0 |
| production DROP | 0 |
| asset deletes | 0 |
| test dataset removed | NO |
| real dataset loaded | NO |
| real dataset validated | NO |
| users removed | 0 |
| settings removed | 0 |
| effective launch mode | `PRELAUNCH` |
| production indexing activated | NO |
| production sitemap published | NO |
| search engines notified | NO |
| platform production ready | NO |
| `CONCURSOMESTRE_PRODUCTION_GO` | NO |
| commit | NO |
| push | NO |
| deploy | NO |

### Verification gates

| Gate | Result |
| --- | --- |
| focused PHP tests | PASS (11 scripts) |
| PHP lint | PASS (all changed/untracked PHP files) |
| Vitest | PASS (154 files, 910 tests; `--maxWorkers=4`) |
| route types | PASS |
| TypeScript | PASS |
| Next production build | PASS (52/52 static pages) |
| ESLint | PASS (0 errors; 96 pre-existing/out-of-scope warnings) |
| SEO launch validator | PASS (55 mapped families, 44 graph families) |
| secret scan | PASS |
| encoding scan | PASS |
| `git diff --check` | PASS |

The first local build attempt exhausted the 60-second static-generation worker deadline across many unrelated routes after an uncached full lint. A single clean retry compiled, typechecked and generated all 52 static pages successfully. No source change was made to influence that retry.

## K. Verdicts

```text
P0_FREEZE_REMEDIATION = 0
P1_FREEZE_REMEDIATION = 0

SYSTEMD_FREEZE_REMEDIATION_READY
DATASET_RESET_RETRY_READY
REAL_DATA_LOAD_EXECUTION_NOT_READY
```

`READY` authorizes planning a new 11B attempt; it does not execute it.
