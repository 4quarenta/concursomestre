<?php

declare(strict_types=1);

final class DatasetAvailabilitySafeFreezeState
{
    public const SCHEMA_VERSION = 'AVAILABILITY_SAFE_FREEZE_V1';

    /** @return array<string, mixed> */
    public static function sign(array $payload, string $key): array
    {
        if (strlen($key) < 32) {
            throw new InvalidArgumentException('Availability-safe freeze key must contain at least 32 bytes.');
        }

        unset($payload['signature']);
        $payload['schemaVersion'] = self::SCHEMA_VERSION;
        $payload['signature'] = hash_hmac('sha256', self::canonicalJson($payload), $key);
        return $payload;
    }

    /** @return array{valid: bool, blockers: list<string>} */
    public static function validate(array $state, string $expectedRunId, string $key): array
    {
        $blockers = [];

        if (($state['schemaVersion'] ?? '') !== self::SCHEMA_VERSION) {
            $blockers[] = 'AVAILABILITY_SAFE_SCHEMA_INVALID';
        }
        if (($state['runId'] ?? '') !== $expectedRunId) {
            $blockers[] = 'AVAILABILITY_SAFE_RUN_ID_MISMATCH';
        }
        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/', (string) ($state['runId'] ?? ''))) {
            $blockers[] = 'AVAILABILITY_SAFE_RUN_ID_INVALID';
        }

        $status = strtoupper(trim((string) ($state['status'] ?? '')));
        if (!in_array($status, ['FROZEN', 'RESUMED', 'FINALIZED_PASS', 'FINALIZED_FAIL', 'SUPERSEDED'], true)) {
            $blockers[] = 'AVAILABILITY_SAFE_STATUS_INVALID';
        }

        $phase = strtolower(trim((string) ($state['phase'] ?? '')));
        if (!in_array($phase, ['frozen', 'coverage_validation', 'observing', 'finalized', 'superseded'], true)) {
            $blockers[] = 'AVAILABILITY_SAFE_PHASE_INVALID';
        }

        if (!self::isIsoUtcTimestamp((string) ($state['createdAt'] ?? ''))) {
            $blockers[] = 'AVAILABILITY_SAFE_CREATED_AT_INVALID';
        }

        $startEpoch = (int) ($state['startEpoch'] ?? 0);
        $deadlineEpoch = (int) ($state['deadlineEpoch'] ?? 0);
        if ($startEpoch <= 0 || $deadlineEpoch <= 0 || $deadlineEpoch < $startEpoch) {
            $blockers[] = 'AVAILABILITY_SAFE_WINDOW_INVALID';
        }

        if (!is_array($state['publicServingUnits'] ?? null) || ($state['publicServingUnits'] ?? []) === []) {
            $blockers[] = 'AVAILABILITY_SAFE_SERVING_UNITS_MISSING';
        }

        if ($phase === 'frozen') {
            if (!is_array($state['frozenUnits'] ?? null) || ($state['frozenUnits'] ?? []) === []) {
                $blockers[] = 'AVAILABILITY_SAFE_FROZEN_UNITS_MISSING';
            }

            $httpBoundary = is_array($state['httpWriteBoundary'] ?? null) ? $state['httpWriteBoundary'] : [];
            $allowedMethods = $httpBoundary['allowedMethods'] ?? null;
            if ((string) ($httpBoundary['path'] ?? '') === '' || !preg_match('/^[a-f0-9]{64}$/', (string) ($httpBoundary['sha256'] ?? ''))) {
                $blockers[] = 'AVAILABILITY_SAFE_HTTP_BOUNDARY_INVALID';
            }
            if (!is_array($allowedMethods) || $allowedMethods === []) {
                $blockers[] = 'AVAILABILITY_SAFE_ALLOWED_METHODS_INVALID';
            }
        }

        if ($phase === 'observing' && !preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/', (string) ($state['firstWindow'] ?? ''))) {
            $blockers[] = 'AVAILABILITY_SAFE_FIRST_WINDOW_INVALID';
        }

        if ($phase === 'superseded') {
            if (!self::isIsoUtcTimestamp((string) ($state['supersededAt'] ?? ''))) {
                $blockers[] = 'AVAILABILITY_SAFE_SUPERSEDED_AT_INVALID';
            }
            if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/', (string) ($state['supersededByRunId'] ?? ''))) {
                $blockers[] = 'AVAILABILITY_SAFE_SUPERSEDED_BY_RUN_INVALID';
            }
            if (trim((string) ($state['supersededByMethod'] ?? '')) === '') {
                $blockers[] = 'AVAILABILITY_SAFE_SUPERSEDED_BY_METHOD_INVALID';
            }
        }

        if (strlen($key) < 32) {
            $blockers[] = 'AVAILABILITY_SAFE_KEY_INVALID';
        }

        $unsigned = $state;
        $signature = (string) ($state['signature'] ?? '');
        unset($unsigned['signature']);
        $expected = strlen($key) >= 32 ? hash_hmac('sha256', self::canonicalJson($unsigned), $key) : '';
        if ($signature === '' || $expected === '' || !hash_equals($expected, $signature)) {
            $blockers[] = 'AVAILABILITY_SAFE_SIGNATURE_INVALID';
        }

        $blockers = array_values(array_unique($blockers));
        sort($blockers);
        return ['valid' => $blockers === [], 'blockers' => $blockers];
    }

    /** @return array<string, mixed> */
    public static function readStateFile(string $path): array
    {
        if ($path === '' || !is_file($path) || !is_readable($path)) {
            throw new RuntimeException('Availability-safe freeze state is missing or unreadable.');
        }

        $payload = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($payload)) {
            throw new RuntimeException('Availability-safe freeze state must be a JSON object.');
        }

        return $payload;
    }

    /** @param array<string, mixed> $state @return array<string, mixed> */
    public static function supersede(array $state, string $coverageRunId, string $coverageMethod): array
    {
        if (self::supersessionStatus($state) === 'SUPERSEDED') {
            return $state;
        }

        $state['supersededAt'] = gmdate(DATE_ATOM);
        $state['supersededByRunId'] = $coverageRunId;
        $state['supersededByMethod'] = $coverageMethod;
        $state['supersession'] = [
            'result' => 'SUPERSEDED_BY_METHOD_CHANGE',
            'previousStatus' => (string) ($state['status'] ?? ''),
            'previousPhase' => (string) ($state['phase'] ?? ''),
            'preservedEvidence' => true,
        ];
        $state['status'] = 'SUPERSEDED';
        $state['phase'] = 'superseded';
        return $state;
    }

    public static function supersessionStatus(array $state): string
    {
        $status = strtoupper(trim((string) ($state['status'] ?? '')));
        $phase = strtolower(trim((string) ($state['phase'] ?? '')));
        return $status === 'SUPERSEDED' || $phase === 'superseded'
            ? 'SUPERSEDED'
            : 'REMAINS_AUTHORITATIVE';
    }

    /** @param array<string, mixed> $state */
    public static function writeStateFile(string $path, array $state, string $key): void
    {
        if ($path === '' || str_contains(str_replace('\\', '/', $path), '../')) {
            throw new RuntimeException('A safe availability-safe state path is required.');
        }

        $directory = dirname($path);
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Unable to create the availability-safe state directory.');
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
            throw new RuntimeException('Unable to atomically publish the availability-safe state.');
        }
    }

    private static function isIsoUtcTimestamp(string $value): bool
    {
        return $value !== '' && strtotime($value) !== false;
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
