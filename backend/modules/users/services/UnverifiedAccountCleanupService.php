<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/auth/AuthSession.php';

/**
 * Dry-run-first lifecycle for unverified accounts. Destructive execution is
 * deliberately gated twice and is not enabled by deployment configuration.
 */
final class UnverifiedAccountCleanupService
{
    private const MAX_LIMIT = 500;
    private const AGE_DAYS = 30;
    private const EXECUTION_TOKEN = 'UNVERIFIED_ACCOUNT_CLEANUP';

    public function __construct(private readonly PDO $db)
    {
    }

    public function run(array $options = []): array
    {
        $requestedMode = strtolower(trim((string) ($options['mode'] ?? 'dry-run')));
        $mode = $requestedMode === 'execute' ? 'execute' : 'dry_run';
        $limit = max(1, min(self::MAX_LIMIT, (int) ($options['limit'] ?? 100)));
        $now = $this->utc($options['now'] ?? null);
        $cutoff = $now->modify('-' . self::AGE_DAYS . ' days');
        $runId = $this->uuid();

        if ($mode === 'execute' && !hash_equals(self::EXECUTION_TOKEN, (string) ($options['execute_token'] ?? ''))) {
            throw new RuntimeException('Execucao destrutiva requer token explicito de politica.');
        }
        if ($mode === 'execute' && getenv('UNVERIFIED_CLEANUP_EXECUTION_ENABLED') !== '1') {
            throw new RuntimeException('Execucao destrutiva permanece desabilitada pela configuracao operacional.');
        }

        $this->insertRun($runId, $mode, 'running');
        $candidates = $this->findCandidates($cutoff, $limit);
        $eligible = 0;
        $protected = 0;
        $deleted = 0;
        $reasonSummary = [];
        $rows = [];

        foreach ($candidates as $candidate) {
            $assessment = $this->assess($candidate, $cutoff);
            $reasons = $assessment['reasons'];
            foreach ($reasons as $reason) {
                $reasonSummary[$reason] = ($reasonSummary[$reason] ?? 0) + 1;
            }

            if ($assessment['eligible']) {
                $eligible++;
                if ($mode === 'execute' && $this->deleteIfStillEligible((string) $candidate['id'], $cutoff)) {
                    $deleted++;
                }
            } else {
                $protected++;
            }

            $rows[] = [
                'user_id' => (string) $candidate['id'],
                'age_days' => $this->ageDays((string) $candidate['created_at'], $now),
                'eligible' => $assessment['eligible'],
                'reasons' => $reasons,
            ];
        }

        $result = [
            'success' => true,
            'run_id' => $runId,
            'mode' => $mode,
            'cutoff_utc' => $cutoff->format(DateTimeInterface::ATOM),
            'summary' => [
                'candidates' => count($candidates),
                'eligible' => $eligible,
                'protected_or_excluded' => $protected,
                'deleted' => $deleted,
                'reasons' => $reasonSummary,
            ],
            'rows' => $rows,
        ];

        $this->finishRun($runId, $result, 'completed');
        return $result;
    }

