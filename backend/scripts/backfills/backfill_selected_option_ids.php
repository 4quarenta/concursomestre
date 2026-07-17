<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';

$options = getopt('', ['apply', 'batch-size::', 'after-id::', 'max-batches::']);
$apply = isset($options['apply']);
if ($apply && filter_var(getenv('MIGRATIONS_ALLOW_APPLY') ?: 'false', FILTER_VALIDATE_BOOLEAN) !== true) {
    fwrite(STDERR, "Defina MIGRATIONS_ALLOW_APPLY=true para executar o backfill.\n");
    exit(2);
}

$batchSize = max(25, min(1000, (int) ($options['batch-size'] ?? 250)));
$afterId = max(0, (int) ($options['after-id'] ?? 0));
$maxBatches = max(1, (int) ($options['max-batches'] ?? PHP_INT_MAX));
$db = (new Database())->getConnection();
$update = $db->prepare(
    'UPDATE user_answers
     SET selected_option_id = :selected_option_id
     WHERE id = :id AND selected_option_id IS NULL'
);
$summary = [
    'mode' => $apply ? 'apply' : 'dry-run',
    'answersScanned' => 0,
    'answersUpdated' => 0,
    'unmatchedAnswers' => 0,
    'lastAnswerId' => $afterId,
];

for ($batch = 0; $batch < $maxBatches; $batch++) {
    $stmt = $db->prepare(
        'SELECT ua.id, qo.id AS selected_option_id
         FROM user_answers ua
         LEFT JOIN question_options qo
           ON qo.question_id = ua.question_id
          AND qo.display_order = ua.selected_option_index + 1
         WHERE ua.id > :after_id
           AND ua.selected_option_id IS NULL
         ORDER BY ua.id
         LIMIT :batch_size'
    );
    $stmt->bindValue(':after_id', $afterId, PDO::PARAM_INT);
    $stmt->bindValue(':batch_size', $batchSize, PDO::PARAM_INT);
    $stmt->execute();
    $answers = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if ($answers === []) {
        break;
    }

    if ($apply) {
        $db->beginTransaction();
    }
    try {
        foreach ($answers as $answer) {
            $afterId = (int) $answer['id'];
            $selectedOptionId = is_numeric($answer['selected_option_id'] ?? null)
                ? (int) $answer['selected_option_id']
                : 0;
            $summary['answersScanned']++;
            $summary['lastAnswerId'] = $afterId;
            if ($selectedOptionId < 1) {
                $summary['unmatchedAnswers']++;
                continue;
            }
            if ($apply) {
                $update->execute([
                    ':selected_option_id' => $selectedOptionId,
                    ':id' => $afterId,
                ]);
                $summary['answersUpdated'] += $update->rowCount();
            }
        }
        if ($apply) {
            $db->commit();
        }
    } catch (Throwable $error) {
        if ($apply && $db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}

fwrite(STDOUT, json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
