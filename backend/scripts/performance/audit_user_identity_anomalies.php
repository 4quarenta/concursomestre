<?php

declare(strict_types=1);

/**
 * Auditoria somente leitura de identificadores de usuario invalidos/orfaos.
 * Valores brutos nunca sao emitidos; o fingerprint permite reconciliar grupos.
 */

$backendRoot = trim((string) getenv('BACKEND_ROOT')) ?: dirname(__DIR__, 2);
require_once rtrim($backendRoot, DIRECTORY_SEPARATOR) . '/config/database.php';

$db = (new Database())->getConnection();
$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

$result = [];
$stmt = $db->query(
    "SELECT
        LEFT(SHA2(COALESCE(t.user_id, ''), 256), 16) AS user_id_fingerprint,
        CHAR_LENGTH(COALESCE(t.user_id, '')) AS value_length,
        CASE
            WHEN t.user_id IS NULL OR TRIM(t.user_id) = '' THEN 'empty'
            WHEN t.user_id LIKE '%@%' THEN 'email_like'
            WHEN t.user_id REGEXP '^[0-9]+$' THEN 'numeric'
            ELSE 'other'
        END AS value_shape,
        COUNT(*) AS row_count,
        GROUP_CONCAT(DISTINCT COALESCE(t.type, '') ORDER BY t.type SEPARATOR ',') AS transaction_types,
        GROUP_CONCAT(DISTINCT COALESCE(t.status, '') ORDER BY t.status SEPARATOR ',') AS statuses,
        MIN(t.created_at) AS first_created_at,
        MAX(t.created_at) AS last_created_at
     FROM transactions t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.user_id IS NOT NULL
       AND TRIM(t.user_id) <> ''
       AND (
            t.user_id NOT REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
            OR u.id IS NULL
       )
     GROUP BY t.user_id
     ORDER BY first_created_at"
);
$result['transaction_user_anomalies'] = $stmt->fetchAll() ?: [];

foreach (['auth_sessions', 'email_verifications'] as $table) {
    $quoted = '`' . $table . '`';
    $stmt = $db->query(
        "SELECT COUNT(*) AS orphaned_rows, MIN(source_row.created_at) AS oldest_created_at,
                MAX(source_row.created_at) AS newest_created_at
         FROM {$quoted} source_row
         LEFT JOIN users u ON u.id COLLATE utf8mb4_unicode_ci = source_row.user_id COLLATE utf8mb4_unicode_ci
         WHERE source_row.user_id IS NOT NULL AND u.id IS NULL"
    );
    $result[$table . '_orphans'] = $stmt->fetch() ?: [];
}

fwrite(STDOUT, json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
