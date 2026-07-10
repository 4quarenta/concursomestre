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

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../modules/admin/services/AdminSystemLogAnalyzer.php';

function logAuditCliOption(string $name, ?string $fallback = null): ?string
{
    global $argv;

    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') === 0) {
            return substr($argument, strlen($name) + 3);
        }
    }

    return $fallback;
}

function logAuditBoolOption(string $name, bool $fallback): bool
{
    $value = logAuditCliOption($name);
    if ($value === null) {
        return $fallback;
    }

    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

function logAuditDefaultFiles(): string
{
    return implode(',', [
        'C:/xampp/apache/logs/error.log',
        dirname(__DIR__, 2) . '/storage/logs/subscriptions/subscription_cron.log',
        dirname(__DIR__, 2) . '/storage/logs/settings.log',
    ]);
}

/**
 * @return string[]
 */
function logAuditResolveFiles(): array
{
    $raw = logAuditCliOption('files', getEnvString('LOG_AUDIT_FILES', logAuditDefaultFiles()));
    $items = array_map('trim', explode(',', (string) $raw));
    $items = array_values(array_filter($items, static fn (string $path): bool => $path !== ''));

    return array_map(static fn (string $path): string => str_replace('\\', '/', $path), $items);
}

/**
 * @return string[]
 */
function logAuditTailLines(string $path, int $maxLines): array
{
    $maxLines = max(1, $maxLines);
    $file = new SplFileObject($path, 'r');
    $file->seek(PHP_INT_MAX);
    $lastLine = max(0, $file->key());
    $startLine = max(0, $lastLine - $maxLines + 1);
    $lines = [];

    for ($lineNumber = $startLine; $lineNumber <= $lastLine; $lineNumber++) {
        $file->seek($lineNumber);
        $line = trim((string) $file->current());
        if ($line !== '') {
            $lines[] = $line;
        }
    }

    return $lines;
}

function logAuditLineTimestamp(string $line): ?int
{
    if (preg_match('/^\[([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})(?:\.\d+)?\s+(\d{4})\]/', $line, $matches)) {
        $timestamp = strtotime($matches[1] . ' ' . $matches[2]);
        return $timestamp !== false ? $timestamp : null;
    }

    if (preg_match('/"time"\s*:\s*"([^"]+)"/', $line, $matches)) {
        $timestamp = strtotime($matches[1]);
        return $timestamp !== false ? $timestamp : null;
    }

    if (preg_match('/\b(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:?\d{2}|Z)?)\b/', $line, $matches)) {
        $timestamp = strtotime($matches[1]);
        return $timestamp !== false ? $timestamp : null;
    }

    return null;
}

/**
 * @return string[]
 */
function logAuditFilterRecentLines(array $lines, int $sinceMinutes): array
{
    if ($sinceMinutes <= 0) {
        return $lines;
    }

    $cutoff = time() - ($sinceMinutes * 60);
    $recent = [];
    $includeContinuation = false;

    foreach ($lines as $line) {
        $line = (string) $line;
        $timestamp = logAuditLineTimestamp($line);

        if ($timestamp === null) {
            if ($includeContinuation) {
                $recent[] = $line;
            }
            continue;
        }

        $includeContinuation = $timestamp >= $cutoff;
        if ($includeContinuation) {
            $recent[] = $line;
        }
    }

    return $recent;
}

function logAuditShouldFail(array $analysis, string $failOn): bool
{
    $failOn = strtolower($failOn);
    if ($failOn === 'none') {
        return false;
    }

    if ($failOn === 'error') {
        return ((int) ($analysis['critical_count'] ?? 0)) > 0 || ((int) ($analysis['error_count'] ?? 0)) > 0;
    }

    return ((int) ($analysis['critical_count'] ?? 0)) > 0;
}

try {
    $files = logAuditResolveFiles();
    $tailLines = max(100, min(50000, (int) logAuditCliOption('tail', getEnvString('LOG_AUDIT_TAIL_LINES', '5000'))));
    $sinceMinutes = max(0, min(10080, (int) logAuditCliOption('since-minutes', getEnvString('LOG_AUDIT_SINCE_MINUTES', '0'))));
    $repeatThreshold = max(2, min(100, (int) logAuditCliOption('repeat-threshold', getEnvString('LOG_AUDIT_REPEAT_THRESHOLD', '5'))));
    $requireFiles = logAuditBoolOption('require-files', filter_var(getEnvString('LOG_AUDIT_REQUIRE_FILES', 'false'), FILTER_VALIDATE_BOOLEAN));
    $failOn = strtolower((string) logAuditCliOption('fail-on', getEnvString('LOG_AUDIT_FAIL_ON', 'critical')));
    $analyzer = new AdminSystemLogAnalyzer();
    $results = [];
    $missing = [];
    $success = true;

    foreach ($files as $path) {
        if (!is_file($path) || !is_readable($path)) {
            $missing[] = $path;
            if ($requireFiles) {
                $success = false;
            }
            continue;
        }

        $tail = logAuditTailLines($path, $tailLines);
        $lines = logAuditFilterRecentLines($tail, $sinceMinutes);
        $analysis = $analyzer->analyze($lines, $repeatThreshold);
        $failed = logAuditShouldFail($analysis, $failOn);

        if ($failed) {
            $success = false;
        }

        $results[] = [
            'path' => $path,
            'ok' => !$failed,
            'size_bytes' => filesize($path) ?: 0,
            'tail_line_window' => count($tail),
            'line_window' => count($lines),
            'analysis' => $analysis,
        ];
    }

    $payload = [
        'success' => $success,
        'fail_on' => $failOn,
        'tail_lines' => $tailLines,
        'since_minutes' => $sinceMinutes,
        'repeat_threshold' => $repeatThreshold,
        'missing_files' => $missing,
        'files' => $results,
        'checked_at' => gmdate(DATE_ATOM),
    ];

    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($success) {
        echo $json . PHP_EOL;
        exit(0);
    }

    fwrite(STDERR, $json . PHP_EOL);
    exit(2);
} catch (Throwable $e) {
    fwrite(STDERR, json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}
