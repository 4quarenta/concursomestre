<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';

function collectExplainTables(mixed $node, array &$tables, bool &$usesFilesort): void
{
    if (!is_array($node)) {
        return;
    }
    if (($node['using_filesort'] ?? false) === true) {
        $usesFilesort = true;
    }
    if (isset($node['table_name'])) {
        $tables[] = [
            'table' => (string) $node['table_name'],
            'accessType' => (string) ($node['access_type'] ?? ''),
            'key' => $node['key'] ?? null,
            'rowsExaminedPerScan' => isset($node['rows_examined_per_scan']) ? (int) $node['rows_examined_per_scan'] : null,
            'rowsProducedPerJoin' => isset($node['rows_produced_per_join']) ? (int) $node['rows_produced_per_join'] : null,
        ];
    }
    foreach ($node as $child) {
        collectExplainTables($child, $tables, $usesFilesort);
    }
}

function explainQuery(PDO $db, string $name, string $sql, array $bindings = []): array
{
    $stmt = $db->prepare('EXPLAIN FORMAT=JSON ' . $sql);
    $stmt->execute($bindings);
    $decoded = json_decode((string) $stmt->fetchColumn(), true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Plano invalido para ' . $name);
    }
    $tables = [];
    $usesFilesort = false;
    collectExplainTables($decoded, $tables, $usesFilesort);
    return [
        'name' => $name,
        'tables' => $tables,
        'usesFilesort' => $usesFilesort,
        'planHash' => hash('sha256', json_encode($decoded, JSON_UNESCAPED_SLASHES) ?: ''),
    ];
}

$db = (new Database())->getConnection();
$cursor = $db->query(
    "SELECT published_sort_at, id FROM questions
     WHERE publish_status = 'published' AND visibility_status = 'public' AND published_sort_at IS NOT NULL
     ORDER BY published_sort_at DESC, id DESC LIMIT 1 OFFSET 100"
)->fetch(PDO::FETCH_ASSOC) ?: ['published_sort_at' => date('Y-m-d H:i:s'), 'id' => PHP_INT_MAX];
$filterId = (int) ($db->query('SELECT MIN(filter_id) FROM question_filters')->fetchColumn() ?: 0);

$plans = [];
$plans[] = explainQuery(
    $db,
    'public_first_page',
    "SELECT id, enunciado_clean, tipo, dificuldade, published_sort_at, has_image
     FROM questions
     WHERE publish_status = 'published' AND visibility_status = 'public'
       AND published_sort_at IS NOT NULL AND published_sort_at <= NOW()
     ORDER BY published_sort_at DESC, id DESC LIMIT 51"
);
$plans[] = explainQuery(
    $db,
    'public_next_cursor',
    "SELECT id, enunciado_clean, tipo, dificuldade, published_sort_at, has_image
     FROM questions
     WHERE publish_status = 'published' AND visibility_status = 'public'
       AND published_sort_at IS NOT NULL AND published_sort_at <= NOW()
       AND (published_sort_at < :published_at OR (published_sort_at = :published_at_equal AND id < :id))
     ORDER BY published_sort_at DESC, id DESC LIMIT 51",
    [
        ':published_at' => $cursor['published_sort_at'],
        ':published_at_equal' => $cursor['published_sort_at'],
        ':id' => (int) $cursor['id'],
    ]
);
$plans[] = explainQuery(
    $db,
    'fulltext_search',
    "SELECT q.id
     FROM question_search_documents qsd
     INNER JOIN questions q ON q.id = qsd.question_id
     WHERE MATCH(qsd.statement_text) AGAINST ('+questao*' IN BOOLEAN MODE)
       AND q.publish_status = 'published' AND q.visibility_status = 'public'
     LIMIT 51"
);
if ($filterId > 0) {
    $plans[] = explainQuery(
        $db,
        'filter_reverse_lookup',
        'SELECT q.id
         FROM questions q
         WHERE q.publish_status = \'published\' AND q.visibility_status = \'public\'
           AND q.published_sort_at IS NOT NULL AND q.published_sort_at <= NOW()
           AND EXISTS (
             SELECT 1 FROM question_filters qf
             WHERE qf.question_id = q.id AND qf.filter_id = :filter_id
           )
         ORDER BY q.published_sort_at DESC, q.id DESC LIMIT 51',
        [':filter_id' => $filterId]
    );
}

fwrite(STDOUT, json_encode([
    'database' => (string) $db->query('SELECT DATABASE()')->fetchColumn(),
    'questionCount' => (int) $db->query('SELECT COUNT(*) FROM questions')->fetchColumn(),
    'plans' => $plans,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
