<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

function stripStandardHeader(string $content): string
{
    return (string) preg_replace('/^(<\?php\s*)?\/\*[\s\S]*?@since 1\.0\.0[\s\S]*?\*\/\s*/', '$1', $content, 1);
}

function assertThinApiBridges(string $base): void
{
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($base . '/api', FilesystemIterator::SKIP_DOTS)
    );

    $bannedNeedles = [
        'new PDO(',
        'ALTER TABLE',
        'DESCRIBE ',
        'SHOW TABLES',
        'TRUNCATE TABLE',
    ];

    $documentedAliases = [
        'subscriptions/webhook_stripe.php' => "require_once __DIR__ . '/stripe_webhook.php';",
    ];

    foreach ($iterator as $fileInfo) {
        if (!$fileInfo->isFile() || strtolower($fileInfo->getExtension()) !== 'php') {
            continue;
        }

        $path = $fileInfo->getPathname();
        $relativePath = str_replace('\\', '/', substr($path, strlen($base . '/api/')));
        $content = file_get_contents($path);

        if ($content === false) {
            throw new RuntimeException('Não foi possível ler o bridge: ' . $relativePath);
        }

        $lineCount = count(preg_split('/\r\n|\r|\n/', stripStandardHeader($content)));
        if ($lineCount > 20) {
            throw new RuntimeException('Bridge público excedeu o budget de 20 linhas: ' . $relativePath . ' (' . $lineCount . ')');
        }

        $delegatesToOfficialLayer = (
            strpos($content, '/modules/') !== false
            || strpos($content, '/shared/') !== false
            || strpos($content, '../admin/') !== false
            || preg_match('/handle[A-Za-z0-9_]+Route\(/', $content) === 1
            || (
                isset($documentedAliases[$relativePath])
                && strpos($content, $documentedAliases[$relativePath]) !== false
            )
        );

        if (!$delegatesToOfficialLayer) {
            throw new RuntimeException('Bridge público não delega claramente para camada oficial: ' . $relativePath);
        }

        foreach ($bannedNeedles as $needle) {
            if (strpos($content, $needle) !== false) {
                throw new RuntimeException('Bridge público não deve conter logica operacional [' . $needle . ']: ' . $relativePath);
            }
        }

        if (strpos($content, 'include_once') !== false) {
            throw new RuntimeException('Bridge público não deve usar include_once; padrao oficial e require_once com __DIR__: ' . $relativePath);
        }

        if (preg_match('/require_once\s+[\'"]\.\.\//', $content) === 1) {
            throw new RuntimeException('Bridge público não deve usar require_once com caminho relativo cru; use __DIR__: ' . $relativePath);
        }
    }
}

$base = dirname(__DIR__) . '';

assertThinApiBridges($base);

fwrite(STDOUT, "API thin bridges wiring assertions passed.\n");
