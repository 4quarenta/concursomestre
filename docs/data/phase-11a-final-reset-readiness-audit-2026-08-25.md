# Macroetapa 11A Final Audit - Independent Reset Readiness

- Measurement date: 2026-08-25
- Branch: `1.0.0`
- Baseline: `fbb34f83f94bbda0792bd861c20d137916566a58`
- Audit mode: local/read-only evidence review; production not mutated

## A. Executive summary

Independent evidence supports authorizing the 11B reset procedure, not immediate DML. Four operational defects found during this audit were corrected locally: real rehearsal JSON compatibility, database/host binding for freeze evidence, actual RefuseManualStart verification, and manual SQL/Unix-socket session detection. P0_RESET=0 and P1_RESET=0 after retest.

## B. Baseline

Branch 1.0.0; HEAD fbb34f83f94bbda0792bd861c20d137916566a58; exact match.

## C. Scope

Full accumulated 11A/11A-R/11A-W/11A-WR diff, reports and machine artifacts. No 11B, deploy, push, commit, migration, production stop or production write.

## D. Full accumulated diff

30 files including this report: 9 modified and 21 new; no deleted or renamed files. OUT_OF_SCOPE=0 and UNCERTAIN=0.

## E. File-by-file classification

See FINAL_FILE_SCOPE_MATRIX. Every file is tied to reset policy, read boundary, freeze tooling, tests or evidence.

## F. RESET_POLICY_V2

ACTIVE_FOR_PLANNING. Policy was recomputed from PHP twice with the same SHA-256 and cross-checked against the independent 125-table inventory.

## G. 125-table reconciliation

Inventory=125; known=125; unknown=0; missing=0; overlap=0.

## H. 12 PRESERVE

`addresses`, `admin_audit_logs`, `bank_accounts`, `cache_settings`, `filter_types`, `plans`, `schema_audit_runs`, `schema_backfill_runs`, `schema_migrations`, `security_ip_bans`, `system_settings`, `users`.

## I. 113 RESETTABLE

**AUTH_OPERATIONAL_STATE (5)**: `auth_refresh_tokens`, `auth_sessions`, `email_verifications`, `password_resets`, `user_cards`

**QUESTIONS (11)**: `question_assets`, `question_context_questions`, `question_contexts`, `question_editorial_feedback`, `question_editorials`, `question_filters`, `question_options`, `question_provas`, `questions`, `questions_groups`, `teacher_comments`

**TAXONOMIES (4)**: `filter_aliases`, `filter_relationships`, `filter_source_identities`, `filters`

**EXAMS (11)**: `prova_arquivos`, `prova_caderno_cargos`, `prova_caderno_filters`, `prova_cadernos`, `prova_cargo_detalhes`, `prova_cargo_requisitos`, `prova_cargo_vagas`, `prova_extracao_itens`, `prova_extracoes`, `prova_filters`, `provas`

**CONTESTS_CAREERS_POSITIONS (0)**:

**PUBLIC_SIMULATIONS (0)**:

**PRIVATE_SIMULATIONS (1)**: `simulations`

**LAWS (24)**: `article_doutrina`, `article_exam_tips`, `article_jurisprudence`, `article_sumulas`, `law_article_blocks`, `law_article_versions`, `law_articles`, `law_section_editorials`, `law_sections`, `law_updates`, `law_versions`, `laws`, `legal_ai_batch_items`, `legal_ai_batch_runs`, `legal_areas`, `legal_comment_reports`, `legal_content_reactions`, `legal_sync_logs`, `legal_user_comments`, `legal_user_favorites`, `legal_user_notes`, `legal_user_progress`, `legal_user_reader_annotations`, `sync_errors`

**MATERIALS (4)**: `material_moderation_events`, `material_ratings`, `material_uploads`, `materials`

**BLOG_CHANGELOG (6)**: `blog_article_likes`, `blog_article_tags`, `blog_articles`, `blog_categories`, `blog_tags`, `changelogs`

