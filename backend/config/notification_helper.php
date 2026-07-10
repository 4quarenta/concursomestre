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

// config/notification_helper.php
function notificationHelperReadSystemSetting(PDO $db, string $key, $fallback = null)
{
    try {
        $stmt = $db->prepare('SELECT value_json FROM system_settings WHERE key_name = :key LIMIT 1');
        $stmt->execute([':key' => $key]);
        $rawValue = $stmt->fetchColumn();

        if ($rawValue === false) {
            return $fallback;
        }

        $decoded = json_decode((string) $rawValue, true);
        return json_last_error() === JSON_ERROR_NONE ? $decoded : $rawValue;
    } catch (Throwable $e) {
        return $fallback;
    }
}

function notificationHelperBoolean($value, bool $fallback = true): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return (int) $value !== 0;
    }

    if (is_string($value)) {
        $normalized = strtolower(trim($value));
        if (in_array($normalized, ['1', 'true', 'yes', 'on'], true)) {
            return true;
        }
        if (in_array($normalized, ['0', 'false', 'no', 'off', ''], true)) {
            return false;
        }
    }

    return $fallback;
}

function resolveNotificationDeliveryRule(
    PDO $db,
    string $title = '',
    string $message = '',
    string $type = 'info',
    string $category = 'system',
    ?string $link = null,
    ?string $ruleKey = null
): array
{
    $delivery = [
        'enabled' => true,
        'title' => $title,
        'message' => $message,
        'type' => $type,
        'category' => $category,
        'link' => $link,
    ];

    $legacyEnabled = notificationHelperReadSystemSetting($db, 'notificationsEnabled', true);
    if (!notificationHelperBoolean($legacyEnabled, true)) {
        $delivery['enabled'] = false;
        return $delivery;
    }

    $settings = notificationHelperReadSystemSetting($db, 'notificationSettings', []);
    if (!is_array($settings)) {
        return $delivery;
    }

    if (!notificationHelperBoolean($settings['enabled'] ?? true, true)) {
        $delivery['enabled'] = false;
        return $delivery;
    }

    $rules = is_array($settings['rules'] ?? null) ? $settings['rules'] : [];
    $normalizedTitle = strtolower(trim($title));
    $normalizedRuleKey = strtolower(trim((string) $ruleKey));

    foreach ($rules as $rule) {
        if (!is_array($rule)) {
            continue;
        }

        $candidateKey = strtolower(trim((string) ($rule['key'] ?? '')));
        $candidateTitle = strtolower(trim((string) ($rule['title'] ?? '')));
        $matchesKey = $normalizedRuleKey !== '' && $candidateKey === $normalizedRuleKey;
        $matchesTitle = $normalizedRuleKey === '' && $candidateTitle !== '' && $candidateTitle === $normalizedTitle;

        if ($matchesKey || $matchesTitle) {
            $delivery['enabled'] = notificationHelperBoolean($rule['enabled'] ?? true, true);
            if (array_key_exists('title', $rule) && is_string($rule['title'])) {
                $delivery['title'] = $rule['title'];
            }
            if (array_key_exists('message', $rule) && is_string($rule['message'])) {
                $delivery['message'] = $rule['message'];
            }
            if (array_key_exists('type', $rule) && is_string($rule['type']) && trim($rule['type']) !== '') {
                $delivery['type'] = trim($rule['type']);
            }
            if (array_key_exists('link', $rule)) {
                $delivery['link'] = is_string($rule['link']) && trim($rule['link']) !== '' ? trim($rule['link']) : null;
            }

            return $delivery;
        }
    }

    return $delivery;
}

function isNotificationDeliveryEnabled(PDO $db, string $title = '', string $category = 'system', ?string $ruleKey = null): bool
{
    $delivery = resolveNotificationDeliveryRule($db, $title, '', 'info', $category, null, $ruleKey);
    return notificationHelperBoolean($delivery['enabled'] ?? true, true);
}
// Helper centralizado para criação de notificações no sistema

/**
 * Preserva o resumo real e acrescenta o valor confirmado mesmo quando uma
 * regra administrativa personaliza o texto-base da notificacao.
 *
 * @since 1.0.0
 */
function preserveFinancialNotificationMessage(
    string $originalMessage,
    string $configuredMessage,
    float $financialAmount,
    string $financialAmountLabel = 'Valor'
): string {
    $originalMessage = trim($originalMessage);
    $message = trim($configuredMessage);
    $normalizedAmount = max(0, round($financialAmount, 2));
    $amountText = 'R$ ' . number_format($normalizedAmount, 2, ',', '.');

    if (
        $originalMessage !== ''
        && $message !== $originalMessage
        && strpos($message, $originalMessage) === false
    ) {
        $message = rtrim($message, '. ') . '. ' . $originalMessage;
    }

    if (strpos($message, $amountText) === false) {
        $safeLabel = trim($financialAmountLabel) !== '' ? trim($financialAmountLabel) : 'Valor';
        $message = rtrim($message, '. ') . '. ' . $safeLabel . ': ' . $amountText . '.';
    }

    return trim($message);
}

