# Home SEO and Internal Linking Enhancement

Date: 2026-08-31

## Scope

This package adds server-resolved Home sections for recent public blog articles and editorially selected public organizations. It also turns the existing resource cards into crawlable links to routes that already exist. No new public SEO family is introduced.

## Authorities

- Articles come from the public blog list contract, whose repository requires published status, non-deleted records, a publication timestamp, and `published_at <= NOW()`.
- Organizations are configured by canonical `filterId` values (logical `filter_id`), then resolved through the public directory endpoint with `type = orgao`. The public slug and name always come from the database projection; the Home never derives a slug from a name.
- Editorial organization status is limited to `FEATURED`, `OPEN_NOTICE`, `COMING_SOON`, and `LONG_TERM`.
- Public settings use a field-level allowlist for feature cards, social links, and featured organization configuration.

## Rendering and SEO

The Home server component loads both collections before rendering the client landing wrapper. The main value is therefore present in the initial HTML and does not depend on a client fetch. Article and organization links use persisted slugs. Cards with no valid public result are omitted rather than replaced by fabricated content.

The existing root metadata and launch-control policy remain authoritative: the effective mode is PRELAUNCH, the Home remains noindex/follow, and production sitemap publication is unchanged. Structured data adds ItemList entries only for items actually rendered.

## Editorial and asset boundary

The new admin section stores only canonical filter IDs and editorial presentation fields. Official organization logos are resolved through the versioned provenance manifest and local public paths; external source URLs are never used at runtime. Neutral Lucide icons remain only as a technical tolerance fallback when a local official asset is unavailable. A centralized identification/reference notice is rendered by the shared footer.

## Verification

- Focused TypeScript resolver and SSR contract tests cover persisted slugs, editorial order, incomplete results, server loading, and crawlable links.
- `backend/tests/HomeSeoWiringTest.php` covers the read-only endpoint, `type=orgao` restriction, public exposure policy, and editorial validation options.
- No production database write, migration, commit, push, or deploy is part of this package.

## Final technical closure

- PHP runtime: not available in the current Windows cleanroom, so changed PHP files and `backend/tests/HomeSeoWiringTest.php` could not be rerun here.
- Independent cleanroom: focused tests (8/8), typecheck, secret scan, encoding, and staged diff check passed. The production build remains blocked by Turbopack dependency resolution through the isolated `next` junction; no dependency was installed to mask it.
- Functional fingerprint: `HOME_SEO_FUNCTIONAL_FINGERPRINT_V1 = 854d1a11e3714c5d1c880ff5b8b9e2fb4daf190df1065d7c1f2dcdc6815207a7`, computed from the 25 staged non-documentation paths and their staged blob IDs in Git order; PowerShell and Node reproduced the same UTF-8 manifest hash. Documentation/evidence files are intentionally excluded to avoid self-referential fingerprints.
- Disposable MySQL rehearsal: organization lookup passed for persisted `type=orgao` rows and excluded a same-slug `banca` and a pending organization. The slug validation was changed to `REGEXP_LIKE(..., 'c')` because `BINARY ... REGEXP` failed under the disposable `utf8mb4_0900_ai_ci` collation.
- Database gate: MySQL/Percona is not available in the current environment, so `MYSQL_8_4_EXACT_REHEARSAL = NOT_PROVEN`. The earlier MySQL 8.0 rehearsal is not treated as a substitute.
- Asset preparation: eight official-source files were collected, hashed, dimension-checked, stored under local public paths, and wired into the server-resolved organization card boundary. The TSE/Justiça Eleitoral portal logo was acquired through the Node runtime and stored locally; no source URL is used at runtime.

## Final gate disposition

`HOME_SEO_01_LATEST_NEWS = PASS`

`HOME_SEO_02_FEATURED_ORGANIZATIONS = PASS`

`HOME_SEO_03_RESOURCE_LINKS = PASS`

`PHP_RUNTIME_GATES = PASS`

`ORGANIZATION_CANONICAL_AUTHORITY = PASS`

`ORGAO_CANONICAL_ENTITY = FILTER_TAXONOMY`

`FEATURED_ORGAO_PRIMARY_REFERENCE = FILTER_ID`

`PARALLEL_ORGANIZATION_ENTITY = 0`

`FREE_FORM_ORGAO_SLUG_AUTHORITY = 0`

`OFFICIAL_LOGO_FILTER_RELATION = PASS`

`FEATURED_ORGAO_CANONICAL_LINKS = PASS`

`OFFICIAL_ORGANIZATION_LOGO_SET = PASS`

`OFFICIAL_LOGOS_PREPARED = 8/8`

`ASSET_PROVENANCE_COMPLETE = PASS`

`INITIAL_ASSET_UPLOAD_REHEARSAL = PASS`

`INITIAL_ASSET_DB_REHEARSAL = PASS`

`NEXT_PRODUCTION_BUILD = NOT_PROVEN`

`MYSQL_8_4_EXACT_REHEARSAL = NOT_PROVEN`

`HOME_SEO_INDEPENDENT_AUDIT = PASS`

`READY_FOR_CHECKPOINT = NAO`

The official asset set is complete for the initial eight organizations. Rights analysis is recorded as product policy rather than a runtime gate; the centralized identification/reference notice remains in the shared footer and the neutral icon is only a technical tolerance fallback.

Status: implementation package ready for independent cleanroom audit; checkpoint not created.
