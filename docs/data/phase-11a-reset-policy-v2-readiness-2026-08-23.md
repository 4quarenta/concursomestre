# Macroetapa 11A-R - RESET_POLICY_V2 readiness

Measured at: `2026-08-24T03:39:56Z`

## A. Executive summary

RESET_POLICY_V2 is technically implemented and rehearsed without production writes. Reset is NOT READY solely because the production writer stop/verify/resume procedure has not been rehearsed in a representative environment. Real-data load is independently NOT READY.

## B. Baseline

Branch `1.0.0`; baseline `fbb34f83f94bbda0792bd861c20d137916566a58`.

## C. RESET_POLICY_V2

Active for planning. It preserves account identity, essential settings/configuration and schema contracts while resetting all current test content and operational history.

## D. Scope

Preparation, read-only production measurement, disposable rehearsal and documentation only. No 11B execution authorization is implied.

## E. Production target

Production primary was identified via a dedicated read-only user. It was not mutated.

## F. Database fingerprint

MySQL `8.4.10-10`; 125 tables; 313630 exact rows at dry-run. Structural fingerprint `7e9904fc21bfa27ec5fe108f5ba6c0e594bf677fed9a509425beb77043656741`; snapshot fingerprint `36f44faf3c64e804b91d0b8d3f0f5360b76fa77eaaa0283b75ccb79af4ee0dfd`. Fingerprints are observations and must be regenerated immediately before an approved execution.

## G. Preserve scope

12 explicit tables, 2120 observed rows. Preservation is allowlisted and independently snapshotted.

## H. Reset scope

113 explicit tables across 14 domains, 311510 observed rows. Unknown schema tables cause abort.

## I. Users

Six user rows are preserved. No user was removed in production or rehearsal.

## J. Required user identity

Users, indispensable profile relations and credentials remain. Public/content activity is deliberately outside identity preservation.

## K. Auth state

Sessions, refresh tokens, verification/reset tokens and test payment-card state are reset; users must reauthenticate after a future authorized reset.

## L. Settings

System settings (99 rows) and cache settings remain preserved by manifest and digest.

## M. Plans/config

Plans (14 rows) remain configuration. Financial transactions, subscriptions, ledger and webhook history are reset as test state.

## N. Schema/migrations

Schema is preserved. Migration history stayed 62/62 during reset rehearsal; three pending migrations were then rehearsed separately, reaching 65 only on the disposable target.

## O. Static contracts

filter_types and schema audit/backfill contracts are explicitly preserved.

## P. Content

Questions, exams, contests, simulations, laws, materials, blog and related content are reset under V2.

## Q. Taxonomies

filters, aliases, source identities and relationships are reset; current taxonomy quality is not treated as definitive data.

## R. User operational data

Answers, progress, favorites, notes, study sessions, rankings, notifications and other current operational activity are reset.

## S. Financial test data

694 current financial-test rows are in reset scope; Stripe/system configuration remains preserved.

## T. Audit/log policy

Security/admin audit is preserved; test content/import/moderation logs are reset according to the explicit policy.

## U. Import staging

207 staging rows are reset. Import checkpoints are not treated as definitive source identity.

## V. Assets

339 upload files were inventoried. Profile assets and configuration/admin assets are preserved; question, exam, context and current material assets are reset. Unknown classes: 0.

## W. Legacy reset

The legacy reset script previously had unsafe semantics.

## X. Legacy containment

The legacy entry point now exits fail-closed with `LEGACY_DATASET_RESET_DISABLED` and contains no database access or DML.

## Y. New reset tool

The new CLI tool is `backend/scripts/data/reset_definitive_dataset.php`; it uses an explicit policy, direct guarded PDO and post-reset residue verification.

## Z. Default dry-run

Default execution is dry-run and read-only. `--execute` alone cannot authorize writes.

## AA. Guards

Policy/schema, target, structural fingerprint, exact counts, preserve snapshots, FK topology, backup/restore, assets, writer freeze, approval, operation token and environment guards all fail closed.

## AB. Fingerprint

Structural and snapshot fingerprints are recomputed; drift aborts before the first write.

## AC. Expected counts

All 125 table counts are exact. A mismatch against an approved manifest aborts before write. Production moved from 313,629 rows in the restored backup to 313,630 during later read-only observation, confirming that a manifest must be regenerated and approved immediately before execution.

