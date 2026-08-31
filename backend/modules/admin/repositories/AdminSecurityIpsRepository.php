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

require_once __DIR__ . '/../../../shared/auth/AuthSession.php';
require_once __DIR__ . '/../../../shared/security/IpBanGuard.php';

/**
 * Repositorio da tela administrativa de IPs suspeitos e bloqueados.
 *
 * @since 1.0.0
 */
class AdminSecurityIpsRepository
{
    private bool $schemaEnsured = false;

    public function __construct(private readonly PDO $db)
    {
    }

    /**
     * Lista IPs com sinais de risco a partir das tabelas de auth.
     *
     * @since 1.0.0
     */
    public function listSuspiciousIps(string $search = '', int $limit = 50): array
    {
        $this->ensureSchema();

        $sessionStats = $this->fetchSessionStats();
        $refreshStats = $this->fetchRefreshStats();
        $activeBans = $this->indexActiveBansByIp();
        $byIp = [];

        foreach ($sessionStats as $row) {
            $ip = normalizeSecurityIpAddress((string) ($row['ip_address'] ?? ''));
            if ($ip === null) {
                continue;
            }
            $byIp[$ip] = array_merge(
                $byIp[$ip] ?? $this->emptyRiskBucket($ip),
                [
                    'sessionsCount' => (int) ($row['sessions_count'] ?? 0),
                    'usersCount' => (int) ($row['users_count'] ?? 0),
                    'sessionReuseCount' => (int) ($row['session_reuse_count'] ?? 0),
                    'sessionCsrfCount' => (int) ($row['session_csrf_count'] ?? 0),
                    'sessionExpiredCount' => (int) ($row['session_expired_count'] ?? 0),
                    'firstSeenAt' => (string) ($row['first_seen_at'] ?? ''),
                    'lastSeenAt' => (string) ($row['last_seen_at'] ?? ''),
                ]
            );
        }

        foreach ($refreshStats as $row) {
            $ip = normalizeSecurityIpAddress((string) ($row['ip_address'] ?? ''));
            if ($ip === null) {
                continue;
            }

            $current = $byIp[$ip] ?? $this->emptyRiskBucket($ip);
            $refreshLastSeenAt = (string) ($row['refresh_last_seen_at'] ?? '');
            $byIp[$ip] = array_merge(
                $current,
                [
                    'refreshCount' => (int) ($row['refresh_count'] ?? 0),
                    'refreshReuseCount' => (int) ($row['refresh_reuse_count'] ?? 0),
                    'refreshCsrfCount' => (int) ($row['refresh_csrf_count'] ?? 0),
                    'refreshExpiredCount' => (int) ($row['refresh_expired_count'] ?? 0),
                    'firstSeenAt' => $this->resolveEarlierDate($current['firstSeenAt'], (string) ($row['refresh_first_seen_at'] ?? '')),
                    'lastSeenAt' => $this->resolveLaterDate($current['lastSeenAt'], $refreshLastSeenAt),
                ]
            );
        }

        $items = [];
        foreach ($byIp as $ip => $row) {
            if ($search !== '' && stripos($ip, $search) === false) {
                continue;
            }

            $signals = $this->buildSignals($row);
            $score = $this->computeScore($row, $signals);
            $isSuspicious = $score >= 10
                || $row['sessionReuseCount'] > 0
                || $row['refreshReuseCount'] > 0
                || ($row['sessionCsrfCount'] + $row['refreshCsrfCount']) > 0;

            if (!$isSuspicious) {
                continue;
            }

            $ban = $activeBans[$ip] ?? null;
            $items[] = [
                'ipAddress' => $ip,
                'score' => $score,
                'signals' => $signals,
                'sessionsCount' => (int) $row['sessionsCount'],
                'refreshCount' => (int) $row['refreshCount'],
                'usersCount' => (int) $row['usersCount'],
                'firstSeenAt' => $row['firstSeenAt'] ?: null,
                'lastSeenAt' => $row['lastSeenAt'] ?: null,
                'isBanned' => $ban !== null,
                'banReason' => $ban['reason'] ?? null,
                'bannedAt' => $ban['created_at'] ?? null,
                'blockedHits' => isset($ban['blocked_hits']) ? (int) $ban['blocked_hits'] : 0,
            ];
        }

        usort($items, static function (array $left, array $right): int {
            if ((int) $right['score'] !== (int) $left['score']) {
                return ((int) $right['score']) <=> ((int) $left['score']);
            }

            return strcmp((string) ($right['lastSeenAt'] ?? ''), (string) ($left['lastSeenAt'] ?? ''));
        });

        return array_slice($items, 0, max(1, $limit));
    }

