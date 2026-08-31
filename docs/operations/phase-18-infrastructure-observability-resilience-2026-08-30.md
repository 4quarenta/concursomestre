# Macrostep 18 - Infrastructure / Observability / Resilience

Date of collection: 2026-08-31 UTC
Candidate baseline: `2548a9151103b50c21c791fdba59f7f4cdaa6fe2`
Origin branch: `origin/1.0.0` at the candidate baseline
Production evidence source: read-only SSH to the existing VPS, public HTTP
GET/HEAD, versioned repository and the incident record supplied in the local
worktree.

## Executive decision

```text
MACROSTEP_18_CONSOLIDATED_INFRA_OBSERVABILITY_RESILIENCE = BLOCKED
MACROSTEP_18_READINESS_AUDIT = FAIL
MACROSTEP_18_IMPROVEMENT_AUDIT = COMPLETE
MACROSTEP_18_INDEPENDENT_AUDIT = PASS
MACROSTEP_18_FINAL_PREPRODUCTION_PREFLIGHT = FAIL
PRODUCTION_CHANGESET_18_V1_STATUS = PARTIALLY_APPLIED
PRODUCTION_CHANGESET_18_INDEPENDENT_REVIEW = PASS
INFRASTRUCTURE_READINESS = FAIL
P0_REMAINING = 0
P1_REMAINING_AT_V1_REVIEW = 5
P1_REMAINING_CURRENT = 3
MACROSTEP_18_READY_FOR_CHECKPOINT = NÃO
MACROSTEP_18_CONTROLLED_PRODUCTION_REMEDIATION = PARTIAL
```

The block is evidence-based. Public availability and local backup health are
good, but TLS renewal/alert proof, independent monitor execution and durable
post-renewal key permissions remain unresolved for production. The MySQL
private bind, legacy-route closure, listener
hardening and TLS key-mode change were applied and verified; the disposable
MySQL 8.4 least-privilege rehearsal passed. No application deploy, schema
migration, content DML or certificate mutation was performed.

## Safety accounting

```text
PRODUCTION_READONLY_ACCESS = PASS
PRODUCTION_DML = 0
PRODUCTION_DDL = 0
PRODUCTION_MIGRATIONS = 0
PRODUCTION_DCL = 1
PRODUCTION_CONFIG_MUTATIONS = 4
SERVICE_RESTARTS = 1
CONFIG_RELOADS = 2
CERTIFICATE_MUTATIONS = 0
FIREWALL_MUTATIONS = 0
DEPLOY = NÃO
MACROSTEP_13_OBSERVATION_INTERFERENCE = 0
B13X_006_CURRENT_STATUS = ACTIVE_AVAILABILITY_SAFE_OBSERVATION
REAL_DATA_INSERTION_AUTHORIZED = NÃO
REAL_DATA_LOADED = NÃO
PRODUCTION_GO = NÃO
```

## Identity and current production

| Item | Evidence |
| --- | --- |
| Candidate baseline | `2548a9151103b50c21c791fdba59f7f4cdaa6fe2` |
| Remote branch | `origin/1.0.0` now contains monitor bootstrap `9455a4a8`; application production SHA remains unchanged |
| VPS | `srv1754980`, Ubuntu 24.04.4, kernel `6.8.0-124-generic` |
| Production release | `b4ab179d5ab9bea3a52e070bc6f599be0ec544f4` from the authoritative incident addendum |
| Launch mode | `PRELAUNCH` |
| Public production sitemap | unavailable by design |
| Home | HTTP 200 |
| Health | HTTP 200 |
| Readiness | HTTP 200 |
| Disk | 48G total, 41% used, 29G available, 10% inode use |
| Memory | 3.8Gi total, 2.7Gi available, 2Gi swap with about 1.3Gi used |
| Load | 0.00 / 0.00 / 0.00 at collection |

## Diff inventory

The Macrostep 18 local diff contains no application, schema, migration,
deployment or production configuration change. Its three local artifacts are
classified as follows:

| File | Classification |
| --- | --- |
| `docs/audit/cross-cutting-improvement-ledger.md` | documentation / improvement ledger |
| `docs/operations/infrastructure-operational-contract.md` | documentation / operational contract |
| `docs/operations/phase-18-infrastructure-observability-resilience-2026-08-30.md` | documentation / audit report |

