<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../modules/questions/repositories/QuestionCanonicalRepository.php';

function optionIdentityAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$db = (new Database())->getConnection();
$questionId = (int) $db->query(
    'SELECT question_id
     FROM question_options
     GROUP BY question_id
     HAVING COUNT(*) >= 3
     ORDER BY question_id
     LIMIT 1'
)->fetchColumn();

$db->beginTransaction();
try {
    if ($questionId < 1) {
        $questionId = (int) $db->query('SELECT COALESCE(MAX(question_id), 0) + 1000 FROM question_options')->fetchColumn();
        $seed = $db->prepare(
            'INSERT INTO question_options
                (question_id, external_key, display_order, label, body, body_clean, is_correct, metadata_json)
             VALUES
                (:question_id, :external_key, :display_order, :label, :body, :body, 0, NULL)'
        );
        foreach (['A', 'B', 'C'] as $index => $label) {
            $seed->execute([
                ':question_id' => $questionId,
                ':external_key' => 'seed_' . strtolower($label),
                ':display_order' => $index + 1,
                ':label' => $label,
                ':body' => 'Alternativa ' . $label,
            ]);
        }
    }
    $rows = $db->query(
        'SELECT id, display_order
         FROM question_options
         WHERE question_id = ' . $questionId . '
         ORDER BY display_order, id
         LIMIT 3'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    optionIdentityAssert(count($rows) === 3, 'Nao foi possivel preparar as alternativas do teste.');

    $keys = ['stable_a', 'stable_b', 'stable_c'];
    $setKey = $db->prepare(
        'UPDATE question_options SET external_key = :external_key WHERE id = :id'
    );
    $originalIds = [];
    foreach ($rows as $index => $row) {
        $setKey->execute([':external_key' => $keys[$index], ':id' => (int) $row['id']]);
        $originalIds[$keys[$index]] = (int) $row['id'];
    }

    $repository = new QuestionCanonicalRepository($db);
    $payload = [
        'alternatives' => [
            ['tempId' => 'stable_c', 'order' => 1, 'label' => 'A', 'text' => 'C movida'],
            ['tempId' => 'stable_a', 'order' => 2, 'label' => 'B', 'text' => 'A movida'],
            ['tempId' => 'stable_b', 'order' => 3, 'label' => 'C', 'text' => 'B movida'],
        ],
        'answer' => ['raw' => 'B', 'correctAlternativeTempIds' => ['stable_a']],
        'assets' => [],
        'editorial' => [],
    ];
    $repository->replaceQuestionAggregate($questionId, $payload);

    $after = $db->query(
        'SELECT id, external_key, display_order
         FROM question_options
         WHERE question_id = ' . $questionId
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $afterByKey = [];
    foreach ($after as $row) {
        $afterByKey[(string) $row['external_key']] = $row;
    }
    foreach ($originalIds as $key => $id) {
        optionIdentityAssert((int) ($afterByKey[$key]['id'] ?? 0) === $id, 'O ID da alternativa ' . $key . ' foi alterado.');
    }
    optionIdentityAssert((int) $afterByKey['stable_c']['display_order'] === 1, 'A reordenacao da alternativa nao foi persistida.');

    $payload['alternatives'] = [
        ['tempId' => 'stable_c', 'order' => 1, 'label' => 'A', 'text' => 'C mantida'],
        ['tempId' => 'stable_a', 'order' => 2, 'label' => 'B', 'text' => 'A mantida'],
        ['tempId' => 'stable_new', 'order' => 3, 'label' => 'C', 'text' => 'Nova alternativa'],
    ];
    $repository->replaceQuestionAggregate($questionId, $payload);
    $final = $db->query(
        'SELECT id, external_key
         FROM question_options
         WHERE question_id = ' . $questionId
    )->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
    $finalByKey = array_flip(array_map('strval', $final));
    optionIdentityAssert(isset($finalByKey['stable_a'], $finalByKey['stable_c'], $finalByKey['stable_new']), 'O conjunto final de alternativas esta incorreto.');
    optionIdentityAssert(!isset($finalByKey['stable_b']), 'Alternativa removida permaneceu no agregado.');

    $db->rollBack();
    fwrite(STDOUT, "QuestionCanonicalOptionIdentityIntegrationTest: PASS\n");
} catch (Throwable $error) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    fwrite(STDERR, 'QuestionCanonicalOptionIdentityIntegrationTest: FAIL - ' . $error->getMessage() . "\n");
    exit(1);
}
