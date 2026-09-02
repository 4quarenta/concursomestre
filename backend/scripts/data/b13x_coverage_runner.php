<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("B13X coverage runner is CLI-only.\n");
}

require_once __DIR__ . '/DatasetAvailabilitySafeFreezeState.php';
require_once __DIR__ . '/DatasetResetPolicyV2.php';
require_once __DIR__ . '/DatasetWriterCoverageState.php';
require_once __DIR__ . '/DatasetWriterFreezeReporter.php';
require_once __DIR__ . '/DatasetWriterSystemdCoverage.php';
require_once __DIR__ . '/DatasetWriterSystemdFreezePolicy.php';

/** @return array<string, string|bool> */
function b13xRunnerOptions(array $arguments): array
{
    $options = [];
    foreach (array_slice($arguments, 1) as $argument) {
        if (!str_starts_with($argument, '--')) {
            throw new InvalidArgumentException('Every option must use --name=value or --flag.');
        }
        $argument = substr($argument, 2);
        if (!str_contains($argument, '=')) {
            $options[$argument] = true;
            continue;
        }
        [$key, $value] = explode('=', $argument, 2);
        if (!preg_match('/^[a-z][a-z0-9-]*$/', $key)) {
            throw new InvalidArgumentException('Invalid option name: ' . $key);
        }
        $options[$key] = trim($value);
    }
    return $options;
}

function b13xRunnerEnv(string $key, string $fallback = ''): string
{
    $value = $_ENV[$key] ?? getenv($key);
    if ($value === false || $value === null) {
        return $fallback;
    }
    return trim((string) $value);
}

function b13xRunnerPathOption(array $options, string $key, string $env = ''): string
{
    $value = trim((string) ($options[$key] ?? ($env !== '' ? b13xRunnerEnv($env) : '')));
    return $value;
}

function b13xRunnerReadKey(string $directValue, string $filePath): string
{
    if ($directValue !== '') {
        return $directValue;
    }
    if ($filePath === '' || !is_file($filePath) || !is_readable($filePath)) {
        throw new RuntimeException('A readable signing key is required.');
    }
    $key = trim((string) file_get_contents($filePath));
    if ($key === '') {
        throw new RuntimeException('The signing key file is empty.');
    }
    return $key;
}

/** @return array<string, mixed> */
function b13xRunnerSystemdResumeState(array $options): array
{
    static $cached = null;
    if (is_array($cached)) {
        return $cached;
    }

    $stateFile = b13xRunnerPathOption($options, 'systemd-state-file');
    $runId = trim((string) ($options['systemd-run-id'] ?? $options['availability-run-id'] ?? ''));
    $key = b13xRunnerReadKey('', b13xRunnerPathOption($options, 'systemd-key-file'));
    if ($stateFile === '' || !is_file($stateFile) || !is_readable($stateFile)) {
        throw new RuntimeException('A readable signed systemd resume state is required.');
    }

    $state = json_decode((string) file_get_contents($stateFile), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($state)) {
        throw new RuntimeException('Systemd resume state must contain a JSON object.');
    }
    $validation = DatasetWriterSystemdFreezePolicy::validateState($state, $runId, $key);
    if (!$validation['valid']) {
        throw new RuntimeException('Systemd resume state refused: ' . implode(', ', $validation['blockers']));
    }
    if (($state['status'] ?? '') !== 'RESUMED') {
        throw new RuntimeException('Systemd state must be RESUMED before coverage validation.');
    }

    $cached = $state;
    return $cached;
}

/** @return array{status: int, output: string} */
function b13xRunnerShellCommand(string $commandLine): array
{
    $commandLine = trim($commandLine);
    if ($commandLine === '' || preg_match('/[\r\n]/', $commandLine)) {
        throw new RuntimeException('Configured shell command is invalid.');
    }

    $output = [];
    $status = 0;
    exec($commandLine . ' 2>&1', $output, $status);
    return ['status' => $status, 'output' => trim(implode("\n", $output))];
}

/** @return array{status: int, output: string} */
function b13xRunnerCommand(array $arguments, array $environmentOverrides = []): array
{
    $descriptors = [
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];
    $environment = array_merge(getenv(), $environmentOverrides);
    $process = proc_open($arguments, $descriptors, $pipes, null, $environment);
    if (!is_resource($process)) {
        throw new RuntimeException('Unable to start coverage subprocess.');
    }
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $status = proc_close($process);
    return ['status' => $status, 'output' => trim((string) $stdout . ($stderr !== '' ? "\n" . $stderr : ''))];
}

