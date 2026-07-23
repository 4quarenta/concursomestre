<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Esta ferramenta so pode ser executada via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';

$options = getopt('', ['status', 'dead-letters', 'requeue:', 'limit:']);
$actions = array_filter([
    isset($options['status']),
    isset($options['dead-letters']),
    isset($options['requeue']),
]);
if (count($actions) > 1) {
    fwrite(STDERR, "Escolha somente --status, --dead-letters ou --requeue=ID.\n");
    exit(2);
}

$limit = max(1, min(100, (int) ($options['limit'] ?? 25)));
$db = (new Database())->getConnection();

if (isset($options['requeue'])) {
    $eventId = filter_var($options['requeue'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($eventId === false) {
        fwrite(STDERR, "Informe um ID numerico positivo em --requeue.\n");
        exit(2);
    }
    $stmt = $db->prepare(
        "UPDATE platform_event_outbox
         SET status = 'pending', attempts = 0, available_at = NOW(),
             locked_at = NULL, locked_by = NULL, dead_lettered_at = NULL,
             last_error = NULL
         WHERE id = :id AND status = 'dead_letter'"
    );
    $stmt->execute([':id' => $eventId]);
    fwrite(STDOUT, json_encode([
        'action' => 'requeue',
        'eventId' => (int) $eventId,
        'requeued' => $stmt->rowCount() === 1,
    ], JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit($stmt->rowCount() === 1 ? 0 : 1);
}

if (isset($options['dead-letters'])) {
    $stmt = $db->query(
        "SELECT id, aggregate_type, aggregate_id, event_type, attempts,
                max_attempts, dead_lettered_at, LEFT(last_error, 1000) AS last_error
         FROM platform_event_outbox
         WHERE status = 'dead_letter'
         ORDER BY dead_lettered_at DESC, id DESC
         LIMIT {$limit}"
    );
    fwrite(STDOUT, json_encode([
        'action' => 'dead-letters',
        'items' => $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(0);
}

$rows = $db->query(
    "SELECT status, COUNT(*) AS total,
            MIN(created_at) AS oldest_created_at,
            MIN(available_at) AS next_available_at
     FROM platform_event_outbox
     GROUP BY status
     ORDER BY status"
)->fetchAll(PDO::FETCH_ASSOC) ?: [];
fwrite(STDOUT, json_encode([
    'action' => 'status',
    'queues' => $rows,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
