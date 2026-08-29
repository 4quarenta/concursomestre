<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

final class DatasetResetPolicyV2
{
    public const VERSION = 'RESET_POLICY_V2';
    public const SEMANTICS_VERSION = 'RESET_POLICY_V2_EXECUTION_AND_STEADY_STATE_V1';
    public const EXECUTION_TOKEN = 'RESET_DEFINITIVE_DATASET_V2';
    public const CLASS_PRESERVE = 'PRESERVE';
    public const CLASS_MUTABLE_INFRASTRUCTURE = 'MUTABLE_INFRASTRUCTURE';
    public const CLASS_RESETTABLE_STRICT = 'RESETTABLE_STRICT';
    public const CLASS_RESETTABLE_RECREATABLE_RUNTIME = 'RESETTABLE_RECREATABLE_RUNTIME';

    /** @var array<string, string> */
    private const PRESERVE_MANIFEST = [
        'addresses' => 'PRESERVE_REQUIRED_ACCOUNT_PROFILE',
        'admin_audit_logs' => 'PRESERVE_SECURITY_AUDIT',
        'bank_accounts' => 'PRESERVE_REQUIRED_ACCOUNT_RELATION_IF_PRESENT',
        'cache_settings' => 'PRESERVE_SYSTEM_CONFIGURATION',
        'filter_types' => 'PRESERVE_STATIC_CONTRACT',
        'plans' => 'PRESERVE_COMMERCIAL_CONFIGURATION',
        'schema_audit_runs' => 'PRESERVE_SCHEMA_INFRASTRUCTURE',
        'schema_backfill_runs' => 'PRESERVE_SCHEMA_INFRASTRUCTURE',
        'schema_migrations' => 'PRESERVE_MIGRATION_HISTORY',
        'security_ip_bans' => 'PRESERVE_SECURITY_INFRASTRUCTURE',
        'system_settings' => 'PRESERVE_SYSTEM_CONFIGURATION',
        'users' => 'PRESERVE_REQUIRED_USER_IDENTITY',
    ];

    /** @var array<string, string> */
    private const MUTABLE_INFRASTRUCTURE_MANIFEST = [
        'seo_dataset_revisions' => 'MUTABLE_DERIVED_ARTIFACT_AUTHORITY',
    ];

