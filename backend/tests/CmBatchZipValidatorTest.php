<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/ingestion/services/CmBatchZipValidator.php';

function cmBatchAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function createCmBatchFixture(bool $tamperHash = false, bool $addTraversal = false, bool $invalidReference = false): string
{
    if (!class_exists(ZipArchive::class)) {
        throw new RuntimeException('ZipArchive precisa estar habilitado para executar este teste.');
    }
    $path = tempnam(sys_get_temp_dir(), 'cm-batch-');
    if (!is_string($path)) {
        throw new RuntimeException('Nao foi possivel criar ZIP temporario.');
    }
    $entries = [
        'taxonomias-global.json' => json_encode([
            'schemaVersion' => 'cm-taxonomies.v1',
            'taxonomies' => ['subjects' => []],
        ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
        'provas/1/metadados.json' => json_encode([
            'schemaVersion' => 'cm-exam-metadata.v1',
            'metadata' => ['ano' => 2017],
        ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
        'provas/1/questoes.json' => json_encode([
            'schemaVersion' => 'question-import.v2',
            'import' => [],
            'exam' => ['year' => 2017],
            'contexts' => [],
            'questions' => [[
                'tempId' => 'q1',
                'source' => ['contextTempId' => $invalidReference ? 'missing-context' : ''],
                'alternatives' => [['tempId' => 'a1']],
                'answer' => ['correctAlternativeTempIds' => $invalidReference ? ['missing-alternative'] : ['a1']],
                'review' => ['required' => true, 'status' => 'pending'],
                'filters' => ['years' => [['label' => '2017']]],
            ]],
        ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
    ];
    $fileManifest = [];
    foreach ($entries as $name => $body) {
        $fileManifest[] = [
            'path' => $name,
            'sha256' => hash('sha256', $body),
            'bytes' => strlen($body),
            'mimeType' => 'application/json',
            'kind' => 'json',
        ];
    }
    if ($tamperHash) {
        $fileManifest[0]['sha256'] = str_repeat('0', 64);
    }
    $manifest = [
        'schemaVersion' => 'cm-batch.v1',
        'batchId' => 'unit:batch-1',
        'createdAt' => '2026-10-25',
        'datasetLabel' => 'fixture',
        'yearsCovered' => [2017],
        'sourceProviders' => ['unit'],
        'files' => $fileManifest,
        'exams' => [[
            'externalKey' => 'unit:1',
            'path' => 'provas/1',
            'expectedQuestions' => 1,
            'correctYear' => 2017,
        ]],
        'validationSummary' => [],
        'generatorVersion' => 'test',
    ];

    $zip = new ZipArchive();
    if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        throw new RuntimeException('Nao foi possivel abrir ZIP temporario.');
    }
    try {
        $zip->addFromString('manifest.json', json_encode($manifest, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        foreach ($entries as $name => $body) {
            $zip->addFromString($name, $body);
        }
        if ($addTraversal) {
            $zip->addFromString('../outside.json', '{}');
        }
    } finally {
        $zip->close();
    }
    return $path;
}

function cmBatchExpectInvalid(string $path, string $expectedMessage): void
{
    try {
        (new CmBatchZipValidator())->validate($path);
        throw new RuntimeException('Esperava rejeicao do arquivo ZIP.');
    } catch (InvalidArgumentException $error) {
        cmBatchAssert(
            str_contains($error->getMessage(), $expectedMessage),
            'Mensagem inesperada: ' . $error->getMessage()
        );
    }
}

$validPath = createCmBatchFixture();
$tamperedPath = createCmBatchFixture(true);
$traversalPath = createCmBatchFixture(false, true);
$invalidReferencePath = createCmBatchFixture(false, false, true);
try {
    $result = (new CmBatchZipValidator())->validate($validPath);
    cmBatchAssert($result['valid'] === true, 'ZIP de fixture nao foi validado.');
    cmBatchAssert($result['questionCount'] === 1, 'Contagem de questoes divergente.');
    cmBatchAssert($result['exams'][0]['correctYear'] === 2017, 'Ano oficial da prova nao foi preservado.');
    cmBatchAssert($result['exams'][0]['needsReview'] === 1, 'Questao pendente deveria ficar marcada para revisao.');
    cmBatchExpectInvalid($tamperedPath, 'SHA-256 invalido ou divergente');
    cmBatchExpectInvalid($traversalPath, 'Caminho inseguro');
    cmBatchExpectInvalid($invalidReferencePath, 'contextTempId sem correspondencia');
} finally {
    @unlink($validPath);
    @unlink($tamperedPath);
    @unlink($traversalPath);
    @unlink($invalidReferencePath);
}

echo "CmBatchZipValidatorTest: PASS\n";
