<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';

$queries = [
    'practice_filters' => "SELECT q.id FROM questions q JOIN question_filters qf ON qf.question_id = q.id WHERE q.publish_status = 'published' AND qf.filter_id = 0 ORDER BY q.id DESC LIMIT 50",
    'admin_questions' => "SELECT q.id FROM questions q ORDER BY q.updated_at DESC LIMIT 50",
    'question_statistics' => "SELECT question_id, COUNT(*) FROM user_answers WHERE question_id = 0 GROUP BY question_id",
    'financial_dashboard' => "SELECT status, COUNT(*) FROM transactions GROUP BY status",
    'notifications' => "SELECT id FROM notifications WHERE user_id = '' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50",
    'legal_commentary' => "SELECT id FROM law_articles WHERE law_id = 0 ORDER BY article_number LIMIT 100",
    'marketplace' => "SELECT id FROM materials WHERE status = 'published' ORDER BY created_at DESC LIMIT 50",
];

try {
    $db = (new Database())->getConnection();
    $result = [
        'generated_at' => gmdate(DATE_ATOM),
        'database' => (string) $db->query('SELECT DATABASE()')->fetchColumn(),
        'plans' => [],
    ];

    foreach ($queries as $name => $sql) {
        try {
            $result['plans'][$name] = $db->query('EXPLAIN ' . $sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Throwable $exception) {
            $result['plans'][$name] = [
                'status' => 'unavailable',
                'reason' => $exception->getMessage(),
            ];
        }
    }

    fwrite(STDOUT, json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
} catch (Throwable $exception) {
    fwrite(STDERR, 'EXPLAIN audit failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
