# Infrastructure Operational Contract

Date: 2026-08-31

This document is the versioned operational boundary for the ConcursoMestre
infrastructure. It is a contract and runbook index, not permission to change
production. Production remains in `PRELAUNCH` while Macrostep 13 observation
is active.

## Availability-safe invariants

- The public serving layer is always-on during a dataset or billing freeze:
  Nginx, PHP-FPM, the frontend, health, readiness and essential monitoring are
  not stopped by a strict writer freeze.
- Strict control is applied at the mutating HTTP boundary and to an explicit
  allowlist of writer jobs. The freeze state is signed, bound to the host and
  boot, expires by policy, and fails closed on tampering or drift.
- A freeze must never be implemented by stopping the public serving layer.
  The legacy systemd policy that includes serving units is not an acceptable
  production mechanism until replaced by the availability-safe boundary.
- `/health` is liveness-oriented and `/readiness` fails when critical database,
  migration, storage, runtime-store or worker checks fail.
- PRELAUNCH keeps the public sitemap unavailable with `503`, `text/plain`,
  and `X-Robots-Tag: noindex, nofollow`.

## Critical topology

```text
Cloudflare -> DNS -> Nginx :80/:443
                    |-> Next.js frontend :3000 (loopback)
                    |-> PHP-FPM :19000 (loopback)
                    |-> internal extractor :8010 (loopback)
                    |-> MySQL/Percona
                    |-> static sitemap fail-closed boundary
```

Redis, Memcached and the extractor are internal dependencies. Public listeners
must be limited to the approved edge surface. MySQL, MySQL X, Varnish cache,
FTP and SMTP require an explicit owner and exposure decision; a bind alone is
not evidence that a public listener is necessary.

## Failure signals and ownership

| Signal | Required evidence | Owner |
| --- | --- | --- |
| HTTP availability | Independent GET checks for home, health and readiness | Operations |
| Origin/service crash | systemd state plus external health | Operations |
| Database failure | readiness database check and MySQL service state | Database |
| Backup freshness | backup health JSON, checksum and manifest | Recovery |
| Log maintenance | current health JSON and bounded log growth | Operations |
| TLS expiry/renewal | certificate dates, active renewal job, last success and alert | Infrastructure |
| Writer freeze | signed state, inventory hash and writer boundary checks | Data operations |
| Sitemap | 503/noindex in PRELAUNCH; materializer status and invalidation evidence | SEO operations |
| Host loss | alert path independent of the monitored VPS | Operations |

Local health files are useful evidence but are not an independent alert path.
They must not be the only way a failure is detected.

## Independent monitoring contract

The external monitor must execute HTTPS probes against the public hostname,
not `localhost`, and record status, response class and certificate expiry.
The minimum probes are:

| Probe | Expected response | Alert condition |
| --- | --- | --- |
| `/` | HTTP 200 within the configured timeout | timeout, DNS/TLS failure or non-2xx |
| `/api/system/health.php` | HTTP 200 and liveness success | timeout, non-2xx or malformed response |
| `/api/system/readiness.php` | HTTP 200 and readiness success | timeout, non-2xx or readiness failure |
| TLS certificate | Valid hostname and expiry beyond configured threshold | threshold breach or renewal failure |
| Host-loss signal | External probe cannot reach the public edge for the configured consecutive checks | alert after consecutive failures |

The exact thresholds and alert channel are deployment configuration, not
hardcoded application facts. A local cron or a process on the same VPS is
explicitly not independent monitoring.

## Recovery runbook index

1. **Site down / 522:** check external HTTP, DNS and Cloudflare first; then
   check public listeners, Nginx configuration, frontend, PHP-FPM, firewall and
   systemd. Do not stop additional services while diagnosing.
2. **Database unavailable:** preserve logs and current release identity, check
   readiness and MySQL state, and use the last verified recovery set. Never
   overwrite the production database during diagnosis.
3. **Disk full:** stop nonessential writers only under an approved runbook,
   preserve the active binlog and verified backup, and record the recovery
   boundary before any cleanup.
4. **Bad release:** switch only to a previously verified application release;
   prefer application rollback over destructive schema rollback for additive
   migrations.
5. **Backup failure:** fail closed, retain the last known-good artifact, alert
   the recovery owner, and do not publish a partial artifact.
6. **VPS loss:** recovery requires a verified off-host, encrypted and immutable
   copy. That capability is currently not proven and is a Production GO gate.

## Current decision gates

- Local DB backup: current; the health record reports checksum and manifest
  success on 2026-08-31, while an independent checksum recheck remains
  uncompleted in this collection.
- PITR: MySQL binlog/durability are currently enabled, but operational PITR
  recovery remains a separate evidence gate.
- Off-host, KMS/managed encryption and immutability: not proven.
- TLS renewal: panel-managed through the existing `clpctl` cron path, whose
  installed source sets a seven-day renewal threshold and whose cron runs
  daily at 05:10 UTC. The authorized command completed with exit `0` while
  the certificate was outside that window, so non-reissue is expected; expiry
  remains 2026-09-12. The renewal and key-permission checks are time-bound
  pre-GO gates beginning with the 2026-09-05 05:10 UTC run.
- Network hardening: MySQL classic/X and SMTP bind to loopback, FTP and Varnish
  are inactive, and the legacy backend route returns 404. Final checks found
  no targeted public listener.
- Independent monitoring: the read-only probe workflow is on the remote
  default branch `1.0.0`, with User-Agent
  `Concursomestre-External-Monitor/1.0`. No matching access-log request has
  yet appeared after publication, so it is pending the next eligible
  scheduled run; the local negative failure-contract self-test passes.
- Runtime DB grants: the configured write principal resolves to
  `concursomestre@127.0.0.1` and its effective grants match the exact
  disposable MySQL rehearsal. No persistent production DML smoke was required
  because the rehearsal proved the required write capability.
- Macrostep 13 observation: do not change freeze state, writers, timers or
  serving services from this workstream.

## Versioned verification helpers

- `backend/scripts/operations/check_tls_expiry.php` emits machine-readable
  expiry status and fails closed for unreadable or invalid certificates.
- `backend/scripts/operations/verify_runtime_grants.php` accepts sanitized
  `SHOW GRANTS` lines on standard input and emits only capability findings;
  it never connects to a database or prints raw grants.
- `config/deploy/mysql-network-hardening.cnf.example` is a private-bind
  candidate only and requires consumer/SSH validation before production use.
- `config/deploy/nginx.concursomestre.conf.example` explicitly rejects the
  legacy `/questao-pro-backend` route without redirecting it to another
  backend surface.
