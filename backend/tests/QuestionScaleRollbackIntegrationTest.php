<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

function rollbackAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function rollbackSchemaCount(PDO $db, string $kind, string $table, ?string $name = null): int
{
    $definitions = [
        'table' => ['information_schema.TABLES', 'TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name', null],
        'column' => ['information_schema.COLUMNS', 'TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :name', 'name'],
    ];
    [$source, $where, $nameParameter] = $definitions[$kind];
    $stmt = $db->prepare("SELECT COUNT(*) FROM {$source} WHERE {$where}");
    $params = [':table_name' => $table];
    if ($nameParameter !== null) {
        $params[':name'] = $name;
    }
    $stmt->execute($params);
    return (int) $stmt->fetchColumn();
}

try {
    $db = (new Database())->getConnection();
    $questionsBefore = (int) $db->query('SELECT COUNT(*) FROM questions')->fetchColumn();
    $optionsBefore = (int) $db->query('SELECT COUNT(*) FROM question_options')->fetchColumn();
    $typeBefore = (string) $db->query(
        "SELECT COLUMN_TYPE FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'filters' AND COLUMN_NAME = 'type'"
    )->fetchColumn();
    $sql = (string) file_get_contents(__DIR__ . '/../database/rollbacks/20260717_010000_question_scale_foundation.sql');
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
        $db->exec($statement);
    }

    foreach (['question_answer_idempotency', 'question_search_documents', 'filter_aliases', 'filter_types'] as $table) {
        rollbackAssert(rollbackSchemaCount($db, 'table', $table) === 0, 'Rollback manteve a tabela ' . $table);
    }
    foreach ([
        ['questions', 'published_sort_at'],
        ['questions', 'has_image'],
        ['questions', 'has_teacher_comment'],
        ['questions', 'has_detailed_comment'],
        ['filters', 'asset_url'],
        ['filters', 'icon_key'],
        ['filters', 'keywords_json'],
        ['user_answers', 'selected_option_id'],
    ] as [$table, $column]) {
        rollbackAssert(rollbackSchemaCount($db, 'column', $table, $column) === 0, "Rollback manteve {$table}.{$column}");
    }
    $typeAfter = (string) $db->query(
        "SELECT COLUMN_TYPE FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'filters' AND COLUMN_NAME = 'type'"
    )->fetchColumn();
    rollbackAssert($typeAfter === $typeBefore, 'Rollback alterou o enum legado de filters.type.');
    rollbackAssert((int) $db->query('SELECT COUNT(*) FROM questions')->fetchColumn() === $questionsBefore, 'Rollback alterou questoes.');
    rollbackAssert((int) $db->query('SELECT COUNT(*) FROM question_options')->fetchColumn() === $optionsBefore, 'Rollback alterou alternativas canonicas.');

    fwrite(STDOUT, json_encode([
        'test' => 'QuestionScaleRollbackIntegrationTest',
        'status' => 'PASS',
        'questionsPreserved' => $questionsBefore,
        'optionsPreserved' => $optionsBefore,
        'filterTypePreserved' => $typeAfter,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
} catch (Throwable $error) {
    fwrite(STDERR, json_encode([
        'test' => 'QuestionScaleRollbackIntegrationTest',
        'status' => 'FAIL',
        'message' => $error->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
}