**USER_CONTENT_ACTIVITY (27)**: `analytics_lifecycle_events`, `comment_likes`, `comments`, `marketing_automation_events`, `notifications`, `platform_event_outbox`, `question_answer_idempotency`, `ranking_entries`, `rankings`, `report_moderation_drafts`, `report_moderation_history`, `reports`, `study_sessions`, `user_answer_counters`, `user_answers`, `user_answers_archive`, `user_badges`, `user_bookmarks`, `user_feedback`, `user_feedback_votes`, `user_gamification_events`, `user_highlights`, `user_notes`, `user_saved_questions`, `user_statistics`, `user_streaks`, `user_study_schedules`

**IMPORT_STAGING (7)**: `gran_automatic_crawler_checkpoints`, `gran_question_publication_failures`, `gran_taxonomy_sync_manifests`, `private_ingestion_batches`, `private_ingestion_jobs`, `private_ingestion_nonces`, `private_ingestion_requests`

**FINANCIAL_TEST_DATA (10)**: `coupon_reservations`, `financial_ledger_entries`, `provider_webhook_events`, `referral_commission_entries`, `referral_payout_cycles`, `referral_payout_items`, `referrals`, `stripe_testing_matrix_runs`, `transactions`, `user_subscriptions`

**DERIVED_DATA (3)**: `question_search_documents`, `question_stats`, `subject_statistics`

## J. Users

6 -> 6 in rehearsal; aggregate fingerprint bb6b1387586d03ff546006b38c9521353410fa1daef41b217a258d087f9a2d1a remained equal. No PII is present.

## K. Settings

99 -> 99; aggregate fingerprint b5a3c83bf6cc211350040c904e87e3af088fb4b8bf840baa53238cb7de6c1587 remained equal.

## L. Required identity

users, addresses and bank_accounts are explicit PRESERVE entries. Required account relations are not inferred from the complement.

## M. Auth policy

Identity survives; sessions, refresh tokens, verification/reset tokens and test card state reset. Reauthentication is expected.

## N. Financial test reset policy

Current subscriptions, transactions, ledger, webhook history, reservations, referrals and payouts are test operational data authorized for reset. Plans and configuration remain preserved.

## O. Static contracts

filter_types, plans, cache_settings, schema audit/backfill infrastructure and security controls remain preserved.

## P. Migration history

62 -> 62 during reset; fingerprint f83696b915afe7db3ed74ab4dff2eca4c49238dfec940a0a8df0007307bf8464 remained equal.

## Q. Legacy reset

The legacy entry point contains no DML or FK-disabling logic and independently aborted with exit 64 and zero writes.

## R. New reset tool

Default is read-only dry-run; execution is explicit, transactional, allowlisted and residue-checked. No wildcard, TRUNCATE or global FK disabling exists.

## S. Guard ordering

All database destructive guards and fresh freeze validation run before beginTransaction and before the first DELETE. Filesystem audit preflight is not DB DML.

## T. Dry-run

Default invocation with no DB_READ configuration refused exit 2 and reported writeStatementsExecutedBeforeRefusal=0.

## U. Validate-freeze-only mode

Shares execution guards and exits before audit-log/reset transaction; rehearsal reported writes=0 and transactionStarted=false.

## V. Fingerprint

Structural fingerprint binds schema/FKs/latest migration; snapshot fingerprint additionally binds exact counts and preserve digests. 11B must recompute immediately before freeze/DML.

## W. Expected counts

All 125 exact counts are compared to the approved manifest before DML. Driver affected rows can differ by one because of self/cascade semantics; residue zero and transaction rollback remain authoritative.

## X. Allowlist

Exactly 113 explicit identifiers; SQL identifiers are grammar-validated and quoted.

## Y. Preserve list

Exactly 12 explicit entries with reason codes; not generated as an implicit complement.

## Z. FK order

91 FKs, 113 reset tables ordered child-first, cycles=0, preserve-child/reset-parent incompatibilities=0.

## AA. Backup

Historical backup/checksum evidence proves capability only. A new backup and SHA-256 are mandatory immediately before 11B.

## AB. Restore

Validated backup restored to disposable MySQL 8.4 with 125 tables and 313629 rows; failed-run rollback fingerprint was restored.

## AC. Assets

339 files / 75870346 bytes passed checksum and restore comparison. User profile assets are PRESERVE. Fresh archive/manifest required for 11B.

## AD. Pending migrations

20260819_120000, 20260819_130000 and 20260821_120000 passed disposable rehearsal and remain unapplied in production. They are not required by the current 125-table reset path.

