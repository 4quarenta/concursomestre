<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/seo/contracts/SeoContractValidator.php';
require_once dirname(__DIR__) . '/modules/seo/contracts/SlugContractV1.php';

/** @return array<string, mixed> */
function seoContractsReadJson(string $path): array
{
    $raw = file_get_contents($path);
    if ($raw === false) {
        throw new RuntimeException('Arquivo nao encontrado: ' . $path);
    }

    $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($decoded)) {
        throw new RuntimeException('JSON invalido: ' . $path);
    }

    return $decoded;
}

function seoContractsAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $root = dirname(__DIR__, 2);
    $fixtures = seoContractsReadJson($root . '/contracts/seo/fixtures/contract-fixtures.v1.json');

    foreach ($fixtures['seoDecision']['valid'] as $fixture) {
        $errors = SeoContractValidator::validateSeoDecision($fixture['value']);
        seoContractsAssert($errors === [], 'PHP rejeitou SeoDecision valido: ' . $fixture['name'] . ' - ' . implode(' | ', $errors));
    }
    foreach ($fixtures['seoDecision']['invalid'] as $fixture) {
        seoContractsAssert(
            SeoContractValidator::validateSeoDecision($fixture['value']) !== [],
            'PHP aceitou SeoDecision invalido: ' . $fixture['name']
        );
    }

    foreach ($fixtures['publicationDecision']['valid'] as $fixture) {
        $errors = SeoContractValidator::validatePublicationDecision($fixture['value']);
        seoContractsAssert($errors === [], 'PHP rejeitou PublicationDecision valido: ' . $fixture['name'] . ' - ' . implode(' | ', $errors));
    }
    foreach ($fixtures['publicationDecision']['invalid'] as $fixture) {
        seoContractsAssert(
            SeoContractValidator::validatePublicationDecision($fixture['value']) !== [],
            'PHP aceitou PublicationDecision invalido: ' . $fixture['name']
        );
    }

    foreach ($fixtures['seoFacts']['valid'] as $fixture) {
        $errors = SeoContractValidator::validateSeoFacts($fixture['value']);
        seoContractsAssert($errors === [], 'PHP rejeitou SeoFacts valido: ' . $fixture['name'] . ' - ' . implode(' | ', $errors));
    }
    foreach ($fixtures['seoFacts']['invalid'] as $fixture) {
        seoContractsAssert(
            SeoContractValidator::validateSeoFacts($fixture['value']) !== [],
            'PHP aceitou SeoFacts invalido: ' . $fixture['name']
        );
    }

    $slugContract = seoContractsReadJson($root . '/contracts/seo/slug-vectors.v1.json');
    seoContractsAssert(($slugContract['version'] ?? null) === SlugContractV1::VERSION, 'Versao do Slug Contract divergiu.');
    foreach ($slugContract['vectors'] as $vector) {
        $fallback = $vector['fallback'] ?? ['type' => '', 'id' => ''];
        $actual = SlugContractV1::generate((string) $vector['input'], (string) $fallback['type'], (string) $fallback['id']);
        seoContractsAssert($actual === $vector['expected'], 'Vetor de slug falhou: ' . $vector['id'] . ' (' . $actual . ').');
    }

    $qualityGates = seoContractsReadJson($root . '/config/seo/quality-gates.v1.json');
    seoContractsAssert(($qualityGates['enforcement'] ?? null) === false, 'Quality Gates nao podem estar ativos no Checkpoint 1.');
    $qualityJson = strtolower(json_encode($qualityGates, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
    foreach (['direitos', 'rights', 'proveniencia', 'provenance', 'embargo', 'moderacao', 'moderation', 'restricao_juridica'] as $publicationConcern) {
        seoContractsAssert(!str_contains($qualityJson, $publicationConcern), 'Quality Gates contêm responsabilidade de Publication Policy.');
    }

    $routePolicy = seoContractsReadJson($root . '/config/seo/structural-route-policy.v1.json');
    seoContractsAssert(($routePolicy['enforcement'] ?? null) === false, 'Structural Route Policy nao pode estar ativa no Checkpoint 1.');
    $routeJson = json_encode($routePolicy, JSON_THROW_ON_ERROR);
    foreach (['promotedEntities', 'editorialContent', 'entitySlug', 'metadata'] as $editorialKey) {
        seoContractsAssert(!str_contains($routeJson, $editorialKey), 'Structural Route Policy contem promocao editorial.');
    }

    echo "SeoContractsV1Test: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, "SeoContractsV1Test: FAIL - " . $error->getMessage() . "\n");
    exit(1);
}
