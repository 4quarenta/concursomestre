# Prelaunch Production Manual Test Matrix

This matrix is for controlled manual verification while the application remains
in `PRELAUNCH`. It is an operational checklist, not authorization for public
launch, real-data ingestion, or production cleanup.

## A. Safe read-only checks

- Open the homepage, health/readiness endpoints, public navigation, search,
  taxonomy pages, questions, exams, plans, support, blog, terms, and privacy.
- Verify desktop and mobile layouts, keyboard navigation, headings, links,
  breadcrumbs, cookie consent presentation, and error pages.
- Use only GET/HEAD requests and inspect responses without submitting forms.
- Confirm canonical and robots behavior remains PRELAUNCH-safe; production
  sitemap publication must remain disabled.

## B. Controlled writes

No production write is authorized by this matrix by default. Any write test
requires explicit operator approval, a disposable test account, synthetic input,
an identified table impact, and a documented cleanup or rollback procedure.

Permitted only after that approval: account/session smoke tests, authentication
flow checks, and other already-audited synthetic paths whose writers are known.
Do not use real personal, payment, or content data.

## C. Deferred B13X paths

Do not exercise resettable-strict writers, study-session/statistics writes,
ingestion, import, backfill, crawler, or dataset reset during this matrix.
Those paths require the signed B13X freeze/resume state and their own gate.

## D. Destructive or prohibited actions

- No database cleanup, migration, DDL, seed, or bulk DML.
- No deletion of primary/admin accounts or user data.
- No Stripe LIVE operation, billing reconciliation, or provider mutation.
- No public indexing, sitemap publication, or Production GO.
- No changes to cron, systemd, firewall, TLS keys, grants, or backup policy.

## E. Payment boundary

If a payment smoke is separately authorized, use Stripe TEST only, a disposable
test identity, and the approved test fixture. Never paste secrets, tokens,
webhook payloads, or payment identifiers into tickets or reports.

## F. Privacy boundary

Use synthetic data only. Do not record names, emails, phone numbers, addresses,
session tokens, cookies, provider IDs, or financial payloads in evidence.

## G. API and mobile

Run only documented read-only API checks and the existing mobile/API smoke
commands. Verify authentication, authorization, error shape, and absence of
private fields. Do not create a second client or alter API contracts as part of
the manual test.

## H. Admin

Verify that admin routes remain protected and that no public page exposes admin
state. Do not perform editorial, billing, import, moderation, or configuration
changes during this prelaunch test.

## Exit criteria

Record the exact release SHA, timestamp, environment mode, URLs checked, and
any failed check. A pass here means only that the controlled prelaunch smoke
passed; it does not authorize real data, public indexing, or Production GO.