## AE. Empty dataset

29 routes: 16 hubs HTTP 200, 13 missing details hard 404, all applicable NOINDEX, zero route/page failures.

## AF. SEO PRELAUNCH

Effective mode remains PRELAUNCH; no public production sitemap, indexing activation or search-engine notification.

## AG. Writer inventory

25 known: 20 MUST_FREEZE, 4 NOT_A_WRITER, 1 SAFE_TO_CONTINUE, UNKNOWN=0.

## AH. Writer hash

Two independent executions returned 41ce3c2ca0cfdfc0ceed5081845491810d9f60fcc77f52bcf0da98476a8024a9.

## AI. Writer coverage

125/125 tables statically covered; MUST_FREEZE 20/20; critical untested=0.

## AJ. Representative environment

Disposable WSL2 used real Linux systemd, MySQL 8.4, PHP-FPM, nginx, Node, cron/timers and actual continuous worker commands.

## AK. Representativeness limitations

One NON_MATERIAL and four COMPENSATED differences; MATERIAL=0. See REPRESENTATIVENESS_MATRIX.

## AL. HTTP compensating controls

Business handlers were substituted, but nginx and PHP-FPM were stopped before handler execution and the target-table sentinel stayed unchanged. This proves the freeze barrier, not business correctness.

## AM. Stripe compensating controls

Signed local event proves barrier, retry and local dedupe contract only. It is not evidence of Stripe live readiness.

## AN. Gran/import compensating controls

Fixtures prove writer lifecycle/operator lock, not definitive provider/source readiness. This remains a load concern.

## AO. Full maintenance

For a one-time prelaunch destructive reset, FULL_MAINTENANCE is safer than partial lanes because no complete application write barrier exists.

## AP. Ingress barrier

Nginx closes first. The final capture now verifies both inactive state and RefuseManualStart=yes.

## AQ. Drain

Workers were given their bounded sleep/drain interval; process and DB-session scans were empty before evidence.

## AR. Systemd

Restart=always changed PID before freeze and could not reactivate while RefuseManualStart was set.

## AS. Cron/timers

Schedules were accelerated/exercised, then stopped and protected from manual start across the freeze.

## AT. Producers

HTTP, admin, ingestion and manual producers were blocked before consumers/runtimes stopped.

## AU. Consumers

Platform and ingestion consumers used actual commands; all required consumers were frozen and resumed.

## AV. Queue/outbox

Depth/effects remained stable during freeze; no silent loss, duplicate or backlog explosion after resume.

## AW. MySQL sessions

TCP writer session injection caused refusal; zero sessions during accepted evidence. The final capture also scans manual mysql/mariadb clients and connected Unix sockets.

## AX. Freeze evidence

Future evidence is newly generated in the 11B window and binds run ID, target kind, live DB snapshot, host, inventory, process state and sentinel.

## AY. HMAC

HMAC-SHA256, canonical JSON, minimum 32-byte secret and hash_equals. Secret is operational and absent from Git/reports.

## AZ. Replay protection

15-minute TTL, run ID, target snapshot, inventory and host binding prevent arbitrary cross-run/cross-target replay. Post-reset expected counts also invalidate reuse.

## BA. Freshness

MAX_AGE=900 seconds; observation minimum=30 seconds. The final pre-DML validation must run immediately before reset.

## BB. Quiescence

Full window 70 seconds; signed subset 35 seconds. The difference is documented and both exceed the exercised schedule/minimum; silence was supplemented by active probes.

## BC. Active writes

User, admin, content, ingestion, Gran, extractor, Planalto, maintenance, cron/timer, Stripe and outbox probes were blocked/suppressed with targetMutations=0.

## BD. Resume

Consumers -> extractor -> schedules -> PHP/Next -> ingress -> operators; ingress opened last.

## BE. Health

Required health=100%; no maintenance leak or backlog explosion.

## BF. Duplicate processing

Webhook, jobs, imports and outbox duplicates=0.

## BG. Idempotency

Two deliveries of one signed local event produced one effect using event identity/unique processing contract.

## BH. Failure injection

Stop refusal, autorestart, active consumer, DB session, stale evidence and resume failure all denied completion; recovery passed.

## BI. Recovery

