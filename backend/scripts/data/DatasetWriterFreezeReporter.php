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

require_once __DIR__ . '/DatasetResetPolicyV2.php';

final class DatasetWriterFreezeReporter
{
    public const INVENTORY_VERSION = 'WRITER_INVENTORY_V3_STEADY_STATE';

    /** @return list<array<string, mixed>> */
    public static function matrix(): array
    {
        $domains = DatasetResetPolicyV2::resetDomains();

        return [
            self::writer('http-auth-account', 'PHP API through nginx/php-fpm', 'PHP 8.4', 'HTTP', 'on demand',
                array_merge($domains['AUTH_OPERATIONAL_STATE'], ['users', 'addresses', 'bank_accounts', 'notifications', 'referrals']),
                'auth/account', 'MUST_FREEZE', 'full maintenance ingress barrier', 'restore ingress last',
                'auth read smoke and controlled post-window login', 'backend/auth', 'backend/modules/auth; backend/modules/users'),
            self::writer('http-practice-user-activity', 'PHP public practice API', 'PHP 8.4', 'HTTP', 'on demand',
                array_merge($domains['PRIVATE_SIMULATIONS'], $domains['USER_CONTENT_ACTIVITY']),
                'practice/user activity', 'MUST_FREEZE', 'full maintenance ingress barrier', 'restore ingress last',
                'public read smoke; post-window controlled answer idempotency test', 'backend/questions', 'backend/modules/questions; backend/modules/simulations'),
            self::writer('http-content-interactions', 'PHP comments/materials/blog/reports API', 'PHP 8.4', 'HTTP', 'on demand',
                array_merge($domains['MATERIALS'], $domains['BLOG_CHANGELOG'], ['comments', 'comment_likes', 'reports', 'user_feedback', 'user_feedback_votes']),
                'public interactions', 'MUST_FREEZE', 'full maintenance ingress barrier', 'restore ingress last',
                'read smoke and one idempotent fixture write after resume', 'backend/content modules', 'backend/modules/blog; comments; materials; reports; feedback'),
            self::writer('http-admin-editorial', 'PHP admin API', 'PHP 8.4', 'authenticated HTTP', 'operator initiated',
                array_merge($domains['QUESTIONS'], $domains['TAXONOMIES'], $domains['EXAMS'], $domains['LAWS'], $domains['MATERIALS'], $domains['BLOG_CHANGELOG'], ['system_settings', 'cache_settings', 'plans', 'admin_audit_logs']),
                'admin/editorial', 'MUST_FREEZE', 'full maintenance ingress barrier plus operator change freeze', 'restore admin access after all validation',
                'admin read-only smoke; no mutation until operation close', 'admin owner', 'backend/modules/admin; backend/modules/filters; backend/modules/exams'),
            self::writer('http-private-ingestion-producer', 'private ingestion API', 'PHP 8.4', 'signed HTTP', 'on demand',
                $domains['IMPORT_STAGING'], 'question ingestion producer', 'MUST_FREEZE', 'full maintenance ingress barrier', 'restore after ingestion consumers are healthy',
                'signed endpoint health and queue depth', 'question ingestion owner', 'backend/api/internal/questions/ingest.php; backend/modules/questions/private_ingestion_routes.php'),
            self::writer('http-stripe-webhook-producer', 'Stripe webhook endpoint', 'PHP 8.4', 'external webhook', 'provider initiated',
                ['provider_webhook_events'], 'Stripe test webhook producer', 'MUST_FREEZE', 'full maintenance ingress barrier; provider receives retryable transport/non-2xx failure', 'restore after Stripe consumer is healthy',
                'endpoint health and provider_webhook_events idempotency', 'billing owner', 'backend/api/subscriptions/stripe_webhook.php'),
            self::writer('cron-stripe-webhook-consumer', 'process_stripe_webhook_jobs.php', 'PHP CLI/cron', 'cron', '* * * * *',
                ['provider_webhook_events', 'transactions', 'user_subscriptions', 'users', 'financial_ledger_entries'], 'Stripe test webhook consumer', 'MUST_FREEZE', 'stop cron scheduler and wait for lock/process exit', 'start after application consumers and before ingress',
                'cron lock free, health log current, queue drains without duplicate event IDs', 'billing owner', 'cron concursomestre; backend/scripts/tasks/process_stripe_webhook_jobs.php'),
            self::writer('cron-stripe-reconciliation', 'reconcile_stripe_subscriptions.php (two schedule entries)', 'PHP CLI/cron', 'cron', '*/15 * * * *',
                $domains['FINANCIAL_TEST_DATA'], 'Stripe test reconciliation', 'MUST_FREEZE', 'stop cron scheduler and wait for distributed lock/process exit', 'start once; retain distributed lock',
                'subscriptions_stripe_reconciliation lock and reconciliation log', 'billing owner', 'cron concursomestre and concursomestre-finance'),
            self::writer('cron-card-expiry', 'check_subscription_card_expiry.php', 'PHP CLI/cron', 'cron', '0 11 * * *',
                ['notifications'], 'billing notifications', 'MUST_FREEZE', 'stop cron scheduler and wait for process exit', 'start cron after application health',
                'task exit and notification dedupe', 'billing owner', 'cron concursomestre; backend/scripts/tasks/check_subscription_card_expiry.php'),
            self::writer('cron-marketing-automations', 'process_marketing_automations.php', 'PHP CLI/cron', 'cron', '*/10 * * * *',
                ['marketing_automation_events', 'notifications'], 'marketing automation', 'MUST_FREEZE', 'stop cron scheduler and wait for process exit', 'start cron after application health',
                'marketing_automations lock and event idempotency', 'marketing owner', 'cron concursomestre; backend/scripts/tasks/process_marketing_automations.php'),
            self::writer('cron-referral-rewards', 'process_referral_rewards.php', 'PHP CLI/cron', 'cron', '10 * * * *',
                ['referrals', 'referral_commission_entries', 'referral_payout_cycles', 'referral_payout_items', 'notifications'], 'referrals', 'MUST_FREEZE', 'stop cron scheduler and wait for process exit', 'start cron after application health',
                'users_referral_rewards lock and deduplicated ledger', 'growth owner', 'cron concursomestre; backend/scripts/tasks/process_referral_rewards.php'),
            self::writer('cron-legal-commentary-sync', 'legal commentary sync endpoint', 'curl/PHP/cron', 'cron', '30 6 * * *',
                $domains['LAWS'], 'law ingestion', 'MUST_FREEZE', 'stop cron scheduler and wait for HTTP request exit', 'start cron after ingress and content validation',
                'legal sync log and law table sentinel', 'editorial owner', 'cron concursomestre; backend/api/legal-commentary/cron_sync_updates.php'),
            self::writer('cron-operational-alerts', 'operational_log_alerts.php', 'PHP CLI/cron', 'cron', '5,35 * * * *',
                ['notifications'], 'operational notifications', 'MUST_FREEZE', 'stop cron scheduler and wait for process exit', 'start cron after application health',
                'health ledger plus notification dedupe', 'operations owner', 'cron concursomestre; backend/scripts/tasks/operational_log_alerts.php'),
            self::writer('systemd-platform-event-consumer', 'concursomestre-platform-events@1.service', 'PHP CLI/systemd', 'outbox poller', 'continuous; 2 second loop',
                ['platform_event_outbox', 'user_gamification_events', 'user_badges', 'user_streaks', 'notifications', 'users'], 'async platform events', 'MUST_FREEZE', 'block producers, wait for worker sleep boundary, systemctl stop instance', 'start before ingress and verify worker health JSON',
                'unit active, health JSON current, outbox idempotency keys unique', 'platform owner', 'backend/ops/systemd/concursomestre-platform-events@.service'),
            self::writer('systemd-question-ingestion-consumers', 'concursomestre-question-ingestion@1..2.service', 'PHP CLI/systemd', 'queue poller', 'continuous; 2 second loop',
                array_merge($domains['IMPORT_STAGING'], $domains['QUESTIONS'], $domains['TAXONOMIES'], $domains['EXAMS']), 'question/exam/taxonomy ingestion', 'MUST_FREEZE', 'block producer, wait for both worker sleep boundaries, systemctl stop instances', 'start both before private producer; verify health and no duplicate job completion',
                'both units active, per-slot health JSON current, queue state valid', 'question ingestion owner', 'backend/ops/systemd/concursomestre-question-ingestion@.service'),
            self::writer('systemd-answer-archive', 'concursomestre-answer-archive.timer/service', 'PHP CLI/systemd timer', 'timer', 'weekly',
                ['user_answers', 'user_answers_archive'], 'answer archive', 'MUST_FREEZE', 'stop timer and wait for oneshot service exit', 'start timer after application health',
                'timer waiting, no duplicate archive rows, source/archive counts coherent', 'platform owner', 'backend/ops/systemd/concursomestre-answer-archive.*'),
            self::writer('manual-gran-crawler-taxonomy', 'Gran admin crawler and taxonomy sync', 'PHP admin plus local tools', 'manual/admin', 'unscheduled',
                array_merge($domains['IMPORT_STAGING'], $domains['QUESTIONS'], $domains['TAXONOMIES'], $domains['EXAMS']), 'Gran ingestion', 'MUST_FREEZE', 'operator change freeze, ingress barrier, no crawler client sessions', 'explicit operator release after validation',
                'no active crawler process; manifests/checkpoints stable', 'data ingestion owner', 'AdminGranCrawlerService; AdminGranTaxonomySyncService'),
            self::writer('manual-exam-import-extraction', 'exam import/extraction/materialization paths', 'PHP API/CLI plus Python extractor', 'manual/admin', 'unscheduled',
                $domains['EXAMS'], 'exam ingestion', 'MUST_FREEZE', 'operator change freeze, ingress barrier, stop extractor service', 'start extractor before ingress; release operators last',
                'extractor health plus extraction tables stable', 'exam ingestion owner', 'backend/modules/exams; materialize_gran_exam_files.php'),
            self::writer('manual-planalto-import', 'Planalto admin importer', 'PHP API', 'manual/admin or legal cron', 'unscheduled plus daily cron',
                $domains['LAWS'], 'law ingestion', 'MUST_FREEZE', 'operator change freeze and cron/ingress barrier', 'release after legal content validation',
                'law sync logs and sentinel', 'editorial owner', 'PlanaltoImportService.php'),
            self::writer('manual-backfills-migrations-reset', 'reviewed CLI maintenance scripts', 'PHP CLI/mysql', 'manual shell', 'unscheduled',
                DatasetResetPolicyV2::knownTables(), 'manual privileged maintenance', 'MUST_FREEZE', 'exclusive operation authorization; reject every other shell mutation', 'close operation token after validation',
                'authorized session allowlist and audit log', 'release owner', 'backend/scripts/backfills; backend/database/migrations; backend/scripts/data'),
            self::writer('frontend-next-server', 'concursomestre-frontend.service', 'Node/Next.js', 'HTTP', 'continuous',
                [], 'frontend serving', 'SERVING_LAYER', 'never stop the public serving layer; freeze mutating boundaries separately', 'keep serving active and health-check continuously',
                'unit active and HTTP server healthy', 'frontend owner', 'systemd concursomestre-frontend.service'),
            self::writer('python-extractor', 'concursomestre-python-extractor.service', 'Python/uvicorn', 'HTTP from admin', 'continuous',
                [], 'document extraction', 'MAINTENANCE', 'stop only when an approved extraction freeze requires it', 'start before extraction producers',
                'unit and extractor health endpoint', 'exam ingestion owner', 'python-extractor/app'),
            self::writer('sitemap-generators', 'sitemap and blog-sitemap timers', 'PHP CLI/systemd timer', 'timer', 'daily and every 15 minutes',
                [], 'derived filesystem SEO', 'NOT_A_WRITER', 'stop timers to avoid release-side file churn', 'start timers after application health',
                'timers waiting and sitemap status valid', 'SEO owner', 'backend/ops/systemd sitemap and blog-sitemap'),
            self::writer('mysql-backup', 'backup_mysql.php', 'PHP CLI/cron', 'cron', '20 2 * * *',
                [], 'database backup', 'NOT_A_WRITER', 'run approved pre-reset backup, then stop cron during reset', 'start cron after post-reset backup',
                'backup checksum and health file', 'operations owner', 'cron concursomestre; backend/scripts/tasks/backup_mysql.php'),
            self::writer('log-maintenance', 'operational_log_maintenance.php', 'PHP CLI/cron', 'cron', '45 2 * * *',
                [], 'log files', 'SAFE_TO_CONTINUE', 'no database writes; cron is nevertheless stopped by full-maintenance strategy', 'start cron with other schedules',
                'log maintenance health JSON', 'operations owner', 'backend/scripts/tasks/operational_log_maintenance.php'),
        ];
    }