## AD. Allowlist

Reset allowlist has 113 tables. New or missing tables make policy validation fail.

## AE. Preserve manifest

Preserve manifest has 12 tables and reason codes; it is not inferred as merely the complement of reset scope.

## AF. FK reset order

91 FKs inventoried; 113 reset tables ordered child-to-parent; 0 cycles; 0 preserved-child dependencies on reset parents.

## AG. Transaction strategy

Reset uses ordered DELETE inside a transaction across the 125 observed InnoDB tables. It does not use TRUNCATE or FOREIGN_KEY_CHECKS=0. Exact zero residue and preserved digests are checked before commit.

## AH. DB backup

A recent private database backup (60,916,382 bytes) had SHA-256 checksum verified before rehearsal.

## AI. DB restore rehearsal

PASS: restored 125 tables and 313,629 rows to isolated MySQL 8.4. A deliberately failed first reset rolled back to the exact pre-reset row count and fingerprint.

## AJ. Asset backup

PASS: private asset archive created outside Git, 75,870,346 bytes and 339 files.

## AK. Asset restore rehearsal

PASS: archive extraction and per-file SHA-256 comparison matched; disposable extraction was removed.

## AL. Writer inventory

11 writer classes are documented, including frontend/API, ingestion, extraction, finance, timers, backups and operators.

## AM. Freeze rehearsal

FAIL: production services were not stopped, correctly respecting this read-only checkpoint. No staging-equivalent writer orchestration was available, so freeze/resume remains unproven. One user-operational row appeared between read-only observations, factual evidence that writers remain active.

## AN. Disposable reset rehearsal

PASS: reset completed on the disposable restored database. Expected reset rows were 311,509; driver affected rows were 311,508 because a self-FK cascade deleted one child. Exact post-reset residue across all 113 tables was 0.

## AO. Users before/after

Users before/after: 6/6; aggregate digest preserved.

## AP. Settings before/after

system_settings before/after: 99/99; aggregate digest preserved.

## AQ. Schema before/after

Current schema remained 125 tables during reset. Afterward, disposable migration rehearsal intentionally added the pending structures, reaching 138 tables.

## AR. Migration history before/after

Migration history remained 62 during reset and became 65 only after the separate disposable migration rehearsal.

## AS. Content residue

Exact residue in all 113 reset tables before migrations: 0. The InnoDB TABLE_ROWS estimate of 64,665 after migrations is non-authoritative and was explicitly rejected as residue evidence.

## AT. User activity residue

Exact user-activity residue in reset tables: 0.

## AU. Financial-test residue

Exact financial-test residue in reset tables: 0.

## AV. Empty-dataset application smoke

PASS: 29 browser routes; 16 hubs returned 200 and 13 missing details returned hard 404; no page errors or failures.

## AW. Empty-state SEO

All 29 smoke routes remained noindex under effective PRELAUNCH; indexing and production sitemap stayed disabled.

## AX. Pending migrations

Production still lacks canonical contests, public simulations and public materials migrations.

## AY. Migration rehearsal

PASS on disposable MySQL 8.4 for all three pending migrations; production apply count remains 0.

## AZ. Source readiness

No approved definitive source package exists for all intended domains. This blocks load, not the authorized concept of reset.

## BA. Rights/provenance

Rights/provenance remain unapproved. This blocks load/publication, not reset preparation.

## BB. Reset readiness

NOT READY. One P1 reset blocker remains: representative writer freeze/resume rehearsal.

## BC. Load readiness

NOT READY. Sources, rights, ingestion/admin workflow, production schema rollout, MySQL 8.4 compatibility sweep and real-data contract validation remain open.

## BD. Publication readiness

NOT READY. PRELAUNCH remains active and all 20 real-data/production SEO gates remain open.

## BE. 20 open gates

All 20 required gates remain OPEN exactly as carried forward; see OPEN_REAL_DATA_GATES_MATRIX.

## BF. Tests

Focused PHP PASS; PHP lint PASS; Vitest 154/154 files and 910/910 tests PASS on supported Node 24.19.0; typecheck/route types PASS; build PASS; launch validator PASS; ESLint 0 errors (96 pre-existing warnings); secret scan, encoding and git diff check PASS.