Before DML: keep barrier, recover/resume, no restore. During transaction: rollback; if commit/rollback integrity is uncertain, restore. During resume: keep ingress closed until 100% health.

## BJ. Production 11B runbook

PRODUCTION_11B_RUNBOOK_MATRIX is the executable order. Every row is fail-closed and the fresh backup/freeze artifacts are created in the same run.

## BK. Fresh backup requirement

The rehearsal backup cannot authorize 11B. A fresh DB and asset backup with verified SHA-256 are mandatory.

## BL. Production freeze-evidence requirement

The rehearsal proves mechanism only. 11B must create new production-host evidence bound to the current production snapshot.

## BM. Node versions

Project engine is >=20.19. Node 22.23.1 and 24.19.0 satisfy it; local 20.12.2 does not. This is tooling drift, not a PHP reset-path blocker.

## BN. MySQL versions

Production 8.4.10-10 vs rehearsal 8.4.11 is a patch-level difference. FK, transaction and DELETE semantics used by reset are compatible; migration/load remains separately gated.

## BO. WSL representativeness

Systemd PID1, signals, Restart=always, cron/timers, nginx and MySQL were real. Networking/provider payload differences were explicitly compensated; no material freeze gap remains.

## BP. Port hardening P2

External 3306 did not answer, but broad bind was observed. Keep P2_SECURITY_HARDENING in backlog; it does not alter reset readiness.

## BQ. Load blockers

27 BINARY REGEXP sites, definitive sources, rights/provenance, production rollout of three canonical migrations and real-data validation remain blockers.

## BR. 20 gates

All 20 remain OPEN. None was closed or reclassified by this audit.

## BS. Tests

PHP focused 9/9; PHP lint 25/25; Vitest 154/154 files and 910/910 tests; route types, typecheck, build 52/52, launch validator, secret scan, encoding and diff check PASS. ESLint 0 errors/96 pre-existing warnings.

## BT. Security

Secret scan PASS. Freeze evidence gained live target and host binding plus verified autorestart suppression. npm ci reported 7 existing dependency advisories; platform production readiness remains NO.

## BU. PII

No credential, password, token, private key, raw protected row, CPF or real email was found. Email-like hits were systemd template unit names.

## BV. Matrix consistency

No PRESERVE/RESET overlap, active MUST_FREEZE writer in accepted freeze, unknown table, missing matrix or READY/OPEN contradiction. Earlier NOT_READY reports are chronological predecessor states, not current conflicts.

## BW. P0

P0_RESET=0 after target/host binding correction. No production mutation or destructive command occurred.

## BX. P1

P1_RESET=0 after correcting rehearsal-artifact compatibility, operational RefuseManualStart verification and manual SQL/Unix-socket detection.

## BY. P2

Port hardening, local Node drift, dependency advisories, operational observability and 27 REGEXP load compatibility remain explicit; none is on the reset DML path.

## BZ. Recommendation

APROVADA COM RESSALVAS OPERACIONAIS: authorize the 11B procedure only as a fresh fail-closed run. Do not interpret READY as permission to skip any matrix row or to load real data.

## Required final matrices

### FINAL_FILE_SCOPE_MATRIX

