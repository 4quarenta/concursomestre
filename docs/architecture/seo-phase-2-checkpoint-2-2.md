# SEO Phase 2 - Checkpoint 2.2

> Historical checkpoint record. Checkpoint 2.3 superseded the temporary sitemap
> state described below: the materialized PHP generator is now the operational
> authority and emits only `/questoes` and `/provas` canonical families.

## Scope

Workspace cutover recorded at `2026-08-12T22:39:20-03:00` on branch `1.0.0`.
This timestamp records the code cutover only. No deployment or production change
was performed in this checkpoint.

Canonical public families:

- `/questoes`
- `/questoes/{id}/{normativeSlug}`
- `/provas`
- `/provas/{persistedSlug}`

Permanent compatibility aliases:

- `/practice` and `/questions` -> `/questoes`
- `/question/{id}/{anySlug}` -> `/questoes/{id}/{normativeSlug}`
- `/blog/provas` -> `/provas`
- `/blog/provas/{slug}` -> `/provas/{slug}`

Application-level smoke tests confirmed one `308` hop and a final `200` for
existing resources. Missing question IDs return `404` without redirect. Query
sanitization preserves supported functional, UI and tracking parameters, keeps
repeated values, and removes `_rsc` and unsupported parameters.

## SEO boundary

Server metadata, Open Graph and active JSON-LD now declare only the canonical
families above. Filtered collections are `noindex,follow` with a clean hub
canonical. Unfiltered `/provas?pagina=N`, for `N >= 2`, is indexable with a self
canonical. `/provas?pagina=1` redirects to the clean hub.

The operational sitemap deliberately remains on legacy URLs until Checkpoint
2.3. Robots rules were not changed and do not block the legacy aliases.

## Runtime and performance

Question aliases resolve the existing public projection once through the
React-cached server resolver, derive the normative slug from the entity ID and
redirect directly to the final URL. Hub and exam aliases are resolved by the
Next proxy without data fetches. No schema change, migration, new SEO query or
public API rename was introduced.

## Rollback

Rollback is code-only:

1. restore internal link generation to the legacy route families;
2. restore the legacy page implementations instead of the `308` aliases;
3. restore the previous canonical, Open Graph and JSON-LD paths;
4. keep both new routes available during rollback to avoid broken links.

No database rollback is required. The sitemap stays unchanged until the
separate Checkpoint 2.3 cutover.
