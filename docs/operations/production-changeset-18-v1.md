# PRODUCTION_CHANGESET_18_V1

Status: `READY_FOR_CONTROLLED_PRODUCTION_CHANGE`
Preparation date: 2026-08-31
Production mutation: `NOT_EXECUTED`
B13X-006 interference: `0`

This is one ordered changeset for the Macrostep 18 P1 findings. It is a
runbook for a separately authorized production window, not an authorization.
It contains no credentials, private key, certificate material or provider
secret. The public serving layer must remain available throughout.

> Follow-up note (2026-08-31): this V1 is superseded for the remaining open
> findings by `production-changeset-18-v2.md`. The MySQL private bind and the
> legacy route 404 are already applied and must not be repeated. V2 records the
> authoritative VPS root causes, including the panel-managed TLS path, the
> default-branch placement gap for GitHub Actions, the `motd-news` package
> drift, the remaining wildcard listeners, the runtime grant mismatch and the
> TLS private-key permission finding.

## Global preconditions

- Candidate package and release identity are verified against the approved
  release SHA.
- Current production release, PRELAUNCH mode, SSH continuity, health and
  readiness are captured before the window.
- A valid recovery backup and state capture are available and independently
  verified.
- The B13X-006 signed observation state is read and preserved. No freeze,
  resume, timer or writer-state operation is performed by this changeset.
- An operator has a tested out-of-band SSH session before any network change.
- The operator has a tested rollback path and an explicit stop decision for
  every action below.

## Ordered actions

| ID | Purpose | Preconditions | Command / action | Expected output | Restart / downtime | B13X dependency | Rollback | Validation | Hard stop |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M18-01 | Keep writer freeze availability-safe | Local freeze regression PASS; package approved | Deploy the versioned `DatasetWriterSystemdFreezePolicy` and its tests; use endpoint/job writer controls for mutating boundaries | Serving units are absent from freeze stop/resume inventory; strict writer coverage remains complete | Application package switch only; no serving stop | Read B13X-006 read-only; do not modify it | Roll back application package to previous verified release | Run freeze policy tests, health, readiness and public GET checks | Any serving unit appears in strict stop/resume order or health/readiness changes |
| M18-02 | Close public database exposure | Approved listener inventory; second SSH session verified | Install the reviewed MySQL network config with private `bind-address` and `mysqlx-bind-address`, or disable MySQL X only after consumer proof; apply firewall rules for approved edge ports | `ss` shows database ports loopback/private; approved edge remains reachable | MySQL restart may be required; maintenance window required | Do not touch observation state; verify its local store remains available | Restore previous config from the pre-change capture, validate syntax, restart only under rollback approval | `ss`, MySQL socket/app connectivity, home, health, readiness and firewall listing | SSH continuity lost, approved application connectivity fails, or unknown consumer is detected |
| M18-03 | Reconcile runtime DB grants | Actual application `USER()`/`CURRENT_USER()` and required capabilities proven in disposable MySQL 8.4 | Apply only the separately reviewed DCL for the actual runtime principal; no ad hoc grant expansion | Required runtime operations pass; DDL/admin capabilities remain absent | MySQL session reconnect, no application downtime expected | Observation read-only only | Restore the previous grant snapshot through the approved migration principal | Authenticated and public application smoke plus grant verifier | Principal identity remains ambiguous or any required operation fails |
| M18-04 | Remove legacy public backend route | Active consumer count is zero or security owner accepts a documented replacement boundary | Publish Nginx candidate containing exact and prefix 404 locations for `/questao-pro-backend` | Legacy path returns 404 and `/api/` remains healthy | Nginx reload only after `nginx -t`; no stop | Preserve public serving and B13X-006 | Restore prior Nginx file and reload after syntax validation | `nginx -t`, legacy route 404, API health, home and readiness | Any active consumer is found or Nginx validation fails |
| M18-05 | Reconcile failed systemd units | Unit-by-unit classification and owner approval | Remove or repair only stale failed units; never use `reset-failed` as a substitute for repair | `systemctl is-system-running` is green or approved residual is documented | Unit-specific; no broad restart | Do not touch observation timers | Restore only the affected unit definition/configuration | `systemctl --failed`, critical service status, health and readiness | A critical serving, database or observation unit fails |
| M18-06 | Prove TLS renewal and expiry alerting | Real certificate path and ACME ownership confirmed; dry-run plan approved | Run the approved ACME dry-run and install the expiry checker; reload only if the ACME tool reports a changed certificate and the hook is approved | Renewal path and expiry alert are machine-verifiable | Possible Nginx reload only on certificate change | Keep observation untouched | Restore previous certificate/config only through the certificate runbook | Certificate dates, dry-run result, hook log and HTTPS probe | Dry-run/challenge/hook fails or certificate material is exposed |
| M18-07 | Add independent monitoring decision | Existing external resource or explicit owner decision | Configure approved external HTTPS/host-loss probes, or record explicit residual-risk acceptance; do not use VPS-local curl as independence | External signal has a testable alert path and owner | No application restart expected | No writes to B13X-006 | Remove only the new external probe/configuration | Controlled probe failure test and alert receipt | No independent destination or no alert receipt |
| M18-08 | Close the window safely | All prior validations PASS | Capture final state, confirm PRELAUNCH, sitemap unavailable, strict state unchanged and no unauthorized mutation | Availability and operational evidence are complete | None | B13X-006 hash/status unchanged | Revert only the last approved action if validation fails | External home/health/readiness, listeners, systemd, TLS, grants, logs | Any unresolved P1, public sitemap exposure or observation drift |

## Production validation contract

The operator must record before and after values for:

- public home, health and readiness;
- current release SHA and PRELAUNCH mode;
- MySQL socket and application connectivity;
- approved listeners and firewall state;
- `systemctl --failed` and critical service states;
- certificate expiry, renewal result and expiry checker output;
- runtime principal identity and grant verifier output without raw grants;
- legacy route response;
- B13X-006 observation status/hash;
- strict writer state and sitemap fail-closed response.

Any unexpected change is a hard stop. Do not continue to the next action by
guessing or by broadening privileges.

## Explicit exclusions

This changeset does not include PITR configuration, off-host/KMS/immutability,
Stripe changes, strict cleanup, database content changes, ingestion, sitemap
publication, or Production GO.