    public static function inventoryHash(): string
    {
        return hash('sha256', self::canonicalJson(['version' => self::INVENTORY_VERSION, 'writers' => self::matrix()]));
    }

    /** @return list<string> */
    public static function requiredFreezeWriterIds(): array
    {
        $ids = [];
        foreach (self::matrix() as $writer) {
            if (($writer['classification'] ?? '') === 'MUST_FREEZE') $ids[] = (string) $writer['writer_id'];
        }
        sort($ids);
        return $ids;
    }

    /** @return array<string, list<string>> */
    public static function tableCoverage(): array
    {
        $coverage = array_fill_keys(DatasetResetPolicyV2::knownTables(), []);
        foreach (self::matrix() as $writer) {
            foreach ($writer['tables_written'] as $table) {
                if (isset($coverage[$table])) $coverage[$table][] = (string) $writer['writer_id'];
            }
        }
        foreach ($coverage as &$ids) {
            $ids = array_values(array_unique($ids));
            sort($ids);
        }
        unset($ids);
        ksort($coverage);
        return $coverage;
    }

    /** @return list<string> */
    public static function uncoveredTables(): array
    {
        return array_keys(array_filter(self::tableCoverage(), static fn (array $writers): bool => $writers === []));
    }

    /**
     * @param array<string, string> $healthByWriter
     * @param list<string> $processedIdempotencyKeys
     * @return array{passed: bool, missingOrUnhealthy: list<string>, duplicateProcessingKeys: list<string>}
     */
    public static function evaluateResume(array $healthByWriter, array $processedIdempotencyKeys): array
    {
        $missing = [];
        foreach (self::requiredFreezeWriterIds() as $writerId) {
            if (($healthByWriter[$writerId] ?? '') !== 'PASS') $missing[] = $writerId;
        }
        $counts = array_count_values(array_map('strval', $processedIdempotencyKeys));
        $duplicates = array_keys(array_filter($counts, static fn (int $count): bool => $count > 1));
        sort($missing);
        sort($duplicates);
        return [
            'passed' => $missing === [] && $duplicates === [],
            'missingOrUnhealthy' => $missing,
            'duplicateProcessingKeys' => $duplicates,
        ];
    }

