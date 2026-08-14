<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/modules/seo/services/PublicSeoEnvelopeService.php';

$fixturePath = dirname(__DIR__, 2) . '/tests/fixtures/seo/public-payload-envelope-samples.v1.json';
$raw = file_get_contents($fixturePath);
if ($raw === false) {
    fwrite(STDERR, "Fixture de payload nao encontrada.\n");
    exit(1);
}
$fixture = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
$samples = is_array($fixture['samples'] ?? null) ? $fixture['samples'] : [];
$service = new PublicSeoEnvelopeService();
$report = [
    'mode' => 'fixture_shadow_comparison',
    'fixtureVersion' => $fixture['version'] ?? null,
    'total' => 0,
    'withoutDivergence' => 0,
    'withDivergence' => 0,
    'divergences' => [
        'indexability' => 0,
        'canonical' => 0,
        'slug' => 0,
        'publication' => 0,
        'quality' => 0,
    ],
    'payloadSize' => [],
    'databaseQueriesAdded' => 0,
    'errors' => [],
];

foreach ($samples as $sample) {
    if (!is_array($sample) || !is_array($sample['payload'] ?? null)) {
        continue;
    }
    $type = (string) ($sample['resourceType'] ?? '');
    $payload = $sample['payload'];
    try {
        $withEnvelope = match ($type) {
            'question' => $service->attachQuestion($payload),
            'exam' => $service->attachExam($payload),
            'board' => $service->attachBoard($payload),
            'taxonomy' => $service->attachTaxonomy($payload),
            'law' => $service->attachLaw($payload),
            default => throw new InvalidArgumentException('Recurso desconhecido.'),
        };
        foreach (['publicationDecision', 'seoDecision', 'seoFacts'] as $required) {
            if (!is_array($withEnvelope[$required] ?? null)) {
                throw new RuntimeException('Envelope ausente: ' . $required);
            }
        }

        $beforeBytes = strlen(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $afterBytes = strlen(json_encode($withEnvelope, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $report['payloadSize'][$type] = [
            'beforeBytes' => $beforeBytes,
            'afterBytes' => $afterBytes,
            'deltaBytes' => $afterBytes - $beforeBytes,
            'deltaPercent' => $beforeBytes > 0 ? round((($afterBytes - $beforeBytes) / $beforeBytes) * 100, 2) : null,
        ];

        $legacy = is_array($sample['legacySeo'] ?? null) ? $sample['legacySeo'] : [];
        $futureCanonical = $withEnvelope['seoDecision']['canonical']['path'] ?? null;
        $futureSlug = $withEnvelope['seoDecision']['canonical']['slug'] ?? null;
        $comparisons = [
            'indexability' => [$legacy['indexability'] ?? null, $withEnvelope['seoDecision']['indexability']['status'] ?? null],
            'canonical' => [$legacy['canonicalPath'] ?? null, $futureCanonical],
            'slug' => [$legacy['slug'] ?? null, $futureSlug],
            'publication' => [$legacy['publicationStatus'] ?? null, $withEnvelope['publicationDecision']['status'] ?? null],
            'quality' => [$legacy['qualityStatus'] ?? null, $withEnvelope['seoDecision']['quality']['status'] ?? null],
        ];
        $diverged = false;
        foreach ($comparisons as $category => [$legacyValue, $futureValue]) {
            if ($legacyValue !== null && $legacyValue !== $futureValue) {
                $report['divergences'][$category]++;
                $diverged = true;
            }
        }
        $report[$diverged ? 'withDivergence' : 'withoutDivergence']++;
        $report['total']++;
    } catch (Throwable $error) {
        $report['errors'][] = ['resourceType' => $type, 'errorClass' => get_class($error)];
    }
}

echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
exit($report['errors'] === [] ? 0 : 1);
