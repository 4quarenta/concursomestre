<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/questions/services/GranQuestionAssetMaterializer.php';

function granQuestionAssetAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$fixtureBytes = base64_decode('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', true);
if (!is_string($fixtureBytes)) {
    throw new RuntimeException('Fixture GIF invalida.');
}
$downloadCount = 0;
$storedKeys = [];
$materializer = new GranQuestionAssetMaterializer(
    static function (string $url, int $maxBytes) use ($fixtureBytes, &$downloadCount): array {
        $downloadCount++;
        $temporaryPath = tempnam(sys_get_temp_dir(), 'cm-gran-asset-fixture-');
        if ($temporaryPath === false || file_put_contents($temporaryPath, $fixtureBytes) === false) {
            throw new RuntimeException('Falha ao preparar fixture de imagem.');
        }
        return [
            'temporaryPath' => $temporaryPath,
            'mimeType' => 'image/gif',
            'size' => strlen($fixtureBytes),
            'sha256' => hash('sha256', $fixtureBytes),
        ];
    },
    static function (string $temporaryPath, string $storageKey, string $mimeType) use (&$storedKeys): array {
        $storedKeys[] = $storageKey;
        return [
            'storageKey' => $storageKey,
            'url' => '/uploads/' . $storageKey,
            'driver' => 'local',
            'size' => (int) filesize($temporaryPath),
        ];
    }
);

$remoteUrl = 'https://arquivos.infra-questoes.grancursosonline.com.br/imagens_provas/2563/imagemp.bmp.gif';
$payload = $materializer->materialize([
    'schemaVersion' => 'question-import.v2',
    'import' => [
        'sourceType' => 'authorized_admin_collection',
        'extractionMode' => 'gran_browser_extension',
    ],
    'contexts' => [[
        'tempId' => 'ctx_1',
        'body' => 'Contexto [image:ctx_img_1]',
        'assets' => [['tempId' => 'ctx_img_1', 'url' => $remoteUrl, 'usage' => 'context']],
    ]],
    'questions' => [[
        'tempId' => 'q_1',
        'source' => ['provider' => 'gran'],
        'content' => ['statement' => 'Enunciado [image:q_img_1]'],
        'assets' => [['tempId' => 'q_img_1', 'url' => $remoteUrl, 'usage' => 'statement']],
        'alternatives' => [[
            'tempId' => 'alt_a',
            'text' => 'Alternativa [image:alt_img_1]',
            'assets' => [['tempId' => 'alt_img_1', 'url' => $remoteUrl, 'usage' => 'alternative']],
        ]],
    ]],
]);

$contextAsset = $payload['contexts'][0]['assets'][0] ?? [];
$questionAsset = $payload['questions'][0]['assets'][0] ?? [];
$alternativeAsset = $payload['questions'][0]['alternatives'][0]['assets'][0] ?? [];
foreach ([$contextAsset, $questionAsset, $alternativeAsset] as $asset) {
    granQuestionAssetAssert(
        str_starts_with((string) ($asset['url'] ?? ''), '/uploads/question-assets/gran/'),
        'Todo asset Gran deve apontar para o storage proprio.'
    );
    granQuestionAssetAssert(
        str_starts_with((string) ($asset['storagePath'] ?? ''), 'question-assets/gran/'),
        'Todo asset materializado deve persistir a chave de armazenamento.'
    );
    granQuestionAssetAssert(
        ($asset['sourceProvider'] ?? null) === 'gran'
        && strlen((string) ($asset['sourceUrlHash'] ?? '')) === 64
        && !isset($asset['sourceUrl']),
        'A origem deve ser rastreavel sem persistir a URL remota.'
    );
}
granQuestionAssetAssert($downloadCount === 1, 'A mesma imagem remota deve ser baixada uma unica vez por lote.');
granQuestionAssetAssert(count($storedKeys) === 1, 'A mesma imagem deve gerar um unico objeto por lote.');
granQuestionAssetAssert(
    ($payload['questions'][0]['content']['statement'] ?? '') === 'Enunciado [image:q_img_1]'
    && ($payload['contexts'][0]['body'] ?? '') === 'Contexto [image:ctx_img_1]',
    'Marcadores no texto nao podem ser alterados durante a materializacao.'
);

