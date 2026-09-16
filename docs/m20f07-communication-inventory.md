# M20F-07 Communication Inventory

## Current State

The communication architecture is **PARTIAL** on the local canonical checkout.
The additive foundation now provides one server-side intent, policy, delivery,
outbox and audit path for new or migrated producers. Existing domain producers
remain in migration scope until each supplies a stable semantic event identity.

## Canonical Path

`CommunicationService` persists `communication_intents`, applies
`CommunicationPolicy`, creates channel deliveries, writes in-app notifications
transactionally, and enqueues e-mail delivery through the existing
`TransactionalOutbox`. The platform event worker consumes
`communication.intent.dispatch`; `Mailer` remains the provider adapter.

## Existing Fragments

The following paths were verified by source search and remain outside the
canonical intent path:

- Direct e-mail producers: transaction, subscription, subscription billing support, authentication, feedback, reports, admin user actions, admin settings and admin analytics services.
- Direct notification producers: authentication, users, materials, feedback, transactions, subscriptions, comments, reports, rankings, questions, payments, moderation and operational task paths.
- Existing marketing automation eligibility and frequency governance remains in `MarketingAutomationService`; delivery was moved to `CommunicationService`.
- Existing Notification Center read/delete APIs remain the user-scoped read-side authority; admin send and legacy helper creation now prefer the canonical intent path after migration.

## Verification Boundary

The local machine has no PHP CLI, no installed Node dependencies, and the
configured VPS rejected the available SSH key. Therefore PHP lint, database
migration application, worker sink preflight, browser E2E, production deploy,
and PRELAUNCH health checks are not claimed here. No synthetic account,
database mutation, Stripe mutation, or e-mail delivery was performed.

## Closure Decision

`M20F-07 = PARTIAL` until the remaining producer fragments are consolidated,
the actual worker sink is verified, the additive migration is applied through
the CLI migration runner, and authenticated browser/mobile/accessibility and
provider-safe acceptance evidence is collected. The final Macro20F regression
remains out of scope for this package execution.
