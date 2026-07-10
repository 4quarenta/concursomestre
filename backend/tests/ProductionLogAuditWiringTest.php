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

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../modules/admin/services/AdminSystemLogAnalyzer.php';

function assertProductionLogAudit(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assertContainsProductionLogAudit(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function runProductionLogAuditScript(string $script, string $file, int $sinceMinutes, string $failOn): array
{
    $command = escapeshellarg(PHP_BINARY)
        . ' '
        . escapeshellarg($script)
        . ' --files='
        . escapeshellarg($file)
        . ' --since-minutes='
        . escapeshellarg((string) $sinceMinutes)
        . ' --fail-on='
        . escapeshellarg($failOn)
        . ' --repeat-threshold=2'
        . ' --tail=200'
        . ' --require-files=true';

    $output = [];
    $exitCode = 0;
    exec($command . ' 2>&1', $output, $exitCode);

    $body = trim(implode("\n", $output));
    $payload = json_decode($body, true);

    return [
        'exit_code' => $exitCode,
        'payload' => is_array($payload) ? $payload : null,
        'raw_output' => $body,
    ];
}

function apacheProductionLogTimestamp(int $timestamp): string
{
    return date('D M j H:i:s', $timestamp) . '.123456 ' . date('Y', $timestamp);
}

$base = 'C:/xampp/htdocs/questao-pro-backend';
$script = $base . '/scripts/tasks/production_log_audit.php';
$service = $base . '/modules/admin/services/AdminSystemLogService.php';

assertContainsProductionLogAudit(
    $script,
    'LOG_AUDIT_FILES',
    'Production log audit must support configurable log files'
);

assertContainsProductionLogAudit(
    $script,
    '/storage/logs/subscriptions/subscription_cron.log',
    'Production log audit default files must read subscription cron logs from private storage'
);

assertProductionLogAudit(
    strpos((string) file_get_contents($script), '/api/subscriptions/subscription_cron.log') === false,
    'Production log audit default files must not read subscription cron logs from public api/'
);

assertContainsProductionLogAudit(
    $script,
    'LOG_AUDIT_REPEAT_THRESHOLD',
    'Production log audit must support configurable repetition threshold'
);

assertContainsProductionLogAudit(
    $script,
    'LOG_AUDIT_SINCE_MINUTES',
    'Production log audit must support a recent-time window for staging checks'
);

assertContainsProductionLogAudit(
    $script,
    'logAuditFilterRecentLines',
    'Production log audit must filter old historical entries when a recent-time window is configured'
);

assertContainsProductionLogAudit(
    $script,
    'exit(2)',
    'Production log audit must fail non-zero when critical checks fail'
);

assertContainsProductionLogAudit(
    $service,
    '\'analysis\' => $this->analyzer->analyze($lines)',
    'Admin log endpoint must expose analyzed severity/category/repetition data'
);

$analyzer = new AdminSystemLogAnalyzer();
$analysis = $analyzer->analyze([
    '[Mon Apr 27 22:18:58.945592 2026] [php:notice] [pid 17852:tid 1676] [client ::1:52894] Connection error: SQLSTATE[08004] [1040] Too many connections',
    '[Mon Apr 27 22:18:59.827207 2026] [php:error] [pid 17852:tid 1116] [client ::1:58206] PHP Fatal error: Uncaught Exception: Database connection failed: SQLSTATE[08004] [1040] Too many connections',
    '[Mon Apr 27 22:19:00.111111 2026] [php:error] [pid 111:tid 222] [client ::1:1111] PHP Fatal error: Uncaught Exception: Database connection failed: SQLSTATE[08004] [1040] Too many connections',
    '[Sat May 30 14:17:31.346233 2026] [php:notice] [pid 11100:tid 1924] [client ::1:61194] [admin_settings_route] SQLSTATE[HY000]: General error: 2006 MySQL server has gone away',
    '[Tue Apr 28 22:59:38.024601 2026] [php:notice] [client ::1:54076] [AUTH] {"event":"access_token_rejected"}',
], 2);

assertProductionLogAudit(($analysis['critical_count'] ?? 0) >= 4, 'Analyzer must classify DB connection failures as critical.');
assertProductionLogAudit(($analysis['category_counts']['database'] ?? 0) >= 4, 'Analyzer must classify SQLSTATE logs as database.');
assertProductionLogAudit(count($analysis['repeated'] ?? []) >= 1, 'Analyzer must identify repeated high-frequency errors.');
assertProductionLogAudit(
    !empty($analysis['samples']['critical'][0]) && str_contains((string) $analysis['samples']['critical'][0], 'SQLSTATE'),
    'Analyzer must expose actionable critical samples for failed production checks.'
);

$fixturePath = sys_get_temp_dir() . '/concursomestre-production-log-audit-fixture.log';
$oldTimestamp = apacheProductionLogTimestamp(time() - 7200);
$recentTimestamp = apacheProductionLogTimestamp(time() - 120);
$oldCritical = '[' . $oldTimestamp . '] [php:error] [pid 1:tid 1] [client 127.0.0.1:50100] PHP Fatal error: Uncaught Exception: Database connection failed: SQLSTATE[08004] [1040] Too many connections';
$recentCritical = '[' . $recentTimestamp . '] [php:error] [pid 2:tid 2] [client 127.0.0.1:50101] PHP Fatal error: Uncaught Exception: Database connection failed: SQLSTATE[08004] [1040] Too many connections';

file_put_contents($fixturePath, $oldCritical . PHP_EOL, LOCK_EX);
$oldOnlyRun = runProductionLogAuditScript($script, $fixturePath, 60, 'error');
assertProductionLogAudit(
    $oldOnlyRun['exit_code'] === 0 && is_array($oldOnlyRun['payload']) && !empty($oldOnlyRun['payload']['success']),
    'Strict recent log audit must ignore historical errors outside --since-minutes. Output: ' . $oldOnlyRun['raw_output']
);
assertProductionLogAudit(
    (int) ($oldOnlyRun['payload']['files'][0]['line_window'] ?? -1) === 0,
    'Historical-only fixture should leave an empty recent line window.'
);

file_put_contents($fixturePath, $oldCritical . PHP_EOL . $recentCritical . PHP_EOL, LOCK_EX);
$recentRun = runProductionLogAuditScript($script, $fixturePath, 60, 'error');
assertProductionLogAudit(
    $recentRun['exit_code'] === 2 && is_array($recentRun['payload']) && empty($recentRun['payload']['success']),
    'Strict recent log audit must fail when a recent critical error exists. Output: ' . $recentRun['raw_output']
);
assertProductionLogAudit(
    (int) ($recentRun['payload']['files'][0]['analysis']['critical_count'] ?? 0) === 1,
    'Recent strict audit must count only the recent critical entry.'
);
assertProductionLogAudit(
    str_contains((string) ($recentRun['payload']['files'][0]['analysis']['samples']['critical'][0] ?? ''), 'Too many connections'),
    'Recent strict audit payload must include the failing critical log sample.'
);

@unlink($fixturePath);

fwrite(STDOUT, "Production log audit wiring assertions passed.\n");
