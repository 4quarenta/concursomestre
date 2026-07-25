<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/questions/services/GranExamFileMaterializer.php';

function granExamFileAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$fixture = tempnam(sys_get_temp_dir(), 'cm-gran-pdf-fixture-');
$storageRoot = sys_get_temp_dir() . '/cm-gran-storage-' . bin2hex(random_bytes(5));
if ($fixture === false || !mkdir($storageRoot, 0775, true)) {
    throw new RuntimeException('Nao foi possivel preparar fixture do materializador.');
}
file_put_contents($fixture, "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
$downloadCount = 0;
$materializer = new GranExamFileMaterializer(
    static function (string $url, int $maxBytes) use ($fixture, &$downloadCount): array {
        $downloadCount++;
        granExamFileAssert($maxBytes === 104_857_600, 'Limite de download divergente.');
        $temporaryPath = tempnam(sys_get_temp_dir(), 'cm-gran-pdf-copy-');
        if ($temporaryPath === false || !copy($fixture, $temporaryPath)) {
            throw new RuntimeException('Falha ao copiar fixture.');
        }
        return [
            'temporaryPath' => $temporaryPath,
            'mimeType' => 'application/pdf',
            'size' => (int) filesize($temporaryPath),
            'sha256' => (string) hash_file('sha256', $temporaryPath),
        ];
    },
    static function (string $temporaryPath, string $storageKey, string $mimeType) use ($storageRoot): array {
        $target = $storageRoot . '/' . str_replace('/', '-', $storageKey);
        if (!copy($temporaryPath, $target)) {
            throw new RuntimeException('Falha ao gravar fixture.');
        }
        return [
            'storageKey' => $storageKey,
            'url' => '/uploads/' . $storageKey,
            'driver' => 'local',
            'size' => (int) filesize($target),
        ];
    }
);

$payload = $materializer->materialize([
    'schemaVersion' => 'question-import.v2',
    'exam' => [
        'externalId' => '251243',
        'files' => [[
            'kind' => 'edital',
            'name' => 'Edital',
            'sourceUrl' => 'https://arquivos.infra-questoes.grancursosonline.com.br/provas/251243/edital.pdf?signature=test',
            'sourceProvider' => 'gran',
        ]],
    ],
    'questions' => [],
]);

$file = $payload['exam']['files'][0] ?? [];
granExamFileAssert($downloadCount === 1, 'Documento deve ser baixado uma unica vez.');
granExamFileAssert(
    ($file['url'] ?? '') !== ''
    && str_starts_with((string) $file['url'], '/uploads/exams/gran/251243/edital-')
    && ($file['mimeType'] ?? null) === 'application/pdf',
    'Documento deve receber URL permanente do storage proprio.'
);
granExamFileAssert(
    !isset($file['sourceUrl'])
    && strlen((string) ($file['sourceUrlHash'] ?? '')) === 64,
    'URL temporaria remota nao deve ser persistida no registro canonico.'
);

$unsafeRejected = false;
try {
    $materializer->materialize([
        'exam' => [
            'externalId' => '251243',
            'files' => [[
                'kind' => 'prova',
                'sourceUrl' => 'https://example.org/prova.pdf',
            ]],
        ],
    ]);
} catch (InvalidArgumentException) {
    $unsafeRejected = true;
}
granExamFileAssert($unsafeRejected, 'Host arbitrario deve ser rejeitado antes do download.');
granExamFileAssert($downloadCount === 1, 'URL rejeitada nao pode acionar o downloader.');

@unlink($fixture);
foreach (glob($storageRoot . '/*') ?: [] as $storedFixture) {
    @unlink($storedFixture);
}
@rmdir($storageRoot);

fwrite(STDOUT, "GranExamFileMaterializerTest: PASS\n");