```text
out-of-scope = 0
uncertain = 0
```

The ignored JSON companion is a sanitized audit artifact and is not part of
the Git diff.

## Incident 522

The supplied incident record identifies `ORIGIN_SERVICE_DOWN` as the root
cause. The strict freeze had stopped Nginx, PHP-FPM and the frontend. Recovery
restored only the serving layer and kept PRELAUNCH sitemap responses fail
closed. The record also says the new availability-safe observation keeps the
public layer active and suppresses writers at their mutation boundaries.

That runtime state is healthy evidence for the current observation, but its
scripts live under `/root/.config/concursomestre/ops` and are not part of the
`2548a915` repository baseline. The versioned `DatasetWriterSystemdFreezePolicy`
still includes serving units. This is the principal architectural blocker.

## Topology and service inventory

```text
Cloudflare -> Nginx :80/:443 -> Next.js :3000 / PHP-FPM :19000
                                   -> internal extractor :8010
                               -> MySQL/Percona
                               -> Redis/Memcached/Varnish as configured
cron/systemd -> backup, assets, log maintenance, sitemap and observation
```

Observed critical services: Nginx, PHP 8.4 FPM, Next.js frontend, MySQL,
cron and Fail2ban were active. The frontend runs as `concursomestre` and MySQL
runs as `mysql`. Nginx/PHP-FPM master processes run as root as expected for
privileged binding/master-worker operation, but legacy PHP-FPM versions 7.1
through 8.5 are also active and require an explicit inventory/retirement
decision.

`systemctl is-system-running` returned `degraded`. Failed units were:

- stale `concursomestre-frontend-runtime-20260721.service` (`not-found`);
- `concursomestre-preview-20260725120459.service` (`failed`);
- `motd-news.service` (`failed`).

Core service auto-restart was configured (`always` for Nginx, PHP-FPM and
frontend; `on-failure` for MySQL), but a green systemd state was not proven.

## Availability-safe freeze

The invariant required by Macrostep 18 is currently **FAIL in the versioned
policy**: `DatasetWriterSystemdFreezePolicy::units()` includes `nginx.service`,
`php8.4-fpm.service` and `concursomestre-frontend.service`, and the manager's
stop order suppresses the full unit inventory. The observed VPS has a separate
availability-safe runtime mechanism, but it is not versioned in this
candidate. This produces `INFRA18-P1-01`.

The current observation timer and resume timer were active/waiting and the
strict table counts were zero. They were only inspected; no timer, freeze
state, writer or public service was changed.

## Network and firewall

Expected public edge listeners are 22, 80 and 443. The VPS additionally binds:

```text
*:21      proftpd
*:25      postfix
*:6081    Varnish/cache-main
*:3306    mysqld
*:33060   mysqld X protocol
```

Redis, Memcached, PHP-FPM, Node and the extractor were loopback-bound. UFW was
active with default incoming deny and explicit rules for 22, 80, 443 and 8443,
but the bind exposure itself is not an approved service inventory. The public
MySQL bind directly reopens CC-16 and is a P1 until justified and hardened.
SSH also reported `permitrootlogin yes` and `passwordauthentication yes`; this
is transferred to the Macrostep 12 security owner and remains a pre-GO risk.

## HTTP and sitemap

Read-only external probes returned:

| Endpoint | Result |
| --- | --- |
| `/` | 200 |
| `/api/system/health.php` | 200 |
| `/api/system/readiness.php` | 200 |
| `/sitemap.xml` | 503, `text/plain`, `noindex, nofollow` |
| `/sitemap-index.xml` | 503, `text/plain`, `noindex, nofollow` |
| `/sitemaps/` | 503, `text/plain`, `noindex, nofollow` |
| `/robots.txt` | 200 |

This preserves the PRELAUNCH fail-closed sitemap contract. The production
Nginx configuration still has a public `/questao-pro-backend/` legacy route
surface, so CC-01 is not closed.

## MySQL and data state

Using the existing dedicated backup principal for read-only queries:

```text
Percona Server 8.4.10-10
bind_address = *
port = 3306
mysqlx_port = 33060
log_bin = ON
binlog_format = ROW
sync_binlog = 1
innodb_flush_log_at_trx_commit = 1
gtid_mode = OFF
binlog_expire_logs_seconds = 604800
read_only = OFF
super_read_only = OFF
max_connections = 120
```

