# Macroetapa 11C - Pre-Data Technical Blockers

Date: 2026-08-28
Environment: production read-only verification
Launch mode: `PRELAUNCH`
Deployed SHA: `0fc54a40d5235e5b44e619bfda2fcb5bc2fe197f`
Real data loaded: NO
Real data insertion authorized: NO

## Executive result

The three 11C blockers are remediated in the working tree. No production write, migration, deploy, commit, or push was performed. The report is an uncommitted audit artifact.

## Preflight

| Check | Result |
| --- | --- |
| deployed SHA | `0fc54a40d5235e5b44e619bfda2fcb5bc2fe197f` |
| effective launch mode | `PRELAUNCH` |
| RESETTABLE_STRICT tables | 109 |
| strict positive tables | 0 |
| strict positive rows | 0 |
| target migrations pending | 0 |
| analytics_lifecycle_events | 0 |
| reconciliation authorities | 1 active cron authority; backup filenames ignored |
| public production sitemap | unavailable: HTTP 503, private/no-store, noindex |
| stale sitemap URLs served | 0 |
| Stripe test repopulation delta | 0 across the observed reconciliation cycle |

Production checks used the configured read-only database path. No DML or DDL was sent to production.

## A. Statistics read side effect

The former path was `GET /api/statistics/user.php` -> controller -> `StatisticsService::getUserStatistics`, where schema checks and lazy `INSERT user_statistics` occurred. The read path now performs only the lookup and returns a neutral DTO when no row exists. Schema creation and persistence remain on the legitimate study-session mutation path.

Results:

- `StatisticsReadSideEffectTest`: PASS.
- Disposable MariaDB integration: read delta `0`; first legitimate mutation persisted; existing-row behavior preserved.
- Four concurrent legitimate initializations produced exactly one `user_statistics` row and total study time `4`.
- `STATISTICS_READ_SIDE_EFFECT = 0`.
- `STATISTICS_BOOTSTRAP_REMEDIATION = PASS`.

The disposable integration used MariaDB 10.4.28 because no local MySQL 8.4 server was available; the required MySQL 8.4 rehearsal remains a later environmental gate.

## B. Runtime attribution

Existing structured `RequestContext` logs were reused. `RuntimeMutationEvidence` records writer, event, table, operation, timestamp, correlation ID, and policy class without secrets or unnecessary PII. `DatasetRuntimeEvidenceCollector` parses and compares evidence with the `RESET_POLICY_V2` allowlist. Signed row deltas support create/delete net cardinality.

Covered runtime tables:

- `auth_sessions`
- `auth_refresh_tokens`
- `user_cards`
- `user_statistics`

The inventory also covers card state writers in profile sync, checkout, refund unlock, subscription unlock, default-card changes, and recurring-card lock paths. All use the same allowlisted `user_cards` runtime policy and emit operation evidence.

The disposable evidence test covered login, refresh, card create/delete, study statistics, and an unknown writer. Allowlisted evidence passed; the unknown writer failed closed. The steady-state integration also consumed generated evidence rather than manually supplied attribution.

Results:

- `RUNTIME_ATTRIBUTION_AUTOMATED = PASS` for covered scenarios.
- `UNATTRIBUTED_RUNTIME_WRITES = 0` in covered scenarios.
- `UNKNOWN_RUNTIME_WRITERS = 0` in covered scenarios.
- Unknown writer/event evidence is rejected by the validator.

## C. Sitemap freshness

The request path no longer invokes `generate_static_sitemaps.php` or `SITEMAP_FINGERPRINT_ONLY`. It reads a singleton database revision via `read_sitemap_dataset_revision.php`, which is a constant-key lookup. The materializer still computes the complete logical fingerprint offline, records the revision token, and rejects a dataset that changes during materialization.

The prepared additive migration is `backend/database/migrations/20260828_120000_sitemap_dataset_revision.php`. It creates `seo_dataset_revisions` and database-native INSERT/UPDATE/DELETE triggers for the 12 sitemap source tables. Rollback drops only those new triggers and table. It was not applied in production.

Disposable integration results:

- Direct SQL across all 12 source tables advanced the revision by `36` without an application hook.
- Revision lookup `EXPLAIN`: type `const`, key `PRIMARY`, rows `1`.
- 200 freshness checks: 100 rows `45.8904 ms`, 1,000 rows `46.3284 ms`, 10,000 rows `46.5206 ms`.
- `REQUEST_TIME_FULL_DATASET_SCAN = 0`.
- `SITEMAP_REQUEST_FRESHNESS_COMPLEXITY = O(1)`.
- `DIRECT_DB_MUTATION_DETECTION = PASS`.
- Existing physical manifest, shard, atomic promotion, and fail-closed validation contracts remain in place.

The 12 source tables are `blog_articles`, `contest_organizations`, `contests`, `filters`, `law_articles`, `laws`, `material_uploads`, `materials`, `provas`, `public_simulation_questions`, `public_simulations`, and `questions`.

## Policy and reset implications

`seo_dataset_revisions` is classified as `MUTABLE_INFRASTRUCTURE`: it is derived infrastructure authority, not content and not a resettable runtime table. It is excluded from preserve-digest and resettable-row semantics while remaining in the known schema classification. The strict policy remains unchanged at 109 tables; no strict table was reclassified to hide a writer.

## Tests and gates

Passed:

- statistics unit and disposable integration tests;
- runtime evidence and reset policy tests;
- sitemap state, mutation invalidation, revision contract, and disposable integration tests;
- focused Vitest sitemap/robots tests: 9/9;
- full Vitest: 898/898 tests passed, 152 files passed; 2 pre-existing suites failed during jsdom dependency loading because CommonJS required the ESM package `@csstools/css-calc`;
- PHP lint for all changed PHP files;
- `npm run typecheck`;
- `npm run build`;
- launch-control validator;
- generated-artifacts check;
- secret scan;
- text-encoding check;
- source-size gate;
- `git diff --check`.

The two full-suite failures are environmental dependency-loader failures in untouched phase-8 semantic snapshot suites. No package or lockfile change was introduced to bypass them.

## Files changed

Modified application files cover statistics, auth/session, billing-card writer attribution, reset policy/validator, sitemap state/materializer, and related tests. New files cover revision authority, migration/rollback, revision reader, runtime evidence, collector, and focused tests. The seven pre-existing local 11B report files remain untracked and were not modified or staged.

## Final gates

| Gate | Result |
| --- | --- |
| P0 | 0 |
| P1 | 0 in the 11C scope |
| production writes | 0 |
| production migration applied | NO |
| backfill/import/seed | 0 |
| production GO | NO |
| reCAPTCHA | deferred to Phase 12; not changed |
| commit | NO |
| push | NO |
| deploy | NO |

`SAFE_TO_COMMIT_11C = YES` for the reviewed working-tree changes, subject to the known full-suite jsdom environment failure and a future MySQL 8.4 rehearsal.

`SAFE_TO_ROLLOUT_11C = NO` until the MySQL 8.4 rehearsal and the existing full-suite dependency-loader failure are resolved or explicitly waived by the release gate.

`MACROSTEP_11C_PRE_DATA_TECHNICAL_BLOCKERS_READY`
