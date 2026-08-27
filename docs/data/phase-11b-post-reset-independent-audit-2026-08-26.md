# Macroetapa 11B-POST - Auditoria independente pos-reset

## Resumo executivo

- Data UTC: 2026-08-26
- Run ID: `phase11b-post-20260826-020227`
- Branch / baseline: `1.0.0` / `fbb34f83f94bbda0792bd861c20d137916566a58`
- Target: producao, database `concursomestre`, MySQL/Percona `8.4.10-10`
- Credencial: dedicada read-only; grants com escrita recusados pelo auditor
- P0_POST_RESET: 0
- P1_POST_RESET: 2
- Veredito: `DATASET_RESET_POST_AUDIT_NOT_READY`

A auditoria nao repetiu o reset e nao executou DML, seed, crawler, import, backfill, migration, deploy, push ou commit. A limpeza original foi confirmada historicamente, mas o estado autoritativo de zero nao foi mantido: `analytics_lifecycle_events` recebeu uma linha normal de runtime apos o resume. A linha foi criada em `2026-08-25 23:01:15 -03`, com `event_name=identifiable_visit` e `source=auth`, pelo fluxo first-party de analytics da pagina de autenticacao.

Tambem existe sitemap materializado anterior ao reset ainda publicamente acessivel. O indice referencia cinco shards com 1.275 URLs do dataset temporario. Isso nao foi criado pela 11B e nenhum deploy ocorreu, mas contradiz o estado PRELAUNCH requerido.

## POST_RESET_TARGET_MATRIX

| Gate | Esperado | Atual | Resultado |
| --- | --- | --- | --- |
| branch | `1.0.0` | `1.0.0` | PASS |
| baseline | `fbb34f83...a58` | `fbb34f83...a58` | PASS |
| database | `concursomestre` | `concursomestre` | PASS |
| engine | factual | `8.4.10-10` | PASS |
| tables | 125 | 125 | PASS |
| PRESERVE / RESETTABLE | 12 / 113 | 12 / 113 | PASS |
| UNKNOWN / overlap | 0 / 0 | 0 / 0 | PASS |
| read-only connection | required | confirmed by grants | PASS |

## RESETTABLE_ZERO_MATRIX

