# Macrostep 19 - Analytics, conversion and marketing readiness

Date: 2026-08-31

## Context and safety

The candidate is based on `origin/1.0.0` at
`cd965f11d498331c77621f6f9f6e5af173c085f6`. The main worktree was not used for
implementation. Production remains `PRELAUNCH`; no commit, push, deploy,
database write, Stripe mutation, paid campaign, or sitemap publication was
performed.

`REAL_DATA_LOADED = NAO` and `PRODUCTION_GO = NAO`.

## Cloudflare privacy gate

The confirmed pre-consent edge source was Cloudflare Google Tag Gateway. The
single authorized control-plane change disabled it:

- before: `enabled=true`, endpoint `/uhmk`, measurement ID `G-KSRDJ1BZ3P`;
- after: `enabled=false`, with the remaining configuration preserved;
- Zaraz tools: `0`; Worker Routes: `0`; Snippets: `0`;
- analytics markers in active managed rulesets: `0`.

The fresh-browser production gate after the change recorded zero optional
requests before consent, zero requests after rejection, one GA loader with
analytics consent, no marketing request when no marketing provider exists, and
no new optional request after withdrawal. The Cloudflare endpoint was
revalidated read-only with `enabled=false`.

`CLOUDFLARE_GOOGLE_TAG_GATEWAY = DISABLED`.

## Inventory

| System | Purpose | Category | Side | Destination | Active | Duplicate |
| --- | --- | --- | --- | --- | --- | --- |
| Deferred Google Analytics | consented GA4 measurement | analytics | client | Google tag loader | yes, consented only | none after edge disable |
| first-party analytics endpoint | lifecycle/product aggregate signals | analytics | client/server | `analytics/track.php` | candidate, consented only | no third-party duplicate |
| admin analytics readers | internal reporting | necessary admin access | server | database | yes | not public tracking |
| Cloudflare Google Tag Gateway | edge tag injection | analytics | edge | `/uhmk` | disabled | previously duplicated app loader |
| Zaraz/marketing pixels | campaign/ads | marketing | edge/client | none configured | no | none |

## Candidate contract

The candidate now has one typed lifecycle service. It gates on the versioned
cookie consent state, bounds campaign values, allowlists metadata, and excludes
direct identity, raw URLs, session IDs, caller hooks, and payment identifiers
from the network payload. The server validator repeats the boundary and writes
NULL to legacy identity/URL columns for new events.

The public validator rejects financial conversion assertions. Paid conversion
remains the server-side billing state, not a browser event. See:

- `docs/analytics/analytics-event-contract.md`
- `docs/analytics/conversion-funnel.md`

## PII and protected data

`ANALYTICS_DIRECT_PII_FIELDS = 0` for the candidate event contract.

The candidate does not send email, authenticated user ID, session ID, raw
referrer/location, free-text search, tokens, card data, payment IDs, question
content, answers, or provider objects. The legacy table columns remain for
compatibility but are not populated by this contract. Legal review remains
required for retention and any future identity-bearing reporting.

## Funnel and attribution

The canonical funnel distinguishes registration start from successful account
creation. Checkout and payment-step events are UX signals only. Subscription
activation and paid conversion require authoritative billing state. UTM source,
medium, and campaign are bounded and consented; raw referrer and unrestricted
query strings are not stored. Rates and retention are explicitly post-GO
measurements because there is no real public traffic.

## Runtime evidence

- focused Vitest consent/privacy tests: `3/3 PASS`;
- full Vitest suite: `157 files / 920 tests PASS`;
- TypeScript typecheck: `PASS`;
- focused ESLint: `PASS` with 11 existing checkout warnings and no errors;
- production build: `PASS`;
- PHP security test: `PASS` in the available WSL PHP 8.3 runtime;
- PHP lint for changed PHP files: `PASS`;
- cleanroom focused test: `3/3 PASS`;
- cleanroom typecheck: `PASS`;
- cleanroom sensitive-event scan: `PASS`;
- Cloudflare post-change browser scenarios: `PASS`;
- production home: HTTP 200 with PRELAUNCH `noindex`;
- production sitemap: HTTP 503 with `noindex, nofollow`;
- Cloudflare control-plane revalidation: Google Tag Gateway `enabled=false`;
- main worktree remains pre-existing dirty and untouched.

## Improvement audit

| Finding | Disposition | Acceptance condition |
| --- | --- | --- |
| edge pre-consent injection | IMPLEMENTED | GTG disabled and fresh-browser zero-request gate |
| direct identity/raw URL in new analytics payload | IMPLEMENTED in candidate | PHP focused security tests plus deployment of candidate |
| arbitrary metadata/payment identifiers | IMPLEMENTED in candidate | allowlist tests and server-side revalidation |
| public browser conversion assertion | IMPLEMENTED in candidate | validator rejects financial event names; billing remains authority |
| first/last-touch attribution | DEFERRED | product/legal decision and bounded retention contract |
| SPA route pageviews | DEFERRED | explicit measurement decision and duplicate-pageview test |
| marketing integrations | DEFERRED | provider, consent, owner, and dedup contract; no provider currently configured |
| legal retention/basis | OPEN_WITH_OWNER | Macrostep 17 legal review |
| real rates/CAC/LTV/retention | POST_GO_REAL_DATA_VALIDATION | real authorized traffic and dataset |

`ALL_NEW_P2_ACCOUNTED_FOR = SIM`.
`SAFE_QUICK_WINS_EVALUATED = SIM`.
`ARCHITECTURAL_FINDINGS_DOCUMENTED = SIM`.

## Status

Candidate implementation status:

```text
MACROSTEP_19_READINESS_AUDIT = PASS
MACROSTEP_19_IMPROVEMENT_AUDIT = COMPLETE
MACROSTEP_19_INDEPENDENT_AUDIT = PASS
P0_REMAINING = 0
P1_REMAINING = 0
MACROSTEP_19_READY_FOR_CHECKPOINT = SIM
```

The candidate passed the available PHP focused gate through WSL, the cleanroom
replication, and the full Node/build gates. This closes the implementation
audit for the candidate; it does not authorize a commit, deployment, launch
mode change, campaign activation, or production data collection.

## Functional fingerprint

The functional file manifest is the lexicographically sorted list of the seven
changed implementation/test files, each followed by its SHA-256, joined with
LF. The resulting fingerprint is:

```text
MACROSTEP_19_FUNCTIONAL_FINGERPRINT_V1 = c655999009a73c6e6d7119ed7cdb46d1a0e8bf2db9ffb4b2225de54eaa6b35a8
FINGERPRINT_METHOD_POWERSHELL = PASS
FINGERPRINT_METHOD_NODE = PASS
```

## Counters

```text
APPLICATION_CODE_CHANGES = 7 files in isolated candidate
PRODUCTION_DML = 0
PRODUCTION_DDL = 0
PRODUCTION_DEPLOY = 0
STRIPE_LIVE_MUTATIONS = 0
PAID_MARKETING_SPEND = 0
REAL_DATA_INSERTIONS = 0
```

`MACROSTEP_19_COMPLETED = NAO`.
