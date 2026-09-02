<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

$backendRoot = dirname(__DIR__, 2);
$excludedDirectories = [
    DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'migrations' . DIRECTORY_SEPARATOR,
    DIRECTORY_SEPARATOR . 'tests' . DIRECTORY_SEPARATOR,
    DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR,
    DIRECTORY_SEPARATOR . 'scripts' . DIRECTORY_SEPARATOR,
];
$excludedFiles = [
    'modules/setup/services/SetupService.php' => 'first-boot provisioning only',
    'modules/legal_commentary/schema/LegalCommentarySchemaInstaller.php' => 'explicit migration installer only',
    'shared/database/SchemaMigrationRunner.php' => 'CLI migration runner only',
];
$patterns = [
    'create_table' => '/\\bCREATE\\s+TABLE\\b/i',
    'alter_table' => '/\\bALTER\\s+TABLE\\b/i',
    'drop_table' => '/\\bDROP\\s+TABLE\\b/i',
    'create_index' => '/\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b/i',
];
$findings = [];

$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($backendRoot, FilesystemIterator::SKIP_DOTS)
);
foreach ($iterator as $file) {
    if (!$file instanceof SplFileInfo || strtolower($file->getExtension()) !== 'php') {
        continue;
    }

    $path = $file->getPathname();
    $normalizedPath = str_replace(['/', '\\\\'], DIRECTORY_SEPARATOR, $path);
    $relativePath = str_replace(DIRECTORY_SEPARATOR, '/', substr($path, strlen($backendRoot) + 1));
    if (array_key_exists($relativePath, $excludedFiles)) {
        continue;
    }
    $skip = false;
    foreach ($excludedDirectories as $excludedDirectory) {
        if (str_contains($normalizedPath, $excludedDirectory)) {
            $skip = true;
            break;
        }
    }
    if ($skip) {
        continue;
    }

    $contents = file_get_contents($path);
    if ($contents === false) {
        continue;
    }

    foreach ($patterns as $kind => $pattern) {
        if (preg_match_all($pattern, $contents, $matches, PREG_OFFSET_CAPTURE) !== 1 && empty($matches[0])) {
            continue;
        }

        foreach ($matches[0] as $match) {
            $prefix = substr($contents, 0, (int) $match[1]);
            $findings[] = [
                'file' => substr($path, strlen($backendRoot) + 1),
                'line' => substr_count($prefix, "\n") + 1,
                'kind' => $kind,
            ];
        }
    }
}

usort($findings, static fn (array $left, array $right): int => [$left['file'], $left['line']] <=> [$right['file'], $right['line']]);

fwrite(STDOUT, json_encode([
    'generated_at' => gmdate(DATE_ATOM),
    'scope' => 'PHP runtime paths; migrations, tests and CLI scripts are excluded.',
    'count' => count($findings),
    'findings' => $findings,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
