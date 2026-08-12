<?php

declare(strict_types=1);

/**
 * Vincula contextos de questoes a uma prova canonica.
 *
 * Contextos compartilhados pertencem ao caderno/prova que originou as
 * questoes. A coluna permanece nula apenas para registros historicos cuja
 * prova nao pode ser deduzida com seguranca; novas gravacoes sao bloqueadas
 * pelo servico quando nao houver prova valida.
 *
 * Rollback: backend/database/rollbacks/20260808_160000_question_context_exam_ownership.sql
 */
return static function (PDO $db): void {
    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':table_name' => $table, ':index_name' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $foreignKeyExists = static function (string $table, string $key) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS '
            . "WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = :table_name "
            . "AND CONSTRAINT_NAME = :constraint_name AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
        );
        $stmt->execute([':table_name' => $table, ':constraint_name' => $key]);
        return (int) $stmt->fetchColumn() > 0;
    };

    foreach (['question_contexts', 'questions_groups'] as $table) {
        if (!$columnExists($table, 'prova_id')) {
            $after = $table === 'question_contexts' ? 'source_page' : 'assets_json';
            $db->exec('ALTER TABLE `' . $table . '` ADD COLUMN prova_id INT NULL AFTER ' . $after);
        }
        if (!$indexExists($table, 'idx_' . $table . '_prova')) {
            $db->exec('CREATE INDEX `idx_' . $table . '_prova` ON `' . $table . '` (prova_id)');
        }
    }

    // So preenche quando todas as questoes vinculadas apontam para a mesma
    // prova. Contextos ambiguos permanecem pendentes para revisao manual.
    $db->exec(
        'UPDATE question_contexts c '
        . 'INNER JOIN ( '
        . '  SELECT cq.context_id, MIN(q.prova_id) AS prova_id '
        . '  FROM question_context_questions cq '
        . '  INNER JOIN questions q ON q.id = cq.question_id '
        . '  WHERE q.prova_id IS NOT NULL '
        . '  GROUP BY cq.context_id '
        . '  HAVING COUNT(DISTINCT q.prova_id) = 1 '
        . ') linked ON linked.context_id = c.id '
        . 'SET c.prova_id = linked.prova_id '
        . 'WHERE c.prova_id IS NULL'
    );
    $db->exec(
        'UPDATE questions_groups g '
        . 'INNER JOIN ( '
        . '  SELECT q.grupo_questao_id AS group_id, MIN(q.prova_id) AS prova_id '
        . '  FROM questions q '
        . '  WHERE q.grupo_questao_id IS NOT NULL AND q.prova_id IS NOT NULL '
        . '  GROUP BY q.grupo_questao_id '
        . '  HAVING COUNT(DISTINCT q.prova_id) = 1 '
        . ') linked ON linked.group_id = g.id '
        . 'SET g.prova_id = linked.prova_id '
        . 'WHERE g.prova_id IS NULL'
    );
    // Contextos canonicos originalmente espelhados de grupos legados tambem
    // aproveitam o vinculo seguro que acabou de ser deduzido acima.
    $db->exec(
        "UPDATE question_contexts c "
        . "INNER JOIN questions_groups g ON c.external_key = CONCAT('legacy_group_', g.id) "
        . 'SET c.prova_id = g.prova_id '
        . 'WHERE c.prova_id IS NULL AND g.prova_id IS NOT NULL'
    );

    if (!$foreignKeyExists('question_contexts', 'fk_question_contexts_prova')) {
        $db->exec(
            'ALTER TABLE question_contexts ADD CONSTRAINT fk_question_contexts_prova '
            . 'FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE RESTRICT'
        );
    }
    if (!$foreignKeyExists('questions_groups', 'fk_question_groups_prova')) {
        $db->exec(
            'ALTER TABLE questions_groups ADD CONSTRAINT fk_question_groups_prova '
            . 'FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE RESTRICT'
        );
    }
};
