<?php

declare(strict_types=1);

require_once __DIR__ . '/DatasetWriterFreezeReporter.php';

final class DatasetWriterCoverageState
{
    public const SCHEMA_VERSION = 'B13X_COVERAGE_STATE_V1';
    public const VALIDATION_METHOD = 'COVERAGE_BASED_WRITER_VALIDATION';

    /** @return array<string, mixed> */
    public static function sign(array $payload, string $key): array
    {
        if (strlen($key) < 32) {
            throw new InvalidArgumentException('Coverage state key must contain at least 32 bytes.');
        }

        unset($payload['signature']);
        $payload['schemaVersion'] = self::SCHEMA_VERSION;
        $payload['validationMethod'] = self::VALIDATION_METHOD;
        $payload['signature'] = hash_hmac('sha256', self::canonicalJson($payload), $key);
        return $payload;
    }

    /** @return array{valid: bool, blockers: list<string>} */
    public static function validate(array $state, string $key): array
    {
        $blockers = [];

        if (($state['schemaVersion'] ?? '') !== self::SCHEMA_VERSION) {
            $blockers[] = 'COVERAGE_STATE_SCHEMA_INVALID';
        }
        if (($state['validationMethod'] ?? '') !== self::VALIDATION_METHOD) {
            $blockers[] = 'COVERAGE_STATE_METHOD_INVALID';
        }
        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/', (string) ($state['runId'] ?? ''))) {
            $blockers[] = 'COVERAGE_STATE_RUN_ID_INVALID';
        }
        if (($state['coverageInventoryHash'] ?? '') !== DatasetWriterFreezeReporter::coverageInventoryHash()) {
            $blockers[] = 'COVERAGE_STATE_INVENTORY_MISMATCH';
        }
        if (!in_array((string) ($state['status'] ?? ''), [
            'PLANNED',
            'PREFLIGHT_PASSED',
            'COVERAGE_VALIDATION',
            'FINALIZED_PASS',
            'FINALIZED_FAIL',
            'ROLLED_BACK',
        ], true)) {
            $blockers[] = 'COVERAGE_STATE_STATUS_INVALID';
        }
        if (strlen($key) < 32) {
            $blockers[] = 'COVERAGE_STATE_KEY_INVALID';
        }

        $unsigned = $state;
        $signature = (string) ($state['signature'] ?? '');
        unset($unsigned['signature']);
        $expected = strlen($key) >= 32 ? hash_hmac('sha256', self::canonicalJson($unsigned), $key) : '';
        if ($signature === '' || $expected === '' || !hash_equals($expected, $signature)) {
            $blockers[] = 'COVERAGE_STATE_SIGNATURE_INVALID';
        }

        $blockers = array_values(array_unique($blockers));
        sort($blockers);
        return ['valid' => $blockers === [], 'blockers' => $blockers];
    }

    /** @return array<string, mixed> */
    public static function initialState(string $runId, ?string $supersededRunId = null): array
    {
        return [
            'runId' => $runId,
            'createdAt' => gmdate(DATE_ATOM),
            'updatedAt' => gmdate(DATE_ATOM),
            'status' => 'PLANNED',
            'coverageInventoryHash' => DatasetWriterFreezeReporter::coverageInventoryHash(),
            'legacyInventoryHash' => DatasetWriterFreezeReporter::inventoryHash(),
            'supersededRun' => $supersededRunId === null ? null : [
                'runId' => $supersededRunId,
                'previousMethod' => 'TIME_BASED_WINDOW_OBSERVATION',
                'result' => null,
                'preservedEvidence' => false,
            ],
            'writerResults' => [],
            'finalCounters' => [
                'unknownWriters' => 0,
                'unexpectedStrictDiffs' => 0,
                'finalStrictNonzero' => 0,
                'unresolvedSyntheticRows' => 0,
                'executedWriters' => 0,
                'totalWriters' => count(DatasetWriterFreezeReporter::coverageMatrix()),
                'coveragePercent' => 0,
            ],
        ];
    }

    /** @param array<string, mixed> $state @return array<string, mixed> */
    public static function markSupersededRun(array $state, string $stateFile): array
    {
        $state['supersededRun'] = array_merge(
            is_array($state['supersededRun'] ?? null) ? $state['supersededRun'] : [],
            [
                'previousMethod' => 'TIME_BASED_WINDOW_OBSERVATION',
                'result' => 'SUPERSEDED_BY_METHOD_CHANGE',
                'preservedEvidence' => true,
                'stateFile' => $stateFile,
            ]
        );
        $state['updatedAt'] = gmdate(DATE_ATOM);
        return $state;
    }

    /** @param array<string, mixed> $state @param array<string, mixed> $writerResult @return array<string, mixed> */
    public static function withWriterResult(array $state, string $writerId, array $writerResult): array
    {
        $state['writerResults'] = is_array($state['writerResults'] ?? null) ? $state['writerResults'] : [];
        $state['writerResults'][$writerId] = $writerResult;
        ksort($state['writerResults']);
        $state['updatedAt'] = gmdate(DATE_ATOM);
        return $state;
    }

    /** @param array<string, mixed> $state @param array<string, int|float> $counters @return array<string, mixed> */
    public static function withFinalCounters(array $state, array $counters): array
    {
        $state['finalCounters'] = array_merge(
            is_array($state['finalCounters'] ?? null) ? $state['finalCounters'] : [],
            $counters
        );
        $state['updatedAt'] = gmdate(DATE_ATOM);
        return $state;
    }

    /** @param array<string, mixed> $state @return array<string, mixed> */
    public static function transition(array $state, string $status, array $extra = []): array
    {
        $state['status'] = $status;
        foreach ($extra as $key => $value) {
            $state[$key] = $value;
        }
        $state['updatedAt'] = gmdate(DATE_ATOM);
        return $state;
    }

    /** @return array<string, mixed> */
    public static function readFile(string $path): array
    {
        if ($path === '' || !is_file($path) || !is_readable($path)) {
            throw new RuntimeException('Coverage state file is missing or unreadable.');
        }

        $payload = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($payload)) {
            throw new RuntimeException('Coverage state must be a JSON object.');
        }

        return $payload;
    }

    /** @param array<string, mixed> $state */
    public static function writeFile(string $path, array $state, string $key): void
    {
        if ($path === '' || str_contains(str_replace('\\', '/', $path), '../')) {
            throw new RuntimeException('A safe coverage state path is required.');
        }

        $directory = dirname($path);
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Unable to create the coverage state directory.');
        }

        $signed = self::sign($state, $key);
        $temporary = $path . '.tmp-' . bin2hex(random_bytes(4));
        file_put_contents(
            $temporary,
            json_encode($signed, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL,
            LOCK_EX
        );
        @chmod($temporary, 0600);
        if (!rename($temporary, $path)) {
            throw new RuntimeException('Unable to atomically publish the coverage state.');
        }
    }

    private static function canonicalJson(mixed $value): string
    {
        $normalize = static function (mixed $item) use (&$normalize): mixed {
            if (!is_array($item)) {
                return $item;
            }
            if (array_is_list($item)) {
                return array_map($normalize, $item);
            }
            ksort($item);
            foreach ($item as $key => $child) {
                $item[$key] = $normalize($child);
            }
            return $item;
        };

        return json_encode($normalize($value), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}
