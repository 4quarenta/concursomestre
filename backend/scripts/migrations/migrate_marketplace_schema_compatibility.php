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

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/payment_provider.php';
require_once __DIR__ . '/../../config/gamification_helper.php';

$db = (new Database())->getConnection();

function marketplaceMigrationColumnInfo(PDO $db, string $table, string $column): ?array
{
    $stmt = $db->prepare("
        SELECT COLUMN_TYPE, EXTRA
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :table
          AND COLUMN_NAME = :column
        LIMIT 1
    ");
    $stmt->execute([
        ':table' => $table,
        ':column' => $column,
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function marketplaceMigrationTableCount(PDO $db, string $table): int
{
    $stmt = $db->query("SELECT COUNT(*) FROM {$table}");
    return (int) $stmt->fetchColumn();
}

try {
    ensurePaymentProviderSchema($db);
    ensureGamificationSupportSchema($db);

    $db->exec("
        CREATE TABLE IF NOT EXISTS material_ratings (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            material_id VARCHAR(64) NOT NULL,
            rating DECIMAL(3,1) NOT NULL,
            created_at DATETIME NOT NULL,
            UNIQUE KEY uniq_material_ratings_user_material (user_id, material_id),
            INDEX idx_material_ratings_material (material_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $db->exec('ALTER TABLE material_ratings MODIFY user_id VARCHAR(64) NOT NULL');
    $db->exec('ALTER TABLE material_ratings MODIFY material_id VARCHAR(64) NOT NULL');

    $transactionIdInfo = marketplaceMigrationColumnInfo($db, 'transactions', 'id');
    $transactionCount = marketplaceMigrationTableCount($db, 'transactions');
    $idExtra = strtolower((string) ($transactionIdInfo['EXTRA'] ?? ''));
    $idType = strtolower((string) ($transactionIdInfo['COLUMN_TYPE'] ?? ''));

    if ($transactionIdInfo && strpos($idExtra, 'auto_increment') === false) {
        if ($transactionCount === 0) {
            $db->exec('ALTER TABLE transactions MODIFY id INT AUTO_INCREMENT');
            echo "transactions.id convertido para INT AUTO_INCREMENT em tabela vazia.\n";
        } else {
            echo "ATENCAO: transactions.id esta como {$idType} sem AUTO_INCREMENT e a tabela possui {$transactionCount} linhas. Revise manualmente antes do go-live.\n";
        }
    }

    echo "Compatibilidade de marketplace/transacoes verificada.\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'Falha na migracao de compatibilidade do marketplace: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
