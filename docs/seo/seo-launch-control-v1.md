# SEO Launch Control v1

## Objective

Prevent test or pre-launch content from being indexed while preserving the
production destination of strategically indexable route families.

The governing distinction is:

```text
FAMILY_ELIGIBILITY != INSTANCE_READINESS
```

Family eligibility records whether the route family belongs in the final SEO
architecture. Instance readiness records whether one concrete URL is safe and
complete enough to publish. Current test-data volume is not a permanent family
eligibility criterion.

## Modes

`SEO_LAUNCH_MODE` accepts exactly:

- `PRELAUNCH`: safe default. Public documents receive `noindex` through
  metadata and `X-Robots-Tag`; public sitemap artifacts are not served or
  generated.
- `GO_CANDIDATE`: final crawl and release-audit mode. Runtime remains
  `noindex`; a sitemap may be generated only as an isolated simulation with
  `SEO_SITEMAP_SIMULATION=1` and `SITEMAP_SIMULATION_OUTPUT_DIR`.
- `PRODUCTION`: an instance may be indexed only when its family targets INDEX,
  the instance is READY, publication permits it, the canonical is valid, and
  the final response is a canonical HTTP 200 render.

Missing, empty, or unknown values resolve to `PRELAUNCH`. There is no fallback
that resolves to `PRODUCTION`.

## Authority order

```text
existence
-> publication
-> launch mode
-> family eligibility
-> instance readiness
-> quality evidence
-> canonical/resolution
-> runtime indexability
-> sitemap eligibility
```

Canonical identity is not rewritten by launch mode. A valid page may remain
self-canonical while it is `NOINDEX` during PRELAUNCH.

## Production page map

`config/seo/seo-production-page-map.v1.json` is the versioned strategic map.
It includes active, pilot, planned, and permanent-NOINDEX families. A planned
entry documents future policy only; it does not create a route or a runtime
link.

`FAMILY_ELIGIBILITY` values:

- `INDEXABLE`: structurally appropriate for production indexing.
- `CONDITIONAL`: indexable only after the family-specific editorial/public
  readiness rule is satisfied.
- `PERMANENT_NOINDEX`: never promoted, including in PRODUCTION.

`INSTANCE_READINESS` values:

- `READY`
- `NOT_READY`
- `NOT_APPLICABLE`

Blocked states require a versioned reason code. Low temporary content volume is
not an instance-readiness reason by itself.

## Sitemap behavior

The PHP materializer remains the sole operational sitemap authority.

- PRELAUNCH: materialization is a no-op and served sitemap endpoints return
  503 without exposing stored production artifacts.
- GO_CANDIDATE: simulation requires an output directory different from the
  served production directory.
- PRODUCTION: normal atomic temp -> validate -> promote publication remains in
  place.

No mode fabricates `lastmod`; the existing material-date rules remain active.

## Robots and headers

Public pages remain crawlable in robots.txt so crawlers can observe `noindex`.
Private/admin/API paths keep their existing crawl restrictions. PRELAUNCH does
not use `Disallow: /`.

The Next proxy adds `X-Robots-Tag` to document responses as a transversal
defense. Metadata remains the page-level presentation authority. The most
restrictive permanent rules continue to win for private or functional routes.

## Operation and rollback

The release owner changes `SEO_LAUNCH_MODE` through the build/deploy secret or
environment mechanism. Never commit an operational secret or change the mode
in source. Because static metadata is emitted during `next build`, every mode
change requires a fresh build and deployment; restarting an old build is not a
valid transition.

Before `PRODUCTION`, all of these gates must pass:

1. Security and public-projection checks.
2. Database integrity and backup/restore checks.
3. Product critical-flow checks.
4. SSR/hydration, metadata, canonical, redirects, robots, and sitemap crawl.
5. `npm run seo:validate-launch-control`.
6. Production sitemap simulation and review.

Rollback is performed by setting `SEO_LAUNCH_MODE=PRELAUNCH`, rebuilding and
redeploying the web application, restarting the backend process, and verifying
`X-Robots-Tag: noindex`, robots without sitemap entries, and sitemap endpoints
returning 503. This does not change canonical URLs or delete existing
materialized artifacts.
