<?php

declare(strict_types=1);

putenv('QUESTIONS_SCALE_COLUMNS_READY=true');
$_ENV['QUESTIONS_SCALE_COLUMNS_READY'] = 'true';

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../modules/questions/repositories/QuestionsRepository.php';
require_once __DIR__ . '/../modules/questions/validators/QuestionsValidator.php';

function questionCursorAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$db = (new Database())->getConnection();
$db->beginTransaction();

try {
    $ids = array_map('intval', $db->query(
        'SELECT id FROM questions ORDER BY id LIMIT 5'
    )->fetchAll(PDO::FETCH_COLUMN) ?: []);
    if (count($ids) < 5) {
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
        $insert = $db->prepare(
            "INSERT INTO questions
                (enunciado, enunciado_clean, tipo, dificuldade, data_json,
                 resposta_correta_item_index, publish_status, visibility_status,
                 published_at, published_sort_at, created_at, updated_at)
             VALUES
                (:statement, :statement, :question_type, 2, '{}',
                 0, 'published', 'public', :published_at, :published_at, NOW(), NOW())"
        );
        while (count($ids) < 5) {
            $insert->execute([
                ':statement' => 'Questao sintetica de cursor ' . (count($ids) + 1),
                ':question_type' => $questionType,
                ':published_at' => '2026-07-17 12:00:00',
            ]);
            $ids[] = (int) $db->lastInsertId();
        }
    }
    questionCursorAssert(count($ids) === 5, 'Sao necessarias cinco questoes para validar o cursor.');

    $update = $db->prepare(
        "UPDATE questions
         SET publish_status = 'published',
             visibility_status = 'public',
             scheduled_at = NULL,
             published_at = :published_at,
             published_sort_at = :published_at
         WHERE id = :id"
    );
    foreach ($ids as $index => $id) {
        $publishedAt = $index < 3 ? '2026-07-17 12:00:00' : '2026-07-16 12:00:00';
        $update->execute([':published_at' => $publishedAt, ':id' => $id]);
    }

    $repository = new QuestionsRepository($db);
    $filters = ['questionIds' => $ids];
    $firstWithLookahead = $repository->listQuestionListRowsByCursor(4, null, $filters, null);
    questionCursorAssert(count($firstWithLookahead) === 4, 'Primeira pagina nao retornou limit + 1.');
    $first = array_slice($firstWithLookahead, 0, 3);
    $last = $first[array_key_last($first)];
    $cursor = [
        'publishedAt' => (string) $last['published_sort_at'],
        'id' => (string) $last['id'],
    ];
    $second = $repository->listQuestionListRowsByCursor(4, $cursor, $filters, null);

    $firstIds = array_map(static fn (array $row): int => (int) $row['id'], $first);
    $secondIds = array_map(static fn (array $row): int => (int) $row['id'], $second);
    questionCursorAssert(array_intersect($firstIds, $secondIds) === [], 'Ha questoes duplicadas entre as paginas.');
    questionCursorAssert(count(array_unique([...$firstIds, ...$secondIds])) === 5, 'O cursor nao cobriu todas as questoes esperadas.');
    questionCursorAssert(
        (string) $first[0]['published_sort_at'] === (string) $first[1]['published_sort_at'],
        'O cenario nao validou registros com o mesmo timestamp.'
    );

    $validator = new QuestionsValidator();
    questionCursorAssert($validator->validateListQueryV2(['limit' => 0])['limit'] === 1, 'Limite zero nao foi normalizado para 1.');
    questionCursorAssert($validator->validateListQueryV2(['limit' => 500])['limit'] === 50, 'Limite acima de 50 nao foi restringido.');

    $db->rollBack();
    fwrite(STDOUT, json_encode([
        'test' => 'QuestionCursorIntegrationTest',
        'status' => 'PASS',
        'firstPageIds' => $firstIds,
        'secondPageIds' => $secondIds,
        'sameTimestampCovered' => true,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
} catch (Throwable $error) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    fwrite(STDERR, json_encode([
        'test' => 'QuestionCursorIntegrationTest',
        'status' => 'FAIL',
        'message' => $error->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
}
