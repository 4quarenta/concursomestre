<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/questions/services/PrivateQuestionIngestionService.php';

function assertRecovery(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec(
    'CREATE TABLE private_ingestion_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        public_id TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        question_count INTEGER NOT NULL,
        question_keys_json TEXT NOT NULL,
        collection_pages_json TEXT NOT NULL,
        collection_years_json TEXT NOT NULL,
        UNIQUE(actor_user_id, idempotency_key)
    )'
);
$db->prepare(
    'INSERT INTO private_ingestion_batches
     (public_id, actor_user_id, idempotency_key, payload_hash, status, question_count,
      question_keys_json, collection_pages_json, collection_years_json)
     VALUES (:public_id, :actor, :key, :hash, :status, 1, :keys, :pages, :years)'
)->execute([
    ':public_id' => 'existing-batch',
    ':actor' => 'admin-1',
    ':key' => 'gran-page-46',
    ':hash' => str_repeat('a', 64),
    ':status' => 'pending',
    ':keys' => '[]',
    ':pages' => '[46]',
    ':years' => '[2001]',
]);

$service = new PrivateQuestionIngestionService($db);
$method = new ReflectionMethod($service, 'findOrCreateBatchWithConflictRecovery');
$method->setAccessible(true);
$args = [
    'admin-1',
    'gran-page-46',
    str_repeat('b', 64),
    1,
    ['question-source-46'],
    [46],
    [2001],
];

$first = $method->invokeArgs($service, $args);
assertRecovery($first['idempotencyKey'] !== 'gran-page-46', 'A colisao deve criar uma chave de recuperacao.');
assertRecovery($first['batch']['idempotentReplay'] === false, 'A primeira recuperacao deve criar um lote novo.');

$replay = $method->invokeArgs($service, $args);
assertRecovery($replay['idempotencyKey'] === $first['idempotencyKey'], 'A mesma submissao deve reutilizar a chave de recuperacao.');
assertRecovery($replay['batch']['idempotentReplay'] === true, 'A repeticao deve ser idempotente.');

$differentPayload = $args;
$differentPayload[2] = str_repeat('c', 64);
$separate = $method->invokeArgs($service, $differentPayload);
assertRecovery($separate['idempotencyKey'] !== $first['idempotencyKey'], 'Outro payload deve receber outra chave recuperada.');
assertRecovery($separate['batch']['idempotentReplay'] === false, 'Outro payload deve gerar outro lote sem sobrescrever o anterior.');

fwrite(STDOUT, "Private ingestion idempotency recovery assertions passed.\n");