/** @return array<string, mixed> */
function b13xRunnerJsonCommand(array $arguments, array $environmentOverrides = []): array
{
    $result = b13xRunnerCommand($arguments, $environmentOverrides);
    $payload = json_decode(trim($result['output']), true);
    if (!is_array($payload)) {
        throw new RuntimeException('Expected JSON output from command: ' . implode(' ', $arguments));
    }
    $payload['_command_status'] = $result['status'];
    return $payload;
}

function b13xRunnerBaseUrl(array $options): string
{
    $baseUrl = trim((string) ($options['api-base-url'] ?? b13xRunnerEnv('SMOKE_API_BASE_URL')));
    if ($baseUrl === '') {
        throw new RuntimeException('Configure --api-base-url or SMOKE_API_BASE_URL.');
    }
    return rtrim($baseUrl, '/');
}

/** @return array<string, mixed> */
function b13xRunnerSentinel(array $options): array
{
    $script = realpath(__DIR__ . '/capture_write_sentinel.php');
    if (!is_string($script) || $script === '') {
        throw new RuntimeException('capture_write_sentinel.php not found.');
    }
    return b13xRunnerJsonCommand([PHP_BINARY, $script]);
}

/** @return array{strictTableCount: int, total: int, nonzero: array<string, int>} */
function b13xRunnerStrictSummary(array $sentinel): array
{
    $nonzero = [];
    foreach (DatasetResetPolicyV2::strictResetTables() as $table) {
        $rows = (int) (($sentinel['tables'][$table]['rowCount'] ?? 0));
        if ($rows > 0) {
            $nonzero[$table] = $rows;
        }
    }
    ksort($nonzero);
    return [
        'strictTableCount' => count(DatasetResetPolicyV2::strictResetTables()),
        'total' => array_sum($nonzero),
        'nonzero' => $nonzero,
    ];
}

/** @return array<string, array<string, mixed>> */
function b13xRunnerDiffSentinels(array $before, array $after): array
{
    $diff = [];
    foreach (DatasetResetPolicyV2::knownTables() as $table) {
        $beforeMetrics = $before['tables'][$table] ?? null;
        $afterMetrics = $after['tables'][$table] ?? null;
        if (!is_array($beforeMetrics) || !is_array($afterMetrics)) {
            $diff[$table] = [
                'table' => $table,
                'reason' => 'missing_metrics',
                'before' => $beforeMetrics,
                'after' => $afterMetrics,
            ];
            continue;
        }

        $beforeFingerprint = (string) ($beforeMetrics['fingerprint'] ?? '');
        $afterFingerprint = (string) ($afterMetrics['fingerprint'] ?? '');
        if ($beforeFingerprint !== '' && hash_equals($beforeFingerprint, $afterFingerprint)) {
            continue;
        }

        $diff[$table] = [
            'table' => $table,
            'reason' => 'fingerprint_changed',
            'classification' => DatasetResetPolicyV2::classificationFor($table),
            'before' => [
                'rowCount' => (int) ($beforeMetrics['rowCount'] ?? 0),
                'tableChecksum' => $beforeMetrics['tableChecksum'] ?? null,
                'fingerprint' => $beforeFingerprint,
            ],
            'after' => [
                'rowCount' => (int) ($afterMetrics['rowCount'] ?? 0),
                'tableChecksum' => $afterMetrics['tableChecksum'] ?? null,
                'fingerprint' => $afterFingerprint,
            ],
            'rowDelta' => (int) ($afterMetrics['rowCount'] ?? 0) - (int) ($beforeMetrics['rowCount'] ?? 0),
        ];
    }
    ksort($diff);
    return $diff;
}

/** @return array<string, mixed> */
function b13xRunnerInventory(): array
{
    $matrix = DatasetWriterFreezeReporter::coverageMatrix();
    return [
        'status' => DatasetWriterFreezeReporter::coverageBlockers() === [] ? 'PASS' : 'FAIL',
        'validationMethod' => DatasetWriterCoverageState::VALIDATION_METHOD,
        'legacyInventoryVersion' => DatasetWriterFreezeReporter::INVENTORY_VERSION,
        'coverageInventoryVersion' => DatasetWriterFreezeReporter::COVERAGE_VERSION,
        'legacyInventoryHash' => DatasetWriterFreezeReporter::inventoryHash(),
        'coverageInventoryHash' => DatasetWriterFreezeReporter::coverageInventoryHash(),
        'writers' => $matrix,
        'unknownWriteCapablePaths' => count(DatasetWriterFreezeReporter::coverageBlockers()),
        'coverageBlockers' => DatasetWriterFreezeReporter::coverageBlockers(),
    ];
}

