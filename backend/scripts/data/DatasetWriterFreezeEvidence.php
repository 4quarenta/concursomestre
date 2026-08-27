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

require_once __DIR__ . '/DatasetWriterFreezeReporter.php';

final class DatasetWriterFreezeEvidence
{
    public const SCHEMA_VERSION = 'WRITER_FREEZE_EVIDENCE_V2';
    public const MAX_AGE_SECONDS = 900;
    public const MIN_OBSERVATION_SECONDS = 30;

    public static function hostFingerprint(): string
    {
        $machineId = PHP_OS_FAMILY === 'Linux' && is_readable('/etc/machine-id')
            ? trim((string) file_get_contents('/etc/machine-id'))
            : php_uname('n') . '|' . PHP_OS_FAMILY;
        if ($machineId === '') {
            throw new RuntimeException('Unable to identify the freeze evidence host.');
        }
        return hash('sha256', $machineId);
    }

    /**
     * @param array<string, mixed> $before
     * @param array<string, mixed> $after
     * @return array{valid: bool, blockers: list<string>}
     */
    public static function validateObservationBinding(array $before, array $after, string $targetFingerprint): array
    {
        $blockers = [];
        if (($before['database'] ?? '') === '' || ($before['database'] ?? '') !== ($after['database'] ?? '')) {
            $blockers[] = 'SENTINEL_DATABASE_MISMATCH';
        }
        if (($before['globalFingerprint'] ?? '') === ''
            || !hash_equals((string) $before['globalFingerprint'], (string) ($after['globalFingerprint'] ?? ''))) {
            $blockers[] = 'SENTINEL_FINGERPRINT_MISMATCH';
        }
        $observedTarget = (string) ($before['targetSnapshotFingerprint'] ?? '');
        if ($observedTarget === ''
            || !hash_equals($observedTarget, (string) ($after['targetSnapshotFingerprint'] ?? ''))
            || !hash_equals($observedTarget, $targetFingerprint)) {
            $blockers[] = 'OBSERVED_TARGET_FINGERPRINT_MISMATCH';
        }
        return ['valid' => $blockers === [], 'blockers' => $blockers];
    }

    /** @param array<string, mixed> $payload */
    public static function sign(array $payload, string $key): array
    {
        if (strlen($key) < 32) throw new InvalidArgumentException('Freeze evidence key must contain at least 32 bytes.');
        unset($payload['signature']);
        $payload['schemaVersion'] = self::SCHEMA_VERSION;
        $payload['signature'] = hash_hmac('sha256', self::canonicalJson($payload), $key);
        return $payload;
    }