| path | status | purpose | substep | kind | inScope |
| --- | --- | --- | --- | --- | --- |
| backend/api/feedback/testimonials.php | modified | public read boundary | 11A-R | runtime | true |
| backend/modules/contests/repositories/ContestsRepository.php | modified | MySQL 8.4 REGEXP compatibility | 11A-R | runtime | true |
| backend/modules/feedback/repositories/FeedbackRepository.php | modified | read-only testimonial path | 11A-R | runtime | true |
| backend/modules/filters/professional/ProfessionalTaxonomiesRepository.php | modified | MySQL 8.4 REGEXP compatibility | 11A-R | runtime | true |
| backend/modules/materials/public/PublicMaterialsRepository.php | modified | MySQL 8.4 REGEXP compatibility | 11A-R | runtime | true |
| backend/modules/simulations/public/PublicSimulationsRepository.php | modified | MySQL 8.4 REGEXP compatibility | 11A-R | runtime | true |
| backend/scripts/tasks/reset_production_content.php | modified | legacy reset fail-closed | 11A-R | tooling | true |
| backend/tests/CanonicalContestsWiringTest.php | modified | compatibility regression | 11A-R | test | true |
| backend/tests/ProductionContentResetSafetyTest.php | modified | legacy reset refusal | 11A-R | test | true |
| backend/scripts/data/DatasetResetPolicyV2.php | new | explicit 12/113 policy and guards | 11A-R | tooling | true |
| backend/scripts/data/DatasetResetReadinessReporter.php | new | read-only target snapshot and FK order | 11A-R | tooling | true |
| backend/scripts/data/DatasetWriterFreezeEvidence.php | new | signed freeze evidence and host binding | 11A-W/FINAL-AUDIT | security-sensitive tooling | true |
| backend/scripts/data/DatasetWriterFreezeReporter.php | new | 25-writer inventory | 11A-W | tooling | true |
| backend/scripts/data/PostResetResidueReporter.php | new | post-reset residue and preserve check | 11A-R | tooling | true |
| backend/scripts/data/RealDatasetReadinessReporter.php | new | future load gates | 11A-R | tooling | true |
| backend/scripts/data/capture_write_sentinel.php | new | read-only 125-table sentinel and target binding | 11A-W/FINAL-AUDIT | security-sensitive tooling | true |
| backend/scripts/data/capture_writer_freeze_evidence.php | new | operational systemd freeze capture | 11A-WR/FINAL-AUDIT | security-sensitive tooling | true |
| backend/scripts/data/reset_definitive_dataset.php | new | guarded definitive reset CLI | 11A-R/WR | security-sensitive tooling | true |
| backend/tests/DatasetResetPolicyV2Test.php | new | policy and execution guards | 11A-R | test | true |
| backend/tests/DatasetResetToolWiringTest.php | new | reset CLI fail-closed wiring | 11A-R/FINAL-AUDIT | test | true |
| backend/tests/DatasetWriterFreezeCaptureWiringTest.php | new | operational capture wiring | 11A-W/FINAL-AUDIT | test | true |
| backend/tests/DatasetWriterFreezeEvidenceTest.php | new | HMAC, target, host, freshness and resume tests | 11A-W/FINAL-AUDIT | test | true |
| backend/tests/DatasetWriterFreezeReporterTest.php | new | writer inventory coverage | 11A-W | test | true |
| backend/tests/PublicTestimonialsReadOnlyTest.php | new | public read boundary regression | 11A-R | test | true |
| backend/tests/RealDatasetReadinessReporterTest.php | new | load gate separation | 11A-R | test | true |
| docs/data/phase-11a-real-dataset-inventory-reset-plan-2026-08-23.md | new | initial inventory and plan | 11A | docs | true |
| docs/data/phase-11a-reset-policy-v2-readiness-2026-08-23.md | new | policy v2 rehearsal | 11A-R | docs | true |
| docs/data/phase-11a-writer-freeze-rehearsal-2026-08-24.md | new | first freeze audit and blocker | 11A-W | docs | true |
| docs/data/phase-11a-representative-writer-freeze-resume-rehearsal-2026-08-24.md | new | representative rehearsal evidence | 11A-WR | docs | true |
| docs/data/phase-11a-final-reset-readiness-audit-2026-08-25.md | new | independent final audit and 11B runbook | 11A-FINAL-AUDIT | docs | true |

### RESET_POLICY_MATRIX

| domain | tables | classification |
| --- | --- | --- |
| AUTH_OPERATIONAL_STATE | 5 | RESETTABLE |
| QUESTIONS | 11 | RESETTABLE |
| TAXONOMIES | 4 | RESETTABLE |
| EXAMS | 11 | RESETTABLE |
| CONTESTS_CAREERS_POSITIONS | 0 | RESETTABLE |
| PUBLIC_SIMULATIONS | 0 | RESETTABLE |
| PRIVATE_SIMULATIONS | 1 | RESETTABLE |
| LAWS | 24 | RESETTABLE |
| MATERIALS | 4 | RESETTABLE |
| BLOG_CHANGELOG | 6 | RESETTABLE |
| USER_CONTENT_ACTIVITY | 27 | RESETTABLE |
| IMPORT_STAGING | 7 | RESETTABLE |
| FINANCIAL_TEST_DATA | 10 | RESETTABLE |
| DERIVED_DATA | 3 | RESETTABLE |