The application database had zero rows in `provas`, zero null/duplicate slug
delta, zero rows in all five strict tables, zero `study_sessions`, and 62
applied migration rows. The four 13C migrations observed as applied included
the 13C domain migrations and the `provas` slug migration. No production data
was inserted or changed.

The runtime principal configured in the backend environment reported only
`USAGE` in `SHOW GRANTS`, while public health/readiness was successful. This is
an unresolved evidence conflict, not a basis for granting or revoking anything;
it requires a sanitized runtime-config and principal reconciliation before GO.

## Backups and recovery

The active database backup command is the single cron entrypoint at `20 2 * * *`
and the asset backup is at `20 3 * * *`; log maintenance is at `45 2 * * *`.
The latest DB artifact was created at `2026-08-31T02:20:03Z`, size 1,333,218
bytes, mode `0600`, and its health file reported `success=true`, dedicated
credential source, checksum and manifest paths. Independent checksum validation
through the remote command was not fully reproducible because the health path
and shell working directory differed; the health record is therefore accepted
as evidence but not upgraded to independent PASS by this audit.

The local backup health record is present and reports a successful artifact,
but the independent checksum recheck was not completed in this collection.
Off-host destination, managed encryption/KMS and immutability are not proven
(`INFRA18-DR-01`). Asset backup freshness and a combined restore signal were
not found in the current health-file inventory.

## TLS

The active certificate is Let's Encrypt for `concursomestre.com`, valid from
2026-06-14 through **2026-09-12 01:32:52 UTC**. Nginx configuration syntax
passed, with warnings that OCSP stapling has no responder URL and `listen
... http2` syntax is deprecated. A renewal configuration exists, but no
active certbot/ACME timer or service and no last-success signal were observed.
Therefore `TLS_RENEWAL_PATH = NOT_PROVEN` and `TLS_EXPIRY_MONITORED = FAIL`,
creating `INFRA18-P1-03`.

## Observability and silent failure

Present evidence includes public health/readiness, systemd status, local backup
health, log-maintenance health, sitemap materializer status and a local strict
observation monitor. The observation and backup/log timers were active. No
independent off-host alert destination was proven; local files and a local
systemd timer cannot detect total VPS loss. Stripe and reconciliation health
files exist, but independent delivery and freshness alerting are not proven.
This creates `INFRA18-P1-06`.

The application log directories were small at collection (`/var/log/nginx`
208K, `/var/log/mysql` 204K, app logs about 11M and backend storage logs about
9.9M). The journal contains bounded individual files, but a complete retention
policy and alert on journal exhaustion were not proven.

## Macrostep 13 and production safety

This run performed read-only inspection plus the explicitly authorized MySQL
private-bind configuration, one MySQL restart, the Nginx legacy-route closure
with two reload attempts (the first was rejected by `nginx -t` and rolled back),
and stale systemd failure-state cleanup. It did not touch the signed
observation state, writers, database data, Stripe or application deployment.
Current observation evidence says strict rows are zero and public serving is
available. `MACROSTEP_13_OBSERVATION_INTERFERENCE=0`.

## Controlled production remediation outcome

```text
CURRENT_PRODUCTION_SHA = b4ab179d5ab9bea3a52e070bc6f599be0ec544f4
LAUNCH_MODE = PRELAUNCH
HOME = 200
HEALTH = 200
READINESS = 200
SITEMAP = 503
B13X_006_CURRENT_STATUS = FROZEN_ARTIFACT_PRESENT
STRICT_ZERO_PERSISTENCE = 0
STRICT_ZERO_PERSISTENCE_AFTER_RESUME = 0
MACROSTEP_13_OBSERVATION_INTERFERENCE = 0
```

The signed B13X artifact and its observation files were not modified. The
observation was not restarted, shortened or silently invalidated.

Applied and verified:

- MySQL classic and MySQL X now listen on `127.0.0.1` only; external TCP
  probes to `3306` and `33060` were refused. No firewall rule was changed.
- The exact and slash variants of `/questao-pro-backend` return `404` from
  the public HTTPS endpoint. `/`, health and readiness remained healthy.