    /** @var array<string, list<string>> */
    private const RESET_DOMAINS = [
        'AUTH_OPERATIONAL_STATE' => [
            'auth_refresh_tokens',
            'auth_sessions',
            'email_verifications',
            'password_resets',
            'user_cards',
        ],
        'QUESTIONS' => [
            'question_assets',
            'question_context_questions',
            'question_contexts',
            'question_editorial_feedback',
            'question_editorials',
            'question_filters',
            'question_options',
            'question_provas',
            'questions',
            'questions_groups',
            'teacher_comments',
        ],
        'TAXONOMIES' => [
            'filter_aliases',
            'filter_relationships',
            'filter_source_identities',
            'filters',
        ],
        'EXAMS' => [
            'prova_arquivos',
            'prova_caderno_cargos',
            'prova_caderno_filters',
            'prova_cadernos',
            'prova_cargo_detalhes',
            'prova_cargo_requisitos',
            'prova_cargo_vagas',
            'prova_extracao_itens',
            'prova_extracoes',
            'prova_filters',
            'provas',
        ],
        'CONTESTS_CAREERS_POSITIONS' => [
            'contest_aliases',
            'contest_documents',
            'contest_exams',
            'contest_organizations',
            'contest_positions',
            'contests',
        ],
        'PUBLIC_SIMULATIONS' => [
            'public_simulation_aliases',
            'public_simulation_contests',
            'public_simulation_exams',
            'public_simulation_filters',
            'public_simulation_questions',
            'public_simulations',
        ],
        'PRIVATE_SIMULATIONS' => [
            'simulations',
        ],
        'LAWS' => [
            'article_doutrina',
            'article_exam_tips',
            'article_jurisprudence',
            'article_sumulas',
            'law_article_blocks',
            'law_article_versions',
            'law_articles',
            'law_section_editorials',
            'law_sections',
            'law_updates',
            'law_versions',
            'laws',
            'legal_ai_batch_items',
            'legal_ai_batch_runs',
            'legal_areas',
            'legal_comment_reports',
            'legal_content_reactions',
            'legal_sync_logs',
            'legal_user_comments',
            'legal_user_favorites',
            'legal_user_notes',
            'legal_user_progress',
            'legal_user_reader_annotations',
            'sync_errors',
        ],
        'MATERIALS' => [
            'material_aliases',
            'material_moderation_events',
            'material_ratings',
            'material_uploads',
            'materials',
        ],
        'BLOG_CHANGELOG' => [
            'blog_article_likes',
            'blog_article_tags',
            'blog_articles',
            'blog_categories',
            'blog_tags',
            'changelogs',
        ],
        'USER_CONTENT_ACTIVITY' => [
            'analytics_lifecycle_events',
            'comment_likes',
            'comments',
            'marketing_automation_events',
            'notifications',
            'platform_event_outbox',
            'question_answer_idempotency',
            'ranking_entries',
            'rankings',
            'report_moderation_drafts',
            'report_moderation_history',
            'reports',
            'study_sessions',
            'user_answer_counters',
            'user_answers',
            'user_answers_archive',
            'user_badges',
            'user_bookmarks',
            'user_feedback',
            'user_feedback_votes',
            'user_gamification_events',
            'user_highlights',
            'user_notes',
            'user_saved_questions',
            'user_statistics',
            'user_streaks',
            'user_study_schedules',
        ],
        'IMPORT_STAGING' => [
            'gran_automatic_crawler_checkpoints',
            'gran_question_publication_failures',
            'gran_taxonomy_sync_manifests',
            'private_ingestion_batches',
            'private_ingestion_jobs',
            'private_ingestion_nonces',
            'private_ingestion_requests',
            'ingestion_item_events',
            'ingestion_items',
            'ingestion_leases',
            'ingestion_provenance',
            'ingestion_runs',
        ],
        'FINANCIAL_TEST_DATA' => [
            'coupon_reservations',
            'financial_ledger_entries',
            'provider_webhook_events',
            'referral_commission_entries',
            'referral_payout_cycles',
            'referral_payout_items',
            'referrals',
            'stripe_testing_matrix_runs',
            'transactions',
            'user_subscriptions',
        ],
        'DERIVED_DATA' => [
            'question_search_documents',
            'question_stats',
            'subject_statistics',
        ],
    ];

    /**
     * Tabelas que continuam resetaveis e obrigatoriamente zeradas durante o
     * reset, mas podem ser recriadas por eventos operacionais conhecidos apos
     * o resume. A allowlist e intencionalmente fechada por writer e evento.
     *
     * @var array<string, array{reason: string, allowedWriters: array<string, list<string>>}>
     */
    private const RUNTIME_RECREATABLE_MANIFEST = [
        'auth_refresh_tokens' => [
            'reason' => 'RECREATED_BY_LOGIN_AND_TOKEN_ROTATION',
            'allowedWriters' => [
                'http-auth-account' => [
                    'auth_login',
                    'auth_registration',
                    'auth_social_callback',
                    'auth_two_factor_completion',
                    'auth_token_refresh',
                    'auth_logout',
                    'auth_session_revoked',
                ],
            ],
        ],
        'auth_sessions' => [
            'reason' => 'RECREATED_BY_AUTH_SESSION_ESTABLISHMENT',
            'allowedWriters' => [
                'http-auth-account' => [
                    'auth_login',
                    'auth_registration',
                    'auth_social_callback',
                    'auth_two_factor_completion',
                    'auth_session_heartbeat',
                    'auth_token_refresh',
                    'auth_logout',
                    'auth_session_revoked',
                ],
            ],
        ],
        'user_cards' => [
            'reason' => 'RECREATED_AS_REMOTE_PAYMENT_METHOD_MIRROR',
            'allowedWriters' => [
                'http-auth-account' => [
                    'profile_billing_card_sync',
                    'checkout_billing_card_sync',
                    'billing_card_save',
                    'billing_card_delete',
                    'billing_card_default_changed',
                    'billing_card_state_sync',
                    'billing_card_refund_unlock',
                    'billing_card_subscription_unlock',
                ],
            ],
        ],
        'user_statistics' => [
            'reason' => 'RECREATED_BY_LEGITIMATE_STUDY_ACTIVITY',
            'allowedWriters' => [
                'http-practice-user-activity' => [
                    'statistics_study_session_recorded',
                ],
            ],
        ],
    ];