## BG. Security

No secret, raw PII, password hash, token, connection string or private backup content is included. Production access remained read-only.

## BH. P0

P0 = 0. The legacy destructive path is contained.

## BI. P1

Reset P1 = 1 (writer freeze rehearsal). Load P1 blockers are listed separately and do not get misclassified as reset blockers.

## BJ. P2

P2: final asset admin/config classification review, operational timing/runbook refinement and post-load performance monitoring. The 27 remaining MySQL 8.4 BINARY REGEXP call sites are classified separately as a load P1, not hidden in this backlog.

## BK. Reset blockers

- `CONCURRENT_WRITER_FREEZE_NOT_REHEARSED`: Production writers were inventoried, but no representative stop/verify/resume rehearsal was performed.

## BL. Load blockers

- `REAL_DATA_SOURCE_NOT_AVAILABLE_FOR_ALL_INTENDED_DOMAINS`: No approved definitive source package is available.
- `SOURCE_RIGHTS_AND_PROVENANCE_NOT_APPROVED`: Rights and provenance approval remains absent.
- `REAL_DATA_IMPORT_WORKFLOW_NOT_APPROVED`: Importer/admin load workflow and rollback contract are not approved.
- `PRODUCTION_SCHEMA_ROLLOUT_PENDING`: Three additive migrations passed disposable MySQL 8.4 rehearsal but remain unapplied in production.
- `MYSQL84_BINARY_REGEXP_COMPATIBILITY_SWEEP_REQUIRED`: 27 legacy BINARY <column> REGEXP occurrences remain outside the empty-state paths fixed here.
- `REAL_DATA_CONTRACT_VALIDATION_PENDING`: The definitive dataset has not been loaded or validated.

## BM. Publication blockers

PRELAUNCH, all 20 real-data gates, rights/provenance and final production SEO/performance validation remain publication blockers.

## BN. Required matrices

The mandatory matrices follow below.

### RESET_POLICY_V2_MATRIX

| Area | Decision | Authority |
| --- | --- | --- |
| User identity | PRESERVE | RESET_POLICY_V2 |
| Settings/static contracts | PRESERVE | RESET_POLICY_V2 |
| Content and user activity | RESET | RESET_POLICY_V2 |
| Financial test history | RESET | RESET_POLICY_V2 |
| Production execution now | FORBIDDEN | 11A-R scope |

### PRESERVE_MATRIX

| Table | Rows | Reason |
| --- | --- | --- |
| addresses | 2 | PRESERVE_REQUIRED_ACCOUNT_PROFILE |
| admin_audit_logs | 1926 | PRESERVE_SECURITY_AUDIT |
| bank_accounts | 0 | PRESERVE_REQUIRED_ACCOUNT_RELATION_IF_PRESENT |
| cache_settings | 0 | PRESERVE_SYSTEM_CONFIGURATION |
| filter_types | 10 | PRESERVE_STATIC_CONTRACT |
| plans | 14 | PRESERVE_COMMERCIAL_CONFIGURATION |
| schema_audit_runs | 0 | PRESERVE_SCHEMA_INFRASTRUCTURE |
| schema_backfill_runs | 1 | PRESERVE_SCHEMA_INFRASTRUCTURE |
| schema_migrations | 62 | PRESERVE_MIGRATION_HISTORY |
| security_ip_bans | 0 | PRESERVE_SECURITY_INFRASTRUCTURE |
| system_settings | 99 | PRESERVE_SYSTEM_CONFIGURATION |
| users | 6 | PRESERVE_REQUIRED_USER_IDENTITY |

### RESET_ALLOWLIST_MATRIX

| Domain | Tables | Rows observed |
| --- | --- | --- |
| AUTH_OPERATIONAL_STATE | 5 | 843 |
| QUESTIONS | 11 | 20764 |
| TAXONOMIES | 4 | 283827 |
| EXAMS | 11 | 3447 |
| CONTESTS_CAREERS_POSITIONS | 0 | 0 |
| PUBLIC_SIMULATIONS | 0 | 0 |
| PRIVATE_SIMULATIONS | 1 | 3 |
| LAWS | 24 | 61 |
| MATERIALS | 4 | 0 |
| BLOG_CHANGELOG | 6 | 47 |
| USER_CONTENT_ACTIVITY | 27 | 460 |
| IMPORT_STAGING | 7 | 207 |
| FINANCIAL_TEST_DATA | 10 | 694 |
| DERIVED_DATA | 3 | 1157 |

