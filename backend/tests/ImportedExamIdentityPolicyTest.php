<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/questions/repositories/ImportedExamIdentityPolicy.php';

$base = [
    'source_provider' => 'gran',
    'source_external_id' => 'exam-alias-a',
    'nome' => 'Banca X - 2024 - Secretaria de Educacao - Professor',
    'ano' => 2024,
    'banca_id' => 11,
    'orgao_id' => 506,
    'cargo_id' => 31,
    'nivel_id' => 2,
    'tipo_prova_id' => 4,
    'carreira_id' => null,
];
$sameProof = $base;
$sameProof['source_external_id'] = 'exam-alias-b';
$differentProvider = $sameProof;
$differentProvider['source_provider'] = 'other';
$differentYear = $sameProof;
$differentYear['ano'] = 2023;
$differentAgency = $sameProof;
$differentAgency['banca_id'] = 12;

if (!ImportedExamIdentityPolicy::isSameGranExam($base, $sameProof)) {
    throw new RuntimeException('A Gran proof alias must reuse the existing canonical proof.');
}
if (ImportedExamIdentityPolicy::isSameGranExam($base, $differentProvider)
    || ImportedExamIdentityPolicy::isSameGranExam($base, $differentYear)
    || ImportedExamIdentityPolicy::isSameGranExam($base, $differentAgency)) {
    throw new RuntimeException('Different provider, year, or canonical exam metadata must not be merged.');
}

fwrite(STDOUT, "ImportedExamIdentityPolicyTest: PASS\n");
