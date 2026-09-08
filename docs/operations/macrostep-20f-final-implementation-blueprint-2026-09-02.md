# Macro20F Final Implementation Blueprint

Status: amended for M20F-03 domain-event boundary and M20F-07 roadmap, 2026-09-07

## Package order

1. M20F-00 - Admin Design System & UX Foundation
2. M20F-01 - Admin Surface Rollout & Editor Foundation
3. M20F-02 - Marketing Conversion
4. M20F-03 - Billing, Entitlements & Benefits
5. M20F-04 - Support & Moderation, including Support Compensation
6. M20F-05 - Provider-safe Import & Collector
7. M20F-06 - Global Safe Operations: dry-run, namespaces and destructive operations
8. M20F-07 - Communications, Notifications & Email
9. Final Macro20F regression

## Current roadmap state

- M20F-00 = PASS
- M20F-01 = PASS
- M20F-02 = PASS
- M20F-03 = IN_PROGRESS / PARTIAL
- M20F-04 = NOT_STARTED
- M20F-05 = NOT_STARTED
- M20F-06 = NOT_STARTED
- M20F-07 = NOT_STARTED

## M20F-00 - Admin Design System & UX Foundation

Standardize Admin interaction with the operational predictability of WordPress Admin as a UX reference, while preserving ConcursoMestre's own visual identity. This is a component foundation, not a visual copy or a domain rewrite.

Use existing shared Admin primitives first. Where a primitive is missing, create one canonical implementation for page headers, primary actions, toolbars, search, filters, sort, data tables and columns, pagination, bulk actions, row actions, status presentation, loading/empty/error states, confirmation dialogs, editor shells, editor header/sidebar, form sections, save bars, validation summaries, feedback, danger zones and form fields.

Comparable lists use the same hierarchy: header, primary action, status tabs where applicable, bulk actions, filters, search, sort, results, row actions, pagination, result count and explicit loading/empty/error states. Equivalent actions keep consistent semantics and order: edit, view/preview, duplicate where applicable, archive/trash, delete. Destructive actions remain last and mobile uses the canonical overflow pattern. Buttons use PRIMARY, SECONDARY, UTILITY/GHOST and DESTRUCTIVE variants.

Editors share breadcrumb/context, title, status, form sections, visibility/dates, preview, save/publish and archive/delete semantics without forcing domain-specific fields into every editor. Feedback, validation, saving, retry and unsaved-navigation behavior are shared. Desktop and mobile use the same system, with keyboard navigation, focus, labels, ARIA semantics, contrast, dialog focus management, table semantics and error announcements preserved.

Standardization is achieved through reusable components plus domain configuration/data, never by copying page JSX. M20F-00 must not alter RBAC, billing, SEO authority, publication, persistence, audit semantics or launch mode.

### M20F-00 acceptance

- Canonical component surface exists without duplicate equivalents.
- Representative Users and Questions list/editor surfaces use the shared system; Blog remains on the canonical collection/editor contracts where needed.
- Desktop and mobile acceptance pass.
- Search, filters, sort, pagination, row actions, bulk actions where applicable, create/edit/save, invalid input, RBAC, CSRF, audit, loading, empty, error, confirmation and hydration behavior remain covered.
- Typecheck, strict typecheck, Vitest, lint, build, affected PHP gates, secret/encoding scans and runtime DDL static gate pass.
- PRELAUNCH remains active, with no real-data insertion or Stripe LIVE mutation.

## Future package requirements

### M20F-01 - Admin Surface Rollout & Editor Foundation

Roll out the M20F-00 system across all comparable Admin list and editor surfaces. The Admin should have WordPress Admin's operational predictability without copying its visual identity. Standardization must use canonical components plus domain configuration/data, never copied page JSX. Comparable lists share header, primary action, status tabs, bulk actions, filters, search, sort, results, row actions, pagination, result count and loading/empty/error states; actions use the order edit, view/preview, duplicate, archive/trash and delete, with destructive actions last and mobile overflow menus. Buttons use PRIMARY, SECONDARY, UTILITY/GHOST and DESTRUCTIVE variants.

Harden the shared disabled-action, form-field association, table-primitive, status, feedback, confirmation, editor-shell, save-bar, validation, dirty-state and navigation-away contracts. All current editable surfaces use the same editor interaction language, including question, exam, blog, novidade, law, user and landing page editors. Preserve publication, visibility, RBAC, CSRF, audit, persistence and domain authority. Require 100% comparable-list and editable-surface standardization, zero unjustified exceptions, no duplicate save submissions, mobile/accessibility acceptance and no behavior regression.

