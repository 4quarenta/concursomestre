<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';

final class MarketingCampaignRepository
{
    private bool $schemaChecked = false;

    public function __construct(private readonly PDO $db)
    {
    }

    public function ensureSchema(): void
    {
        if ($this->schemaChecked) {
            return;
        }

        SchemaReadiness::assertTablesAndColumns($this->db, 'marketing campaigns', [
            'marketing_segments' => ['id', 'name', 'description', 'status', 'rules_json', 'created_by', 'updated_by', 'created_at', 'updated_at'],
            'marketing_campaigns' => ['id', 'name', 'objective', 'status', 'priority', 'starts_at', 'ends_at', 'segment_id', 'rules_json', 'channels_json', 'placements_json', 'content_json', 'landing_slug', 'offer_json', 'plan_id', 'coupon_code', 'tracking_json', 'frequency_cap', 'frequency_cap_window', 'cooldown_hours', 'max_impressions', 'mutual_exclusion_group', 'suppress_after_conversion', 'created_by', 'updated_by', 'created_at', 'updated_at'],
            'marketing_campaign_interactions' => ['id', 'campaign_id', 'user_id', 'session_key_hash', 'interaction_type', 'idempotency_key', 'attribution_json', 'created_at'],
        ]);

        $this->schemaChecked = true;
    }