    /** @return array<string, mixed> */
    private static function writer(string $id, string $process, string $runtime, string $trigger, string $schedule, array $tables, string $domain, string $classification, string $pause, string $resume, string $health, string $owner, string $evidence): array
    {
        $tables = array_values(array_unique(array_map('strval', $tables)));
        sort($tables);
        $runtimeTables = [];
        $allowedEvents = [];
        foreach (DatasetResetPolicyV2::runtimeRecreatableManifest() as $table => $runtimePolicy) {
            $events = $runtimePolicy['allowedWriters'][$id] ?? [];
            if ($events === []) {
                continue;
            }
            $runtimeTables[] = $table;
            $allowedEvents[$table] = $events;
        }
        sort($runtimeTables);
        ksort($allowedEvents);

        return [
            'writer_id' => $id,
            'service_process' => $process,
            'runtime' => $runtime,
            'trigger' => $trigger,
            'schedule' => $schedule,
            'tables_written' => $tables,
            'domain' => $domain,
            'resettable_data' => array_intersect($tables, DatasetResetPolicyV2::resetTables()) !== [],
            'preserved_data' => array_intersect($tables, DatasetResetPolicyV2::preserveTables()) !== [],
            'pause_required' => $classification === 'MUST_FREEZE',
            'must_freeze_during_reset' => $classification === 'MUST_FREEZE',
            'may_write_after_resume' => $runtimeTables !== [],
            'runtime_recreatable_tables' => $runtimeTables,
            'allowed_post_resume_events' => $allowedEvents,
            'classification' => $classification,
            'pause_mechanism' => $pause,
            'resume_mechanism' => $resume,
            'health_check' => $health,
            'owner' => $owner,
            'evidence' => $evidence,
        ];
    }

    private static function canonicalJson(mixed $value): string
    {
        $normalize = static function (mixed $item) use (&$normalize): mixed {
            if (!is_array($item)) return $item;
            if (array_is_list($item)) return array_map($normalize, $item);
            ksort($item);
            foreach ($item as $key => $child) $item[$key] = $normalize($child);
            return $item;
        };
        return json_encode($normalize($value), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}
