# Macrostep 20BR.1 — Stripe health semantics and B13X coverage closure

Date: 2026-09-01

## Decision

The production preflight now distinguishes scheduler health from an explicitly
authorized B13X freeze. A valid, signed, unexpired availability-safe state,
with the canonical `cron.service` writer boundary and an explicit production
expectation, is reported as `EXPECTED_FROZEN`. It is accepted by preflight as
an operationally expected state, but it is not reported as normal scheduler
health. An absent, invalid, expired, tampered, or non-allowlisted freeze fails
closed.

When the freeze is not expected, the normal Stripe reconciliation heartbeat
remains mandatory and stale execution is a failure.

Webhook activity is separate from endpoint health. The preflight classifies a
recent valid delivery as `HEALTHY_ACTIVE`; a configured endpoint with no
activity or an old last-event marker is `HEALTHY_IDLE` when configuration and
the route are valid. Invalid configuration, invalid signatures/status evidence,
or known processing failures remain failures. No timestamp, webhook event, or
financial operation is fabricated by this change.

## Implementation

- `backend/config/StripeHealthGate.php` validates explicit signed B13X freeze
  configuration and the canonical scheduler boundary.
- `backend/config/production_preflight.php` consumes the gate and exposes the
  classifications while preserving fail-closed success semantics.
- `backend/tests/StripeHealthGateTest.php` covers recent/stale scheduler,
  authorized and invalid freeze, idle webhook, and active webhook cases.

The deployment must provide these non-secret references during the authorized
B13X freeze:

- `B13X_STRIPE_HEALTH_FREEZE_EXPECTED=true`
- `B13X_AVAILABILITY_SAFE_FREEZE_STATE_FILE=<signed state path>`
- `B13X_AVAILABILITY_SAFE_FREEZE_KEY_FILE=<private key path>`
- `B13X_AVAILABILITY_SAFE_FREEZE_RUN_ID=<signed run id>`

The key contents are never placed in Git, logs, or this report.

## Verification

- PHP lint: PASS
- Stripe health gate tests: PASS
- production preflight behavior tests: PASS
- production preflight wiring tests: PASS
- TypeScript typecheck: PASS
- secret scan: PASS
- `git diff --check`: PASS
- Stripe TEST mutations: 0
- Stripe LIVE mutations: 0
- database DML/DDL/migrations: 0

## Operational result

The first deploy attempt remains on the previous release because its preflight
found stale Stripe evidence. No release switch, migration, or launch-mode
change was made by that failed attempt. The next deploy is permitted only after
the host has the explicit freeze references above and the signed state still
validates. PRELAUNCH remains authoritative; public indexing remains disabled.

Macrostep 13 is not closed by this remediation until the coverage runner has
completed and its final strict-state evidence has passed.