| Table | Expected | Actual | Result |
| --- | ---: | ---: | --- |
| `analytics_lifecycle_events` | 0 | 1 | FAIL - POST_RESET_AUTOMATIC_REPOPULATION |
| `article_doutrina` | 0 | 0 | PASS |
| `article_exam_tips` | 0 | 0 | PASS |
| `article_jurisprudence` | 0 | 0 | PASS |
| `article_sumulas` | 0 | 0 | PASS |
| `auth_refresh_tokens` | 0 | 0 | PASS |
| `auth_sessions` | 0 | 0 | PASS |
| `blog_article_likes` | 0 | 0 | PASS |
| `blog_article_tags` | 0 | 0 | PASS |
| `blog_articles` | 0 | 0 | PASS |
| `blog_categories` | 0 | 0 | PASS |
| `blog_tags` | 0 | 0 | PASS |
| `changelogs` | 0 | 0 | PASS |
| `comment_likes` | 0 | 0 | PASS |
| `comments` | 0 | 0 | PASS |
| `coupon_reservations` | 0 | 0 | PASS |
| `email_verifications` | 0 | 0 | PASS |
| `filter_aliases` | 0 | 0 | PASS |
| `filter_relationships` | 0 | 0 | PASS |
| `filter_source_identities` | 0 | 0 | PASS |
| `filters` | 0 | 0 | PASS |
| `financial_ledger_entries` | 0 | 0 | PASS |
| `gran_automatic_crawler_checkpoints` | 0 | 0 | PASS |
| `gran_question_publication_failures` | 0 | 0 | PASS |
| `gran_taxonomy_sync_manifests` | 0 | 0 | PASS |
| `law_article_blocks` | 0 | 0 | PASS |
| `law_article_versions` | 0 | 0 | PASS |
| `law_articles` | 0 | 0 | PASS |
| `law_section_editorials` | 0 | 0 | PASS |
| `law_sections` | 0 | 0 | PASS |
| `law_updates` | 0 | 0 | PASS |
| `law_versions` | 0 | 0 | PASS |
| `laws` | 0 | 0 | PASS |
| `legal_ai_batch_items` | 0 | 0 | PASS |
| `legal_ai_batch_runs` | 0 | 0 | PASS |
| `legal_areas` | 0 | 0 | PASS |
| `legal_comment_reports` | 0 | 0 | PASS |
| `legal_content_reactions` | 0 | 0 | PASS |
| `legal_sync_logs` | 0 | 0 | PASS |
| `legal_user_comments` | 0 | 0 | PASS |
| `legal_user_favorites` | 0 | 0 | PASS |
| `legal_user_notes` | 0 | 0 | PASS |
| `legal_user_progress` | 0 | 0 | PASS |
| `legal_user_reader_annotations` | 0 | 0 | PASS |
| `marketing_automation_events` | 0 | 0 | PASS |
| `material_moderation_events` | 0 | 0 | PASS |
| `material_ratings` | 0 | 0 | PASS |
| `material_uploads` | 0 | 0 | PASS |
| `materials` | 0 | 0 | PASS |
| `notifications` | 0 | 0 | PASS |
| `password_resets` | 0 | 0 | PASS |
| `platform_event_outbox` | 0 | 0 | PASS |
| `private_ingestion_batches` | 0 | 0 | PASS |
| `private_ingestion_jobs` | 0 | 0 | PASS |
| `private_ingestion_nonces` | 0 | 0 | PASS |
| `private_ingestion_requests` | 0 | 0 | PASS |
| `prova_arquivos` | 0 | 0 | PASS |
| `prova_caderno_cargos` | 0 | 0 | PASS |
| `prova_caderno_filters` | 0 | 0 | PASS |
| `prova_cadernos` | 0 | 0 | PASS |
| `prova_cargo_detalhes` | 0 | 0 | PASS |
| `prova_cargo_requisitos` | 0 | 0 | PASS |
| `prova_cargo_vagas` | 0 | 0 | PASS |
| `prova_extracao_itens` | 0 | 0 | PASS |
| `prova_extracoes` | 0 | 0 | PASS |
| `prova_filters` | 0 | 0 | PASS |
| `provas` | 0 | 0 | PASS |
| `provider_webhook_events` | 0 | 0 | PASS |
| `question_answer_idempotency` | 0 | 0 | PASS |
| `question_assets` | 0 | 0 | PASS |
| `question_context_questions` | 0 | 0 | PASS |
| `question_contexts` | 0 | 0 | PASS |
| `question_editorial_feedback` | 0 | 0 | PASS |
| `question_editorials` | 0 | 0 | PASS |
| `question_filters` | 0 | 0 | PASS |
| `question_options` | 0 | 0 | PASS |
| `question_provas` | 0 | 0 | PASS |
| `question_search_documents` | 0 | 0 | PASS |
| `question_stats` | 0 | 0 | PASS |
| `questions` | 0 | 0 | PASS |
| `questions_groups` | 0 | 0 | PASS |
| `ranking_entries` | 0 | 0 | PASS |
| `rankings` | 0 | 0 | PASS |
| `referral_commission_entries` | 0 | 0 | PASS |
| `referral_payout_cycles` | 0 | 0 | PASS |
| `referral_payout_items` | 0 | 0 | PASS |
| `referrals` | 0 | 0 | PASS |
| `report_moderation_drafts` | 0 | 0 | PASS |
| `report_moderation_history` | 0 | 0 | PASS |
| `reports` | 0 | 0 | PASS |
| `simulations` | 0 | 0 | PASS |
| `stripe_testing_matrix_runs` | 0 | 0 | PASS |
| `study_sessions` | 0 | 0 | PASS |
| `subject_statistics` | 0 | 0 | PASS |
| `sync_errors` | 0 | 0 | PASS |
| `teacher_comments` | 0 | 0 | PASS |
| `transactions` | 0 | 0 | PASS |
| `user_answer_counters` | 0 | 0 | PASS |
| `user_answers` | 0 | 0 | PASS |
| `user_answers_archive` | 0 | 0 | PASS |
| `user_badges` | 0 | 0 | PASS |
| `user_bookmarks` | 0 | 0 | PASS |
| `user_cards` | 0 | 0 | PASS |
| `user_feedback` | 0 | 0 | PASS |
| `user_feedback_votes` | 0 | 0 | PASS |
| `user_gamification_events` | 0 | 0 | PASS |
| `user_highlights` | 0 | 0 | PASS |
| `user_notes` | 0 | 0 | PASS |
| `user_saved_questions` | 0 | 0 | PASS |
| `user_statistics` | 0 | 0 | PASS |
| `user_streaks` | 0 | 0 | PASS |
| `user_study_schedules` | 0 | 0 | PASS |
| `user_subscriptions` | 0 | 0 | PASS |

