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
    exit("Freeze evidence capture is CLI-only.\n");
}

require_once __DIR__ . '/DatasetWriterFreezeEvidence.php';
require_once __DIR__ . '/DatasetWriterSystemdFreezePolicy.php';

/** @return array<string, string> */
function freezeCaptureOptions(array $arguments): array
{
    $options = [];
    foreach (array_slice($arguments, 1) as $argument) {
        if (!str_starts_with($argument, '--') || !str_contains($argument, '=')) throw new InvalidArgumentException('Every option must use --name=value.');
        [$key, $value] = explode('=', substr($argument, 2), 2);
        if (!preg_match('/^[a-z][a-z0-9-]*$/', $key)) throw new InvalidArgumentException('Invalid option name.');
        $options[$key] = trim($value);
    }
    return $options;
}

function freezeCaptureEnv(string $key): string
{
    $value = $_ENV[$key] ?? getenv($key);
    $value = $value === false || $value === null ? '' : trim((string) $value);
    if ($value === '') throw new RuntimeException('Required environment variable missing: ' . $key);
    return $value;
}

/** @return array<string, mixed> */
function freezeCaptureJson(string $path, string $label): array
{
    if ($path === '' || !is_file($path) || !is_readable($path)) throw new RuntimeException($label . ' is missing or unreadable.');
    $value = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($value)) throw new RuntimeException($label . ' must be a JSON object.');
    return $value;
}

/** @return array{status: int, output: string} */
function freezeCaptureCommand(string $command): array
{
    $output = [];
    $status = 0;
    exec($command . ' 2>&1', $output, $status);
    return ['status' => $status, 'output' => trim(implode("\n", $output))];
}

/** @return array<string, string> */
function freezeCaptureUnitState(string $unit): array
{
    $properties = ['ActiveState', 'SubState', 'LoadState', 'UnitFileState', 'FragmentPath', 'DropInPaths', 'RefuseManualStart', 'Restart', 'Names', 'Triggers', 'TriggeredBy'];
    $command = ['/usr/bin/systemctl', 'show', '--no-pager', $unit];
    foreach ($properties as $property) $command[] = '--property=' . $property;
    $result = freezeCaptureCommand(implode(' ', array_map('escapeshellarg', $command)));
    if ($result['status'] !== 0) throw new RuntimeException('Unable to inspect frozen unit: ' . $unit);
    $state = [];
    foreach (explode("\n", $result['output']) as $line) {
        if (!str_contains($line, '=')) continue;
        [$key, $value] = explode('=', $line, 2);
        $state[$key] = $value;
    }
    return $state;
}

