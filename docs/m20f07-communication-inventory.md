# M20F-07 Communication Inventory

## Current State

`M20F-07 = PARTIAL` on the canonical checkout. The structural communication
foundation and PRELAUNCH e-mail safety boundary are proven; dynamic provider,
database-concurrency and authenticated browser acceptance remain unexecuted.

Runtime evidence:

- Active PRELAUNCH runtime: `fb25d079`.
- `origin/1.0.0`: `b1a4c6a4`, ahead only with the Windows quality-harness commit.
- No runtime deploy is required for that origin delta.
- PRELAUNCH health/readiness: HTTP 200, `ready=true`, migrations pending `0`,
  checksum drift `0`.
- Home: HTTP 200. Sitemap: HTTP 503 with `X-Robots-Tag: noindex, nofollow`.
- Nginx, PHP-FPM, frontend and platform-event worker are active.

## Canonical Path

`CommunicationService` is the server-side intent/policy/delivery authority.
It persists `communication_intents`, applies communication policy, creates
channel deliveries and in-app notifications transactionally, and enqueues
e-mail through the existing `TransactionalOutbox`. The platform-event worker
dispatches `communication.intent.dispatch`; `EmailProviderAdapter` is the only
provider boundary.

The migrated domain producers queue through `CommunicationService`. A source
search found zero direct `Mailer::send` authorities outside
`EmailProviderAdapter`.

## Static Closure Evidence

- Communication event catalog: 26 canonical event identities.
- Observed producer event identities: 17.
- Unclassified observed event identities: 0.
- Communication wiring, marketing wiring, shared security wiring,
  subscription-notification wiring and reports wiring tests pass when run in
  an environment with the PHP CLI.
- PHP runtime files in the deployed candidate passed lint before deployment.
- Typecheck, strict typecheck, build, encoding, secrets, generated-artifact,
  source-size and diff checks pass.
- Vitest: 163 files, 944 tests, 944 passed.
- ESLint manifest: 832 expected, 832 unique, 0 missing, 0 errors, 99 existing
  warnings. Coverage is 100%.

## E-mail Safety

`CM_SYNTHETIC_EMAIL_SINK=1` is active in the PHP-FPM pool and the platform
event worker environment. A safe synthetic probe was captured by the sink;
the explicit missing-sink probe failed closed before provider delivery.

- `M20F07_EMAIL_SINK_PREFLIGHT = PASS`
- `M20F07_WEB_RUNTIME_EMAIL_SINK_ACTIVE = PASS`
- `M20F07_WORKER_EMAIL_SINK_ACTIVE = PASS`
- `M20F07_POST_DEPLOY_EMAIL_SINK = PASS`
- `M20F07_REAL_EXTERNAL_EMAIL_DELIVERIES = 0`
- No synthetic fixture or database mutation was created in this execution.

## Remaining Closure Evidence

The following gates remain unproven and therefore are not promoted to PASS:

- communication idempotency, real MySQL concurrency, retry and delivery
  reconciliation;
- provider-failure, channel and event-ordering matrices;
- dynamic consent, preference and deep-link authorization scenarios;
- authenticated user/admin browser E2E, mobile and accessibility acceptance.

The repository contains structural wiring tests but no canonical M20F-07
browser/provider acceptance harness for these scenarios. Creating a parallel
test-only delivery path would invalidate the requested evidence, so
`M20F-07 = PARTIAL` remains the correct closure state.

## Governance

No real data was inserted or deleted, no Stripe LIVE mutation occurred, and
the runtime remains PRELAUNCH. M20F-06 is closed, M20F-07 is not closed, and
the final Macro20F regression remains out of scope.