/**
 * Cria uma notificação para um usuário.
 *
 * @param PDO    $db        Conexão com o banco de dados
 * @param string $userId    ID do usuário que receberá a notificação
 * @param string $title     Título curto da notificação
 * @param string $message   Mensagem descritiva
 * @param string $type      'info' | 'success' | 'warning' | 'error'
 * @param string $category  'system' | 'social' | 'marketplace' | 'report'
 * @param string|null $link URL interna para navegar ao clicar (ex: '/profile?tab=billing')
 * @return bool             true se inserido com sucesso
 */
function createNotification(
    PDO $db,
    string $userId,
    string $title,
    string $message,
    string $type = 'info',
    string $category = 'system',
    ?string $link = null,
    ?string $ruleKey = null,
    ?float $financialAmount = null,
    string $financialAmountLabel = 'Valor'
): bool {
    try {
        $originalMessage = trim($message);
        $delivery = resolveNotificationDeliveryRule($db, $title, $message, $type, $category, $link, $ruleKey);
        if (!notificationHelperBoolean($delivery['enabled'] ?? true, true)) {
            return false;
        }

        $title = (string) ($delivery['title'] ?? $title);
        $message = (string) ($delivery['message'] ?? $message);
        $type = (string) ($delivery['type'] ?? $type);
        $category = (string) ($delivery['category'] ?? $category);
        $link = array_key_exists('link', $delivery) ? ($delivery['link'] !== null ? (string) $delivery['link'] : null) : $link;

        if ($financialAmount !== null && is_finite($financialAmount)) {
            // Regras administrativas podem personalizar o texto, mas nunca devem
            // apagar o resumo real nem o valor confirmado da operacao financeira.
            $message = preserveFinancialNotificationMessage(
                $originalMessage,
                $message,
                $financialAmount,
                $financialAmountLabel
            );
        }

        ensureNotificationTableSupportsCurrentContract($db);
        $notifId = 'not-' . uniqid() . '-' . time();

        $stmt = $db->prepare(
            "INSERT INTO notifications (id, user_id, title, message, type, category, link, created_at)
             VALUES (:id, :user_id, :title, :message, :type, :category, :link, NOW())"
        );

        return $stmt->execute([
            ':id'       => $notifId,
            ':user_id'  => $userId,
            ':title'    => $title,
            ':message'  => $message,
            ':type'     => $type,
            ':category' => $category,
            ':link'     => $link,
        ]);
    } catch (Exception $e) {
        // Notificação não deve interromper o fluxo principal
        error_log('[notification_helper] Erro ao criar notificação: ' . $e->getMessage());
        return false;
    }
}

/**
 * Cria uma notificacao para todos os administradores ativos.
 *
 * @since 1.0.0
 */