### PRESERVE_RESET_DISJOINT_MATRIX

| check | expected | actual | result |
| --- | --- | --- | --- |
| inventory | 125 | 125 | PASS |
| preserve | 12 | 12 | PASS |
| resettable | 113 | 113 | PASS |
| intersection/unknown/missing | 0 | 0 | PASS |

### USER_SETTINGS_PRESERVATION_MATRIX

| surface | before | after | fingerprintEqual | result | policy |
| --- | --- | --- | --- | --- | --- |
| users | 6 | 6 | true | PASS |  |
| addresses | 2 |  |  | PASS | PRESERVE |
| bank_accounts | 0 |  |  | PASS | PRESERVE_IF_PRESENT |
| system_settings | 99 | 99 | true | PASS |  |
| schema_migrations | 62 | 62 | true | PASS |  |

### RESET_TOOL_GUARD_MATRIX

| order | guard | beforeDml | result |
| --- | --- | --- | --- |
| 1 | environment | true | PASS |
| 2 | target kind | true | PASS |
| 3 | database confirmation | true | PASS |
| 4 | operation token | true | PASS |
| 5 | approved manifest | true | PASS |
| 6 | policy/schema | true | PASS |
| 7 | structural fingerprint | true | PASS |
| 8 | snapshot fingerprint | true | PASS |
| 9 | exact counts | true | PASS |
| 10 | preserve snapshots | true | PASS |
| 11 | FK order | true | PASS |
| 12 | database backup | true | PASS |
| 13 | backup checksum | true | PASS |
| 14 | restore rehearsal | true | PASS |
| 15 | asset backup | true | PASS |
| 16 | asset restore | true | PASS |
| 17 | approved writer rehearsal | true | PASS |
| 18 | fresh signed freeze evidence | true | PASS |
| 19 | writer inventory hash | true | PASS |
| 20 | host fingerprint | true | PASS |

### FREEZE_EVIDENCE_SECURITY_MATRIX

| control | result |
| --- | --- |
| HMAC SHA-256 and constant-time comparison | PASS |
| minimum key length 32 bytes; key not versioned | PASS |
| run ID, target kind, target snapshot and inventory bound | PASS |
| capture host fingerprint bound to reset host | PASS_AFTER_AUDIT_FIX |
| target fingerprint derived from observed sentinel DB | PASS_AFTER_AUDIT_FIX |
| 15-minute TTL and minimum 30-second observation | PASS |
| RefuseManualStart verified instead of asserted | PASS_AFTER_AUDIT_FIX |
| old rehearsal evidence reusable as production freeze | NO |

### BACKUP_RESTORE_MATRIX

| item | result |
| --- | --- |
| validated private rehearsal backup | PASS |
| SHA-256 sidecar | PASS |
| restore to disposable MySQL 8.4 | PASS |
| 125 tables / 313629 rows restored | PASS |
| fresh production backup in 11B | MANDATORY_PRE_DML |

### ASSET_BACKUP_MATRIX

| item | files | bytes | checksum | restore | policy | result |
| --- | --- | --- | --- | --- | --- | --- |
| rehearsal archive | 339 | 75870346 | PASS | PASS |  |  |
| user profile assets |  |  |  |  | PRESERVE | PASS |
| fresh production asset manifest in 11B |  |  |  |  |  | MANDATORY_PRE_DML |

### FK_RESET_MATRIX

| item | actual | result |
| --- | --- | --- |
| foreign keys | 91 | PASS |
| ordered reset tables | 113 | PASS |
| cycles | 0 | PASS |
| preserved child to reset parent incompatibilities | 0 | PASS |
| FOREIGN_KEY_CHECKS disabled | 0 | PASS |
| TRUNCATE planned | 0 | PASS |

### WRITER_COVERAGE_MATRIX

| classification | expected | actual | result |
| --- | --- | --- | --- |
| MUST_FREEZE | 20 | 20 | PASS |
| NOT_A_WRITER | 4 | 4 | PASS |
| SAFE_TO_CONTINUE | 1 | 1 | PASS |
| UNKNOWN | 0 | 0 | PASS |
| TABLE_COVERAGE | 125 | 125 | PASS |

### REPRESENTATIVENESS_MATRIX

