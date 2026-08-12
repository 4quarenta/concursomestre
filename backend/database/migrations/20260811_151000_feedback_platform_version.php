<?php

declare(strict_types=1);

/**
 * Registra a versao editorial vigente em cada sugestao enviada pelo usuario.
 *
 * A versao e resolvida no servidor a partir de system_settings. Sugestoes
 * existentes recebem a versao configurada durante a aplicacao da migration.
 *
 * Rollback:
 * backend/database/rollbacks/20260811_151000_feedback_platform_version.sql
 */
return static function (PDO $db): void {
    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT 1 FROM information_schema.COLUMNS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name LIMIT 1'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (bool) $stmt->fetchColumn();
    };

    if (!$columnExists('user_feedback', 'platform_version')) {
        $db->exec(
            'ALTER TABLE user_feedback '
            . 'ADD COLUMN platform_version VARCHAR(40) NULL AFTER suggestion_status'
        );
    }

    $configuredVersion = '1.0.0';
    $stmt = $db->prepare(
        "SELECT value_json FROM system_settings WHERE key_name = 'platformVersion' LIMIT 1"
    );
    $stmt->execute();
    $rawValue = $stmt->fetchColumn();
    if (is_string($rawValue) && trim($rawValue) !== '') {
        $decoded = json_decode($rawValue, true);
        $candidate = is_string($decoded)
            ? $decoded
            : (is_array($decoded) ? (string) ($decoded['platformVersion'] ?? $decoded['value'] ?? '') : '');
        $candidate = trim($candidate);
        if ($candidate !== '') {
            $configuredVersion = mb_substr($candidate, 0, 40);
        }
    }

    $backfill = $db->prepare(
        "UPDATE user_feedback
         SET platform_version = :platform_version
         WHERE parent_id IS NULL
           AND type = 'suggestion'
           AND public_rating IS NULL
           AND (platform_version IS NULL OR platform_version = '')"
    );
    $backfill->execute([':platform_version' => $configuredVersion]);
};