function createAdminNotification(
    PDO $db,
    string $title,
    string $message,
    string $type = 'info',
    string $category = 'system',
    ?string $link = null,
    ?string $ruleKey = null,
    ?float $financialAmount = null,
    string $financialAmountLabel = 'Valor'
): int {
    try {
        ensureNotificationTableSupportsCurrentContract($db);

        $stmt = $db->query("
            SELECT id
            FROM users
            WHERE role = 'admin'
              AND COALESCE(status, 'active') NOT IN ('deleted', 'pending_deletion', 'banned', 'suspended')
        ");
        $adminIds = $stmt ? $stmt->fetchAll(PDO::FETCH_COLUMN) : [];
        $created = 0;

        foreach ($adminIds as $adminId) {
            if (createNotification(
                $db,
                (string) $adminId,
                $title,
                $message,
                $type,
                $category,
                $link,
                $ruleKey,
                $financialAmount,
                $financialAmountLabel
            )) {
                $created++;
            }
        }

        return $created;
    } catch (Exception $e) {
        error_log('[notification_helper] Erro ao notificar administradores: ' . $e->getMessage());
        return 0;
    }
}

/**
 * Cria uma notificacao para administradores com acesso ao financeiro.
 *
 * @since 1.0.0
 */
function createFinancialAdminNotification(
    PDO $db,
    string $title,
    string $message,
    string $type = 'info',
    string $category = 'finance',
    ?string $link = '/admin/finance/transactions',
    ?string $ruleKey = 'finance_transaction_created',
    ?float $financialAmount = null,
    string $financialAmountLabel = 'Valor recebido'
): int {
    try {
        ensureNotificationTableSupportsCurrentContract($db);

        $stmt = $db->query("
            SELECT id
            FROM users
            WHERE role = 'admin'
              AND COALESCE(status, 'active') NOT IN ('deleted', 'pending_deletion', 'banned', 'suspended')
        ");
        $adminIds = $stmt ? $stmt->fetchAll(PDO::FETCH_COLUMN) : [];
        $created = 0;

        foreach ($adminIds as $adminId) {
            if (notificationRecentlyExists(
                $db,
                (string) $adminId,
                $title,
                $message,
                $type,
                $category,
                $link
            )) {
                continue;
            }

            if (createNotification(
                $db,
                (string) $adminId,
                $title,
                $message,
                $type,
                $category,
                $link,
                $ruleKey,
                $financialAmount,
                $financialAmountLabel
            )) {
                $created++;
            }
        }

        return $created;
    } catch (Exception $e) {
        error_log('[notification_helper] Erro ao notificar financeiro: ' . $e->getMessage());
        return 0;
    }
}

/**
 * Evita spam operacional quando o mesmo evento financeiro chega repetido.
 *
 * @since 1.0.0
 */
function notificationRecentlyExists(
    PDO $db,
    string $userId,
    string $title,
    string $message,
    string $type,
    string $category,
    ?string $link = null
): bool {
    try {
        ensureNotificationTableSupportsCurrentContract($db);

        $stmt = $db->prepare(
            "SELECT 1
             FROM notifications
             WHERE user_id = :user_id
               AND title = :title
               AND message = :message
               AND type = :type
               AND category = :category
               AND COALESCE(link, '') = COALESCE(:link, '')
               AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
             LIMIT 1"
        );

        $stmt->execute([
            ':user_id' => $userId,
            ':title' => $title,
            ':message' => $message,
            ':type' => $type,
            ':category' => $category,
            ':link' => $link,
        ]);

        return (bool) $stmt->fetchColumn();
    } catch (Exception $e) {
        error_log('[notification_helper] Erro ao checar notificacao duplicada: ' . $e->getMessage());
        return false;
    }
}

/**
 * Mantem o helper compativel com bases criadas pelo schema antigo.
 *
 * @since 1.0.0
 */
function ensureNotificationTableSupportsCurrentContract(PDO $db): void
{
    $db->exec("
        CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            title VARCHAR(255) NULL,
            message TEXT NULL,
            type VARCHAR(20) NOT NULL DEFAULT 'info',
            category VARCHAR(40) NOT NULL DEFAULT 'system',
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            link VARCHAR(255) NULL,
            evidence_url VARCHAR(500) NULL,
            deleted_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_notifications_user_visible (user_id, deleted_at, created_at),
            INDEX idx_notifications_user_unread (user_id, is_read, deleted_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    ensureNotificationColumn($db, 'category', "ALTER TABLE notifications ADD COLUMN category VARCHAR(40) NOT NULL DEFAULT 'system' AFTER type");
    ensureNotificationColumn($db, 'is_read', "ALTER TABLE notifications ADD COLUMN is_read TINYINT(1) NOT NULL DEFAULT 0 AFTER type");
    ensureNotificationColumn($db, 'link', "ALTER TABLE notifications ADD COLUMN link VARCHAR(255) NULL AFTER is_read");
    ensureNotificationColumn($db, 'evidence_url', "ALTER TABLE notifications ADD COLUMN evidence_url VARCHAR(500) NULL AFTER link");
    ensureNotificationColumn($db, 'deleted_at', "ALTER TABLE notifications ADD COLUMN deleted_at DATETIME NULL AFTER evidence_url");
    ensureNotificationColumn($db, 'created_at', "ALTER TABLE notifications ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

    $stmt = $db->prepare("
        SELECT CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'notifications'
          AND COLUMN_NAME = 'id'
        LIMIT 1
    ");
    $stmt->execute();
    $length = (int) $stmt->fetchColumn();
    if ($length > 0 && $length < 64) {
        $db->exec('ALTER TABLE notifications MODIFY id VARCHAR(64) NOT NULL');
    }
}

function ensureNotificationColumn(PDO $db, string $column, string $alterSql): void
{
    $stmt = $db->prepare("
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'notifications'
          AND COLUMN_NAME = :column
    ");
    $stmt->execute([':column' => $column]);

    if ((int) $stmt->fetchColumn() === 0) {
        $db->exec($alterSql);
    }
}
?>
