# M20F-07 Communication Inventory

## Current State

`M20F-07 = PARTIAL` on the canonical checkout. The structural communication
foundation, PRELAUNCH e-mail safety boundary, idempotency replay, retry,
preference authority, real two-process MySQL idempotency race and the full
26-event channel matrix are proven; provider-failure/reconciliation and
authenticated browser acceptance remain unexecuted.

Runtime evidence:

- Active PRELAUNCH runtime: `fb25d079`.
- `origin/1.0.0`: the current origin head includes this acceptance harness and
  evidence update; it remains ahead of the active runtime with no runtime
  deploy required.
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
- No synthetic fixture remains after the execution; the harness cleanup counters
  are all zero.

## Canonical Dynamic Harness

The repository-owned CLI entrypoint is
`backend/tests/M20F07CanonicalDynamicAcceptanceHarness.php`. It requires the
PRELAUNCH runtime, the web-runtime sink proof and an explicit
`m20f07-<run-id>` namespace. It creates the synthetic identity through
`AdminUserActionsService`, publishes through `CommunicationService`, and
performs exact cleanup.

The latest PRELAUNCH run (`m20f07-20260919-dynamic-08`) proved:

The sanitized machine-readable result is archived at
`docs/testing/m20f07-dynamic-08.json`.

- duplicate semantic event: one intent, one in-app notification and one e-mail
  outbox effect;
- transactional dispatch replay: processed without a second provider effect;
- marketing e-mail opt-out suppression;
- optional marketing enabled/disabled preference policy and mandatory
  transactional delivery while marketing e-mail is disabled;
- canonical outbox retry/reclaim after a synthetic temporary failure;
- all 26 catalog events with expected channel sets, `26/26` passed and zero
  duplicate in-app or e-mail channel effects;
- two independent PHP workers behind a real file barrier, one canonical intent,
  one notification and one outbox row;
- synthetic active users, communication intents and preferences remaining: `0`;
- real data insertions/deletions, Stripe LIVE mutations and external e-mail
  deliveries: `0`.

## Remaining Closure Evidence

The following gates remain unproven and therefore are not promoted to PASS:

- provider-failure, delivery reconciliation, worker recovery and event-ordering
  matrices;
- full marketing consent eligibility/cooldown policy and deep-link
  authorization;
- authenticated browser E2E for User/Admin, preferences and negative paths,
  mobile and accessibility acceptance;
- authenticated user/admin browser E2E, mobile and accessibility acceptance.

The harness declares the remaining scenarios explicitly as evidence gaps:
provider failure, worker recovery, delivery reconciliation, event ordering,
full consent, preference/deep-link browser behavior, authenticated user/admin
browser flows, mobile and accessibility acceptance. It does not fabricate
those results, so
`M20F-07 = PARTIAL` remains the correct closure state.

## Governance

No real data was inserted or deleted, no Stripe LIVE mutation occurred, and
the runtime remains PRELAUNCH. M20F-06 is closed, M20F-07 is not closed, and
the final Macro20F regression remains out of scope.
