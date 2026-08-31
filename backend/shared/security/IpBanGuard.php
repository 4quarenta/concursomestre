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

require_once __DIR__ . '/../auth/AuthConfig.php';

if (!function_exists('ensureSecurityIpBanTable')) {
    /**
     * Cria a tabela de bloqueio de IPs usada pela operacao de seguranca do admin.
     *
     * @since 1.0.0
     */
    function ensureSecurityIpBanTable(PDO $db): void
    {
        $db->exec(
            "CREATE TABLE IF NOT EXISTS security_ip_bans (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                ip_address VARCHAR(45) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'banned',
                reason VARCHAR(255) NOT NULL,
                blocked_hits BIGINT UNSIGNED NOT NULL DEFAULT 0,
                last_blocked_at DATETIME NULL,
                banned_until DATETIME NULL,
                unbanned_at DATETIME NULL,
                created_by VARCHAR(64) NULL,
                updated_by VARCHAR(64) NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                UNIQUE KEY uniq_security_ip_bans_ip (ip_address),
                INDEX idx_security_ip_bans_status (status),
                INDEX idx_security_ip_bans_banned_until (banned_until),
                INDEX idx_security_ip_bans_updated_at (updated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
    }
}

if (!function_exists('normalizeSecurityIpAddress')) {
    /**
     * Normaliza um IP para persistencia e comparacao.
     *
     * @since 1.0.0
     */
    function normalizeSecurityIpAddress(?string $ipAddress): ?string
    {
        if ($ipAddress === null) {
            return null;
        }

        $raw = trim($ipAddress);
        if ($raw === '') {
            return null;
        }

        if (function_exists('normalizeAuthIpCandidate')) {
            $normalized = normalizeAuthIpCandidate($raw);
            return $normalized !== null ? $normalized : null;
        }

        return filter_var($raw, FILTER_VALIDATE_IP) ? $raw : null;
    }
}

if (!function_exists('getSecurityRequestIpAddress')) {
    /**
     * Resolve o IP atual da request para as regras de seguranca.
     *
     * @since 1.0.0
     */
    function getSecurityRequestIpAddress(): ?string
    {
        if (function_exists('getAuthClientIp')) {
            return normalizeSecurityIpAddress(getAuthClientIp());
        }

        return normalizeSecurityIpAddress((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    }
}

if (!function_exists('findActiveSecurityIpBan')) {
    /**
     * Procura um bloqueio ativo para o IP informado.
     *
     * @since 1.0.0
     */
    function findActiveSecurityIpBan(PDO $db, ?string $ipAddress = null): ?array
    {
        ensureSecurityIpBanTable($db);
        $ip = normalizeSecurityIpAddress($ipAddress ?: getSecurityRequestIpAddress());
        if ($ip === null) {
            return null;
        }

        $stmt = $db->prepare(
            "SELECT *
             FROM security_ip_bans
             WHERE ip_address = :ip_address
               AND status = 'banned'
               AND (banned_until IS NULL OR banned_until > NOW())
             LIMIT 1"
        );
        $stmt->execute([':ip_address' => $ip]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }
}

if (!function_exists('registerSecurityIpBlockedHit')) {
    /**
     * Incrementa metricas de tentativas bloqueadas para o IP.
     *
     * @since 1.0.0
     */
    function registerSecurityIpBlockedHit(PDO $db, string $ipAddress): void
    {
        ensureSecurityIpBanTable($db);

        $ip = normalizeSecurityIpAddress($ipAddress);
        if ($ip === null) {
            return;
        }

        try {
            $stmt = $db->prepare(
                "UPDATE security_ip_bans
                 SET blocked_hits = blocked_hits + 1,
                     last_blocked_at = NOW(),
                     updated_at = NOW()
                 WHERE ip_address = :ip_address
                   AND status = 'banned'"
            );
            $stmt->execute([':ip_address' => $ip]);
        } catch (Throwable $e) {
            error_log('[security_ip_block_hit] ' . $e->getMessage());
        }
    }
}

if (!function_exists('enforceSecurityIpBanOrFail')) {
    /**
     * Interrompe o fluxo quando o IP atual esta bloqueado por seguranca.
     *
     * @since 1.0.0
     */
    function enforceSecurityIpBanOrFail(PDO $db, ?string $ipAddress = null): void
    {
        $ip = normalizeSecurityIpAddress($ipAddress ?: getSecurityRequestIpAddress());
        if ($ip === null) {
            return;
        }

        $ban = findActiveSecurityIpBan($db, $ip);
        if (!$ban) {
            return;
        }

        registerSecurityIpBlockedHit($db, $ip);
        throw new RuntimeException('IP bloqueado por seguranca. Contate o suporte.');
    }
}