/** @return array<string, mixed> */
function b13xRunnerPreflight(array $options): array
{
    $availabilityStateFile = b13xRunnerPathOption($options, 'availability-state-file');
    $availabilityRunId = trim((string) ($options['availability-run-id'] ?? ''));
    $availabilityKey = b13xRunnerReadKey(
        b13xRunnerEnv('B13X_AVAILABILITY_SAFE_KEY', b13xRunnerEnv('DATASET_RESET_FREEZE_EVIDENCE_KEY')),
        b13xRunnerPathOption($options, 'availability-key-file')
    );
    $resumeCommand = trim((string) ($options['resume-command'] ?? ''));
    $rollbackCommand = trim((string) ($options['rollback-command'] ?? ''));

    $availabilityState = DatasetAvailabilitySafeFreezeState::readStateFile($availabilityStateFile);
    $availabilityValidation = DatasetAvailabilitySafeFreezeState::validate($availabilityState, $availabilityRunId, $availabilityKey);
    $sentinel = b13xRunnerSentinel($options);
    $strict = b13xRunnerStrictSummary($sentinel);
    $coverageBlockers = DatasetWriterFreezeReporter::coverageBlockers();

    $blockers = [];
    if (!$availabilityValidation['valid']) {
        $blockers = array_merge($blockers, $availabilityValidation['blockers']);
    }
    if (strtoupper((string) ($availabilityState['status'] ?? '')) !== 'FROZEN') {
        $blockers[] = 'AVAILABILITY_SAFE_NOT_FROZEN';
    }
    if (strtolower((string) ($availabilityState['phase'] ?? '')) !== 'frozen') {
        $blockers[] = 'AVAILABILITY_SAFE_PHASE_NOT_FROZEN';
    }
    if ($strict['nonzero'] !== []) {
        $blockers[] = 'STRICT_NOT_ZERO';
    }
    if ($coverageBlockers !== []) {
        $blockers = array_merge($blockers, $coverageBlockers);
    }
    if ($resumeCommand === '') {
        $blockers[] = 'RESUME_COMMAND_MISSING';
    }
    if ($rollbackCommand === '') {
        $blockers[] = 'ROLLBACK_COMMAND_MISSING';
    }

    $blockers = array_values(array_unique($blockers));
    sort($blockers);

    return [
        'status' => $blockers === [] ? 'PASS' : 'FAIL',
        'availabilityValidation' => $availabilityValidation,
        'strict' => $strict,
        'coverageBlockers' => $coverageBlockers,
        'rollbackAvailable' => $rollbackCommand !== '',
        'resumeAvailable' => $resumeCommand !== '',
        'oldMethod' => DatasetAvailabilitySafeFreezeState::supersessionStatus($availabilityState),
        'availabilityState' => [
            'runId' => $availabilityState['runId'] ?? null,
            'status' => $availabilityState['status'] ?? null,
            'phase' => $availabilityState['phase'] ?? null,
            'frozenUnits' => $availabilityState['frozenUnits'] ?? [],
            'publicServingUnits' => $availabilityState['publicServingUnits'] ?? [],
        ],
        'blockers' => $blockers,
    ];
}

