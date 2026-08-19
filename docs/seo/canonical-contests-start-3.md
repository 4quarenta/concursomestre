# Canonical contests - START #3

Date: 2026-08-19

## Domain decision

The previous `/concursos` catalog combined agencies, roles, years, and boards from
settings. Those combinations were useful filters, but they did not prove that a
contest existed. START #3 replaces that authority with explicit `contests`
records and explicit relations.

A contest is distinct from an organization, position, exam, document, and year.
It may have many organizations, positions, documents, and exams. An exam belongs
to a contest only through `contest_exams`; no name, year, organization, or board
inference creates that relation.

## Identity and publication

- `contests.slug` is the persisted canonical identity and is unique in the
  family.
- Historical slugs live in `contest_aliases` and redirect directly to the
  current canonical slug with one permanent hop.
- Canonical slugs take precedence over aliases.
- `publication_status` and `visibility_status` control public exposure
  independently of the contest's domain status.
- New records default to `draft` and `internal`; an insert does not publish a
  contest.
- Public resolution requires `published`, `public`, a valid persisted slug, a
  valid canonical URL, and no archive date.

## Status and dates

`domain_status` records the declared product state. `/concursos-abertos` includes
only records with `registration_open`, with `registration_start_at` not in the
future and `registration_end_at` not in the past when those dates exist. Dates
bound the declared status; dates alone never infer that registrations are open.
The boundaries are inclusive, inverted or malformed ranges are closed, and the
rule accepts an explicit clock in domain tests. SQL connections set their
session timezone from `APP_TIMEZONE` (safe default `America/Sao_Paulo`) before
comparing `DATETIME` values with `NOW()`. A `scheduled` publication remains
non-public until an editorial workflow explicitly changes it to `published`;
the date does not silently mutate publication state.

Completed, cancelled, or suspended contests may remain useful historical pages
when they are explicitly public and published. They remain in `/concursos` and
can be production-indexable when instance readiness passes.

## Storage and rollout

Migration `20260819_120000_canonical_contests.php` is additive and creates:

- `contests`
- `contest_organizations`
- `contest_positions`
- `contest_exams`
- `contest_documents`
- `contest_aliases`

Foreign keys use restrictive deletion to preserve history. The rollback removes
only these new tables in dependency order. Fresh apply, constraints, indexes,
and rollback were validated in an isolated local database. The migration was not
run in production.

The current model has one explicitly selected organizing board per contest and
many organizations. Multiple co-organizing boards are a documented future
extension if the editorial domain proves that cardinality is necessary.

Public editorial URLs accept only external HTTP(S) destinations. Credentials,
loopback/private IPs, and obvious local/internal hostnames are discarded at the
public projection boundary.

Production rollout order:

1. Review and apply the additive migration during an approved maintenance step.
2. Add canonical contests through a controlled editorial/admin workflow as
   `draft` and `internal` by default.
3. Link organizations, positions, exams, and public documents explicitly.
4. Review identity, slug, dates, status, and publication for each record.
5. Publish only reviewed records; keep `SEO_LAUNCH_MODE=PRELAUNCH` until the
   separate SEO GO gates pass.

## Backfill policy

No synthetic catalog entry is migrated automatically. Existing combinations may
become report-only candidates, but a reviewer must confirm that each contest is
a real canonical entity and explicitly approve its relations. START #3 performs
zero backfill writes.

The production read-only dataset was not reachable from this workspace during
the final run, so candidate counts were not invented. A future sanitized audit
may report aggregate candidates without inserting records or exposing private
data.

## Deferred work

- Editorial/admin CRUD for canonical contests.
- Report-only candidate discovery and manual review workflow.
- Calendar, geographic, career, and position landing families.
- Richer status UX, payload tuning, and optional structured-data expansion.

None of these deferred items changes the canonical identity or publication
contract established here.