- Two stale systemd failure records were cleared only after confirming
  `failed` state, `MainPID=0` and stale/not-found provenance.

Not closed:

- `motd-news.service` still fails with `203/EXEC` because
  `/etc/update-motd.d/50-motd-news` is absent. No masking or fake repair was
  performed.
- The runtime principal still resolves as `concursomestre@127.0.0.1` with
  `USAGE` only. No approved migration/admin principal was available, so no
  DCL was attempted and no grant was changed.
- The certificate still expires on 2026-09-12. No safe ACME dry-run command
  was available: `certbot` is absent and the CLP wrapper did not expose a
  dry-run contract. No certificate was replaced.
- Legacy FTP/SMTP/Varnish processes still bind publicly. External probes were
  blocked by the existing default-deny firewall, but listener ownership and
  required-consumer proof are incomplete; no service was stopped.
- The external monitor workflow was pushed in the authorized intermediate
  commit `9455a4a8`. Its GitHub Actions run could not be independently read
  with the available unauthenticated API (`404`), so
  `EXTERNAL_MONITOR_INITIAL_RUN = NOT_PROVEN`.

```text
PRODUCTION_REMEDIATION = PARTIAL
PRODUCTION_CHANGESET_18_V1_DEVIATIONS = 0
ROLLBACK = NOT_REQUIRED
PRODUCTION_DML = 0
PRODUCTION_DDL = 0
PRODUCTION_DCL = 0
APPLICATION_DEPLOYS = 0
REAL_DATA_INSERTIONS = 0
STRIPE_LIVE_MUTATIONS = 0
```

At the V1 review point, the five remaining P1s were `INFRA18-P1-02`,
`INFRA18-P1-03`, `INFRA18-P1-04`, `INFRA18-P1-06` and `INFRA18-P1-07`. The remediation stops
here rather than improvising administrative credentials, ACME tooling or
service changes.

## Improvement audit and local remediation

All imported ledger findings assigned to Macrostep 18 were accounted for,
including CC-01, CC-16, CC-18, CC-22C/22D/22E and the 522/TLS/observability
transfers. The versioned contract at
`docs/operations/infrastructure-operational-contract.md` was added as a safe,
local, non-production quick win. It documents the availability-safe freeze
invariant, signal ownership, 522 recovery sequence and DR decision gates.
The versioned freeze policy was corrected so Nginx, PHP-FPM and the frontend
are classified as serving infrastructure and are absent from the strict stop
and resume orders. A permanent regression test covers this invariant. The
versioned Nginx candidate now rejects the legacy `/questao-pro-backend` route
with 404, and a private-bind MySQL candidate is available for a controlled
network change. Machine-readable TLS expiry and runtime grant validators were
added without production connectivity or secret output. The explicitly
authorized production remediation later applied only the private MySQL bind,
the legacy-route closure and stale systemd-record cleanup; it did not deploy
the application or change application data.

## P1 accounting after local remediation

```text
P1_TOTAL_INITIAL = 7
P1_REMAINING_AFTER_LOCAL_AT_V1_REVIEW = 5
P1_CLOSED_LOCAL = 2
P1_READY_FOR_CONTROLLED_PRODUCTION_CHANGE = 4
P1_USER_DECISION_REQUIRED = 1
P1_BLOCKED_BY_B13X_006 = 0
P1_RECLASSIFIED = 0
P1_UNACCOUNTED = 0
ALL_LOCAL_SAFE_FIXES_IMPLEMENTED = SIM
ALL_RUNTIME_ROOT_CAUSES_IDENTIFIED = SIM
PRODUCTION_CHANGESET_18_V1 = PARTIALLY_APPLIED
AVAILABILITY_SAFE_FREEZE_REGRESSION = PASS
PUBLIC_SERVING_LAYER_NOT_PART_OF_STRICT_WRITER_FREEZE = PASS
LEGACY_PUBLIC_BACKEND_ROUTE_CANDIDATE = CLOSED
NETWORK_HARDENING_CANDIDATE = PASS
TLS_EXPIRY_CHECK_TOOL = PASS
RUNTIME_LEAST_PRIVILEGE_REHEARSAL = PASS_MYSQL_8_4_11_WSL_DISPOSABLE
MYSQL84_LEAST_PRIVILEGE_HARNESS = PASS
RUNTIME_REQUIRED_OPERATION_FAILURES = 0
UNNECESSARY_HIGH_PRIVILEGE_GRANTS = 0
INDEPENDENT_MONITORING_USER_DECISION_REQUIRED = SIM
RECOMMENDED_MONITORING_OPTION = GITHUB_ACTIONS_SCHEDULED_EXTERNAL_HTTPS_PROBES
```

