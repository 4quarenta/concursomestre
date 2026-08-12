<?php

declare(strict_types=1);

/**
 * Reconstroi as flags indexadas usadas pela listagem/pratica a partir das
 * fontes editoriais canônicas e do snapshot legado. A migration é somente
 * DML, idempotente e não altera nem remove conteúdo editorial.
 *
 * Rollback: backend/database/rollbacks/20260809_010000_question_editorial_filter_backfill.sql
 */
return static function (PDO $db): void {
    $tableExists = static function (string $table) use ($db): bool {
        $statement = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name'
        );
        $statement->execute([':table_name' => $table]);
        return (int) $statement->fetchColumn() > 0;
    };
    $columnExists = static function (string $table, string $column) use ($db): bool {
        $statement = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
        );
        $statement->execute([':table_name' => $table, ':column_name' => $column]);
        return (int) $statement->fetchColumn() > 0;
    };

    if (!$tableExists('questions') || !$tableExists('question_editorials')) {
        return;
    }
    foreach (['has_teacher_comment', 'has_detailed_comment', 'data_json'] as $column) {
        if (!$columnExists('questions', $column)) {
            return;
        }
    }

    $db->exec(
        "UPDATE questions q
         LEFT JOIN (
             SELECT question_id,
                    MAX(CASE WHEN editorial_type = 'teacher_comment' AND TRIM(COALESCE(body, '')) <> '' THEN 1 ELSE 0 END) AS teacher_present,
                    MAX(CASE WHEN editorial_type = 'detailed_analysis' AND TRIM(COALESCE(body, '')) <> '' THEN 1 ELSE 0 END) AS detailed_present
             FROM question_editorials
             GROUP BY question_id
         ) qe ON qe.question_id = q.id
         SET q.has_teacher_comment = CASE
                 WHEN COALESCE(qe.teacher_present, 0) = 1
                      OR TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(
                          CASE WHEN JSON_VALID(COALESCE(q.data_json, '')) THEN q.data_json ELSE '{}' END,
                          '$.teacherComment'
                      )), '')) <> ''
                      OR TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(
                          CASE WHEN JSON_VALID(COALESCE(q.data_json, '')) THEN q.data_json ELSE '{}' END,
                          '$.editorialComments.teacherComment'
                      )), '')) <> ''
                 THEN 1 ELSE 0 END,
             q.has_detailed_comment = CASE
                 WHEN COALESCE(qe.detailed_present, 0) = 1
                      OR TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(
                          CASE WHEN JSON_VALID(COALESCE(q.data_json, '')) THEN q.data_json ELSE '{}' END,
                          '$.detailedComment'
                      )), '')) <> ''
                      OR TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(
                          CASE WHEN JSON_VALID(COALESCE(q.data_json, '')) THEN q.data_json ELSE '{}' END,
                          '$.editorialComments.detailedComment'
                      )), '')) <> ''
                 THEN 1 ELSE 0 END"
    );
};
