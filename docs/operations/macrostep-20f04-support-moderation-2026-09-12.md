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
The exact manifest cleanup was executed before closing the run. The final
inventory reported zero active synthetic users, support cases/messages,
Benefit grants/codes/definitions, and synthetic test clocks. No Stripe
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
no external delivery was observed in this run. The sink was removed during
cleanup; the historical M20F-03 email incident remains historical and is not
rewritten by this M20F-04 ledger.
## Final delta evidence - 2026-09-12

- Runtime candidate: `a77782cb019b061d04f25603e0a7aa894c7b77b6`, deployed atomically to PRELAUNCH. Migration dry-run reported zero pending migrations.
- Support assignment: PASS through the Admin UI. Queue, detail, assignment PUT 200, status PUT 200, and audit visibility were observed. Assignment is persisted in `support_case_assignments`.
- Support compensation access: PASS through the Admin Support UI. The response was 200 and the User Benefits surface showed the resulting temporary access without changing the paid plan.
- Support compensation concurrency: PASS with two live authenticated Admin pages released at the same logical start. Both canonical requests returned 200 through idempotent replay; duplicate grant and extension effects were zero.
- USER_EXCLUSIVE code: wrong User redemption was denied with 409 and no benefit; the target User redemption had already passed through the normal User Benefits UI with 200 and one active benefit.
- Billing and combined Support compensation were exercised through the Admin UI and returned canonical 400 validation because the synthetic User is Free and has no active Stripe TEST subscription. They remain unclosed; no direct Stripe mutation was used.
- Moderation queue routes loaded in an authenticated Admin session. No pending report/comment existed in the final run, and the User question surface did not expose a reportable question link, so authenticated approve/reject/resolve/bulk evidence remains unexecuted rather than being claimed PASS.
- Mobile layout checks on the rendered User/Admin surfaces reported `scrollWidth == clientWidth` at 390 and 430. Full action-level mobile evidence remains partial where the target control was not mounted.
- Browser diagnostics: no page errors; the only recorded non-2xx responses were expected business validation/denial responses from canonical POST actions.

Evidence files are kept under `.codex-tmp/m20f04-target-final-evidence.json`, `.codex-tmp/m20f04-admin-final-evidence.json`, and `.codex-tmp/m20f04-other-final-evidence.json` until cleanup is complete.

## Final prerequisite closure - 2026-09-13

- Canonical runtime release: `8a0aac9ae673142e83064b1355accea583745805`, deployed atomically to production PRELAUNCH. Origin `1.0.0` points to the same commit; the release manifest and migration dry-run were verified after deployment.
- Canonical checkout proof: the synthetic User selected `/plans`, opened `/checkout/5`, completed the normal Stripe Elements TEST flow, and received the product confirmation `PAGAMENTO APROVADO`. Local subscription `504` converged with Stripe TEST subscription `sub_1UF0uGHTtB22su0xv3qdLlOx`; `livemode=false`, status `trialing`, and provider/local period end matched. No LIVE mutation or real payment method was used.
- Support Compensation billing: PASS through the Admin Support UI. The canonical Benefits/Billing authority applied one provider-confirmed billing extension using current provider state; no duplicate billing extension effect was observed.
- Support Compensation combined: PASS through the Admin Support UI after the provider extension fix. The canonical authority applied exactly one `ACCESS_AND_BILLING_EXTENSION` grant, one confirmed provider extension, and preserved the paid base plan. The fixed grant was `d377e32c-5331-4185-ae81-8c39f171eda9`; duplicate grant and duplicate provider-extension effects were zero for the acceptance case.
- Authenticated moderation: PASS through the Admin UI. The synthetic fixture used `QuestionsService`, `CommentsService`, and `ReportsService`; direct raw DB insertion was zero. Two comments were moderated (`approved` and `spam`) and the synthetic report was resolved through `Manter conteúdo atual`, persisted as `ignored` with workflow `closed`, response, operator, and resolution timestamp.
- Runtime defect fixed: `AdminSupportSection` could render the contextual and legacy report modals simultaneously for the same report, intercepting the concluding action. Release `8a0aac9a` retains the legacy fallback only when the report is outside the contextual group. Targeted ESLint, typecheck, strict typecheck, build/deploy, and post-deploy moderation acceptance passed.
- Browser diagnostics for the final moderation acceptance had no page errors, console errors, failed requests, or HTTP errors. Expected RSC prefetch aborts remain harness noise only.

This section supersedes the earlier partial-state observations for the same synthetic identities. Evidence is recorded before cleanup; the final synthetic inventory must be read after cleanup and must not be inferred from this section.

## Final closure audit - 2026-09-13