Resumo factual: 112/113 tabelas vazias; `RESETTABLE_NONZERO_TABLES=1`; `RESETTABLE_TOTAL_ROWS=1`. O valor aproximado `~65.846` mostrado pelo phpMyAdmin para `filter_source_identities` era estatistica InnoDB obsoleta; o `COUNT(*)` independente retornou zero.

## PRESERVE_INTEGRITY_MATRIX

| Table | Reference | Actual | Digest |
| --- | ---: | ---: | --- |
| `addresses` | 2 | 2 | MATCH |
| `admin_audit_logs` | 1926 | 1926 | MATCH |
| `bank_accounts` | 0 | 0 | MATCH |
| `cache_settings` | 0 | 0 | MATCH |
| `filter_types` | 10 | 10 | MATCH |
| `plans` | 14 | 14 | MATCH |
| `schema_audit_runs` | 0 | 0 | MATCH |
| `schema_backfill_runs` | 1 | 1 | MATCH |
| `schema_migrations` | 62 | 62 | MATCH |
| `security_ip_bans` | 0 | 0 | MATCH |
| `system_settings` | 99 | 99 | MATCH |
| `users` | 6 | 6 | MATCH |

## USER_INTEGRITY_MATRIX

| Assertion | Actual | Result |
| --- | --- | --- |
| count | 6 | PASS |
| identity digest vs post-reset reference | unchanged | PASS |
| users removed by audit | 0 | PASS |
| PII exposed in report | 0 | PASS |

## SETTINGS_INTEGRITY_MATRIX

| Assertion | Actual | Result |
| --- | --- | --- |
| rows | 99 | PASS |
| digest | unchanged | PASS |
| unexpected changes | 0 | PASS |

## MIGRATION_INTEGRITY_MATRIX

| Assertion | Actual | Result |
| --- | --- | --- |
| rows | 62 | PASS |
| digest | unchanged | PASS |
| latest migration | `20260811_151000` | PASS |
| migrations applied by 11B-POST | 0 | PASS |

## SCHEMA_FK_MATRIX

| Assertion | Actual | Result |
| --- | --- | --- |
| tables | 125 | PASS |
| structural fingerprint | `7e9904fc21bfa27ec5fe108f5ba6c0e594bf677fed9a509425beb77043656741` | MATCH |
| foreign keys / constraints | 91 / 91 | PASS |
| FK cycles | 0 | PASS |
| FK orphan rows | 0 | PASS |
| `CHECK TABLE QUICK` critical tables | 6/6 OK | PASS |
| DDL during audit | 0 | PASS |

O delta de uma linha entre `logical reset rows=311519` e `direct affected rows=311518` continua explicado por cascade em `comments`. O criterio pos-reset e residuo final, nao igualdade entre essas duas metricas.

## ASSET_POST_RESET_MATRIX