    public function listCampaigns(?string $search = null, ?string $status = null): array
    {
        $this->ensureSchema();
        $conditions = [];
        $params = [];
        if ($search !== null && trim($search) !== '') {
            $conditions[] = '(c.name LIKE :search OR c.objective LIKE :search)';
            $params[':search'] = '%' . trim($search) . '%';
        }
        if ($status !== null && trim($status) !== '') {
            $conditions[] = 'c.status = :status';
            $params[':status'] = trim($status);
        }
        $sql = "SELECT c.*, s.name AS segment_name
                FROM marketing_campaigns c
                LEFT JOIN marketing_segments s ON s.id = c.segment_id";
        if ($conditions !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $conditions);
        }
        $sql .= ' ORDER BY c.priority DESC, c.updated_at DESC';
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return array_map([$this, 'hydrateCampaign'], $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    public function findCampaign(string $id): ?array
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare('SELECT c.*, s.name AS segment_name FROM marketing_campaigns c LEFT JOIN marketing_segments s ON s.id = c.segment_id WHERE c.id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $this->hydrateCampaign($row) : null;
    }

    public function listPublicCampaigns(): array
    {
        $this->ensureSchema();
        $stmt = $this->db->query("SELECT c.*
            FROM marketing_campaigns c
            WHERE c.status IN ('active', 'scheduled')
              AND (c.starts_at IS NULL OR c.starts_at <= UTC_TIMESTAMP(6))
              AND (c.ends_at IS NULL OR c.ends_at > UTC_TIMESTAMP(6))
            ORDER BY c.priority DESC, c.updated_at DESC, c.id ASC");
        $campaigns = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $campaign = $this->hydrateCampaign($row);
            $campaigns[] = [
                'id' => $campaign['id'], 'name' => $campaign['name'], 'objective' => $campaign['objective'],
                'priority' => $campaign['priority'], 'startsAt' => $campaign['starts_at'], 'endsAt' => $campaign['ends_at'],
                'landingSlug' => $campaign['landing_slug'], 'content' => $campaign['content_json'],
                'offer' => $campaign['offer_json'], 'planId' => $campaign['plan_id'], 'couponCode' => $campaign['coupon_code'],
                'channels' => $campaign['channels_json'], 'placements' => $campaign['placements_json'],
                'frequencyCap' => $campaign['frequency_cap'], 'frequencyCapWindow' => $campaign['frequency_cap_window'] ?? 'session',
                'cooldownHours' => $campaign['cooldown_hours'], 'maxImpressions' => $campaign['max_impressions'],
                'mutualExclusionGroup' => $campaign['mutual_exclusion_group'], 'suppressAfterConversion' => $campaign['suppress_after_conversion'],
            ];
        }
        return $campaigns;
    }

    /** Raw candidates remain inside the server-side eligibility authority. */
    public function listPublicCampaignCandidates(): array
    {
        $this->ensureSchema();
        $stmt = $this->db->query("SELECT *
            FROM marketing_campaigns
            WHERE status IN ('active', 'scheduled')
              AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP(6))
              AND (ends_at IS NULL OR ends_at > UTC_TIMESTAMP(6))
            ORDER BY priority DESC, updated_at DESC, id ASC");
        return array_map([$this, 'hydrateCampaign'], $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    public function listSegments(?string $search = null): array
    {
        $this->ensureSchema();
        if ($search === null || trim($search) === '') {
            $stmt = $this->db->query('SELECT * FROM marketing_segments ORDER BY updated_at DESC');
        } else {
            $stmt = $this->db->prepare('SELECT * FROM marketing_segments WHERE name LIKE :search OR description LIKE :search ORDER BY updated_at DESC');
            $stmt->execute([':search' => '%' . trim($search) . '%']);
        }
        return array_map([$this, 'hydrateSegment'], $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    public function findSegment(string $id): ?array
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare('SELECT * FROM marketing_segments WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $this->hydrateSegment($row) : null;
    }

    public function withCampaignGovernanceLock(string $campaignId, callable $operation): mixed
    {
        $this->ensureSchema();
        if ($this->db->inTransaction()) {
            throw new RuntimeException('A transacao de governanca ja esta em andamento.');
        }

        $this->db->beginTransaction();
        $lockName = null;
        try {
            $stmt = $this->db->prepare('SELECT * FROM marketing_campaigns WHERE id = :id LIMIT 1 FOR UPDATE');
            $stmt->execute([':id' => $campaignId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!is_array($row)) {
                $this->db->commit();
                return $operation(null);
            }

            $group = trim((string) ($row['mutual_exclusion_group'] ?? ''));
            if ($group !== '') {
                $lockName = 'm20f02:governance:' . hash('sha256', $group);
                $lockStmt = $this->db->prepare('SELECT GET_LOCK(:lock_name, 5)');
                $lockStmt->execute([':lock_name' => $lockName]);
                if ((int) $lockStmt->fetchColumn() !== 1) {
                    throw new RuntimeException('Nao foi possivel obter o lock de governanca.');
                }
            }

            $result = $operation($this->hydrateCampaign($row));
            $this->db->commit();
            return $result;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        } finally {
            if ($lockName !== null) {
                $releaseStmt = $this->db->prepare('SELECT RELEASE_LOCK(:lock_name)');
                $releaseStmt->execute([':lock_name' => $lockName]);
            }
        }
    }

    public function interactionMetrics(string $campaignId, ?string $userId, ?string $sessionHash, string $frequencyWindow): array
    {
        $this->ensureSchema();
        $persistentWhere = $this->identityWhere($userId, $sessionHash, 'persistent', 'persistent');
        $frequencyWhere = $this->identityWhere($userId, $sessionHash, $frequencyWindow === 'session' ? 'session' : 'persistent', 'frequency');
        $params = array_merge($persistentWhere['params'], $frequencyWhere['params']);
        $frequencySince = $this->frequencySince($frequencyWindow);
        $frequencyClause = $frequencySince === null ? '' : ' AND created_at >= :frequency_since';
        if ($frequencySince !== null) {
            $params[':frequency_since'] = $frequencySince;
        }

        $sql = "SELECT
            (SELECT COUNT(*) FROM marketing_campaign_interactions WHERE campaign_id = :campaign_id_frequency AND interaction_type = 'impression' {$frequencyClause} AND {$frequencyWhere['sql']}) AS frequency_impressions,
            (SELECT COUNT(*) FROM marketing_campaign_interactions WHERE campaign_id = :campaign_id_total AND interaction_type = 'impression' AND {$persistentWhere['sql']}) AS total_impressions,
            (SELECT UNIX_TIMESTAMP(MAX(created_at)) FROM marketing_campaign_interactions WHERE campaign_id = :campaign_id_last AND {$persistentWhere['sql']}) AS last_interaction_unix,
            (SELECT COUNT(*) FROM marketing_campaign_interactions WHERE campaign_id = :campaign_id_dismissed AND interaction_type = 'dismissal' AND {$persistentWhere['sql']}) AS dismissals";
        $params[':campaign_id_frequency'] = $campaignId;
        $params[':campaign_id_total'] = $campaignId;
        $params[':campaign_id_last'] = $campaignId;
        $params[':campaign_id_dismissed'] = $campaignId;
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
        return [
            'frequencyImpressions' => (int) ($row['frequency_impressions'] ?? 0),
            'totalImpressions' => (int) ($row['total_impressions'] ?? 0),
            'lastInteractionAt' => $row['last_interaction_unix'] !== null ? (int) $row['last_interaction_unix'] : null,
            'dismissed' => (int) ($row['dismissals'] ?? 0) > 0,
        ];
    }

    public function hasCampaignConversion(string $campaignId, string $eventName, ?string $userId, ?string $sessionKey): bool
    {
        if ($userId === null && ($sessionKey === null || $sessionKey === '')) {
            return false;
        }
        $identitySql = $userId !== null && $userId !== '' ? 'user_id = :user_id' : 'session_key = :session_key';
        $params = [':campaign_id' => $campaignId, ':event_name' => $eventName];
        if ($userId !== null && $userId !== '') {
            $params[':user_id'] = $userId;
        } else {
            $params[':session_key'] = $sessionKey;
        }
        $stmt = $this->db->prepare("SELECT 1 FROM analytics_lifecycle_events
            WHERE event_name = :event_name AND {$identitySql}
              AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.campaignId')) = :campaign_id LIMIT 1");
        $stmt->execute($params);
        return $stmt->fetchColumn() !== false;
    }

    public function hasInteractionIdempotencyKey(string $idempotencyKey): bool
    {
        $stmt = $this->db->prepare('SELECT 1 FROM marketing_campaign_interactions WHERE idempotency_key = :key LIMIT 1');
        $stmt->execute([':key' => $idempotencyKey]);
        return $stmt->fetchColumn() !== false;
    }

    public function hasCompetingImpression(string $campaignId, ?string $userId, ?string $sessionHash): bool
    {
        $identity = $this->identityWhere($userId, $sessionHash, 'persistent', 'competing');
        $params = array_merge([':campaign_id' => $campaignId], $identity['params']);
        $stmt = $this->db->prepare("SELECT 1
            FROM marketing_campaign_interactions i
            INNER JOIN marketing_campaigns c ON c.id = i.campaign_id
            INNER JOIN marketing_campaigns selected ON selected.id = :campaign_id
            WHERE i.interaction_type = 'impression'
              AND c.mutual_exclusion_group IS NOT NULL
              AND c.mutual_exclusion_group = selected.mutual_exclusion_group
              AND i.campaign_id <> selected.id
              AND {$identity['sql']} LIMIT 1");
        $stmt->execute($params);
        return $stmt->fetchColumn() !== false;
    }

    private function identityWhere(?string $userId, ?string $sessionHash, string $scope, string $prefix): array
    {
        if ($scope === 'session' && $sessionHash !== null && $sessionHash !== '') {
            return ['sql' => 'session_key_hash = :' . $prefix . '_session_hash', 'params' => [':' . $prefix . '_session_hash' => $sessionHash]];
        }
        if ($userId !== null && $userId !== '') {
            return ['sql' => 'user_id = :' . $prefix . '_user_id', 'params' => [':' . $prefix . '_user_id' => $userId]];
        }
        if ($sessionHash === null || $sessionHash === '') {
            return ['sql' => '1 = 0', 'params' => []];
        }
        return ['sql' => 'session_key_hash = :' . $prefix . '_session_hash', 'params' => [':' . $prefix . '_session_hash' => $sessionHash]];
    }

    private function frequencySince(string $window): ?string
    {
        return match ($window) {
            'day' => gmdate('Y-m-d 00:00:00'),
            'week' => gmdate('Y-m-d 00:00:00', strtotime('monday this week')),
            'ever', 'session' => null,
            default => null,
        };
    }

    public function findUserProfile(string $id): ?array
    {
        $stmt = $this->db->prepare('SELECT id, created_at, plan, role FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function hasPlan(int $planId): bool
    {
        if ($planId <= 0) {
            return false;
        }
        $stmt = $this->db->prepare('SELECT 1 FROM plans WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $planId]);
        return $stmt->fetchColumn() !== false;
    }

    public function saveSegment(array $segment): array
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare("INSERT INTO marketing_segments (id, name, description, status, rules_json, created_by, updated_by)
            VALUES (:id, :name, :description, :status, :rules_json, :created_by, :updated_by)
            ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), status = VALUES(status), rules_json = VALUES(rules_json), updated_by = VALUES(updated_by)");
        $stmt->execute([
            ':id' => $segment['id'], ':name' => $segment['name'], ':description' => $segment['description'],
            ':status' => $segment['status'], ':rules_json' => $segment['rules_json'],
            ':created_by' => $segment['created_by'], ':updated_by' => $segment['updated_by'],
        ]);
        return $this->findSegment((string) $segment['id']) ?? $segment;
    }

    public function saveCampaign(array $campaign): array
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare("INSERT INTO marketing_campaigns (
                id, name, objective, status, priority, starts_at, ends_at, segment_id, rules_json,
                channels_json, placements_json, content_json, landing_slug, offer_json, plan_id, coupon_code,
                tracking_json, frequency_cap, frequency_cap_window, cooldown_hours, max_impressions, mutual_exclusion_group,
                suppress_after_conversion, created_by, updated_by
            ) VALUES (
                :id, :name, :objective, :status, :priority, :starts_at, :ends_at, :segment_id, :rules_json,
                :channels_json, :placements_json, :content_json, :landing_slug, :offer_json, :plan_id, :coupon_code,
                :tracking_json, :frequency_cap, :frequency_cap_window, :cooldown_hours, :max_impressions, :mutual_exclusion_group,
                :suppress_after_conversion, :created_by, :updated_by
            ) ON DUPLICATE KEY UPDATE
                name = VALUES(name), objective = VALUES(objective), status = VALUES(status), priority = VALUES(priority),
                starts_at = VALUES(starts_at), ends_at = VALUES(ends_at), segment_id = VALUES(segment_id), rules_json = VALUES(rules_json),
                channels_json = VALUES(channels_json), placements_json = VALUES(placements_json), content_json = VALUES(content_json),
                landing_slug = VALUES(landing_slug), offer_json = VALUES(offer_json), plan_id = VALUES(plan_id), coupon_code = VALUES(coupon_code),
                tracking_json = VALUES(tracking_json), frequency_cap = VALUES(frequency_cap), frequency_cap_window = VALUES(frequency_cap_window), cooldown_hours = VALUES(cooldown_hours),
                max_impressions = VALUES(max_impressions), mutual_exclusion_group = VALUES(mutual_exclusion_group),
                suppress_after_conversion = VALUES(suppress_after_conversion), updated_by = VALUES(updated_by)");
        $stmt->execute([
            ':id' => $campaign['id'], ':name' => $campaign['name'], ':objective' => $campaign['objective'],
            ':status' => $campaign['status'], ':priority' => $campaign['priority'], ':starts_at' => $campaign['starts_at'],
            ':ends_at' => $campaign['ends_at'], ':segment_id' => $campaign['segment_id'], ':rules_json' => $campaign['rules_json'],
            ':channels_json' => $campaign['channels_json'], ':placements_json' => $campaign['placements_json'],
            ':content_json' => $campaign['content_json'], ':landing_slug' => $campaign['landing_slug'], ':offer_json' => $campaign['offer_json'],
            ':plan_id' => $campaign['plan_id'], ':coupon_code' => $campaign['coupon_code'], ':tracking_json' => $campaign['tracking_json'],
            ':frequency_cap' => $campaign['frequency_cap'], ':cooldown_hours' => $campaign['cooldown_hours'],
            ':frequency_cap_window' => $campaign['frequency_cap_window'],
            ':max_impressions' => $campaign['max_impressions'], ':mutual_exclusion_group' => $campaign['mutual_exclusion_group'],
            ':suppress_after_conversion' => $campaign['suppress_after_conversion'], ':created_by' => $campaign['created_by'],
            ':updated_by' => $campaign['updated_by'],
        ]);
        return $this->findCampaign((string) $campaign['id']) ?? $campaign;
    }

    public function updateCampaignStatus(string $id, string $status, string $adminUserId): array
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare('UPDATE marketing_campaigns SET status = :status, updated_by = :updated_by WHERE id = :id');
        $stmt->execute([':status' => $status, ':updated_by' => $adminUserId, ':id' => $id]);
        return $this->findCampaign($id) ?? [];
    }

    public function deleteCampaign(string $id): void
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare('DELETE FROM marketing_campaigns WHERE id = :id');
        $stmt->execute([':id' => $id]);
    }

    public function insertInteraction(array $interaction): bool
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare("INSERT IGNORE INTO marketing_campaign_interactions
            (campaign_id, user_id, session_key_hash, interaction_type, idempotency_key, attribution_json)
            VALUES (:campaign_id, :user_id, :session_key_hash, :interaction_type, :idempotency_key, :attribution_json)");
        $stmt->execute([
            ':campaign_id' => $interaction['campaign_id'], ':user_id' => $interaction['user_id'],
            ':session_key_hash' => $interaction['session_key_hash'], ':interaction_type' => $interaction['interaction_type'],
            ':idempotency_key' => $interaction['idempotency_key'], ':attribution_json' => $interaction['attribution_json'],
        ]);
        return $stmt->rowCount() === 1;
    }

    public function getCampaignAnalytics(string $campaignId): array
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare("SELECT interaction_type, COUNT(*) AS total,
                COUNT(DISTINCT COALESCE(user_id, session_key_hash)) AS unique_count
            FROM marketing_campaign_interactions WHERE campaign_id = :id GROUP BY interaction_type");
        $stmt->execute([':id' => $campaignId]);
        $interactions = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $interactions[(string) $row['interaction_type']] = [
                'total' => (int) $row['total'], 'unique' => (int) $row['unique_count'],
            ];
        }

        $eventStmt = $this->db->prepare("SELECT event_name, COUNT(*) AS total
            FROM analytics_lifecycle_events
            WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.campaignId')) = :id
            GROUP BY event_name");
        $eventStmt->execute([':id' => $campaignId]);
        $funnel = [];
        foreach ($eventStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $funnel[(string) $row['event_name']] = (int) $row['total'];
        }
        return ['interactions' => $interactions, 'funnel' => $funnel];
    }

    private function hydrateCampaign(array $row): array
    {
        foreach (['rules_json', 'channels_json', 'placements_json', 'content_json', 'offer_json', 'tracking_json'] as $key) {
            $decoded = json_decode((string) ($row[$key] ?? ''), true);
            $row[$key] = is_array($decoded) ? $decoded : ($key === 'offer_json' || $key === 'tracking_json' ? null : []);
        }
        $row['priority'] = (int) ($row['priority'] ?? 0);
        $row['frequency_cap'] = $row['frequency_cap'] === null ? null : (int) $row['frequency_cap'];
        $row['frequency_cap_window'] = (string) ($row['frequency_cap_window'] ?? 'session');
        $row['cooldown_hours'] = $row['cooldown_hours'] === null ? null : (int) $row['cooldown_hours'];
        $row['max_impressions'] = $row['max_impressions'] === null ? null : (int) $row['max_impressions'];
        $row['suppress_after_conversion'] = (bool) ($row['suppress_after_conversion'] ?? true);
        return $row;
    }

    private function hydrateSegment(array $row): array
    {
        $decoded = json_decode((string) ($row['rules_json'] ?? ''), true);
        $row['rules_json'] = is_array($decoded) ? $decoded : [];
        return $row;
    }
}
