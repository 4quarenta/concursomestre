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

require_once __DIR__ . '/../scripts/data/DatasetWriterFreezeEvidence.php';
require_once __DIR__ . '/../scripts/data/DatasetWriterSystemdFreezePolicy.php';

function freezeEvidenceAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$now = 1_800_000_000;
$key = str_repeat('writer-freeze-test-key-', 2);
$context = [
    'runId' => 'reset-run-20260824-001',
    'targetKind' => 'DISPOSABLE_REHEARSAL',
    'targetFingerprint' => 'target-fingerprint-a',
    'inventoryHash' => DatasetWriterFreezeReporter::inventoryHash(),
    'hostFingerprint' => DatasetWriterFreezeEvidence::hostFingerprint(),
    'bootId' => DatasetWriterSystemdFreezePolicy::bootId(),
    'systemdVersion' => DatasetWriterSystemdFreezePolicy::systemdVersion(),
    'mechanismVersion' => DatasetWriterSystemdFreezePolicy::VERSION,
    'requiredUnits' => DatasetWriterSystemdFreezePolicy::unitNames(),
    'now' => $now,
];
$unitStates = [];
$units = DatasetWriterSystemdFreezePolicy::units();
$representativeUnit = (string) $units[0]['unit'];
foreach ($units as $unit) {
    $unitStates[(string) $unit['unit']] = [
        'kind' => (string) $unit['kind'],
        'activeState' => 'inactive',
        'dropInLoaded' => true,
        'refuseManualStart' => 'yes',
        'restart' => 'no',
        'runtimeMask' => false,
    ];
}
$base = [
    'runId' => $context['runId'],
    'targetKind' => $context['targetKind'],
    'targetFingerprint' => $context['targetFingerprint'],
    'writerInventoryHash' => $context['inventoryHash'],
    'hostFingerprint' => $context['hostFingerprint'],
    'bootId' => $context['bootId'],
    'systemdVersion' => $context['systemdVersion'],
    'suppressionMechanismVersion' => $context['mechanismVersion'],
    'freezeStateStatus' => 'FROZEN',
    'freezeStateHash' => str_repeat('a', 64),
    'generatedAt' => gmdate(DATE_ATOM, $now - 5),
    'observationStartedAt' => gmdate(DATE_ATOM, $now - 50),
    'observationEndedAt' => gmdate(DATE_ATOM, $now - 5),
    'expiresAt' => gmdate(DATE_ATOM, $now + 300),
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
        'cronFrozen' => true,
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
    'quiescence' => [
        'passed' => true,
        'unexpectedWrites' => 0,
        'beforeFingerprint' => 'stable-sentinel',
        'afterFingerprint' => 'stable-sentinel',
    ],
];

$valid = DatasetWriterFreezeEvidence::sign($base, $key);
freezeEvidenceAssert(DatasetWriterFreezeEvidence::validate($valid, $context, $key)['valid'], 'Valid signed freeze evidence must pass.');

$beforeObservation = ['database' => 'expected', 'globalFingerprint' => 'stable', 'targetSnapshotFingerprint' => 'target-a'];
$afterObservation = $beforeObservation;
freezeEvidenceAssert(DatasetWriterFreezeEvidence::validateObservationBinding($beforeObservation, $afterObservation, 'target-a')['valid'], 'Observed target binding must pass for one stable database snapshot.');
foreach ([
    'SENTINEL_DATABASE_MISMATCH' => [$beforeObservation, [...$afterObservation, 'database' => 'other'], 'target-a'],
    'SENTINEL_FINGERPRINT_MISMATCH' => [$beforeObservation, [...$afterObservation, 'globalFingerprint' => 'changed'], 'target-a'],
    'OBSERVED_TARGET_FINGERPRINT_MISMATCH' => [$beforeObservation, $afterObservation, 'production-target-b'],
] as $expectedBlocker => [$beforeFixture, $afterFixture, $providedTarget]) {
    $binding = DatasetWriterFreezeEvidence::validateObservationBinding($beforeFixture, $afterFixture, $providedTarget);
    freezeEvidenceAssert(!$binding['valid'] && in_array($expectedBlocker, $binding['blockers'], true), 'Observation binding did not reject: ' . $expectedBlocker);
}

