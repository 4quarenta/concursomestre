<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';

$apply = filter_var(getenv('PERF_ALLOW_WRITE') ?: 'false', FILTER_VALIDATE_BOOLEAN) === true;
$target = max(1, min(3_000_000, (int) (getenv('PERF_QUESTION_COUNT') ?: 100_000)));
$batchSize = max(10, min(2000, (int) (getenv('PERF_BATCH_SIZE') ?: 500)));
$fixtureKey = trim((string) (getenv('PERF_FIXTURE_KEY') ?: 'perf-scale-v2'));
$db = (new Database())->getConnection();
$database = (string) $db->query('SELECT DATABASE()')->fetchColumn();
$isolated = preg_match('/(?:^|_)(perf|loadtest|benchmark)(?:_|$)/i', $database) === 1;
$summary = [
    'mode' => $apply ? 'apply' : 'dry-run',
    'database' => $database,
    'targetQuestions' => $target,
    'batchSize' => $batchSize,
    'fixtureKey' => $fixtureKey,
    'insertedQuestions' => 0,
    'insertedOptions' => 0,
];
if (!$apply) {
    fwrite(STDOUT, json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(0);
}
if (!$isolated) {
    throw new RuntimeException('PERF_ALLOW_WRITE exige banco isolado com perf, loadtest ou benchmark no nome.');
}

$existing = $db->prepare('SELECT COUNT(*) FROM questions WHERE source_exam_key = :fixture_key');
$existing->execute([':fixture_key' => $fixtureKey]);
if ((int) $existing->fetchColumn() > 0) {
    throw new RuntimeException('A fixture informada ja existe no banco isolado.');
}
$insertQuestion = $db->prepare(
    "INSERT INTO questions
        (enunciado, enunciado_clean, intro_text, reference_text, tipo, dificuldade,
         resposta_correta_item_index, data_json, anulada, desatualizada,
         publish_status, visibility_status, published_at, published_sort_at,
         has_image, has_teacher_comment, has_detailed_comment,
         source_exam_key, source_question_number, created_at, updated_at)
     VALUES
        (:statement, :statement, '', '', :question_type, :difficulty,
         0, :data_json, 0, 0,
         'published', 'public', :published_at, :published_at,
         0, 0, 0,
         :fixture_key, :question_number, :published_at, :published_at)"
);
$questionTypeDefinition = (string) $db->query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'tipo'"
)->fetchColumn();
$questionType = 'multipla escolha';
if (preg_match_all("/'([^']*)'/", $questionTypeDefinition, $matches) > 0) {
    $allowedTypes = $matches[1];
    $questionType = (string) (array_values(array_filter(
        $allowedTypes,
        static fn (string $value): bool => str_contains(strtolower($value), 'multipla')
    ))[0] ?? $allowedTypes[0] ?? $questionType);
}
$insertOption = $db->prepare(
    'INSERT INTO question_options
        (question_id, external_key, display_order, label, body, body_clean, is_correct, metadata_json)
     VALUES
        (:question_id, :external_key, :display_order, :label, :body, :body, :is_correct, NULL)'
);
$insertSearch = $db->prepare(
    'INSERT INTO question_search_documents (question_id, statement_text, updated_at)
     VALUES (:question_id, :statement, NOW())'
);
$labels = ['A', 'B', 'C', 'D', 'E'];
$startedAt = microtime(true);
for ($offset = 0; $offset < $target; $offset += $batchSize) {
    $size = min($batchSize, $target - $offset);
    $db->beginTransaction();
    try {
        for ($index = 1; $index <= $size; $index++) {
            $number = $offset + $index;
            $publishedAt = gmdate('Y-m-d H:i:s', strtotime('2026-01-01 UTC') + $number);
            $statement = "Questao sintetica {$number} para teste de desempenho e paginacao por cursor.";
            $snapshot = json_encode(['fixture' => true], JSON_UNESCAPED_SLASHES);
            $insertQuestion->execute([
                ':statement' => $statement,
                ':question_type' => $questionType,
                ':difficulty' => ($number % 5) + 1,
                ':data_json' => $snapshot,
                ':published_at' => $publishedAt,
                ':fixture_key' => $fixtureKey,
                ':question_number' => (string) $number,
            ]);
            $questionId = (int) $db->lastInsertId();
            $summary['insertedQuestions']++;
            foreach ($labels as $optionIndex => $label) {
                $insertOption->execute([
                    ':question_id' => $questionId,
                    ':external_key' => 'q_' . $number . '_alt_' . strtolower($label),
                    ':display_order' => $optionIndex + 1,
                    ':label' => $label,
                    ':body' => "Alternativa {$label} da questao {$number}",
                    ':is_correct' => $optionIndex === 0 ? 1 : 0,
                ]);
                $summary['insertedOptions']++;
            }
            $insertSearch->execute([':question_id' => $questionId, ':statement' => $statement]);
        }
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
    fwrite(STDERR, sprintf("fixture progress: %d/%d\n", $summary['insertedQuestions'], $target));
}
$summary['elapsedSeconds'] = round(microtime(true) - $startedAt, 3);
fwrite(STDOUT, json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