    /** @return array<string, string> */
    public static function preserveManifest(): array
    {
        return self::PRESERVE_MANIFEST;
    }

    /** @return array<string, list<string>> */
    public static function resetDomains(): array
    {
        return self::RESET_DOMAINS;
    }

    /** @return list<string> */
    public static function preserveTables(): array
    {
        $tables = array_keys(self::PRESERVE_MANIFEST);
        sort($tables);
        return $tables;
    }

    /** @return list<string> */
    public static function mutableInfrastructureTables(): array
    {
        $tables = array_keys(self::MUTABLE_INFRASTRUCTURE_MANIFEST);
        sort($tables);
        return $tables;
    }

    /** @return list<string> */
    public static function resetTables(): array
    {
        $tables = [];
        foreach (self::RESET_DOMAINS as $domainTables) {
            $tables = array_merge($tables, $domainTables);
        }
        $tables = array_values(array_unique($tables));
        sort($tables);
        return $tables;
    }

    /** @return array<string, array{reason: string, allowedWriters: array<string, list<string>>}> */
    public static function runtimeRecreatableManifest(): array
    {
        return self::RUNTIME_RECREATABLE_MANIFEST;
    }

    /** @return list<string> */
    public static function runtimeRecreatableTables(): array
    {
        $tables = array_keys(self::RUNTIME_RECREATABLE_MANIFEST);
        sort($tables);
        return $tables;
    }

    /** @return list<string> */
    public static function strictResetTables(): array
    {
        $tables = array_values(array_diff(self::resetTables(), self::runtimeRecreatableTables()));
        sort($tables);
        return $tables;
    }

    /** @return array<string, string> */
    public static function classificationManifest(): array
    {
        $manifest = array_fill_keys(self::preserveTables(), self::CLASS_PRESERVE);
        foreach (self::mutableInfrastructureTables() as $table) {
            $manifest[$table] = self::CLASS_MUTABLE_INFRASTRUCTURE;
        }
        foreach (self::strictResetTables() as $table) {
            $manifest[$table] = self::CLASS_RESETTABLE_STRICT;
        }
        foreach (self::runtimeRecreatableTables() as $table) {
            $manifest[$table] = self::CLASS_RESETTABLE_RECREATABLE_RUNTIME;
        }
        ksort($manifest);
        return $manifest;
    }

    public static function classificationFor(string $table): ?string
    {
        return self::classificationManifest()[$table] ?? null;
    }

    /** @return list<string> */
    public static function allowedRuntimeEvents(string $table, string $writerId): array
    {
        return self::RUNTIME_RECREATABLE_MANIFEST[$table]['allowedWriters'][$writerId] ?? [];
    }

    public static function isRuntimeEvidenceAllowed(string $table, string $writerId, string $event): bool
    {
        return in_array($event, self::allowedRuntimeEvents($table, $writerId), true);
    }

    /** @return list<string> */
    public static function knownTables(): array
    {
        $tables = array_merge(self::preserveTables(), self::mutableInfrastructureTables(), self::resetTables());
        sort($tables);
        return $tables;
    }

    public static function resetDomainFor(string $table): ?string
    {
        foreach (self::RESET_DOMAINS as $domain => $tables) {
            if (in_array($table, $tables, true)) {
                return $domain;
            }
        }
        return null;
    }

