<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved.
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Writer freeze manager is CLI-only.\n");
}

require_once __DIR__ . '/DatasetWriterSystemdFreezePolicy.php';
require_once __DIR__ . '/DatasetWriterFreezeEvidence.php';

/** @return array<string, string|bool> */
function systemdFreezeOptions(array $arguments): array
{
    $options = ['attack-tests' => false];
    foreach (array_slice($arguments, 1) as $argument) {
        if ($argument === '--attack-tests') {
            $options['attack-tests'] = true;
            continue;
        }
        if (!str_starts_with($argument, '--') || !str_contains($argument, '=')) throw new InvalidArgumentException('Every option must use --name=value.');
        [$key, $value] = explode('=', substr($argument, 2), 2);
        if (!preg_match('/^[a-z][a-z0-9-]*$/', $key)) throw new InvalidArgumentException('Invalid option name.');
        $options[$key] = trim($value);
    }
    return $options;
}

function systemdFreezeEnv(string $key): string
{
    $value = $_ENV[$key] ?? getenv($key);
    $value = $value === false || $value === null ? '' : trim((string) $value);
    if ($value === '') throw new RuntimeException('Required environment variable missing: ' . $key);
    return $value;
}

/** @return array{status: int, output: string} */
function systemdFreezeCommand(array $arguments): array
{
    $command = implode(' ', array_map('escapeshellarg', $arguments));
    $output = [];
    $status = 0;
    exec($command . ' 2>&1', $output, $status);
    return ['status' => $status, 'output' => trim(implode("\n", $output))];
}

/** @return array<string, string> */
function systemdFreezeInspectUnit(string $unit): array
{
    $properties = ['Id', 'Names', 'LoadState', 'ActiveState', 'SubState', 'UnitFileState', 'FragmentPath', 'DropInPaths', 'RefuseManualStart', 'Restart', 'Triggers', 'TriggeredBy'];
    $arguments = ['/usr/bin/systemctl', 'show', '--no-pager', $unit];
    foreach ($properties as $property) $arguments[] = '--property=' . $property;
    $result = systemdFreezeCommand($arguments);
    if ($result['status'] !== 0) throw new RuntimeException('Unable to inspect systemd unit: ' . $unit);
    $values = [];
    foreach (explode("\n", $result['output']) as $line) {
        if (!str_contains($line, '=')) continue;
        [$key, $value] = explode('=', $line, 2);
        $values[$key] = $value;
    }
    return $values;
}