The two locally closed items are the availability-safe freeze boundary and
the versioned legacy-route deny rule. Network, TLS, systemd and runtime grant
findings remain ready for an explicitly controlled production change. The
independent-monitoring item requires an owner decision because no external
alert destination was found. The consolidated plan is in
`docs/operations/production-changeset-18-v1.md`.

The complete disposable MySQL least-privilege rehearsal was executed through
the existing WSL Ubuntu 24.04 harness with MySQL Community 8.4.11. It used
synthetic credentials, loopback-only networking and an ephemeral datadir. The
real backup entrypoint, runtime DML capability set, denied DDL/GRANT cases,
read-only principal, migration principal, manifest checks, restore and
corrupted-artifact rejection all passed. The harness removed its runtime on
exit; no production credentials or host were read.

No external monitoring destination is configured or proven. The recommended
next option is a scheduled GitHub Actions HTTPS probe with an owner and alert
channel; it is not configured by this preflight. Cloud-provider health checks
or a managed uptime service remain alternatives only after explicit owner
selection and credential/configuration review.

## Independent changeset review

The changeset was reviewed after preparation for command scope, rollback
specificity, dependency order, SSH lockout risk, database connectivity,
availability preservation, B13X-006 interaction and secret safety. The review
found no undocumented production mutation or credential material:

```text
PRODUCTION_CHANGESET_18_INDEPENDENT_REVIEW = PASS
```

## Authoritative root-cause verification (read-only, 2026-08-31)

The VPS is the production source of truth for this verification. This audit
performed no production DML, DDL, DCL, configuration mutation, service
restart/reload, firewall/certificate mutation, deployment or Git mutation.
The already-applied MySQL private bind and legacy-route closure were not
repeated. Production remains on release
`b4ab179d5ab9bea3a52e070bc6f599be0ec544f4` in `PRELAUNCH`.

| Finding | Authoritative environment | Root cause | Current risk | Target state | Mutation required | Final severity | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INFRA18-P1-02 | VPS `ss`, service units, UFW and external probes | ProFTPD `:21`, Postfix `:25` and Varnish `:6081` still use wildcard binds; UFW denies the tested external paths, but service ownership/necessity is not approved | Unnecessary legacy surface can be exposed by firewall drift or service reconfiguration | Only approved edge listeners are externally bound; unused services disabled or private | Owner decision, then service/network change | P1 | Prove FTP/SMTP/Varnish consumers; bind private or disable only with rollback plan |
| INFRA18-P1-03 | Let’s Encrypt renewal file, `/etc/cron.d/clp`, certificate dates | Renewal is delegated to panel `clpctl`; no `certbot` binary, ACME timer, successful renewal or alert receipt was proven | Certificate expires 2026-09-12 without a machine-proven renewal path | Renewal command, expiry alert and last-success evidence are observable | Controlled renewal proof and alert configuration | P1 | Run owner-approved non-destructive renewal validation in a separate window |
| INFRA18-P1-04 | `motd-news.service` status and unit fragment | Static timer invokes absent `/etc/update-motd.d/50-motd-news`, producing `203/EXEC` | Host remains degraded and failure ownership is unclear | Package-owned script restored or timer/service intentionally retired | OS-owner package/service remediation; do not substitute `reset-failed` | P1 | Identify package owner and apply the smallest approved repair |
| INFRA18-P1-06 | Git refs plus unauthenticated GitHub API | Monitor workflow exists only on `1.0.0`; remote default branch is `4quarenta/next-version`, so scheduled/manual availability and run history are not proven | No independently verified alert path or host-loss signal | Workflow is present/enabled on default branch or another external monitor is proven | GitHub workflow placement, permissions and run verification | P1 | Place workflow on default branch through an authorized GitHub change, then prove a run and alert |
| INFRA18-P1-07 | Production env and MySQL session/grant evidence | Read path uses `concursomestre_seo_read`; configured runtime principal resolves as `concursomestre@127.0.0.1` with `USAGE` only, while health does not exercise write capability | Runtime write behavior and least-privilege boundary are not reconciled | Actual runtime operations use an explicitly reviewed capability set | Owner-approved DCL after disposable capability proof | P1 | Trace write endpoints and apply only the reviewed grant contract |
| INFRA18-P1-08 | TLS key metadata from VPS `stat` | Active private-key file mode is `0644`, broader than the required private-key boundary | Other local users may read key material | Root-owned private key with mode `0600` or stricter equivalent | Certificate-owner permission change and post-change verification | P1 | Harden mode in a separate certificate/security window; never print key contents |

