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

$rtfFixture = tempnam(sys_get_temp_dir(), 'cm-gran-rtf-fixture-');
if ($rtfFixture === false) {
    throw new RuntimeException('Nao foi possivel preparar fixture RTF.');
}
file_put_contents($rtfFixture, "{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Arial;}} Prova oficial Gran.}");
$rtfMaterializer = new GranExamFileMaterializer(
    static function (string $url, int $maxBytes) use ($rtfFixture): array {
        $temporaryPath = tempnam(sys_get_temp_dir(), 'cm-gran-rtf-copy-');
        if ($temporaryPath === false || !copy($rtfFixture, $temporaryPath)) {
            throw new RuntimeException('Falha ao copiar fixture RTF.');
        }
        return [
            'temporaryPath' => $temporaryPath,
            'mimeType' => 'application/rtf',
            'size' => (int) filesize($temporaryPath),
            'sha256' => (string) hash_file('sha256', $temporaryPath),
        ];
    },
    static function (string $temporaryPath, string $storageKey, string $mimeType) use ($storageRoot): array {
        $target = $storageRoot . '/' . str_replace('/', '-', $storageKey);
        if (!copy($temporaryPath, $target)) {
            throw new RuntimeException('Falha ao gravar fixture RTF.');
        }
        return [
            'storageKey' => $storageKey,
            'url' => '/uploads/' . $storageKey,
            'driver' => 'local',
            'size' => (int) filesize($target),
        ];
    }
);
$rtfPayload = $rtfMaterializer->materialize([
    'exam' => [
        'externalId' => '2630',
        'files' => [[
            'kind' => 'prova',
            'name' => 'Prova oficial',
            'sourceUrl' => 'https://arquivos.infra-questoes.grancursosonline.com.br/folha-de-prova/F_2630.rtf',
        ]],
    ],
]);
$rtfFile = $rtfPayload['exam']['files'][0] ?? [];
granExamFileAssert(
    ($rtfFile['mimeType'] ?? null) === 'application/rtf'
    && str_ends_with((string) ($rtfFile['storageKey'] ?? ''), '.rtf')
    && ($rtfFile['status'] ?? null) === 'materialized',
    'RTF oficial deve ser validado por assinatura e armazenado com extensao correta.'
);

granExamFileAssert(class_exists(ZipArchive::class), 'Extensao ZIP deve estar disponivel no runtime.');
$zipFixture = tempnam(sys_get_temp_dir(), 'cm-gran-key-zip-');
if ($zipFixture === false) {
    throw new RuntimeException('Nao foi possivel preparar o ZIP de gabarito.');
}
$zip = new ZipArchive();
granExamFileAssert(
    $zip->open($zipFixture, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true,
    'Nao foi possivel criar o ZIP de gabarito.'
);
$zip->addFromString('preliminar.pdf', "%PDF-1.4\nPRELIMINAR\n%%EOF\n");
$zip->addFromString('final.pdf', "%PDF-1.4\nFINAL-GABARITO\n%%EOF\n");
$zip->addFromString('recursos.pdf', "%PDF-1.4\nRECURSOS\n%%EOF\n");
$zip->close();

$zipMaterializer = new GranExamFileMaterializer(
    static function (string $url, int $maxBytes) use ($zipFixture): array {
        $temporaryPath = tempnam(sys_get_temp_dir(), 'cm-gran-key-copy-');
        if ($temporaryPath === false || !copy($zipFixture, $temporaryPath)) {
            throw new RuntimeException('Falha ao copiar ZIP de gabarito.');
        }
        return [
            'temporaryPath' => $temporaryPath,
            'mimeType' => 'application/zip',
            'size' => (int) filesize($temporaryPath),
            'sha256' => (string) hash_file('sha256', $temporaryPath),
        ];
    },
    static function (string $temporaryPath, string $storageKey, string $mimeType) use ($storageRoot): array {
        $target = $storageRoot . '/' . str_replace('/', '-', $storageKey);
        if (!copy($temporaryPath, $target)) {
            throw new RuntimeException('Falha ao gravar gabarito extraido.');
        }
        return [
            'storageKey' => $storageKey,
            'url' => '/uploads/' . $storageKey,
            'driver' => 'local',
            'size' => (int) filesize($target),
        ];
    }
);
$zipPayload = $zipMaterializer->materialize([
    'exam' => [
        'externalId' => '251243',
        'files' => [[
            'kind' => 'gabarito',
            'name' => 'Gabarito oficial',
            'sourceUrl' => 'https://arquivos.infra-questoes.grancursosonline.com.br/gabarito/G_251243.zip',
        ]],
    ],
    'questions' => [['tempId' => 'q_1']],
]);
$zipFile = $zipPayload['exam']['files'][0] ?? [];
$zipStoredPath = $storageRoot . '/' . str_replace('/', '-', (string) ($zipFile['storageKey'] ?? ''));
granExamFileAssert(
    ($zipFile['mimeType'] ?? null) === 'application/pdf'
    && is_file($zipStoredPath)
    && str_contains((string) file_get_contents($zipStoredPath), 'FINAL-GABARITO'),
    'ZIP do gabarito deve materializar o PDF definitivo, nao o preliminar ou recursos.'
);

$invalidRemoteFixture = tempnam(sys_get_temp_dir(), 'cm-gran-invalid-');
if ($invalidRemoteFixture === false) {
    throw new RuntimeException('Nao foi possivel preparar fixture invalida.');
}
file_put_contents($invalidRemoteFixture, '<html>arquivo indisponivel</html>');
$resilientMaterializer = new GranExamFileMaterializer(
    static function (string $url, int $maxBytes) use ($invalidRemoteFixture): array {
        $temporaryPath = tempnam(sys_get_temp_dir(), 'cm-gran-invalid-copy-');
        if ($temporaryPath === false || !copy($invalidRemoteFixture, $temporaryPath)) {
            throw new RuntimeException('Falha ao copiar fixture invalida.');
        }
        return [
            'temporaryPath' => $temporaryPath,
            'mimeType' => 'text/html',
            'size' => (int) filesize($temporaryPath),
            'sha256' => (string) hash_file('sha256', $temporaryPath),
        ];
    },
    static function (): array {
        throw new RuntimeException('Storage nao deve ser chamado para arquivo invalido.');
    }
);
$resilientPayload = $resilientMaterializer->materialize([
    'import' => ['diagnostics' => []],
    'exam' => [
        'externalId' => '251243',
        'files' => [[
            'kind' => 'prova',
            'sourceUrl' => 'https://arquivos.infra-questoes.grancursosonline.com.br/prova/indisponivel.pdf',
        ]],
    ],
    'questions' => [['tempId' => 'q_1']],
]);
granExamFileAssert(
    count($resilientPayload['questions'] ?? []) === 1
    && ($resilientPayload['exam']['files'] ?? []) === []
    && str_contains(
        implode(' ', $resilientPayload['import']['diagnostics'] ?? []),
        'Arquivo oficial prova nao materializado'
    ),
    'Arquivo oficial invalido deve gerar diagnostico sem bloquear as questoes.'
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
@unlink($rtfFixture);
@unlink($zipFixture);
@unlink($invalidRemoteFixture);
foreach (glob($storageRoot . '/*') ?: [] as $storedFixture) {
    @unlink($storedFixture);
}
@rmdir($storageRoot);

fwrite(STDOUT, "GranExamFileMaterializerTest: PASS\n");