### USER_IDENTITY_PRESERVATION_MATRIX

| Object | Policy | Observed rows |
| --- | --- | --- |
| users | PRESERVE identity, credentials and indispensable roles | 6 |
| addresses | PRESERVE required profile relation | 2 |
| bank_accounts | PRESERVE only as required account relation; currently empty | 0 |
| answers/progress/favorites/sessions | RESET operational state | 0 |

### SETTINGS_PRESERVATION_MATRIX

| Object | Policy | Observed rows |
| --- | --- | --- |
| system_settings | PRESERVE | 99 |
| cache_settings | PRESERVE configuration | 0 |
| plans | PRESERVE catalog/configuration | 14 |
| filter_types | PRESERVE static contract | 10 |

### AUTH_STATE_POLICY_MATRIX

| Object | Policy |
| --- | --- |
| users/addresses | PRESERVE |
| sessions/refresh tokens | RESET and require reauthentication |
| verification/password reset tokens | RESET |
| test payment cards | RESET |

### FINANCIAL_TEST_RESET_MATRIX

| Object group | Policy | Rows observed |
| --- | --- | --- |
| transactions/subscriptions/ledger/webhooks | RESET_TEST_HISTORY | 694 |
| plans/system Stripe configuration | PRESERVE_CONFIGURATION | 113 |

### AUDIT_LOG_RESET_POLICY_MATRIX

| Object | Policy |
| --- | --- |
| admin_audit_logs | PRESERVE_SECURITY_AUDIT |
| legal/import/moderation test logs | RESET_TEST_HISTORY |

### IMPORT_STAGING_RESET_MATRIX

| Domain | Policy | Rows observed |
| --- | --- | --- |
| Gran/private ingestion staging | RESET_TEMPORARY_IMPORT_STATE | 207 |

### FK_RESET_ORDER_MATRIX

| Check | Result |
| --- | --- |
| Foreign keys inventoried | 91 |
| Reset tables ordered | 113 |
| Cycles | 0 |
| Preserved child -> reset parent dependencies | 0 |

### RESET_GUARD_MATRIX

| Guard | State | Execution behavior |
| --- | --- | --- |
| Explicit target/database | IMPLEMENTED | ABORT on mismatch |
| Structural fingerprint | IMPLEMENTED | ABORT on drift |
| Per-table expected counts | IMPLEMENTED | ABORT before first write |
| Preserve snapshots | IMPLEMENTED | ABORT on mismatch |
| Backup/restore/assets | IMPLEMENTED | ABORT unless passed |
| Writer freeze | IMPLEMENTED; rehearsal pending | ABORT unless rehearsal and current freeze are true |
| Approval + token + --execute | IMPLEMENTED | All required |

### EXPECTED_COUNT_MATRIX

| Metric | Production dry-run |
| --- | --- |
| Tables | 125 |
| Total exact rows | 313630 |
| Preserved exact rows | 2120 |
| Reset allowlist exact rows | 311510 |
| Unknown tables | 0 |

### DB_RESTORE_REHEARSAL_MATRIX

| Check | Result |
| --- | --- |
| Backup engine | MySQL 8.4.10-10 |
| Restore target | Disposable MySQL 8.4, loopback only |
| Restore result | PASS |
| Restored tables/rows | 125 / 313629 |
| Failed-run rollback proof | PASS; exact row count and fingerprint restored |

### ASSET_BACKUP_RESTORE_MATRIX

| Check | Result |
| --- | --- |
| Archive | Private backup outside repository |
| Files | 339 |
| Bytes | 75870346 |
| Checksum/restore comparison | PASS |
| Unknown asset classes | 0 |

### WRITER_FREEZE_MATRIX

| Writer | Must pause | Rehearsed |
| --- | --- | --- |
| frontend-public-api | YES | NO - inventory only |
| platform-event-outbox | YES | NO - inventory only |
| question-ingestion-primary | YES | NO - inventory only |
| question-ingestion-secondary | YES | NO - inventory only |
| exam-extractor | YES | NO - inventory only |
| financial-workers | YES | NO - inventory only |
| editorial-crons | YES | NO - inventory only |
| sitemap-and-archive-timers | YES | NO - inventory only |
| database-backup-timer | YES | NO - inventory only |
| log-maintenance | NO | NO - inventory only |
| admin-and-import-operators | YES | NO - inventory only |