    private function findCandidates(DateTimeImmutable $cutoff, int $limit): array
    {
        $stmt = $this->db->prepare(
            "SELECT id, created_at, email_verified, role, status, deletion_requested_at
             FROM users
             WHERE COALESCE(email_verified, 0) = 0
               AND created_at < :cutoff
               AND LOWER(COALESCE(status, 'active')) NOT IN ('deleted', 'pending_deletion')
             ORDER BY created_at ASC, id ASC
             LIMIT {$limit}"
        );
        $stmt->execute([':cutoff' => $cutoff->format('Y-m-d H:i:s')]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function assess(array $candidate, DateTimeImmutable $cutoff): array
    {
        $reasons = [];
        $role = strtolower(trim((string) ($candidate['role'] ?? '')));
        if (in_array($role, ['admin', 'operator', 'support', 'moderator', 'system'], true)) {
            $reasons[] = 'privileged_or_system_role';
        }
        if (!empty($candidate['deletion_requested_at'])) {
            $reasons[] = 'existing_deletion_workflow';
        }
        if (strtotime((string) ($candidate['created_at'] ?? '')) === false
            || strtotime((string) $candidate['created_at']) >= $cutoff->getTimestamp()) {
            $reasons[] = 'age_not_strictly_over_30_days';
        }

        $userId = (string) $candidate['id'];
        $protectedRelationships = [
            'user_subscriptions' => ['user_id'],
            'transactions' => ['user_id'],
            'support_cases' => ['user_id'],
            'support_tickets' => ['user_id'],
            'questions' => ['created_by_user_id', 'updated_by_user_id'],
            'laws' => ['created_by_user_id', 'updated_by_user_id', 'published_by_user_id'],
            'materials' => ['created_by_user_id', 'owner_id', 'user_id'],
            'legal_holds' => ['user_id'],
            'user_legal_holds' => ['user_id'],
        ];
        foreach ($protectedRelationships as $table => $columns) {
            foreach ($columns as $column) {
                if ($this->hasUserReference($table, $column, $userId)) {
                    $reasons[] = 'protected_relationship:' . $table . '.' . $column;
                    break;
                }
            }
        }

        if ($this->columnExists('users', 'stripe_customer_id') && $this->hasNonEmptyUserColumn('stripe_customer_id', $userId)) {
            $reasons[] = 'billing_provider_relationship';
        }
        if (!$this->verificationDeliveryWasAvailable($userId)) {
            $reasons[] = 'verification_delivery_unproven';
        }

        return [
            'eligible' => $reasons === [],
            'reasons' => array_values(array_unique($reasons)),
        ];
    }

    private function verificationDeliveryWasAvailable(string $userId): bool
    {
        if (!$this->tableExists('email_verifications')
            || !$this->columnExists('email_verifications', 'delivery_status')
        ) {
            return false;
        }
        $stmt = $this->db->prepare(
            'SELECT delivery_status FROM email_verifications
             WHERE user_id = :user_id ORDER BY id DESC LIMIT 1'
        );
        $stmt->execute([':user_id' => $userId]);
        $status = strtolower(trim((string) $stmt->fetchColumn()));
        return in_array($status, ['queued', 'accepted', 'delivered'], true);
    }

    private function deleteIfStillEligible(string $userId, DateTimeImmutable $cutoff): bool
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare('SELECT * FROM users WHERE id = :id LIMIT 1 FOR UPDATE');
            $stmt->execute([':id' => $userId]);
            $current = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$current || (int) ($current['email_verified'] ?? 0) === 1) {
                $this->db->commit();
                return false;
            }
            $assessment = $this->assess($current, $cutoff);
            if (!$assessment['eligible']) {
                $this->db->commit();
                return false;
            }

            foreach ([
                ['auth_refresh_tokens', 'user_id'],
                ['auth_sessions', 'user_id'],
                ['email_verifications', 'user_id'],
                ['notifications', 'user_id'],
                ['user_study_schedules', 'user_id'],
            ] as [$table, $column]) {
                if ($this->hasUserReference($table, $column, $userId)) {
                    $delete = $this->db->prepare("DELETE FROM `{$table}` WHERE `{$column}` = :user_id");
                    $delete->execute([':user_id' => $userId]);
                }
            }

            $deleteUser = $this->db->prepare('DELETE FROM users WHERE id = :id AND email_verified = 0');
            $deleteUser->execute([':id' => $userId]);
            $deleted = $deleteUser->rowCount() === 1;
            $this->db->commit();
            return $deleted;
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    private function insertRun(string $runId, string $mode, string $status): void
    {
        $stmt = $this->db->prepare(
            'INSERT INTO unverified_account_cleanup_runs
             (run_id, mode, status, created_at) VALUES (:run_id, :mode, :status, UTC_TIMESTAMP())'
        );
        $stmt->execute([':run_id' => $runId, ':mode' => $mode, ':status' => $status]);
    }

    private function finishRun(string $runId, array $result, string $status): void
    {
        $summary = $result['summary'] ?? [];
        $stmt = $this->db->prepare(
            'UPDATE unverified_account_cleanup_runs SET status = :status,
             candidate_count = :candidate_count, eligible_count = :eligible_count,
             protected_count = :protected_count, deleted_count = :deleted_count,
             reason_summary_json = :reason_summary_json, completed_at = UTC_TIMESTAMP()
             WHERE run_id = :run_id'
        );
        $stmt->execute([
            ':status' => $status,
            ':candidate_count' => (int) ($summary['candidates'] ?? 0),
            ':eligible_count' => (int) ($summary['eligible'] ?? 0),
            ':protected_count' => (int) ($summary['protected_or_excluded'] ?? 0),
            ':deleted_count' => (int) ($summary['deleted'] ?? 0),
            ':reason_summary_json' => json_encode($summary['reasons'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':run_id' => $runId,
        ]);
    }

    private function hasUserReference(string $table, string $column, string $userId): bool
    {
        if (!$this->tableExists($table) || !$this->columnExists($table, $column)) {
            return false;
        }
        $stmt = $this->db->prepare("SELECT 1 FROM `{$table}` WHERE `{$column}` = :user_id LIMIT 1");
        $stmt->execute([':user_id' => $userId]);
        return (bool) $stmt->fetchColumn();
    }

    private function hasNonEmptyUserColumn(string $column, string $userId): bool
    {
        $stmt = $this->db->prepare("SELECT 1 FROM users WHERE id = :user_id AND NULLIF(TRIM(`{$column}`), '') IS NOT NULL LIMIT 1");
        $stmt->execute([':user_id' => $userId]);
        return (bool) $stmt->fetchColumn();
    }

    private function tableExists(string $table): bool
    {
        $stmt = $this->db->prepare('SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name LIMIT 1');
        $stmt->execute([':table_name' => $table]);
        return (bool) $stmt->fetchColumn();
    }

    private function columnExists(string $table, string $column): bool
    {
        $stmt = $this->db->prepare('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name LIMIT 1');
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (bool) $stmt->fetchColumn();
    }

    private function ageDays(string $createdAt, DateTimeImmutable $now): int
    {
        $created = new DateTimeImmutable($createdAt, new DateTimeZone('UTC'));
        return max(0, (int) floor(($now->getTimestamp() - $created->getTimestamp()) / 86400));
    }

    private function utc(?string $raw): DateTimeImmutable
    {
        return $raw === null
            ? new DateTimeImmutable('now', new DateTimeZone('UTC'))
            : (new DateTimeImmutable($raw))->setTimezone(new DateTimeZone('UTC'));
    }

    private function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
