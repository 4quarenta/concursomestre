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
    exit("Dataset reset tool is CLI-only.\n");
}

require_once __DIR__ . '/DatasetResetReadinessReporter.php';
require_once __DIR__ . '/PostResetResidueReporter.php';
require_once __DIR__ . '/DatasetWriterFreezeEvidence.php';
require_once __DIR__ . '/DatasetWriterSystemdFreezePolicy.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticSitemapArtifactState.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticSitemapPublisher.php';

/** @return array<string, string|bool> */
function datasetResetOptions(array $arguments): array
{
    $options = ['execute' => false, 'validate-freeze-evidence-only' => false];
    foreach (array_slice($arguments, 1) as $argument) {
        if ($argument === '--execute') {
            $options['execute'] = true;
            continue;
        }
        if ($argument === '--validate-freeze-evidence-only') {
            $options['validate-freeze-evidence-only'] = true;
            continue;
        }
        if (!str_starts_with($argument, '--') || !str_contains($argument, '=')) {
            throw new InvalidArgumentException('Unknown argument: ' . $argument);
        }
        [$key, $value] = explode('=', substr($argument, 2), 2);
        if (!preg_match('/^[a-z][a-z0-9-]*$/', $key)) {
            throw new InvalidArgumentException('Invalid option name.');
        }
        $options[$key] = trim($value);
    }
    if ($options['execute'] === true && $options['validate-freeze-evidence-only'] === true) {
        throw new InvalidArgumentException('--execute and --validate-freeze-evidence-only are mutually exclusive.');
    }
    return $options;
}

function datasetResetOption(array $options, string $key, string $fallback = ''): string
{
    $value = $options[$key] ?? $fallback;
    return is_string($value) ? trim($value) : $fallback;
}

function datasetResetEnv(string $key, bool $required = true): string
{
    $value = $_ENV[$key] ?? getenv($key);
    $normalized = $value === false || $value === null ? '' : trim((string) $value);
    if ($required && $normalized === '') {
        throw new RuntimeException('Required environment variable is missing: ' . $key);
    }
    return $normalized;
}

function datasetResetConnect(bool $execute, string $targetKind): PDO
{
    if ($execute) {
        $host = datasetResetEnv('DB_HOST');
        $port = datasetResetEnv('DB_PORT', false);
        $database = datasetResetEnv('DB_NAME');
        $user = datasetResetEnv('DB_USER');
        $password = datasetResetEnv('DB_PASSWORD', false);
        if ($targetKind === 'PRODUCTION' && $password === '') {
            throw new RuntimeException('Production execution refuses an empty database password.');
        }
    } else {
        $host = datasetResetEnv('DB_READ_HOST');
        $port = datasetResetEnv('DB_READ_PORT', false);
        $database = datasetResetEnv('DB_READ_NAME');
        $user = datasetResetEnv('DB_READ_USER');
        $password = datasetResetEnv('DB_READ_PASSWORD');
    }

    $dsn = 'mysql:host=' . $host
        . ($port !== '' ? ';port=' . $port : '')
        . ';dbname=' . $database
        . ';charset=utf8mb4';
    $db = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => max(1, (int) (datasetResetEnv($execute ? 'DB_TIMEOUT_SECONDS' : 'DB_READ_TIMEOUT_SECONDS', false) ?: '10')),
        PDO::ATTR_PERSISTENT => false,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $db->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    $db->exec("SET time_zone = '-03:00'");
    return $db;
}

/** @return array<string, mixed> */
function datasetResetReadJson(string $path, string $label): array
{
    if ($path === '' || !is_file($path) || !is_readable($path)) {
        throw new RuntimeException($label . ' file is missing or unreadable.');
    }
    $payload = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($payload)) {
        throw new RuntimeException($label . ' must contain a JSON object.');
    }
    return $payload;
}

function datasetResetQuoteIdentifier(string $identifier): string
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
        throw new InvalidArgumentException('Invalid SQL identifier.');
    }
    return '`' . $identifier . '`';
}