### PENDING_MIGRATION_REHEARSAL_MATRIX

| Migration | Disposable MySQL 8.4 | Production |
| --- | --- | --- |
| 20260819_120000_canonical_contests.php | PASS | NOT_APPLIED |
| 20260819_130000_public_simulations.php | PASS | NOT_APPLIED |
| 20260821_120000_public_materials.php | PASS | NOT_APPLIED |

### EMPTY_DATASET_SMOKE_MATRIX

| Check | Result |
| --- | --- |
| Hub routes | 16/16 HTTP 200 |
| Missing detail routes | 13/13 HTTP 404 |
| NOINDEX | 29/29 |
| Page errors/failures | 0/0 |
| Overall | PASS |

### POST_RESET_RESIDUE_MATRIX

| Check | Result |
| --- | --- |
| Reset tables checked | 113 |
| Exact reset-table residue before migrations | 0 |
| Users before/after | 6 / 6 |
| System settings before/after | 99 / 99 |
| Migration history during reset | 62 / 62 |
| InnoDB TABLE_ROWS estimate after migrations | 64665 (non-authoritative estimate; not residue) |

### RESET_READINESS_MATRIX

| Condition | State |
| --- | --- |
| Legacy contained/tool guarded/preserve/FK/count/fingerprint | PASS |
| DB backup and restore | PASS |
| Asset backup and restore | PASS |
| Disposable reset and empty smoke | PASS |
| Representative writer freeze rehearsal | FAIL |
| Verdict | DATASET_RESET_EXECUTION_NOT_READY |

### LOAD_READINESS_MATRIX

| Condition | State |
| --- | --- |
| Approved source | FAIL |
| Rights/provenance | FAIL |
| Importer/admin load workflow | FAIL |
| Production schema prerequisites | PENDING |
| Real-data contract validation | NOT_RUN |
| Verdict | REAL_DATA_LOAD_EXECUTION_NOT_READY |

### OPEN_REAL_DATA_GATES_MATRIX

| # | Gate | State |
| --- | --- | --- |
| 1 | INTERNAL_LINK_GRAPH_REAL_DATA_VALIDATION_REQUIRED | OPEN |
| 2 | SEO_ORPHAN_REAL_DATA_VALIDATION_REQUIRED | OPEN |
| 3 | BREADCRUMB_REAL_DATA_VALIDATION_REQUIRED | OPEN |
| 4 | STRUCTURED_DATA_REAL_DATA_VALIDATION_REQUIRED | OPEN |
| 5 | BLOG_TAXONOMY_REAL_DATA_VALIDATION | OPEN |
| 6 | BLOG_TAXONOMY_REAL_DATA_QUALITY_GATE | OPEN |
| 7 | BLOG_TAXONOMY_REAL_DATA_EXPLAIN_REQUIRED | OPEN |
| 8 | SITEMAP_REAL_DATA_VALIDATION_REQUIRED | OPEN |
| 9 | INDEX_POLICY_REAL_DATA_VALIDATION_REQUIRED | OPEN |
| 10 | ROBOTS_PRODUCTION_VALIDATION_REQUIRED | OPEN |
| 11 | CANONICAL_HOST_PRODUCTION_VALIDATION_REQUIRED | OPEN |
| 12 | SITEMAP_PRODUCTION_SCALE_VALIDATION_REQUIRED | OPEN |
| 13 | SEARCH_ENGINE_SUBMISSION_AFTER_SEO_GO | OPEN |
| 14 | PERFORMANCE_REAL_DATA_QUERY_VALIDATION_REQUIRED | OPEN |
| 15 | PERFORMANCE_REAL_DATA_EXPLAIN_REQUIRED | OPEN |
| 16 | CORE_WEB_VITALS_REAL_USER_VALIDATION_REQUIRED | OPEN |
| 17 | PRODUCTION_PERFORMANCE_SMOKE_REQUIRED | OPEN |
| 18 | CDN_CACHE_PRODUCTION_VALIDATION_REQUIRED | OPEN |
| 19 | FONT_DELIVERY_PRODUCTION_VALIDATION_REQUIRED | OPEN |
| 20 | IMAGE_DELIVERY_REAL_DATA_VALIDATION_REQUIRED | OPEN |