$cases = [
    'FREEZE_EVIDENCE_MISSING' => [],
    'FREEZE_EVIDENCE_SCHEMA_INVALID' => [...$valid, 'schemaVersion' => 'WRITER_FREEZE_EVIDENCE_V1'],
    'FREEZE_EVIDENCE_STALE' => DatasetWriterFreezeEvidence::sign([...$base, 'generatedAt' => gmdate(DATE_ATOM, $now - 1000), 'expiresAt' => gmdate(DATE_ATOM, $now - 1)], $key),
    'FREEZE_EVIDENCE_STALE_OBSERVATION' => DatasetWriterFreezeEvidence::sign([
        ...$base,
        'observationStartedAt' => gmdate(DATE_ATOM, $now - 1100),
        'observationEndedAt' => gmdate(DATE_ATOM, $now - 1000),
    ], $key),
    'FREEZE_TARGET_FINGERPRINT_MISMATCH' => DatasetWriterFreezeEvidence::sign([...$base, 'targetFingerprint' => 'wrong'], $key),
    'WRITER_INVENTORY_MISMATCH' => DatasetWriterFreezeEvidence::sign([...$base, 'writerInventoryHash' => str_repeat('0', 64)], $key),
    'FREEZE_HOST_FINGERPRINT_MISMATCH' => DatasetWriterFreezeEvidence::sign([...$base, 'hostFingerprint' => str_repeat('0', 64)], $key),
    'FREEZE_BOOT_ID_MISMATCH' => DatasetWriterFreezeEvidence::sign([...$base, 'bootId' => str_repeat('0', 64)], $key),
    'FREEZE_SYSTEMD_VERSION_MISMATCH' => DatasetWriterFreezeEvidence::sign([...$base, 'systemdVersion' => 'systemd 0 (invalid)'], $key),
    'FREEZE_SUPPRESSION_MECHANISM_MISMATCH' => DatasetWriterFreezeEvidence::sign([...$base, 'suppressionMechanismVersion' => 'OLD_MECHANISM'], $key),
    'FREEZE_STATE_NOT_FROZEN' => DatasetWriterFreezeEvidence::sign([...$base, 'freezeStateStatus' => 'RESUMED'], $key),
    'FREEZE_UNIT_ACTIVE' => DatasetWriterFreezeEvidence::sign([
        ...$base,
        'suppression' => [...$base['suppression'], 'unitStates' => [...$unitStates, $representativeUnit => [...$unitStates[$representativeUnit], 'activeState' => 'active']]],
    ], $key),
    'FREEZE_DROPIN_MISSING' => DatasetWriterFreezeEvidence::sign([
        ...$base,
        'suppression' => [...$base['suppression'], 'unitStates' => [...$unitStates, $representativeUnit => [...$unitStates[$representativeUnit], 'dropInLoaded' => false]]],
    ], $key),
    'TRIGGER_ACTIVE_UNEXPECTEDLY' => DatasetWriterFreezeEvidence::sign([...$base, 'suppression' => [...$base['suppression'], 'triggersFrozen' => false]], $key),
    'CRON_NOT_FROZEN' => DatasetWriterFreezeEvidence::sign([...$base, 'suppression' => [...$base['suppression'], 'cronFrozen' => false]], $key),
    'MYSQL_WRITER_SESSION_PRESENT' => DatasetWriterFreezeEvidence::sign([...$base, 'suppression' => [...$base['suppression'], 'mysqlWriterSessions' => ['pid:123']]], $key),
    'UNEXPECTED_RUNTIME_MASK_PRESENT' => DatasetWriterFreezeEvidence::sign([...$base, 'suppression' => [...$base['suppression'], 'runtimeMasksPresent' => true]], $key),
    'MANUAL_START_ATTEMPT_DETECTED' => DatasetWriterFreezeEvidence::sign([...$base, 'manualStartAttemptsDetected' => true], $key),
    'UNEXPECTED_WRITER_PRESENT' => DatasetWriterFreezeEvidence::sign([...$base, 'unexpectedWriters' => ['rogue-writer']], $key),
    'WRITER_RESUMED_EARLY' => DatasetWriterFreezeEvidence::sign([...$base, 'earlyResumeDetected' => true], $key),
    'QUIESCENCE_FAILED' => DatasetWriterFreezeEvidence::sign([...$base, 'quiescence' => [...$base['quiescence'], 'passed' => false]], $key),
    'REQUIRED_WRITER_NOT_FROZEN' => DatasetWriterFreezeEvidence::sign([...$base, 'frozenWriterIds' => []], $key),
    'FREEZE_EVIDENCE_SIGNATURE_INVALID' => [...$valid, 'signature' => str_repeat('0', 64)],
];
foreach ($cases as $expected => $evidence) {
    if ($expected === 'FREEZE_EVIDENCE_MISSING') {
        freezeEvidenceAssert($evidence === [], 'Missing evidence fixture must remain empty; reset tool covers file absence.');
        continue;
    }
    $result = DatasetWriterFreezeEvidence::validate($evidence, $context, $key);
    $expectedBlocker = match ($expected) {
        'FREEZE_EVIDENCE_STALE_OBSERVATION' => 'FREEZE_EVIDENCE_STALE',
        'FREEZE_UNIT_ACTIVE' => 'FREEZE_UNIT_ACTIVE:' . $representativeUnit,
        'FREEZE_DROPIN_MISSING' => 'FREEZE_DROPIN_MISSING:' . $representativeUnit,
        default => $expected,
    };
    freezeEvidenceAssert(!$result['valid'] && in_array($expectedBlocker, $result['blockers'], true), 'Freeze guard did not reject: ' . $expected . ' (' . implode(', ', $result['blockers']) . ')');
}

$duplicateIds = DatasetWriterFreezeReporter::requiredFreezeWriterIds();
$duplicateIds[] = $duplicateIds[0];
$deduped = DatasetWriterFreezeEvidence::sign([...$base, 'frozenWriterIds' => $duplicateIds], $key);
freezeEvidenceAssert(DatasetWriterFreezeEvidence::validate($deduped, $context, $key)['valid'], 'Duplicate process evidence must not imply duplicate processing.');

$health = array_fill_keys(DatasetWriterFreezeReporter::requiredFreezeWriterIds(), 'PASS');
$resume = DatasetWriterFreezeReporter::evaluateResume($health, ['job-a', 'job-b']);
freezeEvidenceAssert($resume['passed'], 'All required writers must resume healthy without duplicate processing.');
$resumeMissing = DatasetWriterFreezeReporter::evaluateResume([...$health, array_key_first($health) => 'FAIL'], ['job-a']);
freezeEvidenceAssert(!$resumeMissing['passed'] && $resumeMissing['missingOrUnhealthy'] !== [], 'Unhealthy resumed writer must fail.');
$resumeDuplicate = DatasetWriterFreezeReporter::evaluateResume($health, ['job-a', 'job-a']);
freezeEvidenceAssert(!$resumeDuplicate['passed'] && $resumeDuplicate['duplicateProcessingKeys'] === ['job-a'], 'Duplicate processing must fail resume validation.');

fwrite(STDOUT, "Machine-verifiable writer freeze evidence assertions passed.\n");