    /**
     * Lista IPs ativamente bloqueados na plataforma.
     *
     * @since 1.0.0
     */
    public function listBannedIps(string $search = ''): array
    {
        $this->ensureSchema();

        $stmt = $this->db->prepare(
            "SELECT ip_address, reason, blocked_hits, last_blocked_at, banned_until, created_by, updated_by, created_at, updated_at
             FROM security_ip_bans
             WHERE status = 'banned'
               AND (banned_until IS NULL OR banned_until > NOW())
             ORDER BY updated_at DESC"
        );
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $items = [];
        foreach ($rows as $row) {
            $ip = (string) ($row['ip_address'] ?? '');
            if ($search !== '' && stripos($ip, $search) === false) {
                continue;
            }

            $items[] = [
                'ipAddress' => $ip,
                'reason' => (string) ($row['reason'] ?? ''),
                'blockedHits' => (int) ($row['blocked_hits'] ?? 0),
                'lastBlockedAt' => $row['last_blocked_at'] ?? null,
                'bannedUntil' => $row['banned_until'] ?? null,
                'createdBy' => $row['created_by'] ?? null,
                'updatedBy' => $row['updated_by'] ?? null,
                'createdAt' => $row['created_at'] ?? null,
                'updatedAt' => $row['updated_at'] ?? null,
            ];
        }

        return $items;
    }

    /**
     * Bloqueia (ou reativa bloqueio) para um IP especifico.
     *
     * @since 1.0.0
     */
    public function banIpAddress(string $ipAddress, string $reason, string $adminUserId): array
    {
        $this->ensureSchema();
        $ip = normalizeSecurityIpAddress($ipAddress);
        if ($ip === null) {
            throw new InvalidArgumentException('IP invalido para bloqueio.');
        }

        $stmt = $this->db->prepare(
            "INSERT INTO security_ip_bans (
                ip_address,
                status,
                reason,
                blocked_hits,
                created_by,
                updated_by,
                created_at,
                updated_at,
                banned_until,
                unbanned_at
            ) VALUES (
                :ip_address,
                'banned',
                :reason,
                0,
                :created_by,
                :updated_by,
                NOW(),
                NOW(),
                NULL,
                NULL
            )
            ON DUPLICATE KEY UPDATE
                status = 'banned',
                reason = VALUES(reason),
                updated_by = VALUES(updated_by),
                updated_at = NOW(),
                banned_until = NULL,
                unbanned_at = NULL"
        );
        $stmt->execute([
            ':ip_address' => $ip,
            ':reason' => $reason,
            ':created_by' => $adminUserId,
            ':updated_by' => $adminUserId,
        ]);

