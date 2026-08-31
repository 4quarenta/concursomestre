# Production edge privacy remediation - 2026-08-31

## Direct control-plane execution

The Cloudflare control plane was accessed with the installed account connector.
The identified setting was:

- resource: zone Google Tag Gateway configuration
- current value: `enabled=true`, `endpoint=/uhmk`, `hideOriginalIp=true`,
  `measurementId=G-KSRDJ1BZ3P`, `setUpTag=false`
- target value: `enabled=false`; all other fields preserved
- rollback: restore the exact current value above

Zaraz had no configured tools, Worker Routes were empty, and the active
rulesets were managed security rulesets without analytics markers. The Fail2Ban
Cloudflare configuration was not reused because it has a different operational
purpose.

## Scope

Focused investigation and remediation of optional analytics loaded before the
application cookie consent decision. The single authorized control-plane change
was limited to the Cloudflare Google Tag Gateway setting. No application deploy,
database mutation, Stripe mutation, or freeze change was performed.

## Current state

- production application SHA: `cd965f11d498331c77621f6f9f6e5af173c085f6`
- launch mode: `PRELAUNCH`
- global HTTP freeze: preserved and still `FROZEN`
- production sitemap: expected `503` with `noindex, nofollow`

## Evidence

### Fresh public browser

Chromium was launched with a fresh context and no consent storage. The public
home returned HTTP 200 with one `main`, one `h1`, and the cookie dialog. The
consent storage key was absent before interaction. Before any banner action the
browser observed these optional-tag requests:

- `https://concursomestre.com/uhmk/`
- `https://www.googletagmanager.com/gtag/js?...`

The public HTML also contained the markers `google_tags_first_party`, `uhmk`,
and `gtag`. This is a privacy-gate failure because analytics-related code is
executed before consent.

### Direct origin comparison

The origin was queried directly through the VPS loopback with the canonical
Host/SNI routing and a browser user-agent. The origin HTML contained none of
the public edge markers and made no matching optional-tag request. The direct
origin `/uhmk/` path was handled by Nginx with a redirect, not by the JavaScript
resource returned publicly by Cloudflare.

The public `/uhmk/` resource returned HTTP 200 with `server: cloudflare` and a
JavaScript content type. The origin comparison returned `server: nginx` and no
injected analytics markers. Together these observations prove edge injection;
the application and origin are not the source of this specific injection.

## Application review

The deployed application path was checked against the consent implementation:

- `DeferredGoogleAnalytics` reads `cm:cookie-consent:v1` and only appends the
  Google script when `analytics === true`.
- `CookieConsentManager` defaults optional analytics and marketing to false and
  writes an explicit decision on rejection.
- No application source reference to `/uhmk/` or
  `google_tags_first_party` was found.

No application code change is justified.

## Root cause classification

`EDGE_ANALYTICS_INJECTION = CLOSED`.

The exact source was the Cloudflare Google Tag Gateway configuration. Before the
change it was enabled with automatic endpoint injection at `/uhmk` for
`G-KSRDJ1BZ3P`. After the change it is disabled; the endpoint and measurement
configuration were preserved for an explicit future rollback.

The Cloudflare inventory also found no configured Zaraz tools, no Worker Routes,
no Snippets, and no analytics markers in the active managed security rulesets.
The Fail2Ban Cloudflare configuration was not reused because it has a different
operational purpose.

`/uhmk/` is no longer publicly served by the Google Tag Gateway after the
change. The application remains the consent authority for its own deferred
analytics loader.

## Clean-browser validation after edge change

Fresh Chromium contexts were used after the Cloudflare change. Every scenario
returned HTTP 200 for the home page, with no optional request before consent and
no `uhmk`, Google Tag Manager, Google Analytics, or doubleclick request before
consent.

- Fresh, no interaction: pre-consent optional requests `0`; HTML injection
  markers absent.
- Reject optional cookies: PASS; optional requests after rejection `0`.
- Analytics only: PASS; exactly one GTM request after consent, no marketing
  request.
- Marketing only: PASS; no analytics or marketing request. No marketing tool is
  configured in the inspected Zaraz inventory.
- Both categories: PASS; exactly one GTM request after consent.
- Withdrawal: PASS; no new request after analytics consent was withdrawn.

`COOKIE_CONSENT_TECHNICAL_ENFORCEMENT = PASS_IN_PRODUCTION`.

## Result

`PRELAUNCH_EDGE_PRIVACY_REMEDIATION = PASS`

`MACROSTEP_17_CONTROLLED_ROLLOUT = PASS`

`PRODUCTION_GO = NÃO` because launch mode remains `PRELAUNCH`; this remediation
does not authorize indexing, sitemap publication, or public launch.

## Rollback

The exact prior Google Tag Gateway value is retained as the rollback target:
`enabled=true`, `endpoint=/uhmk`, `hideOriginalIp=true`,
`measurementId=G-KSRDJ1BZ3P`, `setUpTag=false`. Restoring it would require a
separate, explicit control-plane authorization and a fresh consent-gate audit.

No Cloudflare proxy, DNS, TLS, cache, WAF, Zaraz, Worker, or Snippet setting was
changed.

## Counters

- Cloudflare configuration mutations: `1` (Google Tag Gateway `enabled=true` to
  `enabled=false`)
- application code changes: `0`
- application deploys: `0`
- production DML: `0`
- production DDL: `0`
- Stripe mutations: `0`
- real-data insertions: `0`
- migration or reset actions: `0`

## Related operational state

The Phase 13X availability-safe freeze was not resumed or modified. The
Stripe-related scheduler/freeze state was only observed and remains outside
this privacy remediation.
