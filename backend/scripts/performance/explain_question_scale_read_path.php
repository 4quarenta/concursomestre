<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';

function explainQuestionScaleQuery(PDO $db, string $name, string $sql, array $params): array
{
    $stmt = $db->prepare('EXPLAIN FORMAT=JSON ' . $sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->execute();
    $raw = $stmt->fetchColumn();
    $plan = is_string($raw) ? json_decode($raw, true) : null;
    return ['name' => $name, 'params' => $params, 'plan' => is_array($plan) ? $plan : $raw];
}

$db = (new Database())->getConnection();
$limit = max(1, min(51, (int) (getenv('PERF_LIST_LIMIT') ?: 21)));
$cursorAt = trim((string) (getenv('PERF_CURSOR_TIME') ?: gmdate('Y-m-d H:i:s')));
$cursorId = max(1, (int) (getenv('PERF_CURSOR_ID') ?: PHP_INT_MAX));
$filterName = trim((string) (getenv('PERF_FILTER_NAME') ?: 'IBFC'));
$keyword = trim((string) (getenv('PERF_SEARCH_KEYWORD') ?: '+direito* +constitucional*'));
$select = "SELECT q.id, q.enunciado_clean, q.tipo, q.dificuldade, q.prova_id,
                  q.publish_status, q.visibility_status, q.published_sort_at, q.has_image
           FROM questions q";
$where = "q.publish_status IN ('published', 'scheduled')
          AND q.visibility_status = 'public'
          AND q.published_sort_at IS NOT NULL
          AND q.published_sort_at <= NOW()";

$queries = [
    explainQuestionScaleQuery(
        $db,
        'public_first_page',
        $select . " WHERE {$where} ORDER BY q.published_sort_at DESC, q.id DESC LIMIT :limit",
        [':limit' => $limit]
    ),
    explainQuestionScaleQuery(
        $db,
        'public_deep_cursor',
        $select . " WHERE {$where}
                    AND (q.published_sort_at < :cursor_at
                         OR (q.published_sort_at = :cursor_at_equal AND q.id < :cursor_id))
                   ORDER BY q.published_sort_at DESC, q.id DESC LIMIT :limit",
        [
            ':cursor_at' => $cursorAt,
            ':cursor_at_equal' => $cursorAt,
            ':cursor_id' => $cursorId,
            ':limit' => $limit,
        ]
    ),
    explainQuestionScaleQuery(
        $db,
        'public_taxonomy_filter',
        $select . " WHERE {$where}
                    AND EXISTS (
                        SELECT 1 FROM question_filters qf
                        INNER JOIN filters f ON f.id = qf.filter_id
                        WHERE qf.question_id = q.id AND f.type = 'banca' AND f.name = :filter_name
                    )
                   ORDER BY q.published_sort_at DESC, q.id DESC LIMIT :limit",
        [':filter_name' => $filterName, ':limit' => $limit]
    ),
    explainQuestionScaleQuery(
        $db,
        'public_fulltext_search',
        $select . " WHERE {$where}
                    AND EXISTS (
                        SELECT 1 FROM question_search_documents qsd
                        WHERE qsd.question_id = q.id
                          AND MATCH(qsd.statement_text) AGAINST (:keyword IN BOOLEAN MODE)
                    )
                   ORDER BY q.published_sort_at DESC, q.id DESC LIMIT :limit",
        [':keyword' => $keyword, ':limit' => $limit]
    ),
];

$report = [
    'generatedAt' => gmdate(DATE_ATOM),
    'database' => (string) $db->query('SELECT DATABASE()')->fetchColumn(),
    'mysqlVersion' => (string) $db->query('SELECT VERSION()')->fetchColumn(),
    'queries' => $queries,
];
$json = json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if (!is_string($json)) {
    throw new RuntimeException('Nao foi possivel serializar o relatorio de EXPLAIN.');
}
$output = trim((string) (getenv('PERF_EXPLAIN_OUTPUT') ?: ''));
if ($output !== '') {
    $directory = dirname($output);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Nao foi possivel criar o diretorio do relatorio.');
    }
    file_put_contents($output, $json . PHP_EOL);
}
fwrite(STDOUT, $json . PHP_EOL);
