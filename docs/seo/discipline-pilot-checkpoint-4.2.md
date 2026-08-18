# Discipline Pilot Checkpoint 4.2

`/disciplinas/{filters.slug}` is a public SSR pilot backed by `PublicDisciplineProjection`.

- Only `filters.type=assunto` records classified as `materia` can resolve.
- `pending`, placeholder, internal, and structurally unaddressable records return `404`.
- The persisted slug is preserved. Slugs that fail the promotion v1 length or format remain renderable but cannot be promoted.
- Every valid detail is `NOINDEX,follow`, self-canonical, and excluded from all sitemap generators.
- `/questoes?materia=...` remains a separate functional `NOINDEX` facet.
- The endpoint performs at most five constant queries and returns an explicit public allowlist.
- Promotion, thresholds, overlap, and query `EXPLAIN` remain blocked until a representative read-only database is available.