- The post-acceptance cleanup removed the second delta batch as well. The canonical inventory reports zero active synthetic users, support cases/messages, Benefit grants/codes/definitions, and test clocks. The exact Stripe TEST subscription was canceled and its customer deleted; local synthetic subscription and transaction rows are zero.
- The attempted final authenticated viewport/accessibility delta did not produce acceptance evidence. One run reached the real forms but the harness crashed on an unsupported Playwright `Locator.isRequired()` call; the corrected retry was stopped at login timeout after the rate-limit window. No rate-limit configuration was changed and no authentication bypass was used.
- Therefore the M20F-04 result remains `PARTIAL`. The missing gates are final authenticated mobile/accessibility evidence for the complete Support/Benefits surface and must not be promoted from stale or detached observations. M20F-05, M20F-06, and M20F-07 remain not started.
- Immutable synthetic audit history remains under policy: deleted-account tombstones are retained for privacy/audit semantics, and the moderation history row remains immutable. These are not mutable fixtures and are reported separately from the zero active-fixture counters.

## Final mobile and accessibility attempt - 2026-09-13

- The web-runtime email sink preflight passed before provisioning. One synthetic User and one synthetic Admin were provisioned through the approved CLI path and then removed through the canonical cleanup path.
- The authenticated mobile/accessibility runner made one normal login attempt per role. Both login API responses returned HTTP 200, but the browser remained at `/auth?mode=login` with no authenticated `Sair` state. No page error, console error, failed request, or HTTP error was observed. No product mutation was executed in this failed attempt.
- Classification: `HARNESS_DEFECT` / `EVIDENCE_GAP`. This does not prove a product accessibility defect, but it also does not prove the required authenticated mobile and accessibility gates. Rate limiting and authentication configuration were not changed, and no bypass or fabricated cookie was used.
- The final cleanup inventory again reports zero active synthetic users, support cases/messages, benefits, subscriptions, transactions, sessions, refresh tokens, and test clocks. Deleted-account tombstones and immutable audit rows remain separately attributable.

## Final mobile and accessibility closure attempt - 2026-09-13

- The active runtime remained `8a0aac9ae673142e83064b1355accea583745805` in
  production PRELAUNCH. The web PHP-FPM pool had `CM_SYNTHETIC_EMAIL_SINK=1`
  and the FPM service was active before the synthetic moderation fixture was
  created. No real data or Stripe LIVE mutation was used.
- The final consolidated browser run used one normal login per role. User and
  Admin login responses were HTTP 200 with authenticated dashboard state. No
  page errors, console errors, failed requests, or unexpected HTTP errors were
  recorded.
- User Support was positively exercised at 430px and 390px: the synthetic
  conversation was visible, the conversation opened through the User UI, and
  `scrollWidth == clientWidth` at both widths. The Admin Support queue and the
  pending Moderation report were also rendered at mobile widths with no
  horizontal overflow.
- The Admin Support detail was positively inspected at the responsive surface;
  the real Compensation fields were present and named: operator, mode,
  temporary plan, free days, ticket/reference, and reason. The critical form
  focus checks were 6/6 visible, with zero invisible focus observations. A
  shared live status region was present.
- The Comments moderation queue rendered two canonical synthetic comments at
  390px with three labelled checkboxes and the supported bulk-action options.
  The checkbox remained unconfirmed after the probe click, so bulk selection
  is recorded as an evidence gap rather than PASS.
- Responsive action controls use the shared `AdminRowActions` pattern: desktop
  actions are hidden below `sm` and exposed through a native `<details><summary>`
  menu. The final probe did not complete the menu interaction for Support or
  Moderation before the terminal timeout. Consequently Admin mobile detail,
  Compensation mobile interaction, Moderation mobile action/dialog operation,
  and the full keyboard/status/mobile-accessibility intersection remain
  `EVIDENCE_GAP`; this is not classified as a product defect.
- Existing authenticated Moderation dialog evidence remains preserved from the
  prior canonical E2E. No new moderation decision was submitted in this delta.
- The exact synthetic manifest cleanup ran after evidence persistence. Final
  canonical inventory reported `active_synthetic_users=0`,
  `synthetic_support_cases=0`, `synthetic_support_messages=0`,
  `synthetic_benefit_grants=0`, `synthetic_benefit_codes=0`, and
  `synthetic_benefit_definitions=0`. Deleted-account tombstones and immutable
  audit history remain separately attributable under retention policy.

M20F-04 remains `PARTIAL`. No M20F-04 P0/P1 product defect was confirmed, but
the following closure evidence is still missing: final authenticated mobile
interaction through the Support/Moderation row menus, mobile Compensation form
interaction, confirmed bulk checkbox state, and complete authenticated
keyboard/status/dialog intersection evidence. M20F-05, M20F-06, and M20F-07
remain not started.

## Final interaction evidence closure - 2026-09-13

- This was an evidence-only delta. The active runtime remained
  `8a0aac9ae673142e83064b1355accea583745805` in production PRELAUNCH; origin
  was ahead only by documentation/ledger commits, so no runtime deploy was
  required. The PHP-FPM web sink preflight passed with
  `CM_SYNTHETIC_EMAIL_SINK=1` and the FPM service active.
