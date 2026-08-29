<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../shared/storage/AssetBackupManager.php';

$options = getopt('', ['file:', 'target:']);
try {
    $manager = new AssetBackupManager();
    $result = $manager->restoreArchive((string) ($options['file'] ?? ''), (string) ($options['target'] ?? ''));
    echo json_encode(['success' => true, ...$result], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, json_encode(['success' => false, 'message' => $exception->getMessage()], JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}