$capturedAsset = $materializer->materializeAsset([
    'url' => $remoteUrl,
    'base64' => 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
    'usage' => 'statement',
]);
granQuestionAssetAssert(
    $downloadCount === 1
    && str_starts_with((string) ($capturedAsset['url'] ?? ''), '/uploads/question-assets/gran/')
    && !isset($capturedAsset['base64']),
    'Imagem capturada pela extensao deve ser armazenada sem novo download remoto.'
);

$localPayload = $materializer->materialize([
    'import' => ['extractionMode' => 'gran_browser_extension'],
    'questions' => [[
        'source' => ['provider' => 'gran'],
        'assets' => [['url' => '/uploads/question-assets/existing.gif']],
    ]],
]);
granQuestionAssetAssert(
    ($localPayload['questions'][0]['assets'][0]['url'] ?? '') === '/uploads/question-assets/existing.gif'
    && $downloadCount === 1,
    'Asset que ja pertence a plataforma nao deve ser baixado novamente.'
);

$unsafeRejected = false;
try {
    $materializer->materialize([
        'import' => ['extractionMode' => 'gran_browser_extension'],
        'questions' => [[
            'source' => ['provider' => 'gran'],
            'assets' => [['url' => 'https://example.org/image.gif']],
        ]],
    ]);
} catch (InvalidArgumentException) {
    $unsafeRejected = true;
}
granQuestionAssetAssert($unsafeRejected, 'Crawler nao pode persistir imagem de host arbitrario.');

$invalidFixture = tempnam(sys_get_temp_dir(), 'cm-gran-invalid-image-');
if ($invalidFixture === false) {
    throw new RuntimeException('Falha ao preparar fixture invalida.');
}
file_put_contents($invalidFixture, '<html>not an image</html>');
$invalidMaterializer = new GranQuestionAssetMaterializer(
    static function () use ($invalidFixture): array {
        $copy = tempnam(sys_get_temp_dir(), 'cm-gran-invalid-copy-');
        if ($copy === false || !copy($invalidFixture, $copy)) {
            throw new RuntimeException('Falha ao copiar fixture invalida.');
        }
        return [
            'temporaryPath' => $copy,
            'mimeType' => 'text/html',
            'size' => (int) filesize($copy),
        ];
    },
    static fn (): array => throw new RuntimeException('Storage nao deve receber arquivo invalido.')
);
$invalidRejected = false;
try {
    $invalidMaterializer->materializeAsset(['url' => $remoteUrl]);
} catch (RuntimeException) {
    $invalidRejected = true;
}
@unlink($invalidFixture);
granQuestionAssetAssert($invalidRejected, 'Conteudo remoto que nao e imagem deve ser rejeitado.');

$forbiddenMaterializer = new GranQuestionAssetMaterializer(
    static fn (): array => throw new RuntimeException('Nao foi possivel copiar a imagem Gran (HTTP 403).'),
    static fn (): array => throw new RuntimeException('Storage nao deve receber imagem bloqueada.')
);
$forbiddenResult = $forbiddenMaterializer->materializeForIngestion([
    'import' => ['extractionMode' => 'gran_browser_extension'],
    'questions' => [
        [
            'tempId' => 'q_blocked',
            'source' => ['provider' => 'gran', 'questionNumber' => 13],
            'assets' => [['url' => $remoteUrl]],
        ],
        [
            'tempId' => 'q_without_asset',
            'source' => ['provider' => 'gran', 'questionNumber' => 14],
            'assets' => [],
        ],
    ],
]);
granQuestionAssetAssert(
    count($forbiddenResult['payload']['questions']) === 2
    && ($forbiddenResult['payload']['questions'][0]['tempId'] ?? null) === 'q_blocked'
    && ($forbiddenResult['payload']['questions'][1]['tempId'] ?? null) === 'q_without_asset'
    && ($forbiddenResult['payload']['questions'][0]['assets'] ?? []) === [],
    'Um bloqueio 403 deve remover somente o asset afetado e preservar a questao no job.'
);
granQuestionAssetAssert(
    ($forbiddenResult['itemFailures'] ?? []) === []
    && count($forbiddenResult['assetWarnings'] ?? []) === 1
    && ($forbiddenResult['assetWarnings'][0]['tempId'] ?? null) === 'q_blocked'
    && ($forbiddenResult['assetWarnings'][0]['questionNumber'] ?? null) === '13'
    && ($forbiddenResult['assetWarnings'][0]['code'] ?? null) === 'gran_image_forbidden',
    'O 403 deve permanecer rastreavel como aviso do asset, sem criar falha da questao.'
);