### GitHub monitor verification

`origin/1.0.0` points to monitor commit `9455a4a8d410fa0410f7558e2b09fc617f76a14c`.
The workflow contains HTTPS probes for home, health, readiness and the
PRELAUNCH sitemap, plus a local mock failure-contract check. The remote
symbolic `HEAD` points to `4quarenta/next-version`, whose tip does not contain
the workflow. Scheduled and manual workflow events require the workflow file
to exist on the default branch, so the commit alone is not proof of a
scheduled monitor. The unauthenticated Actions API returned `404`; repository
visibility and Actions permissions were not available through the current
read-only access, so neither a successful run nor alert delivery is claimed.

### V2 decision and accounting

```text
MACROSTEP_18_AUTHORITATIVE_RUNTIME_VERIFICATION = PASS
PRODUCTION_INFRA_SOURCE_OF_TRUTH = VPS
PRODUCTION_CHANGESET_18_V2 = READY_FOR_AUTHORIZATION
P1_UNACCOUNTED = 0
P0_REMAINING = 0
P1_REMAINING_CURRENT = 6
PRODUCTION_DML_THIS_AUDIT = 0
PRODUCTION_DDL_THIS_AUDIT = 0
PRODUCTION_DCL_THIS_AUDIT = 0
PRODUCTION_CONFIG_MUTATIONS_THIS_AUDIT = 0
SERVICE_RESTARTS_THIS_AUDIT = 0
SERVICE_RELOADS_THIS_AUDIT = 0
CERTIFICATE_MUTATIONS_THIS_AUDIT = 0
FIREWALL_MUTATIONS_THIS_AUDIT = 0
DEPLOY_THIS_AUDIT = NÃO
COMMIT_THIS_AUDIT = NÃO
PUSH_THIS_AUDIT = NÃO
```

The V2 changeset excludes the already-applied MySQL private bind and legacy
route closure. It does not authorize production changes by itself and leaves
Macrostep 18 blocked until the remaining P1s are closed or explicitly
accepted by the responsible owners.

## Post-change independent audit (2026-08-31)

The authorized V2 actions preserved the deployed application release and
passed availability checks after each runtime service change. Final VPS
evidence is:

```text
HOME = 200
HEALTH = 200
READINESS = 200
SITEMAP = 503 / X-Robots-Tag: noindex, nofollow
LEGACY_ROUTE = 404
MYSQL_PUBLIC = 0
MYSQL_X_PUBLIC = 0
UNJUSTIFIED_FTP_PUBLIC = 0
UNJUSTIFIED_SMTP_PUBLIC = 0
UNJUSTIFIED_VARNISH_PUBLIC = 0
UNKNOWN_PUBLIC_LISTENERS = 0
TLS_KEY_MODE = 0600
RUNTIME_DB_PRINCIPAL_RECONCILIATION = PASS
RUNTIME_WRITE_CAPABILITY = CLOSED_BY_REHEARSAL_AND_PRODUCTION_GRANT_EQUIVALENCE
UNNECESSARY_HIGH_PRIVILEGE_GRANTS = 0
B13X_INTERFERENCE = NÃO
```

The only failed systemd unit is the non-critical static `motd-news.service`
(`203/EXEC`, missing `/etc/update-motd.d/50-motd-news`); it has no application,
security, backup or availability dependency and is tracked as `INFRA18-P2-04`.

