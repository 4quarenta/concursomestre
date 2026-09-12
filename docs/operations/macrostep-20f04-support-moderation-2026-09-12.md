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

## Not proven

Authenticated Admin/User browser acceptance was not executed. No canonical
synthetic identity provisioning command, test fixture endpoint, or credentials
were available in the workspace or deployment environment. Consequently the
following remain open: support user/admin E2E, Support Compensation E2E,
authenticated benefits visibility, mobile authenticated flows, and the
authenticated accessibility gates. This is an execution/provisioning blocker,
not evidence of a product defect.

No synthetic account, session, subscription, transition, retention offer,
benefit grant, or Stripe mutation was created by this run.

## Network classification

- RSC prefetch aborts and Cloudflare RUM aborts: expected harness noise.
- `/favicon.ico` 404: expected missing static resource; not a product route or
  asset defect for the tested M20F-04 surfaces.
- `/benefits` and unauthenticated `/admin/...` URLs: non-canonical or protected
  routes; not used as M20F-04 acceptance surfaces.

## Status

M20F-04 remains `PARTIAL`. The missing authenticated browser evidence prevents
an M20F-04 PASS. The historical M20F-03 email incident remains historical and
was not repeated; current-run external email deliveries are zero.