$retryDownloadAttempts = 0;
$retryRecovered = new GranQuestionAssetMaterializer(
    static function () use (&$retryDownloadAttempts, $fixtureBytes): array {
        $retryDownloadAttempts++;
        if ($retryDownloadAttempts < 3) {
            throw new RuntimeException('Nao foi possivel copiar a imagem Gran (HTTP 0).');
        }
        $temporaryPath = tempnam(sys_get_temp_dir(), 'cm-gran-retry-image-');
        if ($temporaryPath === false || file_put_contents($temporaryPath, $fixtureBytes) === false) {
            throw new RuntimeException('Falha ao preparar fixture de imagem recuperada.');
        }
        return [
            'temporaryPath' => $temporaryPath,
            'mimeType' => 'image/gif',
            'size' => strlen($fixtureBytes),
            'sha256' => hash('sha256', $fixtureBytes),
        ];
    },
    static fn (string $temporaryPath, string $storageKey, string $mimeType): array => [
        'storageKey' => $storageKey,
        'url' => '/uploads/' . $storageKey,
        'driver' => 'local',
        'size' => (int) filesize($temporaryPath),
    ]
);
$recoveredResult = $retryRecovered->materializeForIngestion([
    'import' => ['extractionMode' => 'gran_browser_extension'],
    'questions' => [[
        'tempId' => 'q_recovered',
        'source' => ['provider' => 'gran', 'questionNumber' => 15],
        'assets' => [['url' => $remoteUrl]],
    ]],
]);
granQuestionAssetAssert(
    $retryDownloadAttempts === 3
    && count($recoveredResult['payload']['questions'] ?? []) === 1
    && ($recoveredResult['payload']['questions'][0]['assets'][0]['status'] ?? null) === 'materialized'
    && ($recoveredResult['itemFailures'] ?? []) === [],
    'HTTP 0 transitorio deve ser repetido e a questao importada quando a imagem volta a responder.'
);

$exhaustedDownloadAttempts = 0;
$retryExhausted = new GranQuestionAssetMaterializer(
    static function () use (&$exhaustedDownloadAttempts): array {
        $exhaustedDownloadAttempts++;
        throw new RuntimeException('Nao foi possivel copiar a imagem Gran (HTTP 0).');
    },
    static fn (): array => throw new RuntimeException('Storage nao deve receber imagem sem download.')
);
$exhaustedResult = $retryExhausted->materializeForIngestion([
    'import' => ['extractionMode' => 'gran_browser_extension'],
    'questions' => [
        [
            'tempId' => 'q_still_unavailable',
            'source' => ['provider' => 'gran', 'questionNumber' => 16],
            'assets' => [['url' => $remoteUrl]],
        ],
        [
            'tempId' => 'q_without_image',
            'source' => ['provider' => 'gran', 'questionNumber' => 17],
            'assets' => [],
        ],
    ],
]);
granQuestionAssetAssert(
    $exhaustedDownloadAttempts === 3
    && count($exhaustedResult['payload']['questions'] ?? []) === 2
    && ($exhaustedResult['payload']['questions'][0]['tempId'] ?? null) === 'q_still_unavailable'
    && ($exhaustedResult['payload']['questions'][1]['tempId'] ?? null) === 'q_without_image'
    && ($exhaustedResult['itemFailures'] ?? []) === []
    && count($exhaustedResult['assetWarnings'] ?? []) === 1
    && ($exhaustedResult['assetWarnings'][0]['tempId'] ?? null) === 'q_still_unavailable'
    && ($exhaustedResult['assetWarnings'][0]['code'] ?? null) === 'gran_image_copy_warning'
    && str_contains((string) ($exhaustedResult['assetWarnings'][0]['message'] ?? ''), 'HTTP 0'),
    'Apos esgotar retries, a questao deve ser importada sem o asset e o lote deve continuar.'
);