| Assertion | Actual | Result |
| --- | ---: | --- |
| content reset assets remaining | 0 | PASS |
| preserve assets/static contracts expected | 4 | PASS |
| preserve assets/static contracts intact | 4 | PASS |
| missing / changed preserve assets | 0 / 0 | PASS |
| unknown assets | 0 | PASS |
| unsafe symlinks | 0 | PASS |
| database backup | exists; checksum and gzip valid | PASS |
| asset backup | exists; checksum and tar valid | PASS |

## APPLICATION_EMPTY_STATE_MATRIX

| Route | HTTP | Expected | Result |
| --- | ---: | --- | --- |
| `/` | 200 | hub/empty state | PASS |
| `/questoes` | 200 | hub/empty state | PASS |
| `/disciplinas` | 200 | hub/empty state | PASS |
| `/provas` | 200 | hub/empty state | PASS |
| `/concursos` | 200 | hub/empty state | PASS |
| `/orgaos` | 200 | hub/empty state | PASS |
| `/blog` | 200 | hub/empty state | PASS |
| missing discipline detail | 404 | hard 404 | PASS |
| `/materiais` | 404 | deployed release predates family | EXPECTED_DEPLOYMENT_DRIFT |
| `/simulados` | 404 | deployed release predates family | EXPECTED_DEPLOYMENT_DRIFT |
| unexpected 5xx | 0 | 0 | PASS |

Nenhum deploy foi feito nesta etapa. Os dois 404 conhecidos nao decorrem de residuo de banco.

## SYSTEMD_FINAL_STATE_MATRIX

| Assertion | Actual | Result |
| --- | --- | --- |
| long-running/timer units active | 12/12 | PASS |
| one-shot services inactive by design | 3/3 | PASS |
| runtime freeze drop-ins | 0 | PASS |
| runtime masks | 0 | PASS |
| exclusive operation lock | absent | PASS |
| public HTTP | 200 | PASS |

## WRITER_HEALTH_MATRIX

| Writer/schedule | State | Result |
| --- | --- | --- |
| cron | active/running | PASS |
| question ingestion workers | 2/2 active/running | PASS |
| platform event worker | active/running | PASS |
| Python extractor | active/running | PASS |
| sitemap timer | active/waiting | PASS |
| blog sitemap timer | active/waiting and triggered during audit | PASS |
| answer archive timer | active/waiting | PASS |
| MySQL non-audit sessions at sample | 0 | PASS |
| writers healthy while zero-state remains invariant | no | FAIL |

## POST_RESET_REPOPULATION_MATRIX

| Observation | Time UTC | Resettable rows | Mutation |
| --- | --- | ---: | --- |
| post-reset reference | before audit | 0 | baseline |
| snapshot 1 | 02:02:32 | 1 | `analytics_lifecycle_events` inserted before snapshot |
| snapshot 2 | 02:11:22 | 1 | no additional mutation |
| final snapshot | 02:34:53 | 1 | no additional mutation |

The row was created at `23:01:15 -03` as `identifiable_visit`, source `auth`. Code authority is the client auth effect -> `analytics/track.php` -> `AnalyticsTrackingRepository::INSERT`. No row payload, email, user ID, session key or URL was copied to the report.

## UNAUTHORIZED_WRITE_MATRIX

| Operation | Actual | Result |
| --- | ---: | --- |
| audit DB writes | 0 | PASS |
| post-reset normal-runtime analytics INSERT | 1 | FAIL |
| seed | 0 | PASS |
| crawler / Gran | 0 | PASS |
| import | 0 | PASS |
| backfill | 0 | PASS |
| migration | 0 | PASS |
| real dataset load | 0 | PASS |
| queue/outbox residue | 0 | PASS |

## SEO_PRELAUNCH_MATRIX

| Assertion | Actual | Result |
| --- | --- | --- |
| effective launch mode | config absent -> PRELAUNCH | PASS |
| public page robots header | `noindex, follow` | PASS |
| production indexing activated | no | PASS |
| sitemap index public | HTTP 200 | FAIL |
| public sitemap shards | 5 | FAIL |
| stale URLs in shards | 1275 | FAIL |
| sitemap last-modified | 2026-08-19 | preexisting artifact |
| search engines explicitly notified by operation | no evidence | PASS |

