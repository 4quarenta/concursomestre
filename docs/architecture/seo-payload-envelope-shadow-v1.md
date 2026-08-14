# SEO payload envelope v1

## Scope

Checkpoint 3 transports `publicationDecision`, `seoDecision`, and `seoFacts`
as optional, additive fields. The current runtime remains authoritative for
metadata, canonical links, robots, sitemaps, redirects, URLs, SSR, rendering,
and indexability.

The envelope is attached only after the existing public DTO has been loaded.
`PublicSeoEnvelopeService` has no database or repository dependency, so this
integration adds no query per entity and cannot introduce an SEO N+1.

## Public integrations

| Resource | Backend endpoint | Existing projection | Frontend consumer |
| --- | --- | --- | --- |
| Question | `api/questions/show.php` | `QuestionsService::getQuestionDetails` | question SSR route |
| Question | `api/v2/questions/show.php` | `QuestionsService::getQuestionPracticeV2` | `questionService` |
| Exam | `api/exams/detail.php` | `ExamsService::showPublic` | blog exam server data |
| Board | `api/filters/board.php` | `FiltersService::getPublicBoardDetail` | taxonomy server data |
| Taxonomy | `api/filters/directory.php` | public directory/hierarchy projections | taxonomy server/client data |
| Law | `api/legal-commentary/detail.php` | public full/outline projections | law server/client services |

Administrative endpoints and question list endpoints are outside this
checkpoint. The latter avoids multiplying the envelope across high-volume
practice feeds before a compact collection contract is approved.

## Validation and fallback

The Next adapters validate all three contracts and verify matching resource
type and identifier. A valid envelope is transported internally. An absent or
invalid envelope emits one deduplicated shadow diagnostic and the adapter
returns the unchanged legacy payload without the invalid envelope fields.

Diagnostics never include the payload or protected content. The public
publication decision exposes only the allowlisted, user-safe reason codes.

## Fixture measurements

The deterministic fixture report recorded these uncompressed JSON deltas:

| Resource | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Question | 826 B | 2,161 B | 1,335 B |
| Exam | 433 B | 1,578 B | 1,145 B |
| Board | 431 B | 1,702 B | 1,271 B |
| Taxonomy | 203 B | 1,509 B | 1,306 B |
| Law | 425 B | 1,632 B | 1,207 B |

The percentages are high for deliberately small fixtures, especially taxonomy
items. Absolute overhead is about 1.1-1.3 KB per resource before compression.
Collection payload size must be measured with real data before future
enforcement or expansion to larger lists.

## Legacy comparison

The fixture comparison found five resources with at least one expected shadow
divergence: four in indexability and two in canonical path. These are reports,
not runtime changes. The fixture intentionally retains legacy paths as inputs
so the comparison can detect the completed cutover to `/questoes` and `/provas`.

## Future cache identity

If decisions are cached later, the key must include resource identity,
`updated_at`, policy version, publication state, and quality configuration
version. Public, authenticated, and restricted decisions must never share a
cache entry.
