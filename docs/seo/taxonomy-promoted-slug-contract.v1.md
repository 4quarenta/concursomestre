# Taxonomy Promoted Slug Contract v1

This contract applies only after an individual taxonomy is approved for a public landing.

- `filters.slug` is the public identity. It is not regenerated, truncated, or normalized again.
- Promotion requires a non-empty lowercase ASCII slug matching `^[a-z0-9]+(?:-[a-z0-9]+)*$` and no more than 80 characters under `SeoDecision v1`.
- A promoted slug is frozen. A later change requires a persisted historical alias and one permanent `308` redirect to the new final URL.
- Slugs longer than 80 characters remain valid database values but are not promotable under v1.
- `pending`, placeholders, invalid hierarchy, missing public content, and entities without calibrated quality evidence are not promotable.
- Slug similarity does not establish entity identity and never authorizes merge or automatic alias creation.
- `taxonomy-promotion-policy.v1` is declarative and has `enforcement=false`. Promotion remains blocked until real distribution thresholds are approved.

Future incompatible changes require a new version. Consumers must opt into that version; v1 behavior must not change in place.
