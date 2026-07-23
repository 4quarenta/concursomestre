<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este backfill so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';

$batchSize = 500;
$startAfter = '';
foreach (array_slice($argv, 1) as $argument) {
    if (str_starts_with($argument, '--batch-size=')) {
        $batchSize = max(10, min(2000, (int) substr($argument, 13)));
    } elseif (str_starts_with($argument, '--after=')) {
        $startAfter = trim(substr($argument, 8));
    }
}

$db = (new Database())->getConnection();
$processed = 0;
$cursor = $startAfter;

while (true) {
    $users = $db->prepare(
        "SELECT id
         FROM users
         WHERE id > :cursor
         ORDER BY id
         LIMIT {$batchSize}"
    );
    $users->execute([':cursor' => $cursor]);
    $userIds = array_values(array_filter(array_map('strval', $users->fetchAll(PDO::FETCH_COLUMN) ?: [])));
    if ($userIds === []) {
        break;
    }

    $placeholders = implode(',', array_fill(0, count($userIds), '?'));
    $db->beginTransaction();
    try {
        $stmt = $db->prepare(
            "INSERT INTO user_answer_counters (
                user_id, total_answers, correct_answers, wrong_answers,
                first_answer_at, last_answer_at
             )
             SELECT user_id,
                    COUNT(*) AS total_answers,
                    SUM(is_correct = 1) AS correct_answers,
                    SUM(is_correct = 0) AS wrong_answers,
                    MIN(created_at) AS first_answer_at,
                    MAX(created_at) AS last_answer_at
             FROM (
                SELECT user_id, is_correct, created_at
                FROM user_answers
                WHERE user_id IN ({$placeholders})
                UNION ALL
                SELECT user_id, is_correct, created_at
                FROM user_answers_archive
                WHERE user_id IN ({$placeholders})
             ) answer_history
             GROUP BY user_id
             ON DUPLICATE KEY UPDATE
                total_answers = VALUES(total_answers),
                correct_answers = VALUES(correct_answers),
                wrong_answers = VALUES(wrong_answers),
                first_answer_at = VALUES(first_answer_at),
                last_answer_at = VALUES(last_answer_at)"
        );
        $stmt->execute([...$userIds, ...$userIds]);
        $db->commit();
    } catch (Throwable $exception) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $exception;
    }

    $processed += count($userIds);
    $cursor = $userIds[array_key_last($userIds)];
    fwrite(STDOUT, json_encode([
        'processedUsers' => $processed,
        'cursor' => $cursor,
    ], JSON_UNESCAPED_SLASHES) . PHP_EOL);
}

fwrite(STDOUT, json_encode([
    'status' => 'complete',
    'processedUsers' => $processed,
    'lastCursor' => $cursor,
], JSON_UNESCAPED_SLASHES) . PHP_EOL);
