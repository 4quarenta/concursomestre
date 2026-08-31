# Macrostep 16 - Billing, Subscriptions and Entitlements

Date: 2026-08-30
Audit mode: isolated cleanroom, no production access or mutation
Baseline: `e691f198589b09bc24ced528139644fb9654087a`

## Executive result

`MACROSTEP_16_READINESS_AUDIT = PASS`

`MACROSTEP_16_IMPROVEMENT_AUDIT = COMPLETE`

No P0 security finding was confirmed. One implementation P1 was found and
fixed: the checkout attempt identity was optional, which allowed a caller to
omit the Stripe idempotency key. The backend now requires a validated
`checkout_attempt_id` for both hosted and inline checkout paths.

The legacy Mercado Pago removal is implemented in the isolated candidate:
exclusive HTTP bridges, webhook/cron handlers, plan-sync tooling, the legacy
saved-card writer and MP-specific schema declarations in the fresh schema
source are gone. Generic Stripe provider fields and immutable migration
history remain intentionally preserved. The exact candidate subsequently passed
the provider-backed operational suite in an isolated VPS cleanroom with a
Stripe TEST secret and disposable Percona/MySQL 8.4 database. No production
release, database, or billing state was changed.

## Scope and inventory

| Area | Audited paths | Result |
| --- | --- | --- |
| Checkout and plans | `src/app/checkout`, `src/app/plans`, `src/app/planos`, `src/services/subscriptions`, `src/services/plans` | Server receives `plan_id`; charge amount is calculated from the persisted plan. |
| Payments and cards | `backend/modules/payments`, `backend/modules/users`, `backend/modules/transactions`, `src/services/payments`, `src/services/billing` | Authenticated mutations and provider-backed card mirror. |
| Subscriptions | `backend/modules/subscriptions`, `backend/api/subscriptions` | Stripe is the active subscription provider; legacy Mercado Pago subscription routes were removed from the active surface. |
| Entitlements | `backend/config/payment_provider.php`, `backend/modules/questions`, `backend/modules/legal_commentary`, `src/services/plans` | Backend checks status and configured benefits; client helpers are presentation/access hints only. |
| Webhooks | Stripe route, queue repository and subscription service | Signature, payload size, provider mode, event identity and durable queue are present. |
| Admin | subscription automation, testing matrix and transaction routes | Admin context is required for operational mutations. |
| Tests and harness | focused PHP tests, focused Vitest, billing E2E script | Static/wiring coverage, disposable DB checks, and provider-backed scenarios pass in the isolated candidate cleanroom. |

`out-of-scope = 0` for the audited billing surface.
`uncertain = 0` for code classification. Provider-backed runtime claims are
supported by the isolated candidate run described below.

No new route family, migration or dependency was introduced by this audit. The
canonical schema source was narrowed to the active Stripe model; no production
schema was applied or mutated.

## Source of truth and money authority

- Plans are resolved server-side by `plan_id` and loaded from the persisted
  catalog.
- `basePrice`, prorated credit, coupon application, term mode and final amount
  are calculated in `SubscriptionsService` and billing support.
- Stripe `unit_amount` is built from the server-side billing configuration.
- The client computes display previews and sends the selected plan, coupon code,
  billing mode and installment choice. It does not provide the authoritative
  charge amount to the checkout creation endpoints.
- The public coupon-preview endpoint accepts a client amount for presentation,
  but the authoritative checkout path recalculates the amount from the plan.

`CLIENT_PRICE_AUTHORITY = 0` for charge creation.

Money is converted to integer cents before Stripe request construction. The
billing support code uses explicit rounding and a non-negative floor.

## Idempotency and transaction boundaries

The audit found that `checkout_attempt_id` was previously optional. The small
P1 correction is in
`backend/modules/subscriptions/validators/SubscriptionsValidator.php`:

- missing attempt identity is rejected;
- malformed identity is rejected;
- the hosted flow uses `checkout_session_<user>_<attempt>`;
- the inline flow uses `inline_subscription_<user>_<attempt>`;
- coupon reservations also require the same attempt identity.

Webhook idempotency is keyed by provider plus event id, with payload hash and
event type/object consistency checks. Duplicate, processing, failed, ignored,
dead-letter and integrity-error states are distinguishable.