| item | severity | control | result |
| --- | --- | --- | --- |
| Nginx package minor differs from production | NON_MATERIAL | same stop and RefuseManualStart ingress semantics | PASS |
| HTTP business mutations represented by control endpoint | COMPENSATED | same nginx/PHP-FPM/TCP DB path plus target-table sentinel | PASS |
| Stripe provider substituted | COMPENSATED | signed local test event, retry/redelivery and event-id idempotency | PASS |
| Long cron/timer schedules accelerated or manually invoked | COMPENSATED | same cron/systemd supervision and logical writer IDs | PASS |
| Gran/exam/Planalto payloads substituted | COMPENSATED | operator barrier, process scan and control write path | PASS |

### QUIESCENCE_MATRIX

| item | value | unit | result |
| --- | --- | --- | --- |
| full freeze window | 70 | seconds | PASS |
| signed evidence observation | 35 | seconds | PASS_MIN_30 |
| unexpected target mutations | 0 |  | PASS |
| MySQL writer sessions | 0 |  | PASS |
| cron/timer tick deliberately exercised | true |  | PASS |

### ACTIVE_WRITE_MATRIX

| writer | result |
| --- | --- |
| user | BLOCKED |
| admin | BLOCKED |
| content | BLOCKED |
| privateIngestion | BLOCKED |
| stripe | BLOCKED_RETRYABLE_TRANSPORT |
| gran | BLOCKED |
| examExtraction | BLOCKED |
| planalto | BLOCKED |
| manualMaintenance | BLOCKED |
| cron | SUPPRESSED |
| timer | SUPPRESSED |
| outboxProducer | BLOCKED |
| targetMutations | 0 |

### RESUME_HEALTH_MATRIX

| item | actual | result |
| --- | --- | --- |
| required writer health | 100% | PASS |
| barrier removed only after health | true | PASS |
| duplicate processing | 0 | PASS |
| backlog explosion | false | PASS |

### FAILURE_INJECTION_MATRIX

| scenario | result |
| --- | --- |
| workerRefusesStop | PASS |
| workerAutorestarts | PASS |
| activeConsumer | PASS |
| mysqlSession | PASS |
| staleEvidence | PASS |
| resumeFailure | PASS |
| allDenied | PASS |
| recoveryPassed | PASS |

### PRODUCTION_11B_RUNBOOK_MATRIX

> **SUPERSEDED FOR THE NEXT 11B ATTEMPT (2026-08-25):** rows 11 and 25 below were remediated by 11B-R. The authoritative freeze mechanism is now `SYSTEMD_RUNTIME_DROPIN_V1`, implemented by `manage_writer_systemd_freeze.php`. It writes verified runtime-only drop-ins under `/run`, disables autorestart, denies manual/dependency starts, and binds signed state to host, boot ID and systemd version. `systemctl set-property ... RefuseManualStart=yes` is forbidden.

| order | step | failClosed |
| --- | --- | --- |
| 1 | verify PRELAUNCH and operator authorization | ABORT if not PRELAUNCH |
| 2 | create unique operation run ID and exclusive operator lock | ABORT on collision |
| 3 | recompute read-only 125-table snapshot and exact counts | ABORT on policy drift |
| 4 | recompute structural, migration and target fingerprints | ABORT on drift |
| 5 | create fresh DB backup with single-transaction/quick/routines/triggers/events | ABORT if command/heartbeat fails |
| 6 | verify fresh DB backup SHA-256 and private destination | ABORT on mismatch |
| 7 | create fresh asset archive and manifest, preserving user assets | ABORT on mismatch |
| 8 | capture users, required account relations, settings and migrations digests | ABORT if unavailable |
| 9 | prepare exact manifest and guard artifact; independent operator approves | ABORT unless approvedForExecution=true |
| 10 | activate FULL_MAINTENANCE at nginx | keep barrier closed |
| 11 | arm signed `SYSTEMD_RUNTIME_DROPIN_V1`, verify all 15 unit drop-ins/aliases/triggers, then stop in policy order | ABORT before DML unless 20/20 writers are suppressed and live validation passes |
| 12 | freeze operator/manual producers, cron and timers | ABORT if any producer remains |
| 13 | drain in-flight operations | ABORT if drain incomplete |
| 14 | stop consumers, PHP-FPM, Next and extractor | ABORT if any remains active |
| 15 | scan known processes, TCP DB sessions and manual SQL clients | ABORT on any writer |
| 16 | capture before sentinel, run active-write probes, wait observation, capture after sentinel | ABORT on mutation |
| 17 | generate new HMAC evidence on production host bound to current target snapshot | do not reuse rehearsal evidence |
| 18 | run --validate-freeze-evidence-only with all execution guards | must report transactionStarted=false and writes=0 |
| 19 | immediately rerun exact snapshot/count/freeze validation | ABORT on any mismatch |
| 20 | run --execute once with audit log; ordered transactional DELETE only | rollback on any failure |
| 21 | before commit verify reset residue zero and preserve digests unchanged | rollback on mismatch |
| 22 | run post-reset users/settings/migrations/static-contract and empty-state checks | do not resume on failure |
| 23 | resume consumers, extractor, schedules, PHP/Next in approved order | barrier stays closed |
| 24 | require 100% health and idempotency/duplicate checks | recover before opening ingress |
| 25 | validate signed FROZEN state, remove runtime drop-ins, restore only originally active units in policy order, open nginx last | operation complete only after 12/12 health and idempotent recovery |

