<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$scanRoots = [
    $root . '/modules',
    $root . '/config',
    $root . '/shared',
];
$excluded = [
    str_replace('\\', '/', $root . '/modules/setup/services/SetupService.php'),
    str_replace('\\', '/', $root . '/modules/legal_commentary/schema/LegalCommentarySchemaInstaller.php'),
    str_replace('\\', '/', $root . '/shared/database/SchemaMigrationRunner.php'),
];
$patterns = [
    '/\bCREATE\s+(?:TEMPORARY\s+)?TABLE\b/i',
    '/\bALTER\s+TABLE\b/i',
    '/\bDROP\s+(?:TEMPORARY\s+)?TABLE\b/i',
    '/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i',
    '/\bDROP\s+INDEX\b/i',
    '/\bALTER\s+DATABASE\b/i',
];

$findings = [];
foreach ($scanRoots as $scanRoot) {
    if (!is_dir($scanRoot)) {
        continue;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($scanRoot, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $fileInfo) {
        if (!$fileInfo->isFile() || strtolower($fileInfo->getExtension()) !== 'php') {
            continue;
        }

        $path = str_replace('\\', '/', $fileInfo->getPathname());
        if (in_array($path, $excluded, true)) {
            continue;
        }

        $contents = (string) file_get_contents($path);
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $contents, $match, PREG_OFFSET_CAPTURE) !== 1) {
                continue;
            }

            $line = substr_count(substr($contents, 0, (int) $match[0][1]), "\n") + 1;
            $findings[] = $path . ':' . $line . ' ' . $match[0][0];
        }
    }
}

if ($findings !== []) {
    throw new RuntimeException("Runtime DDL detected:\n" . implode("\n", $findings));
}

fwrite(STDOUT, "Runtime DDL static gate passed (provisioning and migration paths excluded explicitly).\n");