Shard totals: institutional 15, questions 1130, laws 1, exams 88, taxonomies 41. The public sitemap is preexisting deployment state, but its discoverability conflicts with the required PRELAUNCH contract.

## SECURITY_MATRIX

| Assertion | Actual | Result |
| --- | --- | --- |
| dedicated read-only grants | PASS | PASS |
| secrets scan | PASS | PASS |
| dump in Git | 0 | PASS |
| credentials in report/machine output | 0 | PASS |
| PII in report/machine output | 0 | PASS |
| backup removed | no | PASS |
| production DML by audit | 0 | PASS |

## TEST_MATRIX

| Gate | Result |
| --- | --- |
| PHP focused | 11/11 PASS |
| PHP lint | 22/22 PASS |
| Vitest with Node 24.19.0 | 154/154 files; 910/910 tests PASS |
| initial Vitest with system Node 20 | 152 passed; 2 loader failures from CJS/ESM mismatch; superseded by Node 24 run |
| route types / typecheck | PASS |
| clean production build | PASS; 52/52 pages |
| ESLint source directories | 0 errors; 93 preexisting warnings |
| global ESLint attempt | stopped because it traversed ignored `.tmp/next-before-empty-smoke-20260824` generated output |
| launch validator | PASS; 55 mapped, 44 graph, 40 target, 15 permanent noindex, 19 fixtures |
| secret scan | PASS |
| encoding | PASS |
| `git diff --check` | PASS |

## FINAL_RISK_MATRIX

| Priority | Finding | Consequence |
| --- | --- | --- |
| P0 | none | 0 |
| P1-01 | `analytics_lifecycle_events=1` after resume | 113/113 zero invariant failed; automatic repopulation confirmed |
| P1-02 | stale sitemap publicly serves 1275 test URLs | PRELAUNCH sitemap invariant failed |
| P2 | full ESLint includes ignored generated snapshots | tooling performance/noise; no code error |

Recommended remediation is separate and must be explicitly authorized: make lifecycle analytics discard or isolate writes during the empty-dataset PRELAUNCH gate, remove the single residue under a new controlled DML operation, and withdraw/regenerate the stale sitemap under launch-control rules. This audit deliberately performed none of those actions.

## Worktree

The accumulated Macroetapa 11 worktree remains dirty and unstaged. `staged_count=0`. No commit, push or deploy was performed.

## Declaracoes finais

```text
RESET_POLICY_V2 = EXECUTED_BUT_POST_AUDIT_BLOCKED
production target = RESET_NOT_CONFIRMED
113 resettable tables empty = NAO
resettable tables empty = 112/113
RESETTABLE_NONZERO_TABLES = 1
RESETTABLE_TOTAL_ROWS = 1
12 preserve tables intact = SIM
users preserved = SIM
users = 6
settings preserved = SIM
system_settings = 99
migration history preserved = SIM
schema_migrations = 62
schema preserved = SIM
test dataset removed = NAO_CONFIRMED_DUE_POST_RESET_RUNTIME_ROW
content reset assets remaining = 0
automatic repopulation = 1
real dataset loaded = NAO
real dataset validated = NAO
REAL_DATA_INSERTION_AUTHORIZED = NÃO
seed executed = NAO
crawler executed = NAO
import executed = NAO
backfill executed = NAO
production migrations applied = 0
effective launch mode = PRELAUNCH
production indexing activated = NAO
production sitemap published = SIM_STALE_PREEXISTING
search engines notified by operation = NAO
platform production ready = NAO
CONCURSOMESTRE_PRODUCTION_GO = NAO
commit = NAO
push = NAO
deploy = NAO
```

## Vereditos

```text
DATASET_RESET_POST_AUDIT_NOT_READY
TEST_DATASET_REMOVAL_NOT_CONFIRMED
REAL_DATA_INSERTION_AUTHORIZED = NÃO
```