try {
    if (PHP_OS_FAMILY !== 'Linux' || !is_executable('/usr/bin/systemctl')) throw new RuntimeException('Operational evidence must be captured on the Linux systemd target.');
    $options = freezeCaptureOptions($argv);
    $runId = (string) ($options['run-id'] ?? '');
    $targetKind = strtoupper((string) ($options['target-kind'] ?? ''));
    $targetFingerprint = (string) ($options['target-fingerprint'] ?? '');
    if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/', $runId)) throw new RuntimeException('A valid operation run ID is required.');
    if (!in_array($targetKind, ['DISPOSABLE_REHEARSAL', 'PRODUCTION'], true)) throw new RuntimeException('A valid target kind is required.');
    $freezeKey = freezeCaptureEnv('DATASET_RESET_FREEZE_EVIDENCE_KEY');
    $freezeStatePath = (string) ($options['freeze-state'] ?? '');
    $freezeState = freezeCaptureJson($freezeStatePath, 'Signed systemd freeze state');
    $freezeStateValidation = DatasetWriterSystemdFreezePolicy::validateState($freezeState, $runId, $freezeKey);
    if (!$freezeStateValidation['valid'] || ($freezeState['status'] ?? '') !== 'FROZEN') {
        throw new RuntimeException('Signed systemd freeze state is not executable: ' . implode(', ', $freezeStateValidation['blockers']));
    }
    if (($freezeState['targetKind'] ?? '') !== $targetKind) throw new RuntimeException('Freeze state target kind mismatch.');
    $freezeStateHash = hash_file('sha256', $freezeStatePath);
    if (!is_string($freezeStateHash)) throw new RuntimeException('Unable to hash signed freeze state.');
    $before = freezeCaptureJson($options['before'] ?? '', 'Before sentinel');
    $after = freezeCaptureJson($options['after'] ?? '', 'After sentinel');
    $rehearsalPath = $options['approved-rehearsal'] ?? '';
    $rehearsal = freezeCaptureJson($rehearsalPath, 'Approved representative rehearsal');
    $approvedHash = strtolower(freezeCaptureEnv('DATASET_WRITER_FREEZE_REHEARSAL_SHA256'));
    $actualHash = hash_file('sha256', $rehearsalPath);
    if (!is_string($actualHash) || !preg_match('/^[a-f0-9]{64}$/', $approvedHash) || !hash_equals($approvedHash, $actualHash)) throw new RuntimeException('Approved rehearsal hash mismatch.');
    $representativeEnvironment = ($rehearsal['representativeEnvironment'] ?? false) === true
        || (is_array($rehearsal['environment'] ?? null)
            && ($rehearsal['environment']['kind'] ?? '') === 'DISPOSABLE_WSL2'
            && (int) ($rehearsal['materialLimitations'] ?? -1) === 0);
    if (($rehearsal['systemdFreezeRemediationGate'] ?? '') !== 'READY'
        || ($rehearsal['writerGate'] ?? '') !== 'READY'
        || !$representativeEnvironment
        || ($rehearsal['systemdVersionSemanticMatch'] ?? false) !== true
        || ($rehearsal['suppressionMechanismVersion'] ?? '') !== DatasetWriterSystemdFreezePolicy::VERSION
        || ($rehearsal['attacks']['manualStartDenied'] ?? false) !== true
        || ($rehearsal['attacks']['restartDenied'] ?? false) !== true
        || ($rehearsal['attacks']['dependencyActivationDenied'] ?? false) !== true
        || ($rehearsal['attacks']['timerActivationDenied'] ?? false) !== true
        || ($rehearsal['attacks']['autorestartSuppressed'] ?? false) !== true
        || ($rehearsal['resume']['passed'] ?? false) !== true
        || (int) ($rehearsal['resume']['duplicateProcessing'] ?? -1) !== 0
        || ($rehearsal['writerInventoryHash'] ?? '') !== DatasetWriterFreezeReporter::inventoryHash()) {
        throw new RuntimeException('Representative rehearsal evidence is not approved for an operational freeze.');
    }

    $unitStates = [];
    foreach (DatasetWriterSystemdFreezePolicy::units() as $entry) {
        $unit = (string) $entry['unit'];
        $observed = freezeCaptureUnitState($unit);
        $dropInPath = DatasetWriterSystemdFreezePolicy::dropInPath($unit);
        $dropInExpected = DatasetWriterSystemdFreezePolicy::dropInContent($unit, $runId);
        $runtimeMaskPath = '/run/systemd/system/' . $unit;
        $runtimeMask = is_link($runtimeMaskPath) && readlink($runtimeMaskPath) === '/dev/null';
        $dropInLoaded = is_file($dropInPath)
            && hash_equals(hash('sha256', $dropInExpected), hash_file('sha256', $dropInPath) ?: '')
            && str_contains((string) ($observed['DropInPaths'] ?? ''), $dropInPath);
        $activeState = (string) ($observed['ActiveState'] ?? '');
        if (!in_array($activeState, ['inactive', 'failed'], true)) throw new RuntimeException('Required maintenance unit remains active: ' . $unit);
        if (($observed['RefuseManualStart'] ?? '') !== 'yes' || !$dropInLoaded) throw new RuntimeException('Runtime start suppression is incomplete: ' . $unit);
        if (($entry['kind'] ?? '') === 'service' && ($observed['Restart'] ?? '') !== 'no') throw new RuntimeException('Autorestart suppression is incomplete: ' . $unit);
        if ($runtimeMask) throw new RuntimeException('Unexpected runtime mask conflicts with the selected mechanism: ' . $unit);
        $unitStates[$unit] = [
            'kind' => (string) $entry['kind'],
            'activeState' => $activeState,
            'subState' => (string) ($observed['SubState'] ?? ''),
            'unitFileState' => (string) ($observed['UnitFileState'] ?? ''),
            'fragmentPath' => (string) ($observed['FragmentPath'] ?? ''),
            'refuseManualStart' => (string) ($observed['RefuseManualStart'] ?? ''),
            'restart' => (string) ($observed['Restart'] ?? ''),
            'dropInLoaded' => $dropInLoaded,
            'runtimeMask' => $runtimeMask,
            'names' => (string) ($observed['Names'] ?? ''),
            'triggers' => (string) ($observed['Triggers'] ?? ''),
            'triggeredBy' => (string) ($observed['TriggeredBy'] ?? ''),
        ];
    }

    $processScan = freezeCaptureCommand("/usr/bin/pgrep -af 'process_platform_events|process_question_ingestion_jobs|process_stripe_webhook_jobs|reconcile_stripe_subscriptions|process_marketing_automations|process_referral_rewards|cron_sync_updates|archive_user_answers|gran_capture|gran_mapper|materialize_gran|backfill_' || true");
    $unexpectedProcesses = array_values(array_filter(explode("\n", $processScan['output']), static fn (string $line): bool => trim($line) !== '' && !str_contains($line, 'pgrep -af')));
    if ($unexpectedProcesses !== []) throw new RuntimeException('Writer process remains active after freeze.');

    $sqlClientScan = freezeCaptureCommand("/usr/bin/pgrep -af '(^|/)(mysql|mariadb)([[:space:]]|$)' || true");
    $unexpectedSqlClients = array_values(array_filter(explode("\n", $sqlClientScan['output']), static fn (string $line): bool => trim($line) !== '' && !str_contains($line, 'pgrep -af')));
    if ($unexpectedSqlClients !== []) throw new RuntimeException('Manual SQL client remains active after operator freeze.');

    if (!is_executable('/usr/bin/ss')) throw new RuntimeException('Database session inspection tool is unavailable.');
    $databaseSessionScan = freezeCaptureCommand("/usr/bin/ss -Hntp state established '( sport = :3306 or dport = :3306 )'");
    if ($databaseSessionScan['status'] !== 0) throw new RuntimeException('Unable to inspect established database sessions.');
    $unixDatabaseSessionScan = freezeCaptureCommand("/usr/bin/ss -Hxnp state connected | /usr/bin/grep -E '^u_str.*(mysql|mysqld|mariadb)' || true");
    $unexpectedDatabaseSessions = array_values(array_filter(
        explode("\n", trim($databaseSessionScan['output'] . "\n" . $unixDatabaseSessionScan['output'])),
        static fn (string $line): bool => trim($line) !== ''
    ));
    if ($unexpectedDatabaseSessions !== []) throw new RuntimeException('Database session remains established after writer drain.');

    $started = strtotime((string) ($before['capturedAt'] ?? ''));
    $ended = strtotime((string) ($after['capturedAt'] ?? ''));
    if ($started === false || $ended === false || $ended - $started < DatasetWriterFreezeEvidence::MIN_OBSERVATION_SECONDS) throw new RuntimeException('Freeze observation window is too short.');

    $observationBinding = DatasetWriterFreezeEvidence::validateObservationBinding($before, $after, $targetFingerprint);
    if (!$observationBinding['valid']) throw new RuntimeException('Freeze observation is not bound to the target: ' . implode(', ', $observationBinding['blockers']));
    $observedTargetFingerprint = (string) ($before['targetSnapshotFingerprint'] ?? '');
    $generated = time();
    $payload = DatasetWriterFreezeEvidence::sign([
        'runId' => $runId,
        'targetKind' => $targetKind,
        'targetFingerprint' => $observedTargetFingerprint,
        'hostFingerprint' => DatasetWriterFreezeEvidence::hostFingerprint(),
        'bootId' => DatasetWriterSystemdFreezePolicy::bootId(),
        'systemdVersion' => DatasetWriterSystemdFreezePolicy::systemdVersion(),
        'suppressionMechanismVersion' => DatasetWriterSystemdFreezePolicy::VERSION,
        'freezeStateStatus' => 'FROZEN',
        'freezeStateHash' => $freezeStateHash,
        'writerInventoryHash' => DatasetWriterFreezeReporter::inventoryHash(),
        'approvedRehearsalHash' => $actualHash,
        'generatedAt' => gmdate(DATE_ATOM, $generated),
        'observationStartedAt' => gmdate(DATE_ATOM, $started),
        'observationEndedAt' => gmdate(DATE_ATOM, $ended),
        'expiresAt' => gmdate(DATE_ATOM, $generated + DatasetWriterFreezeEvidence::MAX_AGE_SECONDS),
        'frozenWriterIds' => DatasetWriterFreezeReporter::requiredFreezeWriterIds(),
        'unexpectedWriters' => [],
        'earlyResumeDetected' => false,
        'manualStartAttemptsDetected' => false,
        'barrierActive' => true,
        'producersFrozen' => true,
        'consumersFrozen' => true,
        'schedulesFrozen' => true,
        'autorestartHandled' => true,
        'inFlightOperationsDrained' => true,
        'representativeEnvironment' => true,
        'resumePlanValidated' => true,
        'suppression' => [
            'runtimeOnly' => true,
            'dropInsVerified' => true,
            'runtimeMasksPresent' => false,
            'triggersFrozen' => true,
            'cronFrozen' => in_array((string) ($unitStates['cron.service']['activeState'] ?? ''), ['inactive', 'failed'], true),
            'mysqlWriterSessions' => [],
            'rebootInvalidatesEvidence' => true,
            'unitStates' => $unitStates,
        ],
        'representativeAttackProof' => [
            'manualStartDenied' => true,
            'restartDenied' => true,
            'dependencyActivationDenied' => true,
            'timerActivationDenied' => true,
            'autorestartSuppressed' => true,
        ],
        'serviceStateHash' => hash('sha256', json_encode($unitStates, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)),
        'databaseSessionScanHash' => hash('sha256', $databaseSessionScan['output'] . "\n" . $unixDatabaseSessionScan['output']),
        'quiescence' => [
            'passed' => true,
            'unexpectedWrites' => 0,
            'beforeFingerprint' => (string) $before['globalFingerprint'],
            'afterFingerprint' => (string) $after['globalFingerprint'],
        ],
    ], $freezeKey);

    $output = (string) ($options['output'] ?? '');
    if ($output === '' || str_contains(str_replace('\\', '/', $output), '../')) throw new RuntimeException('A safe --output path is required.');
    $directory = dirname($output);
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('Unable to create evidence directory.');
    file_put_contents($output, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL, LOCK_EX);
    chmod($output, 0600);
    fwrite(STDOUT, json_encode(['status' => 'PASS', 'runId' => $runId, 'output' => $output], JSON_UNESCAPED_SLASHES) . PHP_EOL);
} catch (Throwable $exception) {
    fwrite(STDERR, json_encode(['status' => 'REFUSED', 'message' => $exception->getMessage()], JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}