    /**
     * @param list<string> $schemaTables
     * @return array{ok: bool, unknownTables: list<string>, missingPolicyTables: list<string>, overlap: list<string>, classCounts: array<string, int>}
     */
    public static function validateAgainstSchema(array $schemaTables): array
    {
        $schemaTables = array_values(array_unique(array_map('strval', $schemaTables)));
        sort($schemaTables);
        $known = self::knownTables();
        $preserve = self::preserveTables();
        $strict = self::strictResetTables();
        $runtime = self::runtimeRecreatableTables();
        $mutableInfrastructure = self::mutableInfrastructureTables();
        $unknown = array_values(array_diff($schemaTables, $known));
        $missing = array_values(array_diff($known, $schemaTables));
        $overlap = array_values(array_unique(array_merge(
            array_intersect($preserve, $strict),
            array_intersect($preserve, $runtime),
            array_intersect($preserve, $mutableInfrastructure),
            array_intersect($strict, $mutableInfrastructure),
            array_intersect($runtime, $mutableInfrastructure),
            array_intersect($strict, $runtime)
        )));
        sort($unknown);
        sort($missing);
        sort($overlap);

        return [
            'ok' => $unknown === [] && $missing === [] && $overlap === [],
            'unknownTables' => $unknown,
            'missingPolicyTables' => $missing,
            'overlap' => $overlap,
            'classCounts' => [
                self::CLASS_PRESERVE => count($preserve),
                self::CLASS_MUTABLE_INFRASTRUCTURE => count($mutableInfrastructure),
                self::CLASS_RESETTABLE_STRICT => count($strict),
                self::CLASS_RESETTABLE_RECREATABLE_RUNTIME => count($runtime),
            ],
        ];
    }

    /** @return array<string, string> */
    public static function authStatePolicy(): array
    {
        return [
            'users' => 'PRESERVE_REQUIRED_FOR_ACCOUNT',
            'addresses' => 'PRESERVE_REQUIRED_FOR_ACCOUNT',
            'bank_accounts' => 'PRESERVE_REQUIRED_FOR_ACCOUNT_IF_PRESENT',
            'auth_sessions' => self::CLASS_RESETTABLE_RECREATABLE_RUNTIME,
            'auth_refresh_tokens' => self::CLASS_RESETTABLE_RECREATABLE_RUNTIME,
            'email_verifications' => 'RESET_SAFE_OPERATIONAL_AUTH_STATE',
            'password_resets' => 'RESET_SAFE_OPERATIONAL_AUTH_STATE',
            'user_cards' => self::CLASS_RESETTABLE_RECREATABLE_RUNTIME,
        ];
    }

    /** @return array<string, string> */
    public static function runtimeStatePolicy(): array
    {
        return array_fill_keys(
            self::runtimeRecreatableTables(),
            self::CLASS_RESETTABLE_RECREATABLE_RUNTIME
        );
    }

    /** @return array<string, string> */
    public static function auditLogPolicy(): array
    {
        return [
            'admin_audit_logs' => 'PRESERVE_INFRASTRUCTURE_AUDIT',
            'legal_sync_logs' => 'RESET_TEST_HISTORY',
            'material_moderation_events' => 'RESET_TEST_HISTORY',
            'question_editorial_feedback' => 'RESET_TEST_HISTORY',
            'report_moderation_drafts' => 'RESET_TEST_HISTORY',
            'report_moderation_history' => 'RESET_TEST_HISTORY',
        ];
    }

    /** @return array<string, string> */
    public static function importStagingPolicy(): array
    {
        return array_fill_keys(self::RESET_DOMAINS['IMPORT_STAGING'], 'RESET_TEMPORARY_IMPORT_STATE');
    }
}

