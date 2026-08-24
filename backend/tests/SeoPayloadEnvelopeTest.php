<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/seo/services/PublicSeoEnvelopeService.php';

function seoPayloadAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

/** @param mixed $value */
function seoPayloadHasForbiddenKey(mixed $value): bool
{
    $forbidden = [
        'answer', 'resposta', 'correctOptionIndex', 'correctAlternativeId',
        'correctAlternativeTempIds', 'isCorrect', 'is_correct', 'teacherComment',
        'detailedComment', 'editorial', 'questionEditorials',
    ];
    if (!is_array($value)) {
        return false;
    }
    foreach ($value as $key => $item) {
        if (is_string($key) && in_array($key, $forbidden, true)) {
            return true;
        }
        if (seoPayloadHasForbiddenKey($item)) {
            return true;
        }
    }
    return false;
}

try {
    $fixturePath = __DIR__ . '/fixtures/seo/public-payload-envelope-samples.v1.json';
    $fixture = json_decode((string) file_get_contents($fixturePath), true, 512, JSON_THROW_ON_ERROR);
    $service = new PublicSeoEnvelopeService();
    $methods = [
        'question' => 'attachQuestion',
        'exam' => 'attachExam',
        'board' => 'attachBoard',
        'taxonomy' => 'attachTaxonomy',
        'law' => 'attachLaw',
    ];

    foreach ($fixture['samples'] as $sample) {
        $resourceType = (string) $sample['resourceType'];
        $payload = $sample['payload'];
        $payload['answer'] = ['raw' => 'A'];
        $payload['teacherComment'] = 'marcador-protegido';
        $payload['detailedComment'] = 'marcador-protegido';
        $method = $methods[$resourceType];
        $result = $service->{$method}($payload);

        seoPayloadAssert(SeoContractValidator::validatePublicationDecision($result['publicationDecision'] ?? null) === [], 'PublicationDecision invalida em ' . $resourceType);
        seoPayloadAssert(SeoContractValidator::validateSeoDecision($result['seoDecision'] ?? null) === [], 'SeoDecision invalida em ' . $resourceType);
        seoPayloadAssert(SeoContractValidator::validateSeoFacts($result['seoFacts'] ?? null) === [], 'SeoFacts invalido em ' . $resourceType);
        seoPayloadAssert(($result['seoFacts']['resourceType'] ?? null) === $resourceType, 'ResourceType divergente em ' . $resourceType);
        seoPayloadAssert(!seoPayloadHasForbiddenKey($result['seoFacts']), 'SeoFacts expos campo protegido em ' . $resourceType);
        seoPayloadAssert(!str_contains(json_encode($result['seoFacts'], JSON_THROW_ON_ERROR), 'marcador-protegido'), 'SeoFacts expos conteudo protegido em ' . $resourceType);
        $publicEnvelope = [
            'publicationDecision' => $result['publicationDecision'],
            'seoDecision' => $result['seoDecision'],
            'seoFacts' => $result['seoFacts'],
        ];
        seoPayloadAssert(!seoPayloadHasForbiddenKey($publicEnvelope), 'Envelope SEO expos campo protegido em ' . $resourceType);
        seoPayloadAssert(!str_contains(json_encode($publicEnvelope, JSON_THROW_ON_ERROR), 'marcador-protegido'), 'Envelope SEO expos conteudo protegido em ' . $resourceType);
        seoPayloadAssert(!in_array('publication.rights_not_evaluable', $result['publicationDecision']['reasonCodes'], true), 'Diagnostico juridico interno vazou no payload publico.');
        seoPayloadAssert(!in_array('publication.provenance_unknown', $result['publicationDecision']['reasonCodes'], true), 'Proveniencia interna vazou no payload publico.');
    }

    $legacy = ['id' => '', 'enunciado' => 'Payload legado preservado.'];
    seoPayloadAssert($service->attachQuestion($legacy) === $legacy, 'Falha de envelope nao preservou o payload legado.');

    $source = (string) file_get_contents(dirname(__DIR__) . '/modules/seo/services/PublicSeoEnvelopeService.php');
    seoPayloadAssert(
        preg_match('/\bPDO\s+\$|new\s+PDO\s*\(/', $source) !== 1,
        'PublicSeoEnvelopeService recebeu dependencia de banco.'
    );
    seoPayloadAssert(
        preg_match('/\b[A-Za-z0-9_]*Repository\s+\$|new\s+[A-Za-z0-9_]*Repository\s*\(/', $source) !== 1,
        'PublicSeoEnvelopeService consulta repository.'
    );

    $questionSource = (string) file_get_contents(dirname(__DIR__) . '/modules/questions/services/QuestionsService.php');
    seoPayloadAssert(substr_count($questionSource, 'attachQuestion(') === 2, 'Envelope de question foi integrado fora dos dois detalhes publicos.');
    $adminStart = strpos($questionSource, 'public function getQuestionAdminV2');
    $adminEnd = strpos($questionSource, 'public function submitAnswerV2');
    seoPayloadAssert($adminStart !== false && $adminEnd !== false && !str_contains(substr($questionSource, $adminStart, $adminEnd - $adminStart), 'attachQuestion('), 'Endpoint administrativo recebeu envelope publico.');

    $examSource = (string) file_get_contents(dirname(__DIR__) . '/modules/exams/services/ExamsService.php');
    seoPayloadAssert(
        substr_count($examSource, 'attachExam(') === 1,
        'Envelope de exam deve existir apenas no detalhe publico.'
    );

    $filterSource = (string) file_get_contents(dirname(__DIR__) . '/modules/filters/services/FiltersService.php');
    seoPayloadAssert(
        substr_count($filterSource, 'attachBoard(') === 2,
        'Envelope de board deve cobrir diretorio e detalhe publicos.'
    );
    seoPayloadAssert(
        substr_count($filterSource, 'attachTaxonomy(') === 3,
        'Envelope de taxonomy deve cobrir diretorio, hierarquia e expansao publica de filhos.'
    );

    $lawRoutes = (string) file_get_contents(dirname(__DIR__) . '/modules/legal_commentary/routes.php');
    $lawDetailStart = strpos($lawRoutes, 'function handleLegalCommentaryDetailRoute');
    $lawFavoriteStart = strpos($lawRoutes, 'function handleLegalCommentaryFavoriteRoute');
    seoPayloadAssert(
        $lawDetailStart !== false
            && $lawFavoriteStart !== false
            && substr_count(substr($lawRoutes, $lawDetailStart, $lawFavoriteStart - $lawDetailStart), 'attachLaw(') === 1,
        'Envelope de law deve existir apenas no detalhe publico.'
    );

    echo "SeoPayloadEnvelopeTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'SeoPayloadEnvelopeTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
