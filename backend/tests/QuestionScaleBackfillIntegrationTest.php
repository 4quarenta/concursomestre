<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

function backfillAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function backfillFallbackValue(string $type): mixed
{
    $normalized = strtolower($type);
    if (str_starts_with($normalized, 'enum(') && preg_match("/^enum\\('([^']*)'/", $type, $match) === 1) {
        return $match[1];
    }
    if (str_contains($normalized, 'int') || str_contains($normalized, 'decimal') || str_contains($normalized, 'float')) {
        return 0;
    }
    if (str_contains($normalized, 'json')) {
        return '{}';
    }
    if (str_contains($normalized, 'date') || str_contains($normalized, 'time')) {
        return date('Y-m-d H:i:s');
    }
    return '';
}

function backfillInsertMinimal(PDO $db, string $table, array $overrides): int
{
    $columns = $db->query('SHOW COLUMNS FROM `' . $table . '`')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $payload = [];
    foreach ($columns as $column) {
        $name = (string) $column['Field'];
        if (array_key_exists($name, $overrides)) {
            $payload[$name] = $overrides[$name];
            continue;
        }
        if (str_contains(strtolower((string) ($column['Extra'] ?? '')), 'auto_increment')) {
            continue;
        }
        if (($column['Null'] ?? 'YES') === 'YES' || $column['Default'] !== null) {
            continue;
        }
        $payload[$name] = backfillFallbackValue((string) ($column['Type'] ?? ''));
    }
    $names = array_keys($payload);
    $placeholders = array_map(static fn (string $name): string => ':' . $name, $names);
    $stmt = $db->prepare(
        'INSERT INTO `' . $table . '` (`' . implode('`,`', $names) . '`)
         VALUES (' . implode(',', $placeholders) . ')'
    );
    foreach ($payload as $name => $value) {
        $stmt->bindValue(':' . $name, $value, $value === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
    }
    $stmt->execute();
    return (int) $db->lastInsertId();
}

function backfillRun(string $script): array
{
    $command = [
        PHP_BINARY,
        __DIR__ . '/../scripts/backfills/' . $script,
        '--apply',
        '--batch-size=25',
        '--after-id=0',
        '--max-batches=20',
    ];
    $pipes = [];
    $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, dirname(__DIR__));
    if (!is_resource($process)) {
        throw new RuntimeException('Nao foi possivel iniciar o backfill ' . $script);
    }
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $status = proc_close($process);
    backfillAssert($status === 0, $script . ' falhou: ' . trim((string) $stderr));
    $decoded = json_decode((string) $stdout, true);
    backfillAssert(is_array($decoded), $script . ' nao retornou resumo JSON.');
    return $decoded;
}

$db = (new Database())->getConnection();
$questionId = 0;
$answerId = 0;
$optionId = 0;
$userId = '00000000-0000-4000-8000-000000000001';
putenv('MIGRATIONS_ALLOW_APPLY=true');

try {
    $questionId = backfillInsertMinimal($db, 'questions', [
        'enunciado' => '<p>Questao sintetica com imagem <img src="test.png"></p>',
        'enunciado_clean' => 'Questao sintetica com imagem',
        'intro_text' => 'Texto de apoio sintetico',
        'reference_text' => 'Referencia sintetica',
        'dificuldade' => 2,
        'resposta_correta_item_index' => 0,
        'publish_status' => 'published',
        'visibility_status' => 'public',
        'published_at' => date('Y-m-d H:i:s'),
        'data_json' => json_encode([
            'teacherComment' => 'Comentario sintetico',
            'detailedComment' => 'Analise sintetica',
        ], JSON_UNESCAPED_UNICODE),
    ]);
    backfillAssert($questionId > 0, 'Questao sintetica nao foi criada.');

    $option = $db->prepare(
        'INSERT INTO question_options
            (question_id, external_key, display_order, label, body, body_clean, is_correct, metadata_json)
         VALUES (:question_id, :external_key, 1, \'A\', \'Alternativa A\', \'Alternativa A\', 1, NULL)'
    );
    $option->execute([':question_id' => $questionId, ':external_key' => 'backfill_test_a']);
    $optionId = (int) $db->lastInsertId();

    backfillInsertMinimal($db, 'users', [
        'id' => $userId,
        'name' => 'Usuario de integracao',
        'email' => 'question-scale-test@concursomestre.local',
        'password' => password_hash('integration-only', PASSWORD_DEFAULT),
    ]);
    $answerId = backfillInsertMinimal($db, 'user_answers', [
        'user_id' => $userId,
        'question_id' => $questionId,
        'selected_option_index' => 0,
        'selected_option_id' => null,
        'is_correct' => 1,
        'time_taken_seconds' => 10,
    ]);

    $readSummary = backfillRun('backfill_question_scale_read_model.php');
    $answerSummary = backfillRun('backfill_selected_option_ids.php');
    $question = $db->query(
        'SELECT published_sort_at, has_image, has_teacher_comment, has_detailed_comment
         FROM questions WHERE id = ' . $questionId
    )->fetch(PDO::FETCH_ASSOC);
    $selectedOptionId = (int) $db->query(
        'SELECT selected_option_id FROM user_answers WHERE id = ' . $answerId
    )->fetchColumn();
    $searchDocument = (int) $db->query(
        'SELECT COUNT(*) FROM question_search_documents WHERE question_id = ' . $questionId
    )->fetchColumn();

    backfillAssert(is_array($question) && $question['published_sort_at'] !== null, 'published_sort_at nao foi preenchido.');
    backfillAssert((int) $question['has_image'] === 1, 'has_image nao foi preenchido.');
    backfillAssert((int) $question['has_teacher_comment'] === 1, 'has_teacher_comment nao foi preenchido.');
    backfillAssert((int) $question['has_detailed_comment'] === 1, 'has_detailed_comment nao foi preenchido.');
    backfillAssert($selectedOptionId === $optionId, 'selected_option_id nao foi reconciliado.');
    backfillAssert($searchDocument === 1, 'Documento de busca nao foi criado.');
    backfillAssert((int) ($readSummary['questionsUpdated'] ?? 0) > 0, 'Backfill de leitura nao atualizou linhas.');
    backfillAssert((int) ($answerSummary['answersUpdated'] ?? 0) > 0, 'Backfill de respostas nao atualizou linhas.');

    fwrite(STDOUT, json_encode([
        'test' => 'QuestionScaleBackfillIntegrationTest',
        'status' => 'PASS',
        'questionBackfill' => $readSummary,
        'answerBackfill' => $answerSummary,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
} catch (Throwable $error) {
    fwrite(STDERR, json_encode([
        'test' => 'QuestionScaleBackfillIntegrationTest',
        'status' => 'FAIL',
        'message' => $error->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
} finally {
    if ($answerId > 0) {
        $db->exec('DELETE FROM user_answers WHERE id = ' . $answerId);
    }
    if ($questionId > 0) {
        $db->exec('DELETE FROM question_search_documents WHERE question_id = ' . $questionId);
        $db->exec('DELETE FROM question_options WHERE question_id = ' . $questionId);
        $db->exec('DELETE FROM questions WHERE id = ' . $questionId);
    }
    $deleteUser = $db->prepare('DELETE FROM users WHERE id = :user_id');
    $deleteUser->execute([':user_id' => $userId]);
}
