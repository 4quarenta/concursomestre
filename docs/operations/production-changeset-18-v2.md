# PRODUCTION_CHANGESET_18_V2

Status: `PARTIALLY_APPLIED`
Preparation date: 2026-08-31
Scope: authoritative root-cause follow-up for Macrostep 18
Production mutation during initial preparation: `NOT_EXECUTED`; controlled
execution was later authorized and recorded below.

This is a reviewable runbook, not permission to change production. It is
based on the VPS as the production source of truth. It excludes the MySQL
private-bind change and the legacy `/questao-pro-backend` 404 closure because
those were already applied and verified. It also excludes B13X-006 freeze and
writer state.

## Preconditions

- Confirm the production release is `b4ab179d5ab9bea3a52e070bc6f599be0ec544f4`.
- Confirm `PRELAUNCH`, home/health/readiness success and sitemap fail-closed.
- Capture a valid recovery point and an out-of-band operator session.
- Record current listeners, failed units, certificate metadata, runtime
  session identity and monitor branch state.
- Obtain an explicit owner for every action; stop on any unexpected change.

## Ordered remaining actions

| ID | Action | Required proof before mutation | Target | Rollback / hard stop |
| --- | --- | --- | --- | --- |
| V2-01 | Reconcile FTP, SMTP and Varnish exposure | Service owner, consumer inventory, active dependency and firewall plan | Unused services disabled, or required services privately bound/explicitly allowed | Restore only the affected service config; stop on unknown consumer or loss of approved mail/FTP/cache behavior |
| V2-02 | Prove TLS renewal and alerting | Panel ownership, exact `clpctl` command, certificate path, notification owner and non-destructive validation plan | Renewal success, expiry alert and last-success evidence are machine-verifiable | Stop on challenge/hook failure; use certificate runbook only for recovery |
| V2-03 | Harden TLS private-key permissions | Path/owner capture and certificate service dependency | Root-owned mode `0600` or stricter equivalent | Restore only previous mode if the certificate service cannot read the key; never copy or print key material |
| V2-04 | Repair the owning `motd-news` package boundary | Package ownership and whether the timer is required | No `203/EXEC`; systemd state is green or residual is explicitly accepted | Restore the package-owned unit/script; do not hide failure with `reset-failed` |
| V2-05 | Activate independent GitHub monitoring | Authorized GitHub access; workflow on default branch; Actions enabled; owner/alert destination | A real scheduled/manual run and controlled alert receipt are recorded | Remove only the monitor change if it causes unexpected requests; do not claim health from local probes |
| V2-06 | Reconcile runtime DB grants | Endpoint capability matrix, actual write principal, disposable MySQL rehearsal and migration/admin path | Runtime has only required capabilities; no DDL/admin/grant option | Restore reviewed grant snapshot through the migration principal; no ad hoc grants |
| V2-07 | Close and verify | All preceding proofs PASS; B13X-006 unchanged | P1s accounted, external monitor proven, PRELAUNCH retained | Stop and preserve evidence on any mismatch |

## Explicit exclusions

- No repeat of the applied MySQL private bind or legacy route closure.
- No production application deploy, migration, DML, DDL, DCL outside the
  separately approved action, database cleanup, Stripe operation, sitemap
  publication, index promotion or B13X-006 state change.
- No assumption that UFW denial substitutes for listener ownership.
- No assumption that a Git commit substitutes for a GitHub Actions run.

## Authorization boundary

```text
PRODUCTION_CHANGESET_18_V2 = PARTIALLY_APPLIED
MACROSTEP_18 = NOT_READY
P0_REMAINING = 0
P1_UNACCOUNTED = 0
PRODUCTION_GO = NÃO
```

## Controlled execution result (2026-08-31)

- Runtime DCL was applied to the reconciled host-specific runtime account with
  exactly the rehearsed schema grant set; no runtime grant was revoked. A
  production write-smoke was intentionally not run because it would perform
  application DML; the rehearsal plus production grant equivalence closes the
  runtime capability gate under the approved rule.
- TLS private keys were restricted to root mode `0600`; the CloudPanel renewal
  command returned exit `0`, but a future renewal's permission persistence and
  external expiry alert still require proof.
- Varnish and FTP were disabled after no active consumer/user was evidenced.
- Postfix was restricted to loopback and required a service restart because the
  host unit's `ExecReload` is `/bin/true`; application availability remained
  healthy.
- `motd-news` was not mutated; it was reclassified as OS hygiene P2 because
  the failed static unit has no application, security, backup or availability
  dependency.
- The monitor workflow was committed and pushed to the GitHub default branch
  in `68808a0d26497c868e575e97589fe157912bc40d`, then given a stable public
  User-Agent in follow-up commit
  `666a04e3cc767b118520a9467a60f3e59663e390`. A manual or scheduled run and
  alert receipt were not proven because API write credentials were unavailable.

```text
PRODUCTION_DCL = 1
PRODUCTION_CONFIG_MUTATIONS = 4
SERVICE_RESTARTS = 1
CONFIG_RELOADS = 2
CERTIFICATE_MUTATIONS = 0
FIREWALL_MUTATIONS = 0
APPLICATION_DEPLOYS = 0
PRODUCTION_DML = 0
PRODUCTION_DDL = 0
UNAUTHORIZED_PRODUCTION_DML = 0
UNAUTHORIZED_APPLICATION_DDL = 0
GITHUB_COMMITS = 1
```
