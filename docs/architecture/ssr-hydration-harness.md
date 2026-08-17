# SSR and hydration semantic harness

The Phase 3 harness compares the initial HTTP HTML, the hydrated browser DOM,
and the RSC response without relying on screenshots or byte-for-byte snapshots.
Its versioned expectations live in
`config/seo/ssr-hydration-baseline.v1.json`.

Run it against an already running application:

```powershell
npm run seo:ssr-hydration -- --base-url=http://127.0.0.1:3000 --strict=true
```

For deterministic local checks, start
`scripts/seo/ssr-hydration-fixture-api.mjs`, point `API_BASE_URL` and
`NEXT_PUBLIC_API_BASE_URL` to that server, and pass its origin through
`--metrics-url`. The resulting report is written to
`.tmp/seo/ssr-hydration-report.json` by default.

Classifications are intentionally semantic:

- `EQUIVALENT`: the relevant server and hydrated surfaces agree.
- `INTERACTION_ONLY`: only interactive links or controls differ.
- `SEMANTIC_DIVERGENCE`: headings, main content, metadata, canonical,
  breadcrumbs, or structured data differ.
- `SECURITY_DIVERGENCE`: a protected sentinel appears in HTML, hydrated DOM,
  or RSC. This always fails the strict gate.

The baseline stores compact expectations such as route, expected status,
canonical, schema types, and allowed classification. It must not contain full
HTML snapshots or protected content.

Routes migrated away from `@seo` mark their persistent server-owned region with
`data-semantic-content`. This lets the harness follow that region across a
streaming boundary while the independent `mainCount` gate still requires one
main landmark. Interactive islands and their semantic fallbacks may use
`data-hydration-interaction`; required public text and links are asserted
separately through `requiredRawText`, `requiredRawLinks`, and
`requiredRawLinkPrefixes` in the baseline.

Hydration readiness is observed through the browser load lifecycle. The harness
does not add or require a DOM marker, so it also validates the application after
the legacy parallel SEO slot has been removed. Reports include raw and hydrated
HTML byte sizes plus approximate DOM node counts for direct regression checks.

Fetch metrics distinguish three surfaces: `server` covers the raw HTML request,
`browserWindow` covers the complete hydrated navigation (including its server
render), and `browserDirect` records only requests sent directly by the browser
to the fixture API.
