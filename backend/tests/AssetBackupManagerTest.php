<?php

declare(strict_types=1);

require_once __DIR__ . '/../shared/storage/AssetBackupManager.php';

$root = sys_get_temp_dir() . '/cm-assets-' . bin2hex(random_bytes(5));
$source = $root . '/source';
$backup = $root . '/backup';
$restore = $root . '/restore';
mkdir($source . '/nested', 0700, true);
file_put_contents($source . '/one.txt', 'synthetic asset');
file_put_contents($source . '/nested/two.txt', 'synthetic asset two');

try {
    $manager = new AssetBackupManager(0700, 0600);
    $created = $manager->createArchive($source, $backup, 'rehearsal-1');
    $restored = $manager->restoreArchive($created['archive_path'], $restore);
    if (($created['file_count'] ?? 0) !== 2 || ($restored['file_count'] ?? 0) !== 2) {
        throw new RuntimeException('Asset file count parity failed.');
    }
    if (file_get_contents($restore . '/one.txt') !== 'synthetic asset') {
        throw new RuntimeException('Asset restore content mismatch.');
    }
} finally {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($iterator as $file) {
        $file->isDir() ? @rmdir($file->getPathname()) : @unlink($file->getPathname());
    }
    @rmdir($root);
}

fwrite(STDOUT, "AssetBackupManagerTest: PASS\n");