The external monitor workflow is now present on the remote default branch at
`666a04e3cc767b118520a9467a60f3e59663e390`, with a stable public User-Agent
for request attribution. Its workflow is read-only and its
branch-level CI predecessor has no deploy or infrastructure mutation step.
However, `workflow_dispatch` was not executed: no GitHub API write credential
was available, and the read-only GitHub connector cannot dispatch workflows.
Therefore `EXTERNAL_MONITOR_INITIAL_RUN = NOT_PROVEN` and
`TLS_EXPIRY_MONITORED = NOT_PROVEN` remain open.

```text
MACROSTEP_18_CONTROLLED_PRODUCTION_REMEDIATION_V2 = PARTIAL
MACROSTEP_18_POST_CHANGE_INDEPENDENT_AUDIT = PASS
P0_REMAINING = 0
P1_REMAINING = 3
P1_UNACCOUNTED = 0
PRODUCTION_DML_THIS_RUN = 0
PRODUCTION_DDL_THIS_RUN = 0
PRODUCTION_DCL_THIS_RUN = 1
PRODUCTION_CONFIG_MUTATIONS_THIS_RUN = 4
SERVICE_RESTARTS_THIS_RUN = 1
CONFIG_RELOADS_THIS_RUN = 2
CERTIFICATE_MUTATIONS_THIS_RUN = 0
FIREWALL_MUTATIONS_THIS_RUN = 0
APPLICATION_DEPLOYS_THIS_RUN = 0
GITHUB_COMMITS_THIS_RUN = 1
```

## Final pre-production preflight

```text
RUNTIME_LEAST_PRIVILEGE_REHEARSAL = PASS
MYSQL84_LEAST_PRIVILEGE_HARNESS = PASS
RUNTIME_REQUIRED_OPERATION_FAILURES_REHEARSAL = 0
UNNECESSARY_HIGH_PRIVILEGE_GRANTS = 0
PRODUCTION_CHANGESET_18_V1_STATUS = PARTIALLY_APPLIED
PRODUCTION_CHANGESET_18_INDEPENDENT_REVIEW = PASS
INDEPENDENT_MONITORING_USER_DECISION_REQUIRED = SIM
RECOMMENDED_OPTION = GITHUB_ACTIONS_SCHEDULED_EXTERNAL_HTTPS_PROBES
```

The rehearsal closes the local least-privilege evidence gap only. It does not
prove the production write path; no production write-smoke was run because it
would perform application DML. The production DCL applied in V2 is therefore
recorded as a reconciled grant contract. The production write-smoke was not
run because it would perform application DML; under the approved equivalence
rule, the rehearsal and effective production grants close this capability
gate without that persistent smoke.

## Final evidence closure (2026-08-31)

```text
DB_RUNTIME_WRITE_P1 = CLOSED
TLS_RENEWAL_P1 = OPEN
TLS_PERMISSION_PERSISTENCE_P1 = OPEN
EXTERNAL_MONITOR_P1 = OPEN
PRODUCTION_RUNTIME_GRANTS_MATCH_REHEARSAL = PASS
RUNTIME_WRITE_SMOKE_PRODUCTION_DML_REQUIRED = NÃO
TLS_RENEWAL_COMMAND_EXIT = 0
TLS_CERTIFICATE_REISSUED_THIS_RUN = NÃO
TLS_PRIVATE_KEY_MODE_AFTER_COMMAND = 0600
MONITOR_DEFAULT_BRANCH_COMMIT = 666a04e3cc767b118520a9467a60f3e59663e390
MONITOR_WORKFLOW_IDENTITY = Concursomestre-External-Monitor/1.0
EXTERNAL_MONITOR_FIRST_REAL_RUN = NOT_PROVEN
EXTERNAL_MONITOR = PENDING_NEXT_SCHEDULE
NEXT_EXPECTED_MONITOR_RUN = 2026-08-31T13:15:00Z (best-case schedule)
PRE_GO_MANUAL_ALERT_DELIVERY_CHECK = PENDING
TLS_NON_REISSUE_CURRENTLY_EXPECTED = SIM
RENEWAL_THRESHOLD_DAYS = 7
RENEWAL_SCHEDULE = daily 05:10 UTC
TLS_RENEWAL_VALIDATION_WINDOW_START = 2026-09-05T05:10:00Z
FIRST_EXPECTED_RENEWAL_CRON_AFTER_THRESHOLD = 2026-09-05T05:10:00Z
TLS_RENEWAL_TIMED_GATE = PENDING
TLS_KEY_PERMISSION_TIMED_GATE = PENDING
MACROSTEP_18_TIME_BOUND_TLS_CLASSIFICATION = PASS
MACROSTEP_18_FINAL_EVIDENCE_INDEPENDENT_AUDIT = PASS
MACROSTEP_18_READINESS_AUDIT = FAIL
P0_REMAINING = 0
P1_REMAINING = 3
```

