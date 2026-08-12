<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/exams/services/ExamLocationClassifier.php';

function assertExamLocation(array $actual, string $stateCode, string $region): void
{
    if (($actual['stateCode'] ?? null) !== $stateCode || ($actual['region'] ?? null) !== $region) {
        throw new RuntimeException('Unexpected location: ' . json_encode($actual, JSON_UNESCAPED_UNICODE));
    }
}

assertExamLocation(ExamLocationClassifier::classify(['SEFAZ SP - Auditor']), 'SP', 'Sudeste');
assertExamLocation(ExamLocationClassifier::classify(['Prefeitura de João Pessoa', 'Paraíba']), 'PB', 'Nordeste');
assertExamLocation(ExamLocationClassifier::classify(['Secretaria de Estado do Pará']), 'PA', 'Norte');
assertExamLocation(ExamLocationClassifier::classify(['IBGE - Recenseador']), 'BR', 'Nacional');
assertExamLocation(ExamLocationClassifier::classify(['Órgão local'], 'SC'), 'SC', 'Sul');

$unknown = ExamLocationClassifier::classify(['Instituto sem localidade']);
if (!array_key_exists('stateCode', $unknown) || $unknown['stateCode'] !== null || ($unknown['region'] ?? '') !== 'Não informada') {
    throw new RuntimeException('Unknown locations must remain explicit: ' . json_encode($unknown, JSON_UNESCAPED_UNICODE));
}

fwrite(STDOUT, "ExamLocationClassifierTest: PASS\n");
