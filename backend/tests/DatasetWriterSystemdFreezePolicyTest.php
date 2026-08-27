<?php

declare(strict_types=1);

require_once __DIR__ . '/../scripts/data/DatasetWriterSystemdFreezePolicy.php';

function systemdPolicyAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$units = DatasetWriterSystemdFreezePolicy::units();
$names = DatasetWriterSystemdFreezePolicy::unitNames();
systemdPolicyAssert(count($units) === 15 && count($names) === 15, 'The exact systemd control inventory must contain 15 units.');
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
