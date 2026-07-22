<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este diagnostico so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';

$options = getopt('', ['database::', 'summary']);
$databaseName = trim((string) ($options['database'] ?? ''));
if ($databaseName !== '') {
    if (!preg_match('/^concursomestre_scale_stage_[0-9]{8}(?:_[0-9]{4})?$/', $databaseName)) {
        fwrite(STDERR, "O override so aceita uma base temporaria de scale stage.\n");
        exit(2);
    }
    $host = getEnvString('DB_HOST', '127.0.0.1');
    $port = getEnvString('DB_PORT', '3306');
    $user = getEnvString('DB_USER');
    $password = getEnvString('DB_PASSWORD', getEnvString('DB_PASS'));
    $db = new PDO(
        "mysql:host={$host};port={$port};dbname={$databaseName};charset=utf8mb4",
        $user,
        $password,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} else {
    $db = (new Database())->getConnection();
}
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$firstValue = static function (string $sql, string $fallback = '') use ($db): string {
    try {
        $value = $db->query($sql)->fetchColumn();
        return $value === false || $value === null ? $fallback : (string) $value;
    } catch (Throwable) {
        return $fallback;
    }
};

$sampleUser = $firstValue('SELECT id FROM users ORDER BY id LIMIT 1', '00000000-0000-0000-0000-000000000000');
$sampleQuestion = $firstValue('SELECT id FROM questions ORDER BY id LIMIT 1', '0');
$sampleLaw = $firstValue('SELECT id FROM laws ORDER BY id LIMIT 1', '0');
$sampleArticle = $firstValue('SELECT id FROM law_articles ORDER BY id LIMIT 1', '0');

$queries = [
    'questions_public_keyset' => [
        'SELECT id, published_sort_at FROM questions '
        . "WHERE publish_status = 'published' AND visibility_status = 'public' "
        . 'ORDER BY published_sort_at DESC, id DESC LIMIT 51',
        [],
    ],
    'question_filter_reverse_lookup' => [
        'SELECT question_id FROM question_filters WHERE filter_id = :filter_id ORDER BY question_id DESC LIMIT 51',
        [':filter_id' => 1],
    ],
    'user_answers_history' => [
        'SELECT id, question_id, created_at FROM user_answers FORCE INDEX (idx_user_answers_history_keyset) '
        . 'WHERE user_id = :user_id ORDER BY created_at DESC, id DESC LIMIT 21',
        [':user_id' => $sampleUser],
    ],
    'comments_public_target' => [
        'SELECT id, user_id, content, created_at FROM comments '
        . "WHERE target_type = 'question' AND target_id = :target_id AND moderation_status = 'approved' "
        . 'ORDER BY created_at DESC, id DESC LIMIT 21',
        [':target_id' => $sampleQuestion],
    ],
    'notifications_visible' => [
        'SELECT id, title, created_at FROM notifications '
        . 'WHERE user_id = :user_id AND deleted_at IS NULL '
        . 'ORDER BY created_at DESC, id DESC LIMIT 11',
        [':user_id' => $sampleUser],
    ],
    'notifications_unread_count' => [
        'SELECT COUNT(*) FROM notifications '
        . 'WHERE user_id = :user_id AND is_read = 0 AND deleted_at IS NULL',
        [':user_id' => $sampleUser],
    ],
    'law_articles_reader' => [
        'SELECT id, article_number, sort_order FROM law_articles '
        . 'WHERE law_id = :law_id ORDER BY sort_order ASC, id ASC LIMIT 501',
        [':law_id' => $sampleLaw],
    ],
    'legal_comments_article' => [
        'SELECT id, user_id, body, created_at FROM legal_user_comments '
        . "WHERE law_article_id = :article_id AND status = 'active' AND moderation_status = 'approved' "
        . 'ORDER BY created_at DESC, id DESC LIMIT 21',
        [':article_id' => $sampleArticle],
    ],
    'legal_favorites_user' => [
        'SELECT id, target_type, target_id, created_at FROM legal_user_favorites '
        . 'WHERE user_id = :user_id ORDER BY created_at DESC, id DESC LIMIT 51',
        [':user_id' => $sampleUser],
    ],
    'study_sessions_user' => [
        'SELECT id, total_study_time, ended_at FROM study_sessions '
        . 'WHERE user_id = :user_id ORDER BY ended_at DESC, id DESC LIMIT 51',
        [':user_id' => $sampleUser],
    ],
    'saved_questions_user' => [
        'SELECT question_id, created_at FROM user_saved_questions '
        . 'WHERE user_id = :user_id ORDER BY created_at DESC, question_id DESC LIMIT 51',
        [':user_id' => $sampleUser],
    ],
    'transactions_user' => [
        'SELECT id, status, amount, created_at FROM transactions '
        . 'WHERE user_id = :user_id ORDER BY created_at DESC, id DESC LIMIT 51',
        [':user_id' => $sampleUser],
    ],
    'reports_moderation_queue' => [
        'SELECT id, priority, workflow_status, created_at FROM reports '
        . "WHERE workflow_status = 'pending' ORDER BY priority ASC, created_at ASC, id ASC LIMIT 51",
        [],
    ],
    'materials_public' => [
        'SELECT id, title, created_at FROM materials '
        . "WHERE status = 'approved' ORDER BY created_at DESC, id DESC LIMIT 51",
        [],
    ],
    'private_ingestion_available' => [
        'SELECT id, request_id FROM private_ingestion_jobs '
        . "WHERE status = 'pending' AND (available_at IS NULL OR available_at <= UTC_TIMESTAMP()) "
        . 'ORDER BY available_at ASC, id ASC LIMIT 1',
        [],
    ],
];

$results = [];
foreach ($queries as $name => [$sql, $params]) {
    try {
        $stmt = $db->prepare('EXPLAIN FORMAT=JSON ' . $sql);
        $stmt->execute($params);
        $rawPlan = (string) $stmt->fetchColumn();
        $plan = json_decode($rawPlan, true);
        $results[] = [
            'query' => $name,
            'status' => 'ok',
            'uses_full_scan' => str_contains($rawPlan, '"access_type": "ALL"'),
            'uses_filesort' => str_contains($rawPlan, '"using_filesort": true'),
            'plan' => is_array($plan) ? $plan : $rawPlan,
        ];
    } catch (Throwable $error) {
        $results[] = [
            'query' => $name,
            'status' => 'error',
            'message' => $error->getMessage(),
        ];
    }
}

$payload = [
    'generated_at' => gmdate(DATE_ATOM),
    'database' => (string) $db->query('SELECT DATABASE()')->fetchColumn(),
    'results' => $results,
];
if (isset($options['summary'])) {
    $payload['results'] = array_map(static fn (array $result): array => [
        'query' => $result['query'],
        'status' => $result['status'],
        'uses_full_scan' => $result['uses_full_scan'] ?? null,
        'uses_filesort' => $result['uses_filesort'] ?? null,
        'message' => $result['message'] ?? null,
    ], $results);
}
fwrite(STDOUT, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