/** @return array<string, mixed> */
function b13xRunnerSmokeCommand(string $mode, array $options): array
{
    $script = realpath(__DIR__ . '/../tasks/production_smoke.php');
    if (!is_string($script) || $script === '') {
        throw new RuntimeException('production_smoke.php not found.');
    }

    $args = [
        PHP_BINARY,
        $script,
        '--api-base-url=' . b13xRunnerBaseUrl($options),
    ];

    $frontendBaseUrl = trim((string) ($options['frontend-base-url'] ?? b13xRunnerEnv('SMOKE_FRONTEND_BASE_URL')));
    if ($frontendBaseUrl !== '') {
        $args[] = '--frontend-base-url=' . rtrim($frontendBaseUrl, '/');
    }

    $args[] = '--auth-required=' . ($mode === 'PRODUCTION_SMOKE_AUTH' || $mode === 'PRODUCTION_SMOKE_ADMIN' ? 'true' : 'false');
    $args[] = '--admin-required=' . ($mode === 'PRODUCTION_SMOKE_ADMIN' ? 'true' : 'false');

    $adminSmoke = $mode === 'PRODUCTION_SMOKE_ADMIN';
    $emailOption = $adminSmoke ? 'admin-auth-email' : 'auth-email';
    $passwordOption = $adminSmoke ? 'admin-auth-password' : 'auth-password';
    $captchaOption = $adminSmoke ? 'admin-auth-captcha-token' : 'auth-captcha-token';
    $emailEnv = $adminSmoke ? 'SMOKE_ADMIN_EMAIL' : 'SMOKE_AUTH_EMAIL';
    $passwordEnv = $adminSmoke ? 'SMOKE_ADMIN_PASSWORD' : 'SMOKE_AUTH_PASSWORD';
    $captchaEnv = $adminSmoke ? 'SMOKE_ADMIN_CAPTCHA_TOKEN' : 'SMOKE_AUTH_CAPTCHA_TOKEN';

    $authEmail = trim((string) ($options[$emailOption] ?? b13xRunnerEnv($emailEnv)));
    $authPassword = (string) ($options[$passwordOption] ?? b13xRunnerEnv($passwordEnv));
    $authCaptchaToken = trim((string) ($options[$captchaOption] ?? b13xRunnerEnv($captchaEnv)));
    if ($adminSmoke && ($authEmail === '' || $authPassword === '')) {
        return [
            'success' => false,
            'error' => 'Dedicated admin smoke credentials are not configured.',
            '_command_status' => 2,
        ];
    }
    $smokeEnvironment = [];
    if ($authEmail !== '') $smokeEnvironment['SMOKE_AUTH_EMAIL'] = $authEmail;
    if ($authPassword !== '') $smokeEnvironment['SMOKE_AUTH_PASSWORD'] = $authPassword;
    if ($authCaptchaToken !== '') $smokeEnvironment['SMOKE_AUTH_CAPTCHA_TOKEN'] = $authCaptchaToken;

    return b13xRunnerJsonCommand($args, $smokeEnvironment);
}

/** @return array<string, mixed> */
function b13xRunnerHttpGet(string $path, array $options): array
{
    $url = b13xRunnerBaseUrl($options) . $path;
    $startedAt = microtime(true);
    $statusCode = 0;
    $body = '';
    $error = null;

    if (function_exists('curl_init')) {
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_HTTPHEADER => ['Accept: application/json', 'User-Agent: ConcursoMestreB13XCoverage/1.0'],
        ]);
        $body = (string) curl_exec($handle);
        $error = curl_error($handle) ?: null;
        $statusCode = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);
    } else {
        $body = @file_get_contents($url) ?: '';
        $error = $body === '' ? 'GET failed.' : null;
    }

    $json = json_decode(trim($body), true);
    return [
        'ok' => $statusCode >= 200 && $statusCode < 300 && $error === null && is_array($json),
        'statusCode' => $statusCode,
        'durationMs' => (int) round((microtime(true) - $startedAt) * 1000),
        'jsonOk' => is_array($json),
        'url' => $url,
        'error' => $error,
    ];
}