    /**
     * @param array<string, mixed> $evidence
     * @param array{runId: string, targetKind: string, targetFingerprint: string, inventoryHash: string, hostFingerprint: string, bootId: string, systemdVersion: string, mechanismVersion: string, requiredUnits: list<string>, now: int} $context
     * @return array{valid: bool, blockers: list<string>}
     */
    public static function validate(array $evidence, array $context, string $key): array
    {
        $blockers = [];
        if (strlen($key) < 32) $blockers[] = 'FREEZE_EVIDENCE_KEY_INVALID';
        if (($evidence['schemaVersion'] ?? '') !== self::SCHEMA_VERSION) $blockers[] = 'FREEZE_EVIDENCE_SCHEMA_INVALID';
        if (($evidence['runId'] ?? '') !== $context['runId'] || !preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/', (string) ($evidence['runId'] ?? ''))) $blockers[] = 'FREEZE_RUN_ID_MISMATCH';
        if (($evidence['targetKind'] ?? '') !== $context['targetKind']) $blockers[] = 'FREEZE_TARGET_KIND_MISMATCH';
        if (($evidence['targetFingerprint'] ?? '') !== $context['targetFingerprint']) $blockers[] = 'FREEZE_TARGET_FINGERPRINT_MISMATCH';
        if (($evidence['writerInventoryHash'] ?? '') !== $context['inventoryHash']) $blockers[] = 'WRITER_INVENTORY_MISMATCH';
        if (($evidence['hostFingerprint'] ?? '') !== $context['hostFingerprint']) $blockers[] = 'FREEZE_HOST_FINGERPRINT_MISMATCH';
        if (($evidence['bootId'] ?? '') !== $context['bootId']) $blockers[] = 'FREEZE_BOOT_ID_MISMATCH';
        if (($evidence['systemdVersion'] ?? '') !== $context['systemdVersion']) $blockers[] = 'FREEZE_SYSTEMD_VERSION_MISMATCH';
        if (($evidence['suppressionMechanismVersion'] ?? '') !== $context['mechanismVersion']) $blockers[] = 'FREEZE_SUPPRESSION_MECHANISM_MISMATCH';
        if (($evidence['freezeStateStatus'] ?? '') !== 'FROZEN') $blockers[] = 'FREEZE_STATE_NOT_FROZEN';
        if (!preg_match('/^[a-f0-9]{64}$/', (string) ($evidence['freezeStateHash'] ?? ''))) $blockers[] = 'FREEZE_STATE_HASH_INVALID';

        $generated = self::timestamp($evidence['generatedAt'] ?? null);
        $started = self::timestamp($evidence['observationStartedAt'] ?? null);
        $ended = self::timestamp($evidence['observationEndedAt'] ?? null);
        $expires = self::timestamp($evidence['expiresAt'] ?? null);
        $now = $context['now'];
        if ($generated === null || $started === null || $ended === null || $expires === null) {
            $blockers[] = 'FREEZE_EVIDENCE_TIME_INVALID';
        } else {
            if ($generated > $now + 30
                || $now - $generated > self::MAX_AGE_SECONDS
                || $now - $ended > self::MAX_AGE_SECONDS
                || $expires < $now) {
                $blockers[] = 'FREEZE_EVIDENCE_STALE';
            }
            if ($ended < $started || $ended - $started < self::MIN_OBSERVATION_SECONDS || $generated < $ended) $blockers[] = 'QUIESCENCE_WINDOW_INVALID';
        }

        $required = DatasetWriterFreezeReporter::requiredFreezeWriterIds();
        $frozen = array_values(array_unique(array_map('strval', is_array($evidence['frozenWriterIds'] ?? null) ? $evidence['frozenWriterIds'] : [])));
        sort($frozen);
        if (array_diff($required, $frozen) !== []) $blockers[] = 'REQUIRED_WRITER_NOT_FROZEN';
        if (($evidence['unexpectedWriters'] ?? ['invalid']) !== []) $blockers[] = 'UNEXPECTED_WRITER_PRESENT';
        if (($evidence['earlyResumeDetected'] ?? true) !== false) $blockers[] = 'WRITER_RESUMED_EARLY';
        if (($evidence['manualStartAttemptsDetected'] ?? true) !== false) $blockers[] = 'MANUAL_START_ATTEMPT_DETECTED';
        if (($evidence['quiescence']['passed'] ?? false) !== true) $blockers[] = 'QUIESCENCE_FAILED';
        if ((int) ($evidence['quiescence']['unexpectedWrites'] ?? -1) !== 0) $blockers[] = 'UNEXPECTED_DATABASE_WRITE';
        if (($evidence['quiescence']['beforeFingerprint'] ?? '') === ''
            || !hash_equals((string) ($evidence['quiescence']['beforeFingerprint'] ?? ''), (string) ($evidence['quiescence']['afterFingerprint'] ?? ''))) {
            $blockers[] = 'SENTINEL_FINGERPRINT_MISMATCH';
        }
        foreach (['barrierActive', 'producersFrozen', 'consumersFrozen', 'schedulesFrozen', 'autorestartHandled', 'inFlightOperationsDrained', 'representativeEnvironment', 'resumePlanValidated'] as $flag) {
            if (($evidence[$flag] ?? false) !== true) $blockers[] = strtoupper(preg_replace('/(?<!^)[A-Z]/', '_$0', $flag) ?? $flag) . '_MISSING';
        }

        $suppression = is_array($evidence['suppression'] ?? null) ? $evidence['suppression'] : [];
        if (($suppression['runtimeOnly'] ?? false) !== true) $blockers[] = 'RUNTIME_ONLY_SUPPRESSION_MISSING';
        if (($suppression['dropInsVerified'] ?? false) !== true) $blockers[] = 'RUNTIME_DROPIN_VERIFICATION_MISSING';
        if (($suppression['runtimeMasksPresent'] ?? true) !== false) $blockers[] = 'UNEXPECTED_RUNTIME_MASK_PRESENT';
        if (($suppression['triggersFrozen'] ?? false) !== true) $blockers[] = 'TRIGGER_ACTIVE_UNEXPECTEDLY';
        if (($suppression['cronFrozen'] ?? false) !== true) $blockers[] = 'CRON_NOT_FROZEN';
        if (($suppression['mysqlWriterSessions'] ?? ['invalid']) !== []) $blockers[] = 'MYSQL_WRITER_SESSION_PRESENT';
        if (($suppression['rebootInvalidatesEvidence'] ?? false) !== true) $blockers[] = 'REBOOT_INVALIDATION_MISSING';

        $requiredUnits = array_values(array_unique(array_map('strval', $context['requiredUnits'])));
        sort($requiredUnits);
        $unitStates = is_array($suppression['unitStates'] ?? null) ? $suppression['unitStates'] : [];
        $observedUnits = array_values(array_unique(array_map('strval', array_keys($unitStates))));
        sort($observedUnits);
        if ($observedUnits !== $requiredUnits) $blockers[] = 'FREEZE_UNIT_COVERAGE_MISMATCH';
        foreach ($requiredUnits as $unit) {
            $state = is_array($unitStates[$unit] ?? null) ? $unitStates[$unit] : [];
            if (!in_array((string) ($state['activeState'] ?? ''), ['inactive', 'failed'], true)) $blockers[] = 'FREEZE_UNIT_ACTIVE:' . $unit;
            if (($state['dropInLoaded'] ?? false) !== true) $blockers[] = 'FREEZE_DROPIN_MISSING:' . $unit;
            if (($state['refuseManualStart'] ?? '') !== 'yes') $blockers[] = 'FREEZE_MANUAL_START_ALLOWED:' . $unit;
            if (($state['kind'] ?? '') === 'service' && ($state['restart'] ?? '') !== 'no') $blockers[] = 'FREEZE_AUTORESTART_ENABLED:' . $unit;
            if (($state['runtimeMask'] ?? false) !== false) $blockers[] = 'FREEZE_UNEXPECTED_MASK:' . $unit;
        }

        $attackProof = is_array($evidence['representativeAttackProof'] ?? null) ? $evidence['representativeAttackProof'] : [];
        foreach (['manualStartDenied', 'restartDenied', 'dependencyActivationDenied', 'timerActivationDenied', 'autorestartSuppressed'] as $flag) {
            if (($attackProof[$flag] ?? false) !== true) $blockers[] = 'REPRESENTATIVE_ATTACK_PROOF_MISSING:' . $flag;
        }

        $signature = (string) ($evidence['signature'] ?? '');
        $unsigned = $evidence;
        unset($unsigned['signature']);
        $expected = strlen($key) >= 32 ? hash_hmac('sha256', self::canonicalJson($unsigned), $key) : '';
        if ($signature === '' || $expected === '' || !hash_equals($expected, $signature)) $blockers[] = 'FREEZE_EVIDENCE_SIGNATURE_INVALID';

        $blockers = array_values(array_unique($blockers));
        sort($blockers);
        return ['valid' => $blockers === [], 'blockers' => $blockers];
    }

    private static function timestamp(mixed $value): ?int
    {
        if (!is_string($value) || trim($value) === '') return null;
        $timestamp = strtotime($value);
        return $timestamp === false ? null : $timestamp;
    }

    private static function canonicalJson(mixed $value): string
    {
        $normalize = static function (mixed $item) use (&$normalize): mixed {
            if (!is_array($item)) return $item;
            if (array_is_list($item)) return array_map($normalize, $item);
            ksort($item);
            foreach ($item as $key => $child) $item[$key] = $normalize($child);
            return $item;
        };
        return json_encode($normalize($value), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}