The remaining package order is fixed: M20F-02 Marketing Conversion; M20F-03 Billing, Entitlements & Benefits; M20F-04 Support & Moderation including Support Compensation; M20F-05 Provider-safe Import & Collector; M20F-06 Global Safe Operations; M20F-07 Communications, Notifications & Email; then final Macro20F regression. M20F-03 must keep paid subscription state separate from effective access, use one Benefit Service for manual, campaign, redemption, support and level rewards, support billing extensions and temporary access without mutating a paid Stripe plan, enforce exclusive codes and audit/idempotency, and exercise the exhaustive billing state-transition matrix with no double charge, duplicate grant, webhook-order dependence or provider drift. M20F-03 owns only the domain-event contracts required for Billing/Benefits correctness, including BENEFIT_APPLIED, BILLING_EXTENSION_CONFIRMED, REFUND_RETENTION_OFFER_CREATED, REFUND_RETENTION_ACCEPTED, REFUND_RETENTION_DECLINED and REFUND_COMPLETED; it must emit them with stable semantic identity and recipient/domain context so M20F-07 can consume them without a second authority. It must not expand into the global notification/email platform. M20F-04 must use that same Benefit Service for controlled compensation. M20F-05 must provide sandbox/mock provider boundaries and preserve canonical/provider identity separation. M20F-06 must provide dry-run, namespaces, preview, scoped confirmation, audit and recovery for destructive operations.

### M20F-02 - Marketing Conversion

Marketing must explicitly connect Campaign, Audience/Segment, Rule, Offer, Benefit, Benefit Code, Landing, Email, Notification, Banner and Conversion. Campaign and Landing workflows require lifecycle, dates, activation/pause, placement, tracking, preview, publication, relation integrity, audit and reversible testability.

Campaign lifecycle is represented by draft, scheduled, active, paused, ended and archived states, with an authoritative start/end window. Eligibility applies audience checks, frequency caps, cooldowns, impression limits, mutual-exclusion groups and conversion suppression before a public campaign is shown. Fixed-deadline countdowns use the configured deadline and never reset on revisit.

The canonical browser funnel is landing_view -> cta_clicked -> plan_selected -> checkout_started. Paid conversion remains provider/backend-owned; the browser cannot assert subscription_activated or purchase_completed. Marketing events use the existing consent-gated first-party analytics ledger and retain only allowlisted attribution metadata. M20F-02 must not create a second billing, entitlement or analytics authority: offers, coupons and future benefits are integration boundaries to Macrostep 16 and M20F-03.

The implementation reuses the existing promotion, landing-page, offer, countdown and analytics services, adds campaign eligibility/lifecycle helpers, safe landing/CTA/plan-selection instrumentation, and a normalized persistent authority for campaigns, segments and deduplicated campaign interactions. The Admin exposes campaign/segment CRUD, lifecycle transitions, governance fields and bounded campaign funnel metrics; public interaction writes are idempotent and contain only allowlisted attribution references. PRELAUNCH, noindex, publication guards, consent gating, RBAC, CSRF and audit authority remain unchanged. Provider-backed billing, benefit grants, email automation and destructive global operations remain deferred to their later packages.

### M20F-03 - Billing, Entitlements & Benefits

Cover billing, subscriptions, upgrade/downgrade, renewal, cancellation/reactivation, trials, coupons, refunds, payment failure/recovery, reconciliation, webhooks, temporary access, free billing days, benefit codes, marketing benefits, support compensation and level rewards.

### Deferred post-launch item - plan-specific PIX payment and pricing

M20F-03 launch policy is `CARD_ONLY`: recurring card subscriptions remain the
authoritative billing path and PIX is disabled at launch. PIX-related billing
combinations are classified as `DEFERRED_POST_LAUNCH`, not as untested
supported combinations. A future package must first audit the actual Stripe
contract and then implement, if supported, independently Admin-configurable
`STANDARD_PRICE`, `PIX_PRICE_ENABLED` and `PIX_PRICE` per canonical plan,
server-side amount resolution, immutable payment-price snapshots, provider
amount/currency reconciliation, webhook idempotency, expiration/refund
semantics, coupon/Benefit compatibility, public/Admin UX and mobile/accessibility
acceptance. No illustrative price or percentage discount is a default or
business authority.