/** @return array<string, mixed> */
function b13xRunnerInvokeWriter(array $writer, array $options): array
{
    $profile = is_array($writer['coverage'] ?? null) ? $writer['coverage'] : [];
    $method = (string) ($profile['safeInvocationMethod'] ?? '');
    $entrypoint = (string) ($profile['entrypoint'] ?? '');
    $repoRoot = dirname(__DIR__, 3);

    if ($method === 'PRODUCTION_SMOKE_AUTH' || $method === 'PRODUCTION_SMOKE_ADMIN') {
        $smoke = b13xRunnerSmokeCommand($method, $options);
        return [
            'ok' => (bool) ($smoke['success'] ?? $smoke['ok'] ?? false),
            'result' => $smoke,
        ];
    }

    if ($method === 'HTTP_JSON_GET') {
        $probe = b13xRunnerHttpGet($entrypoint, $options);
        return ['ok' => (bool) $probe['ok'], 'result' => $probe];
    }

    if ($method === 'CLI_COVERAGE_NOOP') {
        $script = realpath($repoRoot . '/' . $entrypoint);
        if (!is_string($script) || $script === '') {
            throw new RuntimeException('Coverage-noop script not found: ' . $entrypoint);
        }
        $result = b13xRunnerJsonCommand([PHP_BINARY, $script, '--coverage-noop']);
        return [
            'ok' => ((int) ($result['_command_status'] ?? 1)) === 0,
            'result' => $result,
        ];
    }

    if ($method === 'CLI_DRY_RUN') {
        $script = realpath($repoRoot . '/' . $entrypoint);
        if (!is_string($script) || $script === '') {
            throw new RuntimeException('Dry-run script not found: ' . $entrypoint);
        }
        $args = [PHP_BINARY, $script];
        $args[] = str_contains($entrypoint, 'archive_user_answers.php') ? '--dry-run' : '--dry-run=true';
        $result = b13xRunnerJsonCommand($args);
        return [
            'ok' => ((int) ($result['_command_status'] ?? 1)) === 0,
            'result' => $result,
        ];
    }

    if ($method === 'SYSTEMD_STATE') {
        if (PHP_OS_FAMILY !== 'Linux' || !is_executable('/usr/bin/systemctl')) {
            throw new RuntimeException('systemd state validation requires Linux systemd.');
        }
        $units = array_filter(array_map('trim', explode(',', $entrypoint)));
        $resumeState = b13xRunnerSystemdResumeState($options);
        $states = [];
        foreach ($units as $unit) {
            $state = b13xRunnerCommand(['/usr/bin/systemctl', 'show', '--no-pager', $unit, '--property=ActiveState', '--property=SubState']);
            preg_match('/^ActiveState=(.*)$/m', $state['output'], $activeMatch);
            $actualActiveState = strtolower(trim((string) ($activeMatch[1] ?? '')));
            $expectedActiveState = DatasetWriterSystemdCoverage::expectedActiveState($resumeState, $unit);
            $evaluation = DatasetWriterSystemdCoverage::evaluate($expectedActiveState, $actualActiveState);
            $states[$unit] = [
                'ok' => $state['status'] === 0 && $evaluation['ok'],
                'classification' => $evaluation['classification'],
                'expectedActiveState' => $expectedActiveState,
                'actualActiveState' => $actualActiveState,
                'raw' => $state['output'],
            ];
        }
        $failed = array_values(array_filter($states, static fn (array $item): bool => !$item['ok']));
        return ['ok' => $failed === [], 'result' => ['units' => $states]];
    }

    if ($method === 'OBSERVE_ONLY') {
        return [
            'ok' => true,
            'result' => [
                'observationOnly' => true,
                'justification' => $profile['justification'] ?? '',
                'entrypoint' => $entrypoint,
            ],
        ];
    }

    if ($method === 'NOT_APPLICABLE') {
        return [
            'ok' => true,
            'result' => [
                'notApplicable' => true,
                'justification' => $profile['justification'] ?? '',
                'entrypoint' => $entrypoint,
            ],
        ];
    }

    throw new RuntimeException('Unsupported writer coverage method: ' . $method);
}

/** @return array<string, mixed> */
function b13xRunnerEvaluateWriter(array $writer, array $options): array
{
    $before = b13xRunnerSentinel($options);
    $invocation = b13xRunnerInvokeWriter($writer, $options);
    $after = b13xRunnerSentinel($options);
    $diff = b13xRunnerDiffSentinels($before, $after);

    $allowedTables = array_fill_keys(array_map('strval', $writer['tables_written'] ?? []), true);
    $profile = is_array($writer['coverage'] ?? null) ? $writer['coverage'] : [];
    if (($profile['safeInvocationMethod'] ?? '') === 'PRODUCTION_SMOKE_ADMIN') {
        // The read-only admin probe authenticates through the canonical auth
        // writer before checking RBAC-protected endpoints.
        $allowedTables['auth_sessions'] = true;
        $allowedTables['auth_refresh_tokens'] = true;
    }
    $strictDiffs = [];
    $unexpectedDiffs = [];
    foreach ($diff as $table => $change) {
        if (DatasetResetPolicyV2::classificationFor($table) === DatasetResetPolicyV2::CLASS_RESETTABLE_STRICT) {
            $strictDiffs[$table] = $change;
        }
        if (!isset($allowedTables[$table])) {
            $unexpectedDiffs[$table] = $change;
        }
    }

    $status = 'FAIL';
    if ($invocation['ok'] === true && $strictDiffs === [] && $unexpectedDiffs === []) {
        if (($profile['safeInvocationMethod'] ?? '') === 'NOT_APPLICABLE') {
            $status = 'NOT_APPLICABLE';
        } elseif (($profile['safeInvocationMethod'] ?? '') === 'OBSERVE_ONLY' || $diff === []) {
            $status = 'PASS_NOOP';
        } else {
            $status = 'PASS';
        }
    }

    return [
        'writerId' => $writer['writer_id'],
        'entrypoint' => $profile['entrypoint'] ?? null,
        'safeInvocationMethod' => $profile['safeInvocationMethod'] ?? null,
        'coverageClass' => $profile['coverageClass'] ?? null,
        'status' => $status,
        'beforeFingerprint' => $before['globalFingerprint'] ?? null,
        'afterFingerprint' => $after['globalFingerprint'] ?? null,
        'expectedDiffTables' => array_values(array_keys($allowedTables)),
        'actualDiffTables' => array_values(array_keys($diff)),
        'unexpectedStrictDiffs' => $strictDiffs,
        'unexpectedDiffs' => $unexpectedDiffs,
        'cleanup' => [
            'policy' => $profile['cleanupPolicy'] ?? 'NONE',
            'status' => ($profile['cleanupPolicy'] ?? 'NONE') === 'NONE' ? 'NOT_REQUIRED' : 'RUNTIME_ATTRIBUTION_ONLY',
        ],
        'invocation' => $invocation['result'],
    ];
}

