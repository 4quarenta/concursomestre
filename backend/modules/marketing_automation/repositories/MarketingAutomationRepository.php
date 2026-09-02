<?php

declare(strict_types=1);

/**
 * Repositorio do executor de campanhas e automacoes de marketing.
 *
 * @since 1.0.0
 */
require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';

class MarketingAutomationRepository
{
    private bool $schemaEnsured = false;

    public function __construct(private readonly PDO $db)
    {
    }

    public function getConnection(): PDO
    {
        return $this->db;
    }

    public function fetchActivePromotion(): ?array
    {
        if (!$this->tableExists('system_settings')) {
            return null;
        }

        $stmt = $this->db->prepare("SELECT value_json FROM system_settings WHERE key_name = 'activePromotion' LIMIT 1");
        $stmt->execute();
        $raw = $stmt->fetchColumn();
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }

        $promotion = json_decode($raw, true);
        if (!is_array($promotion) || empty($promotion['isActive'])) {
            return null;
        }

        return $promotion;
    }

    public function findEligibleUsers(string $condition, int $delayHours, int $limit): array
    {
        $limit = max(1, min(500, $limit));
        $delayHours = max(0, min(720, $delayHours));

        return match ($condition) {
            'recent_signup' => $this->findRecentSignupUsers($delayHours, $limit),
            'near_subscription' => $this->findNearSubscriptionUsers($delayHours, $limit),
            'inactive_7_days' => $this->findInactiveUsers($delayHours, $limit),
            'trial_ending' => $this->findTrialEndingUsers($delayHours, $limit),
            'saved_questions' => $this->findSavedQuestionsUsers($delayHours, $limit),
            'elite_upgrade' => $this->findEliteUpgradeUsers($delayHours, $limit),
            default => [],
        };
    }

    public function claimEvent(string $campaignSlug, string $ruleId, string $condition, string $userId, string $eventKey, string $channel): bool
    {
        $this->ensureSchema();

        $stmt = $this->db->prepare("
            INSERT IGNORE INTO marketing_automation_events (
                campaign_slug,
                rule_id,
                rule_condition,
                user_id,
                event_key,
                channel,
                status,
                created_at
            ) VALUES (
                :campaign_slug,
                :rule_id,
                :rule_condition,
                :user_id,
                :event_key,
                :channel,
                'claimed',
                NOW()
            )
        ");

        $stmt->execute([
            ':campaign_slug' => $campaignSlug,
            ':rule_id' => $ruleId,
            ':rule_condition' => $condition,
            ':user_id' => $userId,
            ':event_key' => $eventKey,
            ':channel' => $channel,
        ]);

        return $stmt->rowCount() === 1;
    }

    public function markEventSent(string $campaignSlug, string $ruleId, string $userId, string $eventKey, array $delivery): void
    {
        $this->updateEvent($campaignSlug, $ruleId, $userId, $eventKey, 'sent', $delivery, null);
    }

    public function markEventSkipped(string $campaignSlug, string $ruleId, string $userId, string $eventKey, string $reason): void
    {
        $this->updateEvent($campaignSlug, $ruleId, $userId, $eventKey, 'skipped', [], $reason);
    }

    public function markEventFailed(string $campaignSlug, string $ruleId, string $userId, string $eventKey, string $error): void
    {
        $this->updateEvent($campaignSlug, $ruleId, $userId, $eventKey, 'failed', [], $error);
    }

    public function ensureSchema(): void
    {
        if ($this->schemaEnsured) {
            return;
        }

        SchemaReadiness::assertTablesAndColumns($this->db, 'automacao de marketing', [
            'marketing_automation_events' => ['id', 'campaign_slug', 'rule_id', 'rule_condition', 'user_id', 'event_key', 'channel', 'status', 'delivery_json', 'error_message', 'sent_at', 'created_at'],
        ]);

        $this->schemaEnsured = true;
    }

    private function findRecentSignupUsers(int $delayHours, int $limit): array
    {
        return $this->fetchUsers("
            SELECT u.id, u.name, u.email, u.plan, u.created_at
            FROM users u
            WHERE {$this->activeUserWhere('u')}
              AND u.created_at <= DATE_SUB(NOW(), INTERVAL {$delayHours} HOUR)
              AND u.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
            ORDER BY u.created_at DESC
            LIMIT {$limit}
        ");
    }

    private function findNearSubscriptionUsers(int $delayHours, int $limit): array
    {
        if (!$this->tableExists('analytics_lifecycle_events')) {
            return [];
        }

        return $this->fetchUsers("
            SELECT u.id, u.name, u.email, u.plan, MAX(a.created_at) AS matched_at
            FROM analytics_lifecycle_events a
            INNER JOIN users u ON u.id = a.user_id
            WHERE {$this->activeUserWhere('u')}
              AND COALESCE(u.plan, 'Gratuito') = 'Gratuito'
              AND a.event_name IN ('plan_viewed', 'checkout_started', 'payment_method_started', 'checkout_abandoned')
              AND a.created_at <= DATE_SUB(NOW(), INTERVAL {$delayHours} HOUR)
              AND a.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
            GROUP BY u.id, u.name, u.email, u.plan
            ORDER BY matched_at DESC
            LIMIT {$limit}
        ");
    }

    private function findInactiveUsers(int $delayHours, int $limit): array
    {
        if (!$this->tableExists('user_answers')) {
            return $this->fetchUsers("
                SELECT u.id, u.name, u.email, u.plan, u.created_at
                FROM users u
                WHERE {$this->activeUserWhere('u')}
                  AND u.created_at <= DATE_SUB(NOW(), INTERVAL " . (168 + $delayHours) . " HOUR)
                ORDER BY u.created_at ASC
                LIMIT {$limit}
            ");
        }

        return $this->fetchUsers("
            SELECT u.id, u.name, u.email, u.plan, MAX(ua.created_at) AS matched_at
            FROM users u
            LEFT JOIN user_answers ua ON ua.user_id = u.id
            WHERE {$this->activeUserWhere('u')}
            GROUP BY u.id, u.name, u.email, u.plan, u.created_at
            HAVING COALESCE(MAX(ua.created_at), u.created_at) <= DATE_SUB(NOW(), INTERVAL " . (168 + $delayHours) . " HOUR)
            ORDER BY matched_at ASC
            LIMIT {$limit}
        ");
    }

    private function findTrialEndingUsers(int $delayHours, int $limit): array
    {
        if (!$this->tableExists('user_subscriptions')) {
            return [];
        }

        return $this->fetchUsers("
            SELECT u.id, u.name, u.email, u.plan, MIN(us.current_period_end) AS matched_at
            FROM user_subscriptions us
            INNER JOIN users u ON u.id = us.user_id
            WHERE {$this->activeUserWhere('u')}
              AND us.status = 'trialing'
              AND us.current_period_end >= NOW()
              AND us.current_period_end <= DATE_ADD(NOW(), INTERVAL 7 DAY)
              AND DATE_SUB(us.current_period_end, INTERVAL {$delayHours} HOUR) <= NOW()
            GROUP BY u.id, u.name, u.email, u.plan
            ORDER BY matched_at ASC
            LIMIT {$limit}
        ");
    }

    private function findSavedQuestionsUsers(int $delayHours, int $limit): array
    {
        if (!$this->tableExists('user_saved_questions')) {
            return [];
        }

        return $this->fetchUsers("
            SELECT u.id, u.name, u.email, u.plan, MAX(sq.created_at) AS matched_at
            FROM user_saved_questions sq
            INNER JOIN users u ON u.id = sq.user_id
            WHERE {$this->activeUserWhere('u')}
              AND sq.created_at <= DATE_SUB(NOW(), INTERVAL {$delayHours} HOUR)
              AND sq.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
            GROUP BY u.id, u.name, u.email, u.plan
            ORDER BY matched_at DESC
            LIMIT {$limit}
        ");
    }

    private function findEliteUpgradeUsers(int $delayHours, int $limit): array
    {
        return $this->fetchUsers("
            SELECT u.id, u.name, u.email, u.plan, u.xp, u.created_at
            FROM users u
            WHERE {$this->activeUserWhere('u')}
              AND COALESCE(u.plan, 'Gratuito') <> 'Elite'
              AND COALESCE(u.xp, 0) >= 200
              AND u.created_at <= DATE_SUB(NOW(), INTERVAL {$delayHours} HOUR)
            ORDER BY u.xp DESC, u.created_at ASC
            LIMIT {$limit}
        ");
    }

    private function fetchUsers(string $query): array
    {
        try {
            $stmt = $this->db->query($query);
            if (!$stmt instanceof PDOStatement) {
                return [];
            }

            return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Throwable $e) {
            error_log('[marketing_automation] eligible users query failed: ' . $e->getMessage());
            return [];
        }
    }

    private function updateEvent(
        string $campaignSlug,
        string $ruleId,
        string $userId,
        string $eventKey,
        string $status,
        array $delivery,
        ?string $error
    ): void {
        $stmt = $this->db->prepare("
            UPDATE marketing_automation_events
            SET status = :status,
                delivery_json = :delivery_json,
                error_message = :error_message,
                sent_at = CASE WHEN :status_for_sent = 'sent' THEN NOW() ELSE sent_at END
            WHERE campaign_slug = :campaign_slug
              AND rule_id = :rule_id
              AND user_id = :user_id
              AND event_key = :event_key
        ");

        $stmt->execute([
            ':status' => $status,
            ':delivery_json' => $delivery === [] ? null : json_encode($delivery, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':error_message' => $error,
            ':status_for_sent' => $status,
            ':campaign_slug' => $campaignSlug,
            ':rule_id' => $ruleId,
            ':user_id' => $userId,
            ':event_key' => $eventKey,
        ]);
    }

    private function activeUserWhere(string $alias): string
    {
        return "COALESCE({$alias}.status, 'active') NOT IN ('deleted', 'pending_deletion', 'banned', 'suspended')
            AND COALESCE({$alias}.role, 'user') NOT IN ('admin', 'staff')
            AND COALESCE({$alias}.email, '') <> ''";
    }

    private function tableExists(string $table): bool
    {
        try {
            $stmt = $this->db->query("SHOW TABLES LIKE " . $this->db->quote($table));
            return $stmt instanceof PDOStatement && $stmt->rowCount() > 0;
        } catch (Throwable) {
            return false;
        }
    }
}