        return [
            'ipAddress' => $ip,
            'status' => 'banned',
            'reason' => $reason,
        ];
    }

    /**
     * Remove o bloqueio ativo para um IP especifico.
     *
     * @since 1.0.0
     */
    public function unbanIpAddress(string $ipAddress, string $adminUserId): array
    {
        $this->ensureSchema();
        $ip = normalizeSecurityIpAddress($ipAddress);
        if ($ip === null) {
            throw new InvalidArgumentException('IP invalido para desbloqueio.');
        }

        $stmt = $this->db->prepare(
            "UPDATE security_ip_bans
             SET status = 'unbanned',
                 updated_by = :updated_by,
                 updated_at = NOW(),
                 unbanned_at = NOW()
             WHERE ip_address = :ip_address
               AND status = 'banned'"
        );
        $stmt->execute([
            ':ip_address' => $ip,
            ':updated_by' => $adminUserId,
        ]);

        if ($stmt->rowCount() < 1) {
            throw new OutOfBoundsException('Nao existe bloqueio ativo para este IP.');
        }

        return [
            'ipAddress' => $ip,
            'status' => 'unbanned',
        ];
    }

    private function ensureSchema(): void
    {
        if ($this->schemaEnsured) {
            return;
        }

        ensureAuthTables($this->db);
        ensureSecurityIpBanTable($this->db);
        $this->schemaEnsured = true;
    }

    private function fetchSessionStats(): array
    {
        $stmt = $this->db->prepare(
            "SELECT
                ip_address,
                COUNT(*) AS sessions_count,
                COUNT(DISTINCT user_id) AS users_count,
                SUM(CASE WHEN status = 'reuse_detected' OR reuse_detected_at IS NOT NULL THEN 1 ELSE 0 END) AS session_reuse_count,
                SUM(CASE WHEN revoked_reason = 'csrf_mismatch' THEN 1 ELSE 0 END) AS session_csrf_count,
                SUM(CASE WHEN revoked_reason = 'session_expired' THEN 1 ELSE 0 END) AS session_expired_count,
                MIN(created_at) AS first_seen_at,
                MAX(COALESCE(updated_at, created_at)) AS last_seen_at
             FROM auth_sessions
             WHERE ip_address IS NOT NULL
               AND ip_address <> ''
               AND created_at >= DATE_SUB(NOW(), INTERVAL 45 DAY)
             GROUP BY ip_address"
        );
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function fetchRefreshStats(): array
    {
        $stmt = $this->db->prepare(
            "SELECT
                ip_address,
                COUNT(*) AS refresh_count,
                SUM(CASE
                    WHEN status = 'reuse_detected'
                      OR reuse_detected_at IS NOT NULL
                      OR revoked_reason = 'refresh_token_reuse'
                    THEN 1
                    ELSE 0
                END) AS refresh_reuse_count,
                SUM(CASE WHEN revoked_reason = 'csrf_mismatch' THEN 1 ELSE 0 END) AS refresh_csrf_count,
                SUM(CASE WHEN revoked_reason = 'refresh_token_expired' THEN 1 ELSE 0 END) AS refresh_expired_count,
                MIN(created_at) AS refresh_first_seen_at,
                MAX(COALESCE(rotated_at, used_at, revoked_at, created_at)) AS refresh_last_seen_at
             FROM auth_refresh_tokens
             WHERE ip_address IS NOT NULL
               AND ip_address <> ''
               AND created_at >= DATE_SUB(NOW(), INTERVAL 45 DAY)
             GROUP BY ip_address"
        );
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function indexActiveBansByIp(): array
    {
        $stmt = $this->db->prepare(
            "SELECT ip_address, reason, blocked_hits, created_at
             FROM security_ip_bans
             WHERE status = 'banned'
               AND (banned_until IS NULL OR banned_until > NOW())"
        );
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $indexed = [];
        foreach ($rows as $row) {
            $ip = normalizeSecurityIpAddress((string) ($row['ip_address'] ?? ''));
            if ($ip === null) {
                continue;
            }
            $indexed[$ip] = $row;
        }
        return $indexed;
    }

    private function emptyRiskBucket(string $ipAddress): array
    {
        return [
            'ipAddress' => $ipAddress,
            'sessionsCount' => 0,
            'usersCount' => 0,
            'sessionReuseCount' => 0,
            'sessionCsrfCount' => 0,
            'sessionExpiredCount' => 0,
            'refreshCount' => 0,
            'refreshReuseCount' => 0,
            'refreshCsrfCount' => 0,
            'refreshExpiredCount' => 0,
            'firstSeenAt' => '',
            'lastSeenAt' => '',
        ];
    }

    private function resolveEarlierDate(string $left, string $right): string
    {
        if ($left === '') {
            return $right;
        }
        if ($right === '') {
            return $left;
        }

        return strtotime($left) <= strtotime($right) ? $left : $right;
    }

    private function resolveLaterDate(string $left, string $right): string
    {
        if ($left === '') {
            return $right;
        }
        if ($right === '') {
            return $left;
        }

        return strtotime($left) >= strtotime($right) ? $left : $right;
    }

    private function computeScore(array $row, array $signals): int
    {
        $baseScore = 0.0;
        $baseScore += ((int) $row['sessionReuseCount']) * 22;
        $baseScore += ((int) $row['refreshReuseCount']) * 24;
        $baseScore += (((int) $row['sessionCsrfCount']) + ((int) $row['refreshCsrfCount'])) * 14;
        $baseScore += max(0, ((int) $row['usersCount']) - 3) * 4;
        $baseScore += max(0, ((int) $row['sessionsCount']) - 30) * 0.5;
        $baseScore += max(0, ((int) $row['refreshExpiredCount']) - 12) * 0.2;
        $baseScore += count($signals) * 1.5;

        return (int) round($baseScore);
    }

    private function buildSignals(array $row): array
    {
        $signals = [];

        if ((int) $row['sessionReuseCount'] > 0) {
            $signals[] = [
                'key' => 'session_reuse',
                'label' => 'Reuso de sessao detectado',
                'count' => (int) $row['sessionReuseCount'],
            ];
        }

        if ((int) $row['refreshReuseCount'] > 0) {
            $signals[] = [
                'key' => 'refresh_reuse',
                'label' => 'Reuso de refresh token detectado',
                'count' => (int) $row['refreshReuseCount'],
            ];
        }

        $csrfCount = (int) $row['sessionCsrfCount'] + (int) $row['refreshCsrfCount'];
        if ($csrfCount > 0) {
            $signals[] = [
                'key' => 'csrf_mismatch',
                'label' => 'Falhas de CSRF',
                'count' => $csrfCount,
            ];
        }

        if ((int) $row['usersCount'] >= 5) {
            $signals[] = [
                'key' => 'multi_user_ip',
                'label' => 'Muitos usuarios no mesmo IP',
                'count' => (int) $row['usersCount'],
            ];
        }

        if ((int) $row['sessionsCount'] >= 40) {
            $signals[] = [
                'key' => 'high_session_volume',
                'label' => 'Volume alto de sessoes',
                'count' => (int) $row['sessionsCount'],
            ];
        }

        if ((int) $row['refreshExpiredCount'] >= 20) {
            $signals[] = [
                'key' => 'refresh_expired_burst',
                'label' => 'Muitas expiracoes de refresh',
                'count' => (int) $row['refreshExpiredCount'],
            ];
        }

        return $signals;
    }
}