/** @return array<string, mixed> */
function b13xRunnerVerifyState(array $state, array $options): array
{
    $results = is_array($state['writerResults'] ?? null) ? $state['writerResults'] : [];
    $matrix = DatasetWriterFreezeReporter::coverageMatrix();
    $missing = [];
    $executed = 0;
    $unexpectedStrict = 0;
    $unresolvedSyntheticRows = 0;

    foreach ($matrix as $writer) {
        $writerId = (string) $writer['writer_id'];
        $result = is_array($results[$writerId] ?? null) ? $results[$writerId] : null;
        if ($result === null) {
            $missing[] = $writerId;
            continue;
        }
        if (in_array((string) ($result['status'] ?? ''), ['PASS', 'PASS_NOOP', 'NOT_APPLICABLE'], true)) {
            $executed++;
        }
        $unexpectedStrict += count($result['unexpectedStrictDiffs'] ?? []);
        if (($result['cleanup']['status'] ?? '') === 'REQUIRED') {
            $unresolvedSyntheticRows++;
        }
    }

    $sentinel = b13xRunnerSentinel($options);
    $strict = b13xRunnerStrictSummary($sentinel);
    $coveragePercent = count($matrix) === 0 ? 0 : (int) round(($executed / count($matrix)) * 100);
    sort($missing);

    $blockers = [];
    if ($missing !== []) {
        $blockers[] = 'WRITER_RESULTS_MISSING';
    }
    if ($unexpectedStrict > 0) {
        $blockers[] = 'UNEXPECTED_STRICT_DIFFS';
    }
    if (is_array($state['supersededRun'] ?? null)
        && (($state['supersededRun']['result'] ?? null) !== 'SUPERSEDED_BY_METHOD_CHANGE')) {
        $blockers[] = 'OLD_METHOD_NOT_SUPERSEDED';
    }
    if ($strict['nonzero'] !== []) {
        $blockers[] = 'FINAL_STRICT_NONZERO';
    }
    if ($unresolvedSyntheticRows > 0) {
        $blockers[] = 'UNRESOLVED_SYNTHETIC_ROWS';
    }
    if (DatasetWriterFreezeReporter::coverageBlockers() !== []) {
        $blockers[] = 'UNKNOWN_WRITERS_PRESENT';
    }
    $blockers = array_values(array_unique($blockers));
    sort($blockers);

    return [
        'status' => $blockers === [] && $coveragePercent === 100 ? 'PASS' : 'FAIL',
        'missingWriters' => $missing,
        'executedWriters' => $executed,
        'totalKnownWriters' => count($matrix),
        'coveragePercent' => $coveragePercent,
        'unknownWriters' => count(DatasetWriterFreezeReporter::coverageBlockers()),
        'unexpectedStrictDiffs' => $unexpectedStrict,
        'finalStrict' => $strict,
        'unresolvedSyntheticRows' => $unresolvedSyntheticRows,
        'blockers' => $blockers,
    ];
}

