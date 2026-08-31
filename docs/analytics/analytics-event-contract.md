# Analytics event contract

Date: 2026-08-31

This is the single application contract for optional product analytics. It is
not an authorization to enable public indexing, campaigns, or live billing.

## Privacy boundary

- Analytics and marketing consent default to denied.
- The browser sends no optional event before explicit analytics consent.
- The first-party endpoint accepts aggregate product signals only.
- New event writes do not persist email, user identifiers, session identifiers,
  raw URLs, referrers, caller hooks, payment identifiers, or free text.
- UTM source, medium, and campaign are bounded to an allowlisted character set
  and are sent only after analytics consent. `utm_content` and `utm_term` are
  intentionally not captured yet.
- Existing database columns retained for compatibility are written as NULL by
  the new contract. Historical admin analytics data is not treated as a new
  consent or conversion authority.

## Event names

| Event | Source | Consent | Purpose | Authority |
| --- | --- | --- | --- | --- |
| `identifiable_visit` | auth | analytics | auth surface exposure | client lifecycle signal |
| `signup_started` | auth/checkout | analytics | registration flow started | client state |
| `signup_completed` | auth/checkout | analytics | account creation actually succeeded | successful auth response |
| `checkout_started` | checkout | analytics | checkout flow entered | rendered checkout state |
| `plan_viewed` | checkout | analytics | plan offer exposed | rendered plan state |
| `payment_method_started` | checkout | analytics | payment step entered | rendered payment state |
| `checkout_abandoned` | checkout | analytics | checkout left before completion | page lifecycle signal |
| `payment_failed` | checkout | analytics | payment attempt failed | client error stage only |

The public browser endpoint does not accept `purchase_completed`, renewal,
subscription, or `email_captured` assertions. Paid conversion is authoritative
only in the server-side billing state and provider-backed reconciliation. A
browser redirect, button click, or success URL cannot create a conversion.

## Properties

Allowed properties are limited to `planId`, `cycleLabel`, bounded UTM values,
and the metadata keys `mode`, `authMode`, `step`, and `stage`. Metadata values
are short token-like strings. Arbitrary objects, payment IDs, answer content,
free text, user fields, URLs, and external hooks are discarded.

## Versioning

The current contract is version 1 at the consent-storage layer. Event names
remain stable only when their trigger and authority remain stable; a semantic
change requires a new contract review and focused tests.
