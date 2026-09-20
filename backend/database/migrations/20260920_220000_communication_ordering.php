<?php

declare(strict_types=1);

/** Aditiva: registra a identidade de transicao sem reescrever historico. */
return static function (PDO $db): void {
    $columns = [
        'ordering_key' => 'VARCHAR(191) NULL',
        'source_revision' => 'BIGINT NULL',
        'source_transition_id' => 'VARCHAR(191) NULL',
        'source_state' => 'VARCHAR(64) NULL',
    ];

    foreach ($columns as $column => $definition) {
        $check = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = "communication_intents" AND column_name = :column'
        );
        $check->execute([':column' => $column]);
        if ((int) $check->fetchColumn() === 0) {
            $db->exec("ALTER TABLE communication_intents ADD COLUMN {$column} {$definition}");
        }
    }

    $indexCheck = $db->query(
        'SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = "communication_intents" AND index_name = "idx_communication_intent_ordering"'
    );
    if ((int) $indexCheck->fetchColumn() === 0) {
        $db->exec('CREATE INDEX idx_communication_intent_ordering ON communication_intents (ordering_key, source_revision, created_at)');
    }

    $uniqueCheck = $db->query(
        'SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = "communication_intents" AND index_name = "uq_communication_ordering_transition"'
    );
    if ((int) $uniqueCheck->fetchColumn() === 0) {
        $db->exec('CREATE UNIQUE INDEX uq_communication_ordering_transition ON communication_intents (ordering_key, source_revision, source_transition_id)');
    }
};