try {
    $options = b13xRunnerOptions($argv);
    $mode = strtolower(trim((string) ($options['mode'] ?? 'inventory')));

    if (!in_array($mode, ['inventory', 'preflight', 'dry-run', 'resume', 'run-writer', 'run-all', 'verify', 'cleanup-synthetic', 'finalize', 'rollback'], true)) {
        throw new InvalidArgumentException('Unsupported mode.');
    }

    if ($mode === 'inventory') {
        echo json_encode(b13xRunnerInventory(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
        exit(0);
    }

    $coverageKey = b13xRunnerReadKey(
        b13xRunnerEnv('DATASET_RESET_FREEZE_EVIDENCE_KEY'),
        b13xRunnerPathOption($options, 'coverage-key-file')
    );
    $coverageStateFile = b13xRunnerPathOption($options, 'coverage-state-file');
    $runId = trim((string) ($options['run-id'] ?? ''));
    if ($runId === '' && $coverageStateFile !== '' && is_file($coverageStateFile)) {
        $runId = (string) (DatasetWriterCoverageState::readFile($coverageStateFile)['runId'] ?? '');
    }
    if ($runId === '') {
        throw new RuntimeException('Configure --run-id.');
    }

    if ($mode === 'preflight' || $mode === 'dry-run') {
        $preflight = b13xRunnerPreflight($options);
        $state = DatasetWriterCoverageState::initialState($runId, trim((string) ($options['availability-run-id'] ?? '')));
        $state = DatasetWriterCoverageState::transition($state, $preflight['status'] === 'PASS' ? 'PREFLIGHT_PASSED' : 'FINALIZED_FAIL', [
            'preflight' => $preflight,
            'dryRun' => $mode === 'dry-run',
        ]);
        if ($coverageStateFile !== '') {
            DatasetWriterCoverageState::writeFile($coverageStateFile, $state, $coverageKey);
        }
        echo json_encode([
            'status' => $preflight['status'],
            'mode' => $mode,
            'runId' => $runId,
            'validationMethod' => DatasetWriterCoverageState::VALIDATION_METHOD,
            'oldMethod' => $preflight['oldMethod'],
            'preflight' => $preflight,
            'plannedWriters' => array_values(array_map(
                static fn (array $writer): array => [
                    'writerId' => $writer['writer_id'],
                    'coverageClass' => $writer['coverage']['coverageClass'] ?? null,
                    'safeInvocationMethod' => $writer['coverage']['safeInvocationMethod'] ?? null,
                    'entrypoint' => $writer['coverage']['entrypoint'] ?? null,
                ],
                DatasetWriterFreezeReporter::coverageMatrix()
            )),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
        exit($preflight['status'] === 'PASS' ? 0 : 2);
    }

    $state = $coverageStateFile !== '' && is_file($coverageStateFile)
        ? DatasetWriterCoverageState::readFile($coverageStateFile)
        : DatasetWriterCoverageState::initialState($runId, trim((string) ($options['availability-run-id'] ?? '')));
    $stateValidation = DatasetWriterCoverageState::validate($state, $coverageKey);
    if (!$stateValidation['valid']) {
        throw new RuntimeException('Coverage state refused: ' . implode(', ', $stateValidation['blockers']));
    }

    if ($mode === 'resume') {
        $preflight = b13xRunnerPreflight($options);
        if ($preflight['status'] !== 'PASS') {
            throw new RuntimeException('Preflight must pass before resume.');
        }
        $resumeCommand = trim((string) ($options['resume-command'] ?? ''));
        $resumeResult = b13xRunnerShellCommand($resumeCommand);
        if ($resumeResult['status'] !== 0) {
            throw new RuntimeException('Resume command failed: ' . $resumeResult['output']);
        }
        $availabilityStateFile = b13xRunnerPathOption($options, 'availability-state-file');
        $availabilityRunId = trim((string) ($options['availability-run-id'] ?? ''));
        $availabilityKey = b13xRunnerReadKey(
            b13xRunnerEnv('B13X_AVAILABILITY_SAFE_KEY', b13xRunnerEnv('DATASET_RESET_FREEZE_EVIDENCE_KEY')),
            b13xRunnerPathOption($options, 'availability-key-file')
        );
        $availabilityState = DatasetAvailabilitySafeFreezeState::readStateFile($availabilityStateFile);
        $availabilityValidation = DatasetAvailabilitySafeFreezeState::validate($availabilityState, $availabilityRunId, $availabilityKey);
        if (!$availabilityValidation['valid']) {
            throw new RuntimeException('Availability-safe state refused after resume: ' . implode(', ', $availabilityValidation['blockers']));
        }
        $availabilityState = DatasetAvailabilitySafeFreezeState::supersede(
            $availabilityState,
            $runId,
            DatasetWriterCoverageState::VALIDATION_METHOD
        );
        DatasetAvailabilitySafeFreezeState::writeStateFile($availabilityStateFile, $availabilityState, $availabilityKey);
        $state = DatasetWriterCoverageState::transition($state, 'COVERAGE_VALIDATION', [
            'resumedAt' => gmdate(DATE_ATOM),
            'resumeResult' => $resumeResult['output'],
            'supersededAt' => gmdate(DATE_ATOM),
        ]);
        $state = DatasetWriterCoverageState::markSupersededRun($state, $availabilityStateFile);
        DatasetWriterCoverageState::writeFile($coverageStateFile, $state, $coverageKey);
        echo json_encode(['status' => 'PASS', 'mode' => 'resume', 'runId' => $runId], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
        exit(0);
    }

    if ($mode === 'run-writer' || $mode === 'run-all') {
        if (($state['status'] ?? '') !== 'COVERAGE_VALIDATION') {
            throw new RuntimeException('Coverage state must be in COVERAGE_VALIDATION before executing writers.');
        }

        $targetWriterId = trim((string) ($options['writer-id'] ?? ''));
        $outputs = [];
        foreach (DatasetWriterFreezeReporter::coverageMatrix() as $writer) {
            $writerId = (string) ($writer['writer_id'] ?? '');
            if ($mode === 'run-writer' && $writerId !== $targetWriterId) {
                continue;
            }
            $result = b13xRunnerEvaluateWriter($writer, $options);
            $outputs[$writerId] = $result;
            $state = DatasetWriterCoverageState::withWriterResult($state, $writerId, $result);
            DatasetWriterCoverageState::writeFile($coverageStateFile, $state, $coverageKey);
        }

        if ($mode === 'run-writer' && $outputs === []) {
            throw new RuntimeException('Writer not found: ' . $targetWriterId);
        }

        echo json_encode([
            'status' => count(array_filter($outputs, static fn (array $result): bool => ($result['status'] ?? '') === 'FAIL')) === 0 ? 'PASS' : 'FAIL',
            'mode' => $mode,
            'runId' => $runId,
            'writers' => $outputs,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
        exit(count(array_filter($outputs, static fn (array $result): bool => ($result['status'] ?? '') === 'FAIL')) === 0 ? 0 : 2);
    }

    if ($mode === 'cleanup-synthetic') {
        echo json_encode([
            'status' => 'PASS',
            'mode' => 'cleanup-synthetic',
            'runId' => $runId,
            'cleanup' => 'NOT_REQUIRED',
            'message' => 'No synthetic owned-row cleanup was registered by the canonical coverage run.',
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
        exit(0);
    }

    if ($mode === 'verify' || $mode === 'finalize') {
        $verification = b13xRunnerVerifyState($state, $options);
        $state = DatasetWriterCoverageState::withFinalCounters($state, [
            'unknownWriters' => $verification['unknownWriters'],
            'unexpectedStrictDiffs' => $verification['unexpectedStrictDiffs'],
            'finalStrictNonzero' => count($verification['finalStrict']['nonzero']),
            'unresolvedSyntheticRows' => $verification['unresolvedSyntheticRows'],
            'executedWriters' => $verification['executedWriters'],
            'totalWriters' => $verification['totalKnownWriters'],
            'coveragePercent' => $verification['coveragePercent'],
        ]);
        if ($mode === 'finalize') {
            $state = DatasetWriterCoverageState::transition(
                $state,
                $verification['status'] === 'PASS' ? 'FINALIZED_PASS' : 'FINALIZED_FAIL',
                ['finalizedAt' => gmdate(DATE_ATOM), 'verification' => $verification]
            );
            DatasetWriterCoverageState::writeFile($coverageStateFile, $state, $coverageKey);
        } elseif ($coverageStateFile !== '') {
            DatasetWriterCoverageState::writeFile($coverageStateFile, $state, $coverageKey);
        }

        echo json_encode([
            'status' => $verification['status'],
            'mode' => $mode,
            'runId' => $runId,
            'oldMethod' => (($state['supersededRun']['result'] ?? null) === 'SUPERSEDED_BY_METHOD_CHANGE') ? 'SUPERSEDED' : 'REMAINS_AUTHORITATIVE',
            'newMethod' => DatasetWriterCoverageState::VALIDATION_METHOD,
            'verification' => $verification,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
        exit($verification['status'] === 'PASS' ? 0 : 2);
    }

    if ($mode === 'rollback') {
        $rollbackCommand = trim((string) ($options['rollback-command'] ?? ''));
        if ($rollbackCommand === '') {
            throw new RuntimeException('Rollback command is required.');
        }
        $result = b13xRunnerShellCommand($rollbackCommand);
        if ($result['status'] !== 0) {
            throw new RuntimeException('Rollback command failed: ' . $result['output']);
        }
        $state = DatasetWriterCoverageState::transition($state, 'ROLLED_BACK', [
            'rolledBackAt' => gmdate(DATE_ATOM),
            'rollbackResult' => $result['output'],
        ]);
        DatasetWriterCoverageState::writeFile($coverageStateFile, $state, $coverageKey);
        echo json_encode(['status' => 'PASS', 'mode' => 'rollback', 'runId' => $runId], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
        exit(0);
    }

    throw new RuntimeException('Mode not implemented.');
} catch (Throwable $exception) {
    fwrite(STDERR, json_encode([
        'status' => 'FAIL',
        'message' => $exception->getMessage(),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL);
    exit(2);
}