/** @return list<string> */
function systemdFreezeList(string $value): array
{
    $values = preg_split('/\s+/', trim($value), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $values = array_values(array_unique(array_map(static fn (string $item): string => trim($item, '"'), $values)));
    sort($values);
    return $values;
}

/** @param array<string, mixed> $state */
function systemdFreezeWriteState(string $path, array $state, string $key): void
{
    if ($path === '' || str_contains(str_replace('\\', '/', $path), '../')) throw new RuntimeException('A safe state path is required.');
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('Unable to create state directory.');
    $signed = DatasetWriterSystemdFreezePolicy::signState($state, $key);
    $temporary = $path . '.tmp-' . bin2hex(random_bytes(4));
    file_put_contents($temporary, json_encode($signed, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL, LOCK_EX);
    chmod($temporary, 0600);
    if (!rename($temporary, $path)) throw new RuntimeException('Unable to atomically publish freeze state.');
}

/** @return array<string, mixed> */
function systemdFreezeReadState(string $path): array
{
    if ($path === '' || !is_file($path) || !is_readable($path)) throw new RuntimeException('Freeze state is missing or unreadable.');
    $state = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($state)) throw new RuntimeException('Freeze state must contain a JSON object.');
    return $state;
}

/** @param array<string, mixed> $state */
function systemdFreezeRemoveSuppression(array $state): void
{
    foreach (DatasetWriterSystemdFreezePolicy::unitNames() as $unit) {
        $path = DatasetWriterSystemdFreezePolicy::dropInPath($unit);
        if (is_file($path)) unlink($path);
        $directory = dirname($path);
        if (is_dir($directory)) @rmdir($directory);
    }
    $runId = (string) ($state['runId'] ?? '');
    if ($runId !== '') {
        $runRoot = DatasetWriterSystemdFreezePolicy::runRoot($runId);
        if (is_dir($runRoot)) @rmdir($runRoot);
    }
    systemdFreezeCommand(['/usr/bin/systemctl', 'daemon-reload']);
}

/** @param array<string, mixed> $state */
function systemdFreezeRestoreOriginalState(array $state): array
{
    systemdFreezeRemoveSuppression($state);
    $results = [];
    $original = is_array($state['units'] ?? null) ? $state['units'] : [];
    foreach (DatasetWriterSystemdFreezePolicy::resumeOrder() as $unit) {
        if (($original[$unit]['ActiveState'] ?? '') !== 'active') continue;
        $result = systemdFreezeCommand(['/usr/bin/systemctl', 'start', $unit]);
        $results[$unit] = $result['status'] === 0 ? 'PASS' : 'FAIL';
    }
    foreach (DatasetWriterSystemdFreezePolicy::unitNames() as $unit) {
        $expected = (string) ($original[$unit]['ActiveState'] ?? '');
        $actual = (string) (systemdFreezeInspectUnit($unit)['ActiveState'] ?? '');
        if ($expected === 'active' && $actual !== 'active') $results[$unit] = 'FAIL';
        if ($expected !== 'active' && $actual === 'active') $results[$unit] = 'FAIL';
        $results[$unit] ??= 'PASS';
    }
    ksort($results);
    return $results;
}

try {
    if (PHP_OS_FAMILY !== 'Linux' || !is_executable('/usr/bin/systemctl')) throw new RuntimeException('Writer freeze operations require Linux systemd.');
    if (function_exists('posix_geteuid') && posix_geteuid() !== 0) throw new RuntimeException('Writer freeze operations require root.');
    $options = systemdFreezeOptions($argv);
    $mode = strtolower((string) ($options['mode'] ?? ''));
    $runId = (string) ($options['run-id'] ?? '');
    $statePath = (string) ($options['state-file'] ?? '');
    $targetKind = strtoupper((string) ($options['target-kind'] ?? ''));
    $key = systemdFreezeEnv('DATASET_RESET_FREEZE_EVIDENCE_KEY');
    if (systemdFreezeEnv('DATASET_WRITER_FREEZE_OPERATION_ALLOWED') !== '1') throw new RuntimeException('Writer freeze operation guard is missing.');
    if (!in_array($targetKind, ['DISPOSABLE_REHEARSAL', 'PRODUCTION'], true)) throw new RuntimeException('Invalid target kind.');
    if ($targetKind === 'PRODUCTION'
        && (strtolower(systemdFreezeEnv('APP_ENV')) !== 'production'
            || systemdFreezeEnv('DATASET_WRITER_FREEZE_PRODUCTION_ALLOWED') !== '1')) {
        throw new RuntimeException('Production writer freeze guard is missing.');
    }
    if (($options['attack-tests'] ?? false) === true && $targetKind !== 'DISPOSABLE_REHEARSAL') throw new RuntimeException('Active attack tests are restricted to disposable rehearsal.');
    if (DatasetWriterSystemdFreezePolicy::controlCoverageBlockers() !== []) throw new RuntimeException('Writer control coverage is incomplete.');

    if ($mode === 'freeze') {
        if (is_file($statePath)) throw new RuntimeException('Stale freeze state exists.');
        $runRoot = DatasetWriterSystemdFreezePolicy::runRoot($runId);
        if (file_exists($runRoot)) throw new RuntimeException('Stale runtime freeze root exists.');
        $units = [];
        foreach (DatasetWriterSystemdFreezePolicy::units() as $entry) {
            $unit = (string) $entry['unit'];
            $maskPath = '/run/systemd/system/' . $unit;
            if (is_link($maskPath) && readlink($maskPath) === '/dev/null') throw new RuntimeException('Stale runtime mask exists: ' . $unit);
            if (file_exists(DatasetWriterSystemdFreezePolicy::dropInPath($unit))) throw new RuntimeException('Stale runtime drop-in exists: ' . $unit);
            $observed = systemdFreezeInspectUnit($unit);
            if (($observed['LoadState'] ?? '') !== 'loaded') throw new RuntimeException('Unit is not loaded: ' . $unit);
            if (!in_array((string) ($observed['FragmentPath'] ?? ''), $entry['fragmentPaths'], true)) throw new RuntimeException('Unit fragment drift: ' . $unit);
            if (systemdFreezeList((string) ($observed['Names'] ?? '')) !== $entry['expectedNames']) throw new RuntimeException('Unit alias drift: ' . $unit);
            if (systemdFreezeList((string) ($observed['Triggers'] ?? '')) !== $entry['triggers']) throw new RuntimeException('Unit trigger drift: ' . $unit);
            if (systemdFreezeList((string) ($observed['TriggeredBy'] ?? '')) !== $entry['triggeredBy']) throw new RuntimeException('Unit reverse-trigger drift: ' . $unit);
            $units[$unit] = $observed;
        }
        $state = [
            'runId' => $runId,
            'targetKind' => $targetKind,
            'mechanismVersion' => DatasetWriterSystemdFreezePolicy::VERSION,
            'hostFingerprint' => DatasetWriterFreezeEvidence::hostFingerprint(),
            'bootId' => DatasetWriterSystemdFreezePolicy::bootId(),
            'systemdVersion' => DatasetWriterSystemdFreezePolicy::systemdVersion(),
            'writerInventoryHash' => DatasetWriterFreezeReporter::inventoryHash(),
            'capturedAt' => gmdate(DATE_ATOM),
            'status' => 'ARMING',
            'units' => $units,
            'attackTests' => [],
        ];
        systemdFreezeWriteState($statePath, $state, $key);
        try {
            if (!mkdir($runRoot, 0700, true) && !is_dir($runRoot)) throw new RuntimeException('Unable to create runtime freeze root.');
            foreach (DatasetWriterSystemdFreezePolicy::unitNames() as $unit) {
                $path = DatasetWriterSystemdFreezePolicy::dropInPath($unit);
                $directory = dirname($path);
                if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('Unable to create runtime drop-in directory.');
                $temporary = $path . '.tmp';
                file_put_contents($temporary, DatasetWriterSystemdFreezePolicy::dropInContent($unit, $runId), LOCK_EX);
                chmod($temporary, 0600);
                if (!rename($temporary, $path)) throw new RuntimeException('Unable to publish runtime drop-in.');
            }
            $reload = systemdFreezeCommand(['/usr/bin/systemctl', 'daemon-reload']);
            if ($reload['status'] !== 0) throw new RuntimeException('systemd daemon-reload failed.');
            foreach (DatasetWriterSystemdFreezePolicy::units() as $entry) {
                $unit = (string) $entry['unit'];
                $observed = systemdFreezeInspectUnit($unit);
                if (($observed['RefuseManualStart'] ?? '') !== 'yes') throw new RuntimeException('Manual-start suppression was not armed: ' . $unit);
                if (($entry['kind'] ?? '') === 'service' && ($observed['Restart'] ?? '') !== 'no') throw new RuntimeException('Autorestart suppression was not armed: ' . $unit);
                if (!str_contains((string) ($observed['DropInPaths'] ?? ''), DatasetWriterSystemdFreezePolicy::dropInPath($unit))) throw new RuntimeException('Runtime drop-in is not loaded: ' . $unit);
            }
            foreach (DatasetWriterSystemdFreezePolicy::stopOrder() as $unit) {
                $stop = systemdFreezeCommand(['/usr/bin/systemctl', 'stop', $unit]);
                if ($stop['status'] !== 0) throw new RuntimeException('Unable to stop suppressed unit: ' . $unit);
            }
            $attackResults = [];
            $dependencyResults = [];
            foreach (DatasetWriterSystemdFreezePolicy::unitNames() as $unit) {
                $observed = systemdFreezeInspectUnit($unit);
                if (!in_array((string) ($observed['ActiveState'] ?? ''), ['inactive', 'failed'], true)) throw new RuntimeException('Suppressed unit remains active: ' . $unit);
                if (($options['attack-tests'] ?? false) === true) {
                    $start = systemdFreezeCommand(['/usr/bin/systemctl', 'start', $unit]);
                    $restart = systemdFreezeCommand(['/usr/bin/systemctl', 'restart', $unit]);
                    $afterAttack = systemdFreezeInspectUnit($unit);
                    $denied = $start['status'] !== 0 && $restart['status'] !== 0
                        && in_array((string) ($afterAttack['ActiveState'] ?? ''), ['inactive', 'failed'], true);
                    $attackResults[$unit] = $denied ? 'DENIED' : 'BYPASS';
                    if (!$denied) throw new RuntimeException('Suppression attack bypass: ' . $unit);

                    $transient = 'cm-freeze-dependency-' . substr(hash('sha256', $runId . '|' . $unit), 0, 16) . '.service';
                    $dependency = systemdFreezeCommand([
                        '/usr/bin/systemd-run',
                        '--quiet',
                        '--unit=' . $transient,
                        '--property=Wants=' . $unit,
                        '/usr/bin/true',
                    ]);
                    $afterDependency = systemdFreezeInspectUnit($unit);
                    $dependencyDenied = $dependency['status'] === 0
                        && in_array((string) ($afterDependency['ActiveState'] ?? ''), ['inactive', 'failed'], true);
                    $dependencyResults[$unit] = $dependencyDenied ? 'DENIED' : 'BYPASS';
                    systemdFreezeCommand(['/usr/bin/systemctl', 'reset-failed', $transient]);
                    if (!$dependencyDenied) throw new RuntimeException('Dependency activation bypass: ' . $unit);
                }
            }
            $state['status'] = 'FROZEN';
            $state['frozenAt'] = gmdate(DATE_ATOM);
            $state['attackTests'] = $attackResults;
            $state['dependencyAttackTests'] = $dependencyResults;
            $state['dropInStateHash'] = hash('sha256', json_encode(array_map(
                static fn (string $unit): string => hash('sha256', (string) file_get_contents(DatasetWriterSystemdFreezePolicy::dropInPath($unit))),
                DatasetWriterSystemdFreezePolicy::unitNames()
            ), JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
            systemdFreezeWriteState($statePath, $state, $key);
        } catch (Throwable $exception) {
            $recovery = systemdFreezeRestoreOriginalState($state);
            $state['status'] = 'FREEZE_FAILED_RECOVERED';
            $state['failure'] = $exception->getMessage();
            $state['recovery'] = $recovery;
            systemdFreezeWriteState($statePath, $state, $key);
            throw $exception;
        }
        echo json_encode(['status' => 'FROZEN', 'runId' => $runId, 'units' => count($units), 'mechanismVersion' => DatasetWriterSystemdFreezePolicy::VERSION], JSON_UNESCAPED_SLASHES) . PHP_EOL;
        exit(0);
    }

    if ($mode === 'resume') {
        $state = systemdFreezeReadState($statePath);
        $validation = DatasetWriterSystemdFreezePolicy::validateState($state, $runId, $key);
        if (!$validation['valid']) throw new RuntimeException('Freeze state refused: ' . implode(', ', $validation['blockers']));
        if (($state['status'] ?? '') === 'RESUMED') {
            echo json_encode(['status' => 'RESUMED', 'runId' => $runId, 'idempotent' => true], JSON_UNESCAPED_SLASHES) . PHP_EOL;
            exit(0);
        }
        if (($state['status'] ?? '') !== 'FROZEN') throw new RuntimeException('Only a fully frozen state can resume.');
        $results = systemdFreezeRestoreOriginalState($state);
        if (in_array('FAIL', $results, true)) throw new RuntimeException('Resume failed to restore original unit states.');
        $state['status'] = 'RESUMED';
        $state['resumedAt'] = gmdate(DATE_ATOM);
        $state['resume'] = $results;
        systemdFreezeWriteState($statePath, $state, $key);
        echo json_encode(['status' => 'RESUMED', 'runId' => $runId, 'idempotent' => false, 'health' => '100%'], JSON_UNESCAPED_SLASHES) . PHP_EOL;
        exit(0);
    }

    throw new InvalidArgumentException('Use --mode=freeze or --mode=resume.');
} catch (Throwable $exception) {
    fwrite(STDERR, json_encode(['status' => 'REFUSED', 'message' => $exception->getMessage()], JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}