The production grant equivalence closes the database evidence gate without
performing application DML. The CloudPanel renewal command completed without
error, but the certificate dates did not change, so issuance/renewal proof and
post-issuance permission persistence remain open. The external monitor is now
attributable and placed on the default branch, but its first real external run
and failure-state persistence are not proven through the available GitHub
access.

## Local tests and limitations

Passing checks:

- versioned systemd freeze policy assertions;
- freeze manager wiring;
- backup wiring;
- release observability wiring;
- distributed/cron lock wiring;
- sitemap readiness parity;
- PHP syntax for the audited operational scripts;
- PHP syntax and focused tests for the availability-safe freeze, TLS expiry,
  grant contract and infrastructure candidates;
- `npm run check:secrets`;
- `npm run check:text-encoding`;
- `git diff --check` on the candidate after local remediation.
- disposable MySQL Community `8.4.11` least-privilege and recovery harness in
  WSL, including backup/restore and failure-contract checks.

Unavailable or environment-limited checks:

- `VpsOperationsGateWiringTest.php` did not return JSON under Windows PHP;
- `BackupArtifactPublisherTest.php` failed because Windows PHP could not
  `fsync` the test artifact;
- Linux systemd, Nginx and full browser/build gates were not rerun in a clean
  Macrostep 18 candidate because no application code changed.

These limitations do not invalidate the disposable database rehearsal, but
they keep production infrastructure readiness blocked; they were not bypassed.

## Findings

| ID | Severity | Finding | Acceptance condition |
| --- | --- | --- | --- |
| INFRA18-P1-01 | P1 | Versioned freeze includes public serving layer; safe runtime mechanism is not versioned. | Version and test endpoint-level writer freeze that leaves public serving healthy. |
| INFRA18-P1-02 | P1 | MySQL 3306/33060 and legacy listeners bind publicly. | Approved exposure inventory plus private binds/firewall proof. |
| INFRA18-P1-03 | P1 | TLS expires 2026-09-12; renewal timer/success/alert unproven. | Prove renewal path, hook, last success and expiry alert. |
| INFRA18-P1-04 | P1 | systemd is degraded with failed/stale units. | Reconcile failed units and prove green critical service state. |
| INFRA18-P1-05 | P1 | Legacy backend route remains in production Nginx. | Security owner proves removal or explicitly documents the required boundary. |
| INFRA18-P1-06 | P1 | No independent alert path or host-loss detection proven. | Prove external alert delivery or accept risk before GO. |
| INFRA18-P1-07 | P1 | Runtime DB grants conflict with successful application health evidence. | Reconcile active release/config/principal without changing grants in this run. |
| INFRA18-P1-08 | P1 | Active TLS private-key metadata was observed with mode `0644`. | Harden to `0600` or stricter equivalent and recheck HTTPS continuity without exposing key material. |
| INFRA18-DR-01 | P2/GO | Off-host/KMS/immutability absent. | User decision and real recovery copy before Production GO. |

No P0 was found. The P1 findings are sufficient to block Macrostep 18.

## Required next decisions

1. Resolve the availability-safe writer-freeze boundary without touching the
   active observation.
2. Authorize a separate network/security change for public MySQL and legacy
   listeners; do not mutate them from this audit.
3. Prove TLS renewal before 2026-09-12.
4. Reconcile systemd failed units and runtime DB grants in their owning gates.
5. Choose an off-host encrypted immutable recovery option or record explicit
   risk acceptance; no paid service was created by this audit.

```text
SAFE_TO_AUTHORIZE_PRODUCTION_CHANGES = NÃO
SAFE_TO_DEPLOY = NÃO
SAFE_TO_APPLY_MIGRATIONS = NÃO
SAFE_TO_CLEAN_STRICT_ROWS = NÃO
```