Paid subscription state is distinct from effective access state. Paid tier plus active access grants equals effective entitlement; provider billing period plus valid billing-extension benefits equals the next billing date. Temporary access must not mutate the paid Stripe plan. Free billing days must extend the canonical provider billing period, with no old-date charge, duplicate invoice or duplicate subscription.

Use one reusable Benefit Service for ADMIN_MANUAL, CAMPAIGN, CODE_REDEMPTION, SUPPORT_COMPENSATION, LEVEL_REWARD and PROMOTION. Benefit codes support scope, dates, assigned user, campaign, eligible plans, redemption limits, stacking policy, status and audit, including USER_EXCLUSIVE enforcement. The future account area exposes active benefits, expiry and renewal impact.

Level rewards may return only through the generic benefit architecture and state-transition tests. The package requires a programmatic matrix for plan/status/subscription/renewal/upgrade/downgrade/cancellation/reactivation/trial/coupon/free-days/access-grants/overlap/compensation/campaign/level/refund/failure/recovery/duplicate-delayed-out-of-order/concurrent transitions. Double charge, duplicate reward, webhook order dependence, stale plan restore, local-provider drift and duplicate Stripe plans are prohibited.

### M20F-04 - Support & Moderation

Preserve support queues, moderation, reports, comments, threads, replies, assignment, approve/reject, resolve/ignore, bulk actions and audit. Support Compensation must grant free billing days, temporary access, both or an exclusive benefit code through the shared Benefit Service, with reason, ticket/reference, operator, before/after billing and access state, limits and idempotency.

### M20F-05 - Provider-safe Import & Collector

Introduce provider-safe boundaries, sandbox/mock fixtures, provenance, pagination, selection, preview, mapping, dedupe, failure/retry and publication guards. Gran and external IDs remain distinct from canonical identities. No real provider ingestion is required for local evidence.

### M20F-06 - Global Safe Operations

Provide dry-run, synthetic namespaces, preview, scoped confirmation, audit and recovery for cache/log/global reset and other destructive operations. Broad production destruction is prohibited without an explicit safe-operation contract.

### M20F-07 - Communications, Notifications & Email

This package is deferred and must remain `NOT_STARTED` until M20F-03 and the preceding packages are complete. It will create one cross-product communication architecture for the in-app Notification Center, transactional email, Marketing email delivery, templates, user communication preferences, mandatory communication policy, delivery queues, retries, idempotency, delivery status, deep links, audit, Admin observability and provider abstraction.

The package must cover Account, Authentication/Security, Billing, Subscriptions, Benefits, Refunds, Refund Retention Offers, Support, Marketing, System/Admin and relevant Content events. It must enforce one notification authority, one transactional-email authority and one shared delivery infrastructure for Marketing email, with no direct domain SMTP, duplicate notification engines or duplicate semantic communication. Transactional and Marketing policy categories must remain distinct; transactional Benefit/financial communication must not depend on Marketing consent, campaign eligibility, frequency caps, cooldowns or dismissal. Deep links must remain authorized, email GET requests must never mutate financial state, and RBAC, audit, mobile and accessibility must be covered.

M20F-07 consumes M20F-03 domain events rather than recreating Billing/Benefit logic. It must define the canonical event-to-channel policy, templates, preference rules, delivery/retry/idempotency contract and provider-safe acceptance. Pending provider states must never generate a message claiming a Benefit or billing extension is confirmed. This package is the owner of cross-product communication standardization; M20F-03 may provide only the domain event emission needed for its own state-machine correctness.

## Cross-package constraints

Keep production PRELAUNCH until separate launch gates pass. Do not insert real data, mutate Stripe LIVE, change secrets, promote sitemap/indexability or start a later package inside an earlier package run. Every package must use reversible synthetic fixtures and prove cleanup, RBAC, CSRF, audit, persistence, accessibility, mobile behavior, performance and no private-data leakage. Package blueprints must identify objective, affected functions, reused/modified/new components, schema/migration/API/backend/UI/analytics impacts, RBAC/audit impact, tests, dependencies, risks, rollback and acceptance gates. M20F-03 domain events must remain transport- and provider-neutral, carry no payment secrets or unnecessary private data, and be consumable by the future M20F-07 communication layer without creating parallel notification or email authority.

This document supersedes the pre-implementation ordering from the 20F-0.4 audit and is the authoritative implementation blueprint.