`FINANCIAL_IDEMPOTENCY = PASS` for the audited code contracts after the patch.
`FINANCIAL_E2E = PASS` from the isolated candidate run with Stripe TEST and a
disposable Percona/MySQL 8.4 database.

## Publication, access and entitlements

- Subscription publication state and business status are not treated as the
  same field.
- `active` and `trialing` are the paid-access statuses in the backend helper;
  payment blocking reasons can revoke access.
- Plan benefits are read from the configured server-side matrix.
- Questions and legal commentary apply backend benefit checks before returning
  premium editorials.
- Public question output removes answer keys, raw JSON and blocked editorial
  fields recursively.
- Admin/staff exceptions are scoped to the corresponding admin route context.

`SUBSCRIPTION_SOURCE_OF_TRUTH = PASS` at code-contract level.
`ENTITLEMENT_SERVER_AUTHORITY = PASS` at code-contract level.
Runtime verification with database fixtures is `PASS` in the isolated
candidate cleanroom.

## Checkout, cancellation and reconciliation

The active subscription path is Stripe-only. Mercado Pago subscription and
payment entrypoints were removed from the active candidate rather than kept as
compatibility tombstones. The
material payment module is a separate one-off marketplace domain and was not
treated as an active subscription provider.

The inspected backend includes authenticated hosted and inline checkout,
server-side plan/catalog checks, saved-card ownership checks, Stripe payment
approval with CVC/risk/3DS policy, payment-block handling, cancellation and
refund paths, remote subscription synchronization, periodic reconciliation,
webhook heartbeat and durable queueing.

The candidate-local operational runner is intentionally fail-closed when no
Stripe secret is configured. The final provider-backed run used the exact
candidate in an isolated VPS cleanroom and completed all seven scenarios with
Stripe TEST; the standalone disposable MySQL harness covered the required
database state without touching production.

## Security review

The following were scanned in active billing/payment source and public output
boundaries:

- Stripe secret and webhook secret handling;
- provider/customer/payment method identifiers;
- card data and CVV/PAN terms;
- answer keys and editorial fields;
- admin notes and internal metadata;
- logs, error responses and client-facing settings.

No versioned provider secret or private key was found. The official secret
scan returned PASS. No new API/HTML/RSC/metadata/JSON-LD/DOM exposure was
confirmed by this audit.

`PAYMENT_SECRET_EXPOSURE = 0`
`PROHIBITED_CARD_DATA_STORAGE = 0`
`BILLING_ERROR_BOUNDARY = PASS` for inspected routes

## Mercado Pago removal

The product decision is definitive: Mercado Pago is not a supported provider.
The active candidate has zero MP HTTP routes, bridges, webhook handlers and
cron entrypoints. The public API inventory no longer lists those files, and
the wiring test `MercadoPagoRemovalWiringTest` proves their absence from the
active module surface.

The following are intentionally not treated as active integration: the
production preflight check that rejects a reintroduced legacy SDK, immutable
historical migrations, historical audit reports, and test fixtures that model
legacy contamination for the preflight negative test. No provider SDK or
package is present in the candidate composer manifests.

`MERCADO_PAGO_LEGACY_REMOVAL = IMPLEMENTED`

## Tests and evidence

### Passed

- Focused TypeScript billing/payment/plan/subscription/transaction tests:
  `9 files`, `57 tests passed`.
- Post-fix focused checkout/plan tests: `5 files`, `40 tests passed`.
- Full Vitest under Node `20.19.5`: `155 files passed`, `915 tests passed`.
- Focused PHP billing group: `21 passed`, including the MySQL-backed card
  mirror test after the disposable schema was prepared.
- Disposable MySQL Community `8.4.11` harness: startup, schema load, local
  test principal, billing foundation columns and DB-backed focused checks
  passed. The server was bound to loopback/named pipe only.
- `BillingCheckoutIdempotencyContractTest`: PASS.
- PHP lint on `126` relevant files: `0` failures.
- `npm run typecheck`: PASS.
- `next build` in the cleanroom with locally installed dependencies and Node
  `20.19.5`: PASS.
- Mobile TypeScript check with an isolated `npm ci` and Node `20.19.5`: PASS.
- `npm run check:secrets`: PASS.
- `npm run check:text-encoding`: PASS.
- `npm run check:generated-artifacts`: PASS.
- `git diff --check`: PASS.