- One synthetic User and one synthetic Admin were provisioned through the
  canonical PRELAUNCH provisioner. Both authenticated through the normal login
  form with HTTP 200 and authenticated dashboard state. No auth bypass,
  fabricated cookie, login storm, rate-limit bypass, or product configuration
  change was used.
- Admin Support mobile interaction passed at 430px and 390px. The queue and
  detail rendered without horizontal overflow; the real assignment control was
  reached and the assignment request returned HTTP 200 with the persisted
  success state. The action was executed at 390px after the queue/detail path
  was verified at both mobile widths.
- Moderation mobile interaction passed at 390px. The real row action opened the
  moderation workbench, the safe canonical `keep_current_content` decision was
  submitted through the UI, and the workbench closed with an HTTP 200 response
  and visible success state. No direct moderation API substitution was used.
- Support Compensation mobile interaction passed at 390px. The real detail
  form was opened, `ACCESS_ONLY`, one free day, ticket/reference, and reason
  were entered, and the submit returned HTTP 200 through
  `/api/admin/user_actions.php`. The confirmation and resulting status were
  visible in the authenticated Admin UI.
- Bulk interaction passed at 390px. Both synthetic pending comment rows were
  selected through their labelled checkboxes, `Aprovar` was chosen, the bulk
  request returned HTTP 200, and both rows were verified as `Aprovado` after
  switching to `Todos` and reloading. Expected selected rows: 2; changed rows:
  2; unselected synthetic rows changed: 0.
- Accessibility evidence from the same real surfaces passed: five critical
  Support/Compensation controls had visible focus, zero keyboard traps and zero
  invisible-focus observations; critical labels were associated; Support and
  Moderation queue actions were discoverable; bulk checkboxes and operation
  were reachable; and status feedback was exposed through the shared status
  region. The previously closed dialog gate remains PASS. Mobile intersection
  checks at 390px and 430px found zero blocking overflow, clipped dialogs, or
  hidden validation.
- Browser diagnostics recorded zero product 404s, zero unclassified 404s, and
  zero API/route/asset failures. One aborted Google Tag Manager telemetry fetch
  was classified as expected external browser telemetry noise, not a product
  network failure. No GET request mutated financial or support state.
- Evidence was persisted before cleanup. Canonical cleanup removed the two
  synthetic identities and dependent state; the final inventory reported zero
  active synthetic users, support cases/messages, Benefit grants/codes/
  definitions, and synthetic test clocks. The sink captured synthetic mail and
  recorded zero external deliveries. Immutable audit/tombstone records remain
  only under the existing retention policy.

### Closure result

- `SUPPORT_ADMIN_MOBILE=PASS`
- `MODERATION_MOBILE_ACCEPTANCE=PASS`
- `SUPPORT_COMPENSATION_MOBILE=PASS`
- `M20F04_FINAL_AUTHENTICATED_MOBILE=PASS`
- `M20F04_KEYBOARD_ACCESSIBILITY=PASS`
- `M20F04_FORM_ACCESSIBILITY=PASS`
- `M20F04_DIALOG_ACCESSIBILITY=PASS`
- `M20F04_STATUS_FEEDBACK_ACCESSIBILITY=PASS`
- `M20F04_QUEUE_ACCESSIBILITY=PASS`
- `M20F04_BULK_ACTION_ACCESSIBILITY=PASS`
- `M20F04_MOBILE_ACCESSIBILITY_INTERSECTION=PASS`
- `M20F04_ACCESSIBILITY_ACCEPTANCE=PASS`
- `M20F04_BULK_ACTION_PERSISTED_RESULT=PASS`
- `M20F04_BLUEPRINT_CAPABILITY_MATRIX=PASS`
- `M20F04_MISSING_CAPABILITIES=NONE`

This section supersedes the immediately preceding evidence-gap section for
these four interactions. M20F-05, M20F-06, and M20F-07 remain not started.

## Mobile navigation probe - 2026-09-13

- A read-only authenticated Admin probe at 390px used the normal login form
  and confirmed HTTP 200 login, the visible `Abrir menu do admin` drawer,
  the Support submenu expansion, and navigation from the drawer into the
  Moderation destination. No page, console, or HTTP errors were observed and
  no state mutation was issued.
- The probe's initial exact Support-path assertion was intentionally not used
  as acceptance evidence because the tab and child entry share the label
  `Solicitações`; this was a harness locator issue, not a product failure. The
  actual Support mobile action/detail and Moderation mobile action evidence is
  recorded in the preceding closure section.
- The probe identity was removed immediately afterward. Canonical inventory
  again reported zero active synthetic users, support cases/messages, Benefit
  grants/codes/definitions, and synthetic test clocks.