$retryDownloadAttempts = 0;
$retryRecovered = new GranQuestionAssetMaterializer(
    static function () use (&$retryDownloadAttempts, $fixtureBytes): array {
        $retryDownloadAttempts++;
        if ($retryDownloadAttempts < 3) {
            throw new RuntimeException('Nao foi possivel copiar a imagem Gran (HTTP 0).');
        }
        $temporaryPath = tempnam(sys_get_temp_dir(), 'cm-gran-retry-image-');
        if ($temporaryPath === false || file_put_contents($temporaryPath, $fixtureBytes) === false) {
            throw new RuntimeException('Falha ao preparar fixture de imagem recuperada.');
        }
        return [
            'temporaryPath' => $temporaryPath,
            'mimeType' => 'image/gif',
            'size' => strlen($fixtureBytes),
            'sha256' => hash('sha256', $fixtureBytes),
        ];
    },
    static fn (string $temporaryPath, string $storageKey, string $mimeType): array => [
        'storageKey' => $storageKey,
        'url' => '/uploads/' . $storageKey,
        'driver' => 'local',
        'size' => (int) filesize($temporaryPath),
    ]
);
$recoveredResult = $retryRecovered->materializeForIngestion([
    'import' => ['extractionMode' => 'gran_browser_extension'],
    'questions' => [[
        'tempId' => 'q_recovered',
        'source' => ['provider' => 'gran', 'questionNumber' => 15],
        'assets' => [['url' => $remoteUrl]],
    ]],
]);
granQuestionAssetAssert(
    $retryDownloadAttempts === 3
    && count($recoveredResult['payload']['questions'] ?? []) === 1
    && ($recoveredResult['payload']['questions'][0]['assets'][0]['status'] ?? null) === 'materialized'
    && ($recoveredResult['itemFailures'] ?? []) === [],
    'HTTP 0 transitorio deve ser repetido e a questao importada quando a imagem volta a responder.'
);

$exhaustedDownloadAttempts = 0;
$retryExhausted = new GranQuestionAssetMaterializer(
    static function () use (&$exhaustedDownloadAttempts): array {
        $exhaustedDownloadAttempts++;
        throw new RuntimeException('Nao foi possivel copiar a imagem Gran (HTTP 0).');
    },
    static fn (): array => throw new RuntimeException('Storage nao deve receber imagem sem download.')
);
$exhaustedResult = $retryExhausted->materializeForIngestion([
    'import' => ['extractionMode' => 'gran_browser_extension'],
    'questions' => [
        [
            'tempId' => 'q_still_unavailable',
            'source' => ['provider' => 'gran', 'questionNumber' => 16],
            'assets' => [['url' => $remoteUrl]],
        ],
        [
            'tempId' => 'q_without_image',
            'source' => ['provider' => 'gran', 'questionNumber' => 17],
            'assets' => [],
        ],
    ],
]);
granQuestionAssetAssert(
    $exhaustedDownloadAttempts === 3
    && count($exhaustedResult['payload']['questions'] ?? []) === 1
    && ($exhaustedResult['payload']['questions'][0]['tempId'] ?? null) === 'q_without_image'
    && count($exhaustedResult['itemFailures'] ?? []) === 1
    && ($exhaustedResult['itemFailures'][0]['tempId'] ?? null) === 'q_still_unavailable'
    && ($exhaustedResult['itemFailures'][0]['code'] ?? null) === 'gran_image_copy_failed'
    && str_contains((string) ($exhaustedResult['itemFailures'][0]['message'] ?? ''), 'HTTP 0'),
    'Apos esgotar retries, somente a questao com imagem indisponivel deve ficar pendente e o lote deve continuar.'
);

fwrite(STDOUT, "GranQuestionAssetMaterializerTest: PASS\n");
