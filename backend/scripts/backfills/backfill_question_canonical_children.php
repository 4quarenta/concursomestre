<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/questions/services/LegacyQuestionCanonicalMapper.php';

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

$insertOption = $db->prepare(
    'INSERT INTO question_options
        (question_id, external_key, display_order, label, body, body_clean, is_correct, metadata_json)
     VALUES
        (:question_id, :external_key, :display_order, :label, :body, :body_clean, :is_correct, NULL)'
);
$insertEditorial = $db->prepare(
    'INSERT INTO question_editorials
        (question_id, editorial_type, title, body, status, generated_by, metadata_json)
     VALUES
        (:question_id, :editorial_type, NULL, :body, :status, :generated_by, NULL)
     ON DUPLICATE KEY UPDATE
        status = IF(TRIM(body) = \'\', VALUES(status), status),
        generated_by = IF(TRIM(body) = \'\', VALUES(generated_by), generated_by),
        body = IF(TRIM(body) = \'\', VALUES(body), body)'
);
$updateReadFlags = $db->prepare(
    'UPDATE questions
     SET has_teacher_comment = EXISTS(
            SELECT 1 FROM question_editorials qe
            WHERE qe.question_id = questions.id AND qe.editorial_type = \'teacher_comment\' AND TRIM(qe.body) <> \'\'
         ),
         has_detailed_comment = EXISTS(
            SELECT 1 FROM question_editorials qe
            WHERE qe.question_id = questions.id AND qe.editorial_type = \'detailed_analysis\' AND TRIM(qe.body) <> \'\'
         )
     WHERE id = :question_id'
);

$summary = [
    'mode' => $apply ? 'apply' : 'dry-run',
    'questionsScanned' => 0,
    'questionsWithCanonicalOptions' => 0,
    'questionsHydrated' => 0,
    'optionsCreated' => 0,
    'editorialsDiscovered' => 0,
    'editorialsUpserted' => 0,
    'lastQuestionId' => $afterId,
];

for ($batch = 0; $batch < $maxBatches; $batch++) {
    $stmt = $db->prepare(
        'SELECT q.id, q.data_json, q.resposta_correta_item_index,
                EXISTS(SELECT 1 FROM question_options qo WHERE qo.question_id = q.id) AS has_canonical_options
         FROM questions q
         WHERE q.id > :after_id
         ORDER BY q.id
         LIMIT :batch_size'
    );
    $stmt->bindValue(':after_id', $afterId, PDO::PARAM_INT);
    $stmt->bindValue(':batch_size', $batchSize, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if ($rows === []) {
        break;
    }

    if ($apply) {
        $db->beginTransaction();
    }
    try {
        foreach ($rows as $row) {
            $questionId = (int) $row['id'];
            $mapped = LegacyQuestionCanonicalMapper::map($row);
            $summary['questionsScanned']++;
            $summary['editorialsDiscovered'] += count($mapped['editorials']);

            if ((int) $row['has_canonical_options'] === 1) {
                $summary['questionsWithCanonicalOptions']++;
            } elseif ($mapped['options'] !== []) {
                if ($apply) {
                    foreach ($mapped['options'] as $option) {
                        $insertOption->execute([
                            ':question_id' => $questionId,
                            ':external_key' => $option['external_key'],
                            ':display_order' => $option['display_order'],
                            ':label' => $option['label'],
                            ':body' => $option['body'],
                            ':body_clean' => $option['body_clean'],
                            ':is_correct' => $option['is_correct'],
                        ]);
                        $summary['optionsCreated']++;
                    }
                } else {
                    $summary['optionsCreated'] += count($mapped['options']);
                }
                $summary['questionsHydrated']++;
            }

            foreach ($mapped['editorials'] as $editorial) {
                if ($apply) {
                    $insertEditorial->execute([
                        ':question_id' => $questionId,
                        ':editorial_type' => $editorial['editorial_type'],
                        ':body' => $editorial['body'],
                        ':status' => 'published',
                        ':generated_by' => 'legacy_backfill',
                    ]);
                }
                $summary['editorialsUpserted']++;
            }
            if ($apply) {
                $updateReadFlags->execute([':question_id' => $questionId]);
            }
            $afterId = $questionId;
            $summary['lastQuestionId'] = $questionId;
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

fwrite(STDOUT, json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL);
