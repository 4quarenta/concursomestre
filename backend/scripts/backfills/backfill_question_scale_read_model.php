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
$questionUpdate = $db->prepare(
    'UPDATE questions
     SET published_sort_at = :published_sort_at,
         has_image = :has_image,
         has_teacher_comment = :has_teacher_comment,
         has_detailed_comment = :has_detailed_comment
     WHERE id = :id'
);
$searchUpsert = $db->prepare(
    'INSERT INTO question_search_documents (question_id, statement_text, updated_at)
     VALUES (:question_id, :statement_text, NOW())
     ON DUPLICATE KEY UPDATE statement_text = VALUES(statement_text), updated_at = NOW()'
);

$summary = [
    'mode' => $apply ? 'apply' : 'dry-run',
    'questionsScanned' => 0,
    'questionsUpdated' => 0,
    'lastQuestionId' => $afterId,
];

for ($batch = 0; $batch < $maxBatches; $batch++) {
    $stmt = $db->prepare(
        'SELECT id, enunciado, enunciado_clean, intro_text, reference_text, data_json,
                publish_status, scheduled_at, published_at, created_at
         FROM questions
         WHERE id > :after_id
         ORDER BY id
         LIMIT :batch_size'
    );
    $stmt->bindValue(':after_id', $afterId, PDO::PARAM_INT);
    $stmt->bindValue(':batch_size', $batchSize, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if ($rows === []) {
        break;
    }

    $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $assetIds = [];
    $assetStmt = $db->prepare(
        "SELECT DISTINCT question_id FROM question_assets WHERE question_id IN ({$placeholders})"
    );
    $assetStmt->execute($ids);
    foreach ($assetStmt->fetchAll(PDO::FETCH_COLUMN) ?: [] as $id) {
        $assetIds[(int) $id] = true;
    }
    $editorials = [];
    $editorialStmt = $db->prepare(
        "SELECT question_id, editorial_type, MAX(CASE WHEN TRIM(body) <> '' THEN 1 ELSE 0 END) AS has_body
         FROM question_editorials
         WHERE question_id IN ({$placeholders})
           AND editorial_type IN ('teacher_comment', 'detailed_analysis')
         GROUP BY question_id, editorial_type"
    );
    $editorialStmt->execute($ids);
    foreach ($editorialStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $editorial) {
        $editorials[(int) $editorial['question_id']][(string) $editorial['editorial_type']] = (int) $editorial['has_body'] === 1;
    }

    if ($apply) {
        $db->beginTransaction();
    }
    try {
        foreach ($rows as $row) {
            $id = (int) $row['id'];
            $data = json_decode((string) ($row['data_json'] ?? ''), true);
            $data = is_array($data) ? $data : [];
            $legacyAssets = is_array($data['assets'] ?? null) ? $data['assets'] : [];
            $legacyImage = trim((string) ($data['imageUrl'] ?? $data['image_url'] ?? ''));
            $hasImage = isset($assetIds[$id])
                || $legacyAssets !== []
                || $legacyImage !== ''
                || stripos((string) ($row['enunciado'] ?? '') . (string) ($row['intro_text'] ?? ''), '<img') !== false;
            $teacher = trim((string) ($data['editorialComments']['teacherComment'] ?? $data['teacherComment'] ?? '')) !== ''
                || !empty($editorials[$id]['teacher_comment']);
            $detailed = trim((string) ($data['editorialComments']['detailedComment'] ?? $data['detailedComment'] ?? '')) !== ''
                || !empty($editorials[$id]['detailed_analysis']);
            $status = strtolower(trim((string) ($row['publish_status'] ?? 'draft')));
            $publishedSortAt = match ($status) {
                'published' => $row['published_at'] ?: $row['created_at'],
                'scheduled' => $row['scheduled_at'] ?: null,
                default => null,
            };
            $searchText = trim(strip_tags(implode("\n", array_filter([
                (string) ($row['enunciado_clean'] ?? $row['enunciado'] ?? ''),
                (string) ($row['intro_text'] ?? ''),
                (string) ($row['reference_text'] ?? ''),
            ]))));

            if ($apply) {
                $questionUpdate->execute([
                    ':published_sort_at' => $publishedSortAt,
                    ':has_image' => $hasImage ? 1 : 0,
                    ':has_teacher_comment' => $teacher ? 1 : 0,
                    ':has_detailed_comment' => $detailed ? 1 : 0,
                    ':id' => $id,
                ]);
                $searchUpsert->execute([
                    ':question_id' => $id,
                    ':statement_text' => $searchText,
                ]);
                $summary['questionsUpdated']++;
            }
            $summary['questionsScanned']++;
            $summary['lastQuestionId'] = $id;
            $afterId = $id;
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
