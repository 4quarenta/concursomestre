<?php

declare(strict_types=1);

function assertPrivateIngestion(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$root = dirname(__DIR__);
$service = (string) file_get_contents($root . '/modules/questions/services/PrivateQuestionIngestionService.php');
$client = (string) file_get_contents(dirname($root) . '/tools/local-question-crawler/ingest_client.py');

foreach ([
    'HTTP_X_QUESTION_INGEST_SIGNATURE',
    'HTTP_X_QUESTION_INGEST_TIMESTAMP',
    'HTTP_X_QUESTION_INGEST_NONCE',
    'HTTP_IDEMPOTENCY_KEY',
    'hash_hmac',
    'question-import.v2',
    'private_ingestion_jobs',
    'private_ingestion_nonces',
] as $needle) {
    assertPrivateIngestion(str_contains($service, $needle), 'Servico de ingestao privado sem protecao esperada: ' . $needle);
}
assertPrivateIngestion(!str_contains($service, 'HTTP_COOKIE'), 'Servico de ingestao nao deve aceitar cookies de crawler.');
assertPrivateIngestion(str_contains($client, 'X-Question-Ingest-Signature'), 'Cliente local deve assinar a requisicao.');
assertPrivateIngestion(!str_contains($client, 'Cookie'), 'Cliente local nao deve enviar cookies.');

fwrite(STDOUT, "Private question ingestion wiring assertions passed.\n");