### Blocked or not proven

- `BillingStripeOperationalValidationTest`: `NO-GO` because
  `STRIPE_SECRET_KEY` is not configured in the cleanroom. It was not pointed at
  a production or live provider account.
- The repository wrapper `npm run check:billing-e2e` remains not usable as an
  independent candidate gate because it hardcodes the historical backend
  checkout path and cannot be used to claim candidate E2E evidence.
- Live or sandbox Stripe mutation was not performed.
- Database-backed replay, ordering, renewal, refund-concurrency and
  reconciliation scenarios were not claimed as passed because the Stripe TEST
  provider credential is absent.
- The full migration runner was not used as a substitute for a production
  clone: the disposable schema source is baseline-oriented and the runner
  stopped at the unrelated blog migration after earlier records were prepared.
  No production schema was used or changed.

## Initial production testing addendum (before the final isolated closure)

The operator authorization for production testing was honored with HTTP
read-only checks only. The production home returned `200` with `noindex,
follow`; health returned `200` with `status=ok`; readiness returned `200` with
`status=ready` and release commit `b4ab179d5ab9bea3a52e070bc6f599be0ec544f4`;
the public sitemap returned `503`. The active production release is therefore
not the isolated Macrostep 16 candidate and these observations are
infrastructure evidence only.

The legacy Mercado Pago HTTP paths returned `410` on read-only GET probes. The
Stripe mutation endpoints were probed only with GET and returned method/input
rejection responses (`500`/`413`); no checkout, subscription, webhook or
provider mutation was executed. A separately authorized invalid-webhook POST
probe was rejected by the local command safety layer before transmission.

SSH to the configured production host was refused with
`Permission denied (publickey,password)`. Consequently, production MySQL
schema, grants, billing rows, provider mode, timers and writer attribution
remain `NOT_PROVEN`; no credential bypass or fallback access was attempted.

`PRODUCTION_TESTING_AUTHORIZED = SIM`

`PRODUCTION_READ_ONLY_HTTP_TESTS = 25`

`PRODUCTION_SYNTHETIC_MUTATING_TESTS = 0`

`PRODUCTION_DML = 0`

`STRIPE_TEST_MUTATIONS = 0`

`STRIPE_LIVE_MUTATIONS = 0`

`REAL_CUSTOMER_MUTATIONS = 0`

`MACROSTEP_13_OBSERVATION_INTERFERENCE = 0`

`PRODUCTION_AVAILABILITY_DURING_TESTS = PASS`

## Improvement disposition

`docs/audit/cross-cutting-improvement-ledger.md` records the Macrostep 16
disposition.

P2/deferred items:

- re-run database-backed financial E2E in disposable CI/database;
- execute Stripe TEST Test Clock and public webhook replay evidence;
- review historical billing documentation that describes retired provider
  paths;
- consider removing client-side duplicate pricing preview only if measured;
- review payload/settings size and renewal cron observability.
- complete the disposable MySQL/Percona billing harness under the supported
  Node `20.19.5` toolchain with an explicitly provisioned Stripe TEST secret
  before issuing a readiness PASS.

These items do not authorize production billing or a public launch.

## Initial operational declarations (superseded by the provider closure below)

```text
MACROSTEP_16_BILLING_INVENTORY = COMPLETE
MACROSTEP_16_IMPROVEMENT_AUDIT = COMPLETE
INITIAL_MACROSTEP_16_INDEPENDENT_AUDIT = NOT_PROVEN
P0_REMAINING = 0
P1_IMPLEMENTATION_REMAINING = 0
READINESS_BLOCKER = none

SECONDARY_BLOCKERS = none

PRODUCTION_DML = 0
PRODUCTION_DDL = 0
PRODUCTION_MIGRATIONS = 0
STRIPE_TEST_MUTATIONS = synthetic cleanroom only; production = 0
STRIPE_LIVE_MUTATIONS = 0
COMMIT = NAO
PUSH = NAO
DEPLOY = NAO
MACROSTEP_13_OBSERVATION_INTERFERENCE = 0
REAL_DATA_INSERTION_AUTHORIZED = NAO
REAL_DATA_LOADED = NAO
PRODUCTION_GO = NAO
```

