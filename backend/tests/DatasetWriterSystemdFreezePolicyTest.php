<?php

declare(strict_types=1);

require_once __DIR__ . '/../scripts/data/DatasetWriterSystemdFreezePolicy.php';

function systemdPolicyAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$units = DatasetWriterSystemdFreezePolicy::units();
$names = DatasetWriterSystemdFreezePolicy::unitNames();
systemdPolicyAssert(count($units) === 11 && count($names) === 11, 'The strict-writer systemd control inventory must contain 11 units.');
systemdPolicyAssert(DatasetWriterSystemdFreezePolicy::availabilitySafeFreezeGuard()['valid'], 'Public serving units must remain outside the strict freeze inventory.');
foreach (DatasetWriterSystemdFreezePolicy::publicServingLayerUnits() as $unit) {
    systemdPolicyAssert(DatasetWriterSystemdFreezePolicy::classifyUnit($unit) === DatasetWriterSystemdFreezePolicy::CLASS_SERVING_LAYER, 'Serving unit classification drifted: ' . $unit);
    systemdPolicyAssert(!in_array($unit, $names, true), 'Serving unit must never be stopped by strict freeze: ' . $unit);
}
systemdPolicyAssert(DatasetWriterSystemdFreezePolicy::classifyUnit('unknown.service') === DatasetWriterSystemdFreezePolicy::CLASS_UNKNOWN, 'Unknown units must fail closed as UNKNOWN.');
systemdPolicyAssert(DatasetWriterSystemdFreezePolicy::freezeDecision('nginx.service') === 'LEAVE_RUNNING', 'Serving units must remain running during a strict freeze.');
systemdPolicyAssert(DatasetWriterSystemdFreezePolicy::freezeDecision('unknown.service') === 'REJECT_UNKNOWN', 'Unknown units must be rejected rather than broadly suppressed.');
systemdPolicyAssert(count(DatasetWriterFreezeReporter::requiredFreezeWriterIds()) === 20, 'The authoritative MUST_FREEZE inventory must contain 20 writers.');
systemdPolicyAssert(DatasetWriterSystemdFreezePolicy::controlCoverageBlockers() === [], 'Every MUST_FREEZE writer requires explicit suppression controls.');

$runId = 'phase11b-r-test-001';
foreach ($units as $unit) {
    $name = (string) $unit['unit'];
    $dropIn = DatasetWriterSystemdFreezePolicy::dropInContent($name, $runId);
    systemdPolicyAssert(str_contains($dropIn, "RefuseManualStart=yes\n"), 'Drop-in must deny manual starts: ' . $name);
    systemdPolicyAssert(str_contains($dropIn, 'ConditionPathExists=' . DatasetWriterSystemdFreezePolicy::runRoot($runId) . '/allow-start'), 'Drop-in must deny dependency activation: ' . $name);
    if (($unit['kind'] ?? '') === 'service') {
        systemdPolicyAssert(str_contains($dropIn, "[Service]\nRestart=no\n"), 'Service drop-in must disable autorestart: ' . $name);
    }
    systemdPolicyAssert(($unit['expectedNames'] ?? []) === [$name], 'Unexpected unit alias must fail inventory validation.');
}

$key = str_repeat('phase11b-r-state-key-', 2);
$state = DatasetWriterSystemdFreezePolicy::signState([
    'runId' => $runId,
    'targetKind' => 'DISPOSABLE_REHEARSAL',
    'mechanismVersion' => DatasetWriterSystemdFreezePolicy::VERSION,
    'hostFingerprint' => DatasetWriterFreezeEvidence::hostFingerprint(),
    'bootId' => DatasetWriterSystemdFreezePolicy::bootId(),
    'systemdVersion' => DatasetWriterSystemdFreezePolicy::systemdVersion(),
    'writerInventoryHash' => DatasetWriterFreezeReporter::inventoryHash(),
    'status' => 'FROZEN',
], $key);
systemdPolicyAssert(DatasetWriterSystemdFreezePolicy::validateState($state, $runId, $key)['valid'], 'Current signed runtime state must validate.');

$invalidBoot = DatasetWriterSystemdFreezePolicy::signState([...$state, 'bootId' => str_repeat('0', 64)], $key);
$bootResult = DatasetWriterSystemdFreezePolicy::validateState($invalidBoot, $runId, $key);
systemdPolicyAssert(!$bootResult['valid'] && in_array('FREEZE_STATE_BOOT_ID_MISMATCH', $bootResult['blockers'], true), 'Boot change must invalidate runtime state.');

$tampered = [...$state, 'status' => 'RESUMED'];
$tamperResult = DatasetWriterSystemdFreezePolicy::validateState($tampered, $runId, $key);
systemdPolicyAssert(!$tamperResult['valid'] && in_array('FREEZE_STATE_SIGNATURE_INVALID', $tamperResult['blockers'], true), 'Tampered runtime state must fail HMAC validation.');

fwrite(STDOUT, "Systemd writer freeze policy assertions passed.\n");