### BLOCKER_RECLASSIFICATION_MATRIX

| Previous blocker | V2 classification | Evidence |
| --- | --- | --- |
| LEGACY_RESET_SCRIPT_UNSAFE_FOR_11B | CLOSED | Legacy entry point is permanently fail-closed. |
| PROTECTED_CONTENT_REFERENCE_CLOSURE_UNRESOLVED | CLOSED_BY_V2_POLICY | User operational content is explicitly reset; accounts are preserved separately. |
| REAL_DATA_SOURCE_NOT_AVAILABLE_FOR_ALL_INTENDED_DOMAINS | LOAD_BLOCKER | Empty-state is authorized after reset, but load needs approved sources. |
| SOURCE_RIGHTS_AND_PROVENANCE_NOT_APPROVED | LOAD_AND_PUBLICATION_BLOCKER | Does not prevent an authorized reset; prevents load/publication. |
| CANONICAL_SCHEMA_MIGRATIONS_NOT_APPLIED_OR_REHEARSED | LOAD_BLOCKER_PARTIALLY_REMEDIATED | Rehearsal passed; production rollout remains pending. |
| DISPOSABLE_RESTORE_REHEARSAL_NOT_PROVEN | CLOSED | Latest backup restored successfully to disposable MySQL 8.4. |
| FILE_STORAGE_BACKUP_AND_RESTORE_NOT_PROVEN | CLOSED | Private archive, checksum and file-by-file restore comparison passed. |
| CONCURRENT_WRITER_FREEZE_NOT_REHEARSED | RESET_BLOCKER | Inventory exists; representative stop/verify/resume rehearsal does not. |
| FIXTURE_ROW_OWNERSHIP_NOT_OBJECTIVELY_PROVEN_FOR_MIXED_TABLES | CLOSED_BY_V2_POLICY | All operational content is disposable; table policy is exhaustive. |
| CONTENT_RESET_EXPECTED_COUNT_AND_FINGERPRINT_GUARDS_NOT_IMPLEMENTED | CLOSED | Expected counts, structural fingerprint and preserved snapshots abort on drift. |

### DATA_SAFETY_MATRIX

| Operation | Production count |
| --- | --- |
| DELETE | 0 |
| TRUNCATE | 0 |
| UPDATE | 0 |
| INSERT | 0 |
| DROP | 0 |
| Migrations applied | 0 |

## BO. Diffstat

Pending diff against the baseline: 22 files, 9 modified, 13 new, 0 removed, approximately +2,973/-308 lines. The earlier 11A inventory report was already untracked at task start and remains unchanged.

## BP. Worktree

Worktree intentionally remains dirty for audit: reset-policy source, safety fixes, tests and two reports are unstaged. No commit, push or deploy. Machine evidence remains under ignored `.tmp/data`; temporary credentials and disposable services were removed.

## BQ. Recommendation

Do not execute 11B. First perform and independently audit a staging-equivalent writer freeze/resume rehearsal. In parallel, close load blockers without coupling them to reset readiness.

## Mandatory declarations

```text
baseline = fbb34f83f94bbda0792bd861c20d137916566a58
RESET_POLICY_V2 = ACTIVE_FOR_PLANNING
production target = IDENTIFIED_BUT_NOT_MUTATED
production DB writes = 0
production DELETE = 0
production TRUNCATE = 0
production UPDATE = 0
production INSERT = 0
production DROP = 0
production migrations applied = 0
test dataset removed = NÃO
real dataset loaded = NÃO
real dataset validated = NÃO
users removed = 0
settings removed = 0
effective launch mode = PRELAUNCH
production indexing activated = NÃO
production sitemap published = NÃO
search engines notified = NÃO
platform production ready = NÃO
CONCURSOMESTRE_PRODUCTION_GO = NÃO
commit = NÃO
push realizado = NÃO
deploy realizado = NÃO
```

## Independent verdicts

```text
DATASET_RESET_EXECUTION_NOT_READY
REAL_DATA_LOAD_EXECUTION_NOT_READY
```