/** @param array<string, mixed> $payload */
function datasetResetWriteAudit(string $path, array $payload): void
{
    if ($path === '') {
        throw new RuntimeException('Execution requires --audit-log.');
    }
    $normalized = str_replace('\\', '/', $path);
    $directory = dirname($normalized);
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create reset audit directory.');
    }
    $payload['recordedAt'] = gmdate(DATE_ATOM);
    $line = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . "\n";
    if (file_put_contents($normalized, $line, FILE_APPEND | LOCK_EX) === false) {
        throw new RuntimeException('Unable to write reset audit log.');
    }
    @chmod($normalized, 0600);
}

$writeStatementsExecuted = 0;
$transactionCommitted = false;
$committedRows = 0;
$targetKind = 'UNKNOWN';
try {
    $options = datasetResetOptions($argv);
    $execute = ($options['execute'] ?? false) === true;
    $validateFreezeEvidenceOnly = ($options['validate-freeze-evidence-only'] ?? false) === true;
    $executionPreflight = $execute || $validateFreezeEvidenceOnly;
    $targetKind = strtoupper(datasetResetOption($options, 'target-kind', $executionPreflight ? '' : 'READ_ONLY_DRY_RUN'));
    $db = datasetResetConnect($executionPreflight, $targetKind);
    $reporter = new DatasetResetReadinessReporter($db);
    $snapshot = $reporter->snapshot();

    $manifestPath = datasetResetOption($options, 'manifest');
    $guardPath = datasetResetOption($options, 'guard-file');
    $manifest = $manifestPath !== '' ? datasetResetReadJson($manifestPath, 'Manifest') : [];
    $guards = $guardPath !== '' ? datasetResetReadJson($guardPath, 'Guard') : [];
    $readiness = $manifest !== [] && $guards !== []
        ? DatasetResetGuardEvaluator::evaluateReadiness($snapshot, $manifest, $guards)
        : ['ready' => false, 'blockers' => ['APPROVED_MANIFEST_AND_GUARDS_REQUIRED']];

    if (!$executionPreflight) {
        $plannedDeletes = array_intersect_key(
            $snapshot['tableCounts'],
            array_fill_keys(DatasetResetPolicyV2::resetTables(), true)
        );
        echo json_encode([
            'mode' => 'dry-run',
            'policyVersion' => DatasetResetPolicyV2::VERSION,
            'snapshot' => $snapshot,
            'resetReadiness' => $readiness,
            'plannedDeletes' => $plannedDeletes,
            'preservedTables' => DatasetResetPolicyV2::preserveManifest(),
            'writeStatementsExecuted' => 0,
            'authorizationRequired' => true,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
        exit(0);
    }

    $environmentAllowsExecution = $targetKind === 'DISPOSABLE_REHEARSAL'
        ? datasetResetEnv('DATASET_RESET_DISPOSABLE_ALLOWED', false) === '1'
        : ($targetKind === 'PRODUCTION'
            && strtolower(datasetResetEnv('APP_ENV', false)) === 'production'
            && datasetResetEnv('DATASET_RESET_PRODUCTION_ALLOWED', false) === '1');
    $freezeEvidencePath = datasetResetOption($options, 'freeze-evidence');
    $freezeStatePath = datasetResetOption($options, 'freeze-state');
    $freezeRunId = datasetResetOption($options, 'freeze-run-id');
    $freezeEvidenceResult = ['valid' => false, 'blockers' => ['FREEZE_EVIDENCE_MISSING']];
    if ($freezeEvidencePath !== '' && $freezeRunId !== '') {
        $freezeEvidence = datasetResetReadJson($freezeEvidencePath, 'Freeze evidence');
        $freezeEvidenceResult = DatasetWriterFreezeEvidence::validate(
            $freezeEvidence,
            [
                'runId' => $freezeRunId,
                'targetKind' => $targetKind,
                'targetFingerprint' => (string) ($snapshot['snapshotFingerprint'] ?? ''),
                'inventoryHash' => DatasetWriterFreezeReporter::inventoryHash(),
                'hostFingerprint' => DatasetWriterFreezeEvidence::hostFingerprint(),
                'bootId' => DatasetWriterSystemdFreezePolicy::bootId(),
                'systemdVersion' => DatasetWriterSystemdFreezePolicy::systemdVersion(),
                'mechanismVersion' => DatasetWriterSystemdFreezePolicy::VERSION,
                'requiredUnits' => DatasetWriterSystemdFreezePolicy::unitNames(),
                'now' => time(),
            ],
            datasetResetEnv('DATASET_RESET_FREEZE_EVIDENCE_KEY')
        );
        $freezeBlockers = is_array($freezeEvidenceResult['blockers'] ?? null) ? $freezeEvidenceResult['blockers'] : [];
        if ($freezeStatePath === '') {
            $freezeBlockers[] = 'SIGNED_FREEZE_STATE_MISSING';
        } else {
            $freezeState = datasetResetReadJson($freezeStatePath, 'Signed freeze state');
            $freezeStateResult = DatasetWriterSystemdFreezePolicy::validateState(
                $freezeState,
                $freezeRunId,
                datasetResetEnv('DATASET_RESET_FREEZE_EVIDENCE_KEY')
            );
            foreach ($freezeStateResult['blockers'] as $blocker) $freezeBlockers[] = $blocker;
            if (($freezeState['status'] ?? '') !== 'FROZEN') $freezeBlockers[] = 'SIGNED_FREEZE_STATE_NOT_FROZEN';
            $freezeStateHash = hash_file('sha256', $freezeStatePath);
            if (!is_string($freezeStateHash)
                || !hash_equals((string) ($freezeEvidence['freezeStateHash'] ?? ''), $freezeStateHash)) {
                $freezeBlockers[] = 'SIGNED_FREEZE_STATE_HASH_MISMATCH';
            }
            $liveSuppression = DatasetWriterSystemdFreezePolicy::validateRuntimeSuppression($freezeRunId);
            foreach ($liveSuppression['blockers'] as $blocker) $freezeBlockers[] = $blocker;
        }
        $freezeBlockers = array_values(array_unique($freezeBlockers));
        sort($freezeBlockers);
        $freezeEvidenceResult = ['valid' => $freezeBlockers === [], 'blockers' => $freezeBlockers];
    }
    $execution = DatasetResetGuardEvaluator::evaluateExecution(
        $snapshot,
        $manifest,
        $guards,
        datasetResetOption($options, 'operation-token'),
        datasetResetOption($options, 'confirm-database'),
        $targetKind,
        $environmentAllowsExecution,
        ($freezeEvidenceResult['valid'] ?? false) === true,
        is_array($freezeEvidenceResult['blockers'] ?? null) ? $freezeEvidenceResult['blockers'] : []
    );
    if (!$execution['allowed']) {
        throw new RuntimeException('Reset refused: ' . implode(', ', $execution['blockers']));
    }
    if (($snapshot['resetOrderCycles'] ?? []) !== []) {
        throw new RuntimeException('Reset refused: FK cycle requires explicit remediation.');
    }
    if (count($snapshot['resetOrder'] ?? []) !== count(DatasetResetPolicyV2::resetTables())) {
        throw new RuntimeException('Reset refused: incomplete FK reset order.');
    }

    if ($validateFreezeEvidenceOnly) {
        echo json_encode([
            'status' => 'PASS',
            'mode' => 'validate-freeze-evidence-only',
            'policyVersion' => DatasetResetPolicyV2::VERSION,
            'database' => $snapshot['database'],
            'targetKind' => $targetKind,
            'snapshotFingerprint' => $snapshot['snapshotFingerprint'],
            'freezeRunId' => $freezeRunId,
            'writerInventoryHash' => DatasetWriterFreezeReporter::inventoryHash(),
            'writeStatementsExecuted' => 0,
            'transactionStarted' => false,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
        exit(0);
    }

    $auditPath = datasetResetOption($options, 'audit-log');
    datasetResetWriteAudit($auditPath, [
        'event' => 'reset_preflight_passed',
        'policyVersion' => DatasetResetPolicyV2::VERSION,
        'database' => $snapshot['database'],
        'targetKind' => $targetKind,
        'snapshotFingerprint' => $snapshot['snapshotFingerprint'],
        'freezeRunId' => $freezeRunId,
        'writerInventoryHash' => DatasetWriterFreezeReporter::inventoryHash(),
        'expectedRows' => array_sum(array_intersect_key($snapshot['tableCounts'], array_fill_keys(DatasetResetPolicyV2::resetTables(), true))),
    ]);

    $deleted = [];
    $db->beginTransaction();
    try {
        foreach ($snapshot['resetOrder'] as $table) {
            $expected = (int) ($manifest['expectedCounts'][$table] ?? -1);
            $actual = (int) $db->exec('DELETE FROM ' . datasetResetQuoteIdentifier($table));
            $writeStatementsExecuted++;
            $deleted[$table] = [
                'expectedBeforeReset' => $expected,
                'driverAffectedRows' => $actual,
            ];
        }

        $afterSnapshot = $reporter->snapshot();
        $residue = (new PostResetResidueReporter($db))->evaluateResetCompletion(
            $snapshot['preserveSnapshots'],
            $afterSnapshot['preserveSnapshots']
        );
        if (($residue['ok'] ?? false) !== true) {
            throw new RuntimeException('Post-reset residue or preserve mismatch detected.');
        }
        if (($snapshot['policyValidation'] ?? null) !== ($afterSnapshot['policyValidation'] ?? null)) {
            throw new RuntimeException('Policy/schema state changed during reset.');
        }
        if (($snapshot['latestMigration'] ?? '') !== ($afterSnapshot['latestMigration'] ?? '')) {
            throw new RuntimeException('Migration history changed during reset.');
        }

        $db->commit();
        $transactionCommitted = true;
        $committedRows = array_sum(array_column($deleted, 'driverAffectedRows'));

        $sitemapOutputDirectory = trim((string) (getenv('SITEMAP_OUTPUT_DIR') ?: dirname(__DIR__, 2) . '/storage/sitemaps'));
        $sitemapState = new StaticSitemapArtifactState($sitemapOutputDirectory);
        $sitemapPublisher = new StaticSitemapPublisher($sitemapOutputDirectory);
        $sitemapState->invalidate('RESET_POLICY_V2_COMMITTED', [
            'policyVersion' => DatasetResetPolicyV2::VERSION,
            'database' => (string) $snapshot['database'],
        ]);
        $sitemapArtifactWithdrawn = $sitemapPublisher->withdraw();
    } catch (Throwable $exception) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        datasetResetWriteAudit($auditPath, [
            'event' => 'reset_rolled_back',
            'database' => $snapshot['database'],
            'targetKind' => $targetKind,
            'reason' => $exception->getMessage(),
        ]);
        throw $exception;
    }

    datasetResetWriteAudit($auditPath, [
        'event' => 'reset_completed',
        'database' => $snapshot['database'],
        'targetKind' => $targetKind,
        'expectedRowsDeleted' => array_sum(array_column($deleted, 'expectedBeforeReset')),
        'driverAffectedRows' => array_sum(array_column($deleted, 'driverAffectedRows')),
        'deletedByTable' => $deleted,
    ]);
    echo json_encode([
        'status' => 'complete',
        'policyVersion' => DatasetResetPolicyV2::VERSION,
        'policySemanticsVersion' => DatasetResetPolicyV2::SEMANTICS_VERSION,
        'resetCompletionGate' => $residue,
        'database' => $snapshot['database'],
        'targetKind' => $targetKind,
        'expectedRowsDeleted' => array_sum(array_column($deleted, 'expectedBeforeReset')),
        'driverAffectedRows' => array_sum(array_column($deleted, 'driverAffectedRows')),
        'deletedByTable' => $deleted,
        'sitemapPublicationState' => 'DIRTY',
        'sitemapArtifactWithdrawn' => $sitemapArtifactWithdrawn,
        'preservedTables' => DatasetResetPolicyV2::preserveTables(),
        'productionDatabaseWrites' => $targetKind === 'PRODUCTION'
            ? array_sum(array_column($deleted, 'driverAffectedRows'))
            : 0,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, json_encode([
        'status' => $transactionCommitted ? 'failed_after_commit' : 'refused',
        'message' => $exception->getMessage(),
        'writeStatementsExecutedBeforeRefusal' => $writeStatementsExecuted,
        'transactionCommitted' => $transactionCommitted,
        'committedWritesAfterRefusal' => $transactionCommitted && $targetKind === 'PRODUCTION'
            ? $committedRows
            : 0,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL);
    exit(2);
}