### LOAD_BLOCKERS_MATRIX

| blocker | resetImpact | loadImpact |
| --- | --- | --- |
| BINARY_REGEXP_27_OCCURRENCES | NONE | BLOCKER |
| DEFINITIVE_SOURCES_UNAPPROVED | NONE | BLOCKER |
| RIGHTS_UNVALIDATED | NONE | BLOCKER |
| PRODUCTION_MIGRATION_ROLLOUT_PENDING | NONE | BLOCKER |
| REAL_DATA_GATES_20_OPEN | NONE | BLOCKER |

### OPEN_REAL_DATA_GATES_MATRIX

| gate | state | resetImpact | loadImpact |
| --- | --- | --- | --- |
| 1 | OPEN | NONE | BLOCKER |
| 2 | OPEN | NONE | BLOCKER |
| 3 | OPEN | NONE | BLOCKER |
| 4 | OPEN | NONE | BLOCKER |
| 5 | OPEN | NONE | BLOCKER |
| 6 | OPEN | NONE | BLOCKER |
| 7 | OPEN | NONE | BLOCKER |
| 8 | OPEN | NONE | BLOCKER |
| 9 | OPEN | NONE | BLOCKER |
| 10 | OPEN | NONE | BLOCKER |
| 11 | OPEN | NONE | BLOCKER |
| 12 | OPEN | NONE | BLOCKER |
| 13 | OPEN | NONE | BLOCKER |
| 14 | OPEN | NONE | BLOCKER |
| 15 | OPEN | NONE | BLOCKER |
| 16 | OPEN | NONE | BLOCKER |
| 17 | OPEN | NONE | BLOCKER |
| 18 | OPEN | NONE | BLOCKER |
| 19 | OPEN | NONE | BLOCKER |
| 20 | OPEN | NONE | BLOCKER |

### FINAL_RISK_MATRIX

| severity | open | result | item | owner |
| --- | --- | --- | --- | --- |
| P0_RESET | 0 | PASS |  |  |
| P1_RESET | 0 | PASS_AFTER_4_AUDIT_FIXES |  |  |
| P2 |  |  | MySQL bind-address hardening | security/operations |
| P2 |  |  | Node 20.12 local tooling below engine | developer environment |
| P2 |  |  | 7 npm audit findings in existing lock graph | platform security; not reset path |
| LOAD_BLOCKER |  |  | 27 BINARY REGEXP plus sources/rights/migrations/real-data gates | 11C+ |

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
test dataset removed = NAO
real dataset loaded = NAO
real dataset validated = NAO
users removed = 0
settings removed = 0
effective launch mode = PRELAUNCH
production indexing activated = NAO
production sitemap published = NAO
search engines notified = NAO
platform production ready = NAO
CONCURSOMESTRE_PRODUCTION_GO = NAO
commit = NAO
push realizado = NAO
deploy realizado = NAO
```

## Verdicts

```text
DATASET_RESET_FINAL_AUDIT_READY
DATASET_RESET_EXECUTION_READY
REAL_DATA_LOAD_EXECUTION_NOT_READY
```
