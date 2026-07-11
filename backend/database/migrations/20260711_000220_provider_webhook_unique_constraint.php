<?php

declare(strict_types=1);

return static function (PDO $db): void {
    $tableExists = (int) $db->query(
        "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'provider_webhook_events'"
    )->fetchColumn() > 0;
    if (!$tableExists) {
        return;
    }

    $indexExistsStmt = $db->prepare(
        "SELECT COUNT(*) FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'provider_webhook_events'
           AND INDEX_NAME = 'uq_provider_webhook_event'"
    );
    $indexExistsStmt->execute();
    if ((int) $indexExistsStmt->fetchColumn() > 0) {
        return;
    }

    $duplicates = $db->query(
        'SELECT provider, event_id, COUNT(*) AS duplicate_count
         FROM provider_webhook_events
         GROUP BY provider, event_id
         HAVING COUNT(*) > 1
         LIMIT 10'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if ($duplicates !== []) {
        throw new RuntimeException(
            'Nao foi criada a chave unica de webhook: existem eventos duplicados. Execute o diagnostico e trate os registros antes de reaplicar esta migration. Amostra: '
            . json_encode($duplicates, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );
    }

    $db->exec('CREATE UNIQUE INDEX uq_provider_webhook_event ON provider_webhook_events (provider, event_id)');
};
