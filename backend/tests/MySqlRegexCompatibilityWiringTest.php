<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$scanRoots = [$root . '/modules', $root . '/scripts'];
$violations = [];

foreach ($scanRoots as $scanRoot) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($scanRoot, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $file) {
        if (!$file instanceof SplFileInfo || !$file->isFile() || $file->getExtension() !== 'php') {
            continue;
        }
        $source = (string) file_get_contents($file->getPathname());
        if (preg_match('/\bBINARY\s+[A-Za-z0-9_.`]+\s+REGEXP\b/i', $source) === 1) {
            $violations[] = str_replace('\\', '/', substr($file->getPathname(), strlen($root) + 1));
        }
    }
}

if ($violations !== []) {
    fwrite(STDERR, 'MySqlRegexCompatibilityWiringTest FAIL: predicado incompativel em ' . implode(', ', $violations) . PHP_EOL);
    exit(1);
}

echo "MySqlRegexCompatibilityWiringTest PASS\n";
