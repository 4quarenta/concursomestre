<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/questions/repositories/QuestionsRepository.php';

$repository = (new ReflectionClass(QuestionsRepository::class))->newInstanceWithoutConstructor();
$merge = new ReflectionMethod(QuestionsRepository::class, 'mergeMissingCmBatchMetadata');
$merge->setAccessible(true);

$existing = [
    'manualTitle' => 'Titulo revisado',
    'stages' => [],
    'documents' => [['name' => 'edital.pdf', 'sha256' => 'a']],
    'nested' => ['verified' => true, 'missing' => null],
];
$incoming = [
    'manualTitle' => 'Titulo do pacote',
    'stages' => [['name' => 'objetiva']],
    'documents' => [['name' => 'edital.pdf', 'sha256' => 'a'], ['name' => 'gabarito.pdf', 'sha256' => 'b']],
    'nested' => ['verified' => false, 'missing' => 'comprovado'],
];
$actual = $merge->invoke($repository, $existing, $incoming);
$expected = [
    'manualTitle' => 'Titulo revisado',
    'stages' => [['name' => 'objetiva']],
    'documents' => [['name' => 'edital.pdf', 'sha256' => 'a'], ['name' => 'gabarito.pdf', 'sha256' => 'b']],
    'nested' => ['verified' => true, 'missing' => 'comprovado'],
];

if ($actual !== $expected) {
    throw new RuntimeException('CM Batch metadata merge overwrote existing fields or failed to union list metadata.');
}

echo "CmBatchMetadataMergeTest: PASS\n";
