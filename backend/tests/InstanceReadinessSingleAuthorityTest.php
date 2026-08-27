<?php

declare(strict_types=1);

function readinessAuthorityAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$root = dirname(__DIR__);
$assembler = file_get_contents($root . '/modules/seo/launch/SeoInstanceReadinessAssembler.php');
$validator = file_get_contents($root . '/modules/seo/launch/SeoInstanceReadiness.php');
$envelope = file_get_contents($root . '/modules/seo/services/PublicSeoEnvelopeService.php');
$material = file_get_contents($root . '/modules/materials/public/PublicMaterialReadiness.php');
$simulation = file_get_contents($root . '/modules/simulations/public/PublicSimulationReadinessValidator.php');
$materializer = file_get_contents($root . '/scripts/seo/generate_static_sitemaps.php');

foreach (compact('assembler', 'validator', 'envelope', 'material', 'simulation', 'materializer') as $name => $source) {
    readinessAuthorityAssert(is_string($source), 'Fonte indisponivel: ' . $name);
}

readinessAuthorityAssert(substr_count($assembler, 'public function assemble(') === 1, 'Assembler final deve possuir uma unica entrada assemble().');
readinessAuthorityAssert(str_contains($assembler, 'array_unique($reasons)') && str_contains($assembler, 'sort($reasons, SORT_STRING)'), 'Reasons nao sao normalizados deterministicamente.');
readinessAuthorityAssert(!str_contains($validator, 'fromSignals('), 'Validator voltou a produzir readiness a partir de sinais.');
readinessAuthorityAssert(str_contains($envelope, 'SeoInstanceReadinessAssembler())->assemble('), 'Envelope nao usa a autoridade compartilhada.');

foreach (['material' => $material, 'simulation' => $simulation] as $name => $source) {
    readinessAuthorityAssert(str_contains($source, 'assemblePublicEntity('), ucfirst($name) . ' nao delega ao assembler compartilhado.');
    readinessAuthorityAssert(!str_contains($source, "['reasonCodes'][]"), ucfirst($name) . ' acrescenta reason autoritativo no wrapper.');
    readinessAuthorityAssert(!preg_match('/\$[A-Za-z_][A-Za-z0-9_]*\s*\[\s*[\'\"]status[\'\"]\s*\]\s*=/', $source), ucfirst($name) . ' recalcula status no wrapper.');
}

readinessAuthorityAssert(!str_contains($materializer, "'instanceReadiness' =>"), 'Materializer injeta readiness final.');
readinessAuthorityAssert(str_contains($materializer, 'PublicMaterialReadiness::publicationInput($row)')
    && str_contains($materializer, 'PublicMaterialReadiness::profileSignals($row)'), 'Materializer nao reutiliza fatos de Material.');
readinessAuthorityAssert(str_contains($materializer, 'PublicSimulationReadinessValidator::publicationInput($row)')
    && str_contains($materializer, 'PublicSimulationReadinessValidator::profileSignals($row)'), 'Materializer nao reutiliza fatos de Simulation.');

echo json_encode([
    'gate' => 'INSTANCE_READINESS_SINGLE_AUTHORITY_GATE',
    'status' => 'PASS',
    'finalInstanceReadinessAuthorities' => 1,
    'materializerFinalReadinessRules' => 0,
    'wrapperFinalReadinessOverrides' => 0,
], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
