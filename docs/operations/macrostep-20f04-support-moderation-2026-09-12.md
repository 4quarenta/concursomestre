# Macrostep 20F-04 Evidence - 2026-09-12

## Scope

Support, moderation, and Support Compensation were audited against the
canonical Macro20 blueprint. M20F-05, M20F-06, and M20F-07 were not started.
Closed M20F-03 financial gates were preserved and not rerun.

## Runtime change

- Initial release commit: `c39d6bfc378512a5d0f310b9ccba47d43ee999b4`
- Active runtime release: `a35c134f1bf316d853b0da9aa94f44310edaf20a`
- Deployment target: production PRELAUNCH
- Runtime changes: admin mutation CSRF/method enforcement, canonical support
  compensation fields and audit metadata, the Admin support-case compensation
  entrypoint through `BenefitService`, and explicit support compensation mode
  validation for access, billing extension, or both.
- No migration was required; the production dry-run reported zero pending
  migrations.

## Verified

- Typecheck, strict typecheck, focused Vitest (36/36), and full ESLint run
  completed; ESLint errors were zero and no new warnings were introduced.
- Remote PHP lint passed for all changed PHP files.
- Production PRELAUNCH returned HOME 200, health 200, readiness 200, sitemap
  503, and `X-Robots-Tag: noindex, nofollow`.
- Active release manifest contains the exact release commit and `gitDirty` is
  false.
- Public smoke at the canonical `/support` and `/profile/benefits` routes
  returned 200 at desktop and mobile widths without product API errors.
- Effective PHP-FPM pool configuration was checked with `php-fpm -t` and
  `-tt`; the temporary synthetic email sink was active before any mutation.

## Authenticated evidence

The CLI-only provisioner created exactly one synthetic User and one synthetic
Admin through `AdminUserActionsService`, after the PRELAUNCH/FPM sink preflight.
Normal browser login returned HTTP 200 for both roles. The live authenticated
contexts then proved user support create/list/detail/reply and admin queue,
detail, reply, and status-transition interactions. The Admin Benefits surface
also accepted a synthetic definition, a `USER_EXCLUSIVE` code bound to the
synthetic User, and a manual grant, all through the browser and the shared
Benefit authority.

The rotating refresh token invalidated a storage state after its capturing
context was closed. The remaining authenticated interactions therefore ran in
the same live context that completed normal login; this is recorded as a
harness limitation, not an auth bypass.

## Remaining evidence

M20F-04 remains `PARTIAL`. Authenticated moderation mutation evidence,
Support Compensation access/billing/combined browser evidence, exclusive-code
target redemption and wrong-user denial, true barrier-based compensation
concurrency, the full mobile matrix, and the complete accessibility matrix
were not proven before the login rate limiter returned `Retry-After: 563`.
The generic Benefit Code creation and manual grant do not substitute for the
missing Support Compensation exclusive-code proof. No claim of M20F-04 PASS is
made.

The current run produced one synthetic support case, one synthetic Benefit
grant, two synthetic Benefit definitions, and one synthetic exclusive code.
All are removable by the exact provisioner manifest cleanup below. No Stripe
subscription, test clock, plan transition, live mutation, or real product
data insertion was created.

## Network classification

- RSC prefetch aborts and Cloudflare RUM aborts: expected harness noise.
- `/favicon.ico` 404: expected missing static resource; not a product route or
  asset defect for the tested M20F-04 surfaces.
- `/benefits` and unauthenticated `/admin/...` URLs: non-canonical or protected
  routes; not used as M20F-04 acceptance surfaces.

## Status

M20F-04 remains `PARTIAL`. The authenticated support and Benefits evidence is
material progress, but the missing gates above prevent a PASS. The synthetic
email sink was active in the web FPM runtime during mutation-capable tests and
no external delivery was observed in this run. The sink is removed during
cleanup; the historical M20F-03 email incident remains historical and is not
rewritten by this M20F-04 ledger.