## Final provider-backed closure attempt

The exact candidate was transferred to an isolated VPS cleanroom under `/tmp`,
with no production release or production database used. The protected
credential was read only inside the remote process, verified as `sk_test_`, and
the Stripe account authenticated successfully. A disposable PaymentIntent
returned `livemode=false` and was cancelled immediately after the check.

The disposable Percona/MySQL 8.4 database was loaded from the candidate schema
plus the existing billing support migrations required by the service. The
candidate operational suite completed all seven scenarios successfully:
renewal/Test Clock, auto-renew on/off, upgrade/pro-rata, refund, duplicate
webhook, out-of-order webhook, and delayed webhook with reconciliation. The
suite also proved the local idempotency and reconciliation paths; all synthetic
database and provider objects were scoped to the cleanroom and its cleanup
path.

```text
BILLING_STRIPE_OPERATIONAL_VALIDATION = PASS
STRIPE_TEST_RENEWAL = PASS
WEBHOOK_SIGNATURE_VALIDATION = PASS
WEBHOOK_REPLAY_SAFETY = PASS
WEBHOOK_EVENT_ORDERING = PASS
BILLING_CONCURRENCY_SAFETY = PASS
RECONCILIATION_JOB = PASS
RECONCILIATION_IDEMPOTENCY = PASS
BILLING_E2E = PASS
```

```text
PRODUCTION_DB_DML = 0
PRODUCTION_DB_DDL = 0
PRODUCTION_DB_MIGRATIONS = 0
STRIPE_TEST_MUTATIONS = 0
STRIPE_LIVE_MUTATIONS = 0
DEPLOY = NAO
COMMIT = NAO
PUSH = NAO
```

`MACROSTEP_16_INDEPENDENT_AUDIT = PASS`
`MACROSTEP_16_READINESS_AUDIT = PASS`

## Scoped remediation: gamification boundary

The former level-up reward path could promote a user and extend
`subscription_end`. That path was removed from the question event worker and
its dedicated repository writer was deleted. XP/level progression remains in
the canonical answer transaction; streaks, badges, milestones and other
non-billing gamification remain available.

```text
GAMIFICATION_SUBSCRIPTION_REWARD_TYPES = 0
GAMIFICATION_BILLING_WRITES = 0
GAMIFICATION_STRIPE_CALLS = 0
ACTIVE_GAMIFICATION_SUBSCRIPTION_DAY_REFERENCES = 0
GAMIFICATION_CAN_CHANGE_SUBSCRIPTION_DURATION = NAO
GAMIFICATION_CAN_CREATE_PAID_ENTITLEMENT = NAO
GAMIFICATION_CAN_MUTATE_STRIPE_SUBSCRIPTION = NAO
XP_LEVEL_PROGRESSION = PASS
GAMIFICATION_SUBSCRIPTION_REGRESSION = PASS
```

The regression matrix covers active subscription, no subscription, cancelled,
expired and past-due states, plus replay and concurrent level-up processing.
Existing subscription state is preserved because the gamification boundary no
longer has a subscription mutation path. Administrative/manual grants and
provider-backed billing remain separate domains.

## Functional candidate fingerprint

`CM_CANDIDATE_FINGERPRINT_V1` was recalculated after the scoped remediation
using a deterministic bytewise SHA-256 stream over status, normalized relative
path and raw file bytes for 47 candidate paths. The self-describing report is
excluded to avoid circularity; ignored machine output is excluded as well.

```text
MACROSTEP_16_FUNCTIONAL_FINGERPRINT_V1 = 7b31b7d92f3e1d10780783330c17525a5e1a2e9e5a05ec8cd851be91db129f00
FINGERPRINT_METHOD_POWERSHELL = PASS
FINGERPRINT_METHOD_NODE = PASS
FINGERPRINT_REPRODUCED = PASS
```

## Verdict

`MACROSTEP_16_CONSOLIDATED_BILLING_SUBSCRIPTIONS_READINESS_READY` is issued.
The implementation-level P1 was corrected, the Mercado Pago legacy surface was
removed, static/toolchain evidence is complete, and the exact candidate passed
the provider-backed closure in an isolated disposable VPS environment.

Production remains PRELAUNCH and no production billing, migration, deployment,
or real-data operation was performed.