final class DatasetResetGuardEvaluator
{
    /**
     * @param array<string, mixed> $snapshot
     * @param array<string, mixed> $manifest
     * @param array<string, mixed> $guards
     * @return array{ready: bool, blockers: list<string>}
     */
    public static function evaluateReadiness(array $snapshot, array $manifest, array $guards): array
    {
        $blockers = [];
        if (($snapshot['policyValidation']['ok'] ?? false) !== true) $blockers[] = 'POLICY_SCHEMA_MISMATCH';
        if (($manifest['policyVersion'] ?? '') !== DatasetResetPolicyV2::VERSION) $blockers[] = 'MANIFEST_POLICY_VERSION_MISMATCH';
        if (($manifest['database'] ?? '') !== ($snapshot['database'] ?? '')) $blockers[] = 'TARGET_DATABASE_MISMATCH';
        if (($manifest['structuralFingerprint'] ?? '') !== ($snapshot['structuralFingerprint'] ?? '')) $blockers[] = 'TARGET_FINGERPRINT_MISMATCH';
        if (($manifest['expectedCounts'] ?? null) !== ($snapshot['tableCounts'] ?? null)) $blockers[] = 'EXPECTED_COUNT_MISMATCH';
        if (($manifest['preserveSnapshots'] ?? null) !== ($snapshot['preserveSnapshots'] ?? null)) $blockers[] = 'PRESERVE_SNAPSHOT_MISMATCH';
        if (($snapshot['resetOrderCycles'] ?? []) !== []) $blockers[] = 'FK_RESET_ORDER_CYCLE';
        if (count($snapshot['resetOrder'] ?? []) !== count(DatasetResetPolicyV2::resetTables())) $blockers[] = 'INCOMPLETE_FK_RESET_ORDER';
        if (($snapshot['preservedChildDependencies'] ?? []) !== []) $blockers[] = 'PRESERVED_CHILD_DEPENDS_ON_RESET_PARENT';
        if (($guards['databaseBackup']['created'] ?? false) !== true) $blockers[] = 'BACKUP_MISSING';
        if (($guards['databaseBackup']['checksumValid'] ?? false) !== true) $blockers[] = 'BACKUP_CHECKSUM_INVALID';
        if (($guards['databaseBackup']['restoreRehearsalPassed'] ?? false) !== true) $blockers[] = 'RESTORE_REHEARSAL_MISSING';
        if (($guards['assetBackup']['created'] ?? false) !== true) $blockers[] = 'ASSET_BACKUP_MISSING';
        if (($guards['assetBackup']['restoreRehearsalPassed'] ?? false) !== true) $blockers[] = 'ASSET_RESTORE_REHEARSAL_MISSING';
        if (($guards['writerFreeze']['rehearsalPassed'] ?? false) !== true) $blockers[] = 'WRITER_FREEZE_REHEARSAL_MISSING';

        $blockers = array_values(array_unique($blockers));
        sort($blockers);
        return ['ready' => $blockers === [], 'blockers' => $blockers];
    }

    /**
     * @param array<string, mixed> $snapshot
     * @param array<string, mixed> $manifest
     * @param array<string, mixed> $guards
     * @return array{allowed: bool, blockers: list<string>}
     */
    public static function evaluateExecution(
        array $snapshot,
        array $manifest,
        array $guards,
        string $operationToken,
        string $confirmedDatabase,
        string $targetKind,
        bool $environmentAllowsExecution,
        bool $machineFreezeEvidenceValid = false,
        array $machineFreezeBlockers = []
    ): array {
        $readiness = self::evaluateReadiness($snapshot, $manifest, $guards);
        $blockers = $readiness['blockers'];
        if (($manifest['approvedForExecution'] ?? false) !== true) $blockers[] = 'MANIFEST_NOT_APPROVED_FOR_EXECUTION';
        if (!hash_equals(DatasetResetPolicyV2::EXECUTION_TOKEN, $operationToken)) $blockers[] = 'INVALID_OPERATION_TOKEN';
        if ($confirmedDatabase === '' || !hash_equals((string) ($snapshot['database'] ?? ''), $confirmedDatabase)) $blockers[] = 'DATABASE_CONFIRMATION_MISMATCH';
        if (!in_array($targetKind, ['DISPOSABLE_REHEARSAL', 'PRODUCTION'], true)) $blockers[] = 'INVALID_TARGET_KIND';
        if (($manifest['targetKind'] ?? '') !== $targetKind) $blockers[] = 'TARGET_KIND_MISMATCH';
        if ($environmentAllowsExecution !== true) $blockers[] = 'ENVIRONMENT_EXECUTION_GUARD_MISSING';
        if ($machineFreezeEvidenceValid !== true) {
            $blockers[] = 'MACHINE_FREEZE_EVIDENCE_INVALID';
            foreach ($machineFreezeBlockers as $freezeBlocker) {
                if (is_string($freezeBlocker) && $freezeBlocker !== '') $blockers[] = $freezeBlocker;
            }
        }
        $blockers = array_values(array_unique($blockers));
        sort($blockers);

        return ['allowed' => $blockers === [], 'blockers' => $blockers];
    }
}
