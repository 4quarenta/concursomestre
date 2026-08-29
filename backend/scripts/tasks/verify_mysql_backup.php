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

require_once __DIR__ . '/../../shared/database/BackupManifestContract.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

function backupVerifyCliOption(string $name, ?string $fallback = null): ?string
{
    global $argv;

    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') === 0) {
            return substr($argument, strlen($name) + 3);
        }
    }

    return $fallback;
}

function backupVerifyReadChecksum(string $path): string
{
    $checksumPath = $path . '.sha256';
    if (!is_file($checksumPath)) {
        throw new RuntimeException('Checksum obrigatorio ausente.');
    }

    $content = trim((string) file_get_contents($checksumPath));
    if (!preg_match('/^[a-f0-9]{64}\b/i', $content, $matches)) {
        throw new RuntimeException('Arquivo de checksum invalido.');
    }

    return strtolower($matches[0]);
}

/** @return array<string, mixed> */
function backupVerifyReadManifest(string $path): array
{
    $manifestPath = $path . '.manifest.json';
    if (!is_file($manifestPath) || !is_readable($manifestPath)) {
        throw new RuntimeException('Manifest final obrigatorio ausente.');
    }
    $manifest = json_decode((string) file_get_contents($manifestPath), true);
    if (!is_array($manifest) || (int) ($manifest['format_version'] ?? 0) < 1) {
        throw new RuntimeException('Manifest final invalido.');
    }
    if ((int) ($manifest['format_version'] ?? 0) >= BackupManifestContract::FORMAT_VERSION) {
        BackupManifestContract::assertValid($manifest);
    }
    if (($manifest['dump_sha256'] ?? '') === '' || !hash_equals((string) $manifest['dump_sha256'], backupVerifyReadChecksum($path))) {
        throw new RuntimeException('Manifest nao corresponde ao checksum do backup.');
    }
    if (isset($manifest['dump_size']) && (int) $manifest['dump_size'] !== (int) filesize($path)) {
        throw new RuntimeException('Manifest nao corresponde ao tamanho do backup.');
    }
    return $manifest;
}

try {
    $path = backupVerifyCliOption('file');
    if ($path === null || trim($path) === '') {
        throw new RuntimeException('Informe --file=/caminho/backup.sql.');
    }

    $path = str_replace('\\', '/', $path);
    if (!is_file($path) || !is_readable($path)) {
        throw new RuntimeException('Arquivo de backup nao encontrado ou sem permissao de leitura.');
    }

    $size = filesize($path);
    if ($size === false || $size <= 0) {
        throw new RuntimeException('Arquivo de backup vazio.');
    }

    $expectedChecksum = backupVerifyReadChecksum($path);
    $manifest = backupVerifyReadManifest($path);
    $actualChecksum = hash_file('sha256', $path);
    if ($actualChecksum === false) {
        throw new RuntimeException('Nao foi possivel calcular checksum.');
    }

    if (strtolower($actualChecksum) !== $expectedChecksum) {
        throw new RuntimeException('Checksum do backup nao confere.');
    }

    $sample = (string) file_get_contents($path, false, null, 0, 1048576);
    $hasDumpMarker = stripos($sample, 'CREATE TABLE') !== false
        || stripos($sample, 'INSERT INTO') !== false
        || stripos($sample, 'Table structure for table') !== false
        || stripos($sample, 'MariaDB dump') !== false
        || stripos($sample, 'MySQL dump') !== false;

    if (!$hasDumpMarker) {
        throw new RuntimeException('Arquivo nao parece ser um dump SQL MySQL/MariaDB.');
    }

    echo json_encode([
        'success' => true,
        'backup_file' => $path,
        'size_bytes' => $size,
        'sha256' => $actualChecksum,
        'checksum_file_found' => true,
        'manifest_file_found' => true,
        'manifest' => $manifest,
        'verified_at' => gmdate(DATE_ATOM),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}
