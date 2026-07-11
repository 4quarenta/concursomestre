<?php

declare(strict_types=1);

/**
 * Adds import idempotency constraints only after proving that existing rows do
 * not conflict. It fails closed rather than selecting a row to discard.
 */
return static function (PDO $db): void {
    $indexExists = static function (string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \'questions\' AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':index_name' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $duplicates = static function (string $columns) use ($db): int {
        $stmt = $db->query(
            'SELECT COUNT(*) FROM (
                SELECT ' . $columns . ', COUNT(*) AS duplicate_count
                FROM questions
                WHERE ' . str_replace(', ', ' IS NOT NULL AND ', $columns) . ' IS NOT NULL
                GROUP BY ' . $columns . '
                HAVING COUNT(*) > 1
            ) duplicates'
        );
        return (int) $stmt->fetchColumn();
    };

    if (!$indexExists('uq_questions_import_fingerprint')) {
        $count = $duplicates('import_fingerprint');
        if ($count > 0) {
            throw new RuntimeException('Nao foi possivel criar uq_questions_import_fingerprint: existem import_fingerprint duplicados. Corrija o relatorio antes de aplicar a migration.');
        }
        $db->exec('ALTER TABLE questions ADD UNIQUE KEY uq_questions_import_fingerprint (import_fingerprint)');
    }
    if (!$indexExists('uq_questions_source_exam_number')) {
        $count = $duplicates('source_exam_key, source_question_number');
        if ($count > 0) {
            throw new RuntimeException('Nao foi possivel criar uq_questions_source_exam_number: existem chaves de origem duplicadas. Corrija o relatorio antes de aplicar a migration.');
        }
        $db->exec('ALTER TABLE questions ADD UNIQUE KEY uq_questions_source_exam_number (source_exam_key, source_question_number)');
    }
};
