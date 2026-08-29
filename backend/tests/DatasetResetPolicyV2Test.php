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

require_once __DIR__ . '/../scripts/data/DatasetResetPolicyV2.php';

function resetPolicyAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$preserve = DatasetResetPolicyV2::preserveTables();
$reset = DatasetResetPolicyV2::resetTables();
$strict = DatasetResetPolicyV2::strictResetTables();
$runtime = DatasetResetPolicyV2::runtimeRecreatableTables();
$mutableInfrastructure = DatasetResetPolicyV2::mutableInfrastructureTables();
$known = DatasetResetPolicyV2::knownTables();
resetPolicyAssert(count($preserve) === 12, 'Preserve manifest count changed without review.');
resetPolicyAssert(count($reset) === 131, 'Reset allowlist count changed without review.');
resetPolicyAssert(count($strict) === 127, 'Strict resettable count changed without review.');
resetPolicyAssert(count($runtime) === 4, 'Runtime recreatable count changed without review.');
resetPolicyAssert(count($mutableInfrastructure) === 1, 'Mutable infrastructure manifest count changed without review.');
resetPolicyAssert(count($known) === 144, 'Policy must classify all 144 measured tables.');
resetPolicyAssert(array_intersect($preserve, $reset) === [], 'Preserve and reset tables overlap.');
resetPolicyAssert(array_intersect($strict, $runtime) === [], 'Strict and runtime resettable tables overlap.');
$resetClassUnion = array_values(array_unique([...$strict, ...$runtime]));
sort($resetClassUnion);
resetPolicyAssert($resetClassUnion === $reset, 'Reset class union drifted.');

resetPolicyAssert($runtime === [
    'auth_refresh_tokens',
    'auth_sessions',
    'user_cards',
    'user_statistics',
], 'Only the four forensically proven tables may be runtime recreatable.');

foreach (['users', 'system_settings', 'plans', 'schema_migrations', 'filter_types'] as $table) {
    resetPolicyAssert(in_array($table, $preserve, true), 'Required preserve table missing: ' . $table);
    resetPolicyAssert(!in_array($table, $reset, true), 'Required preserve table leaked into reset: ' . $table);
}
foreach (['user_answers', 'auth_sessions', 'transactions', 'questions', 'filters', 'simulations'] as $table) {
    resetPolicyAssert(in_array($table, $reset, true), 'RESET_POLICY_V2 table missing: ' . $table);
}
foreach ($runtime as $table) {
    resetPolicyAssert(in_array($table, $reset, true), 'Runtime table must remain resettable: ' . $table);
    resetPolicyAssert(!in_array($table, $preserve, true), 'Runtime table must never become PRESERVE: ' . $table);
    resetPolicyAssert(
        DatasetResetPolicyV2::classificationFor($table) === DatasetResetPolicyV2::CLASS_RESETTABLE_RECREATABLE_RUNTIME,
        'Runtime classification mismatch: ' . $table
    );
}
resetPolicyAssert(
    DatasetResetPolicyV2::classificationFor('questions') === DatasetResetPolicyV2::CLASS_RESETTABLE_STRICT,
    'Questions must remain strict resettable.'
);
resetPolicyAssert(
    DatasetResetPolicyV2::classificationFor('users') === DatasetResetPolicyV2::CLASS_PRESERVE,
    'Users must remain preserve.'
);
resetPolicyAssert(
    DatasetResetPolicyV2::classificationFor('seo_dataset_revisions') === DatasetResetPolicyV2::CLASS_MUTABLE_INFRASTRUCTURE,
    'Sitemap revision authority must remain mutable infrastructure.'
);

$valid = DatasetResetPolicyV2::validateAgainstSchema($known);
resetPolicyAssert($valid['ok'], 'Measured schema must match policy.');
resetPolicyAssert($valid['classCounts'] === [
    DatasetResetPolicyV2::CLASS_PRESERVE => 12,
    DatasetResetPolicyV2::CLASS_MUTABLE_INFRASTRUCTURE => 1,
    DatasetResetPolicyV2::CLASS_RESETTABLE_STRICT => 127,
    DatasetResetPolicyV2::CLASS_RESETTABLE_RECREATABLE_RUNTIME => 4,
], 'Policy class counts drifted.');
$withUnknown = DatasetResetPolicyV2::validateAgainstSchema([...$known, 'unexpected_table']);
resetPolicyAssert(!$withUnknown['ok'] && $withUnknown['unknownTables'] === ['unexpected_table'], 'Unknown table must fail closed.');
$withoutUsers = DatasetResetPolicyV2::validateAgainstSchema(array_values(array_diff($known, ['users'])));
resetPolicyAssert(!$withoutUsers['ok'] && in_array('users', $withoutUsers['missingPolicyTables'], true), 'Missing users table must fail closed.');

$snapshot = [
    'database' => 'disposable_reset',
    'structuralFingerprint' => 'structure-a',
    'tableCounts' => ['users' => 6, 'questions' => 10],
    'preserveSnapshots' => ['users' => ['rows' => 6, 'digest' => 'users-a']],
    'policyValidation' => ['ok' => true],
    'resetOrder' => DatasetResetPolicyV2::resetTables(),
    'resetOrderCycles' => [],
    'preservedChildDependencies' => [],
];
$manifest = [
    'policyVersion' => DatasetResetPolicyV2::VERSION,
    'database' => 'disposable_reset',
    'structuralFingerprint' => 'structure-a',
    'expectedCounts' => $snapshot['tableCounts'],
    'preserveSnapshots' => $snapshot['preserveSnapshots'],
    'approvedForExecution' => true,
    'targetKind' => 'DISPOSABLE_REHEARSAL',
];
$guards = [
    'databaseBackup' => ['created' => true, 'checksumValid' => true, 'restoreRehearsalPassed' => true],
    'assetBackup' => ['created' => true, 'restoreRehearsalPassed' => true],
    'writerFreeze' => ['rehearsalPassed' => true, 'currentlyFrozen' => true],
];

$ready = DatasetResetGuardEvaluator::evaluateReadiness($snapshot, $manifest, $guards);
resetPolicyAssert($ready['ready'], 'Complete readiness evidence should pass.');

$guardCases = [
    'TARGET_FINGERPRINT_MISMATCH' => fn () => [$snapshot, [...$manifest, 'structuralFingerprint' => 'wrong'], $guards],
    'EXPECTED_COUNT_MISMATCH' => fn () => [$snapshot, [...$manifest, 'expectedCounts' => ['users' => 5]], $guards],
    'BACKUP_MISSING' => fn () => [$snapshot, $manifest, [...$guards, 'databaseBackup' => [...$guards['databaseBackup'], 'created' => false]]],
    'BACKUP_CHECKSUM_INVALID' => fn () => [$snapshot, $manifest, [...$guards, 'databaseBackup' => [...$guards['databaseBackup'], 'checksumValid' => false]]],
    'RESTORE_REHEARSAL_MISSING' => fn () => [$snapshot, $manifest, [...$guards, 'databaseBackup' => [...$guards['databaseBackup'], 'restoreRehearsalPassed' => false]]],
    'ASSET_RESTORE_REHEARSAL_MISSING' => fn () => [$snapshot, $manifest, [...$guards, 'assetBackup' => [...$guards['assetBackup'], 'restoreRehearsalPassed' => false]]],
    'WRITER_FREEZE_REHEARSAL_MISSING' => fn () => [$snapshot, $manifest, [...$guards, 'writerFreeze' => [...$guards['writerFreeze'], 'rehearsalPassed' => false]]],
    'FK_RESET_ORDER_CYCLE' => fn () => [[...$snapshot, 'resetOrderCycles' => ['filters']], $manifest, $guards],
    'INCOMPLETE_FK_RESET_ORDER' => fn () => [[...$snapshot, 'resetOrder' => []], $manifest, $guards],
    'PRESERVED_CHILD_DEPENDS_ON_RESET_PARENT' => fn () => [[...$snapshot, 'preservedChildDependencies' => [['childTable' => 'users', 'parentTable' => 'filters']]], $manifest, $guards],
];
foreach ($guardCases as $expectedBlocker => $factory) {
    [$caseSnapshot, $caseManifest, $caseGuards] = $factory();
    $result = DatasetResetGuardEvaluator::evaluateReadiness($caseSnapshot, $caseManifest, $caseGuards);
    resetPolicyAssert(!$result['ready'] && in_array($expectedBlocker, $result['blockers'], true), 'Guard did not fail: ' . $expectedBlocker);
}

$execution = DatasetResetGuardEvaluator::evaluateExecution(
    $snapshot,
    $manifest,
    $guards,
    DatasetResetPolicyV2::EXECUTION_TOKEN,
    'disposable_reset',
    'DISPOSABLE_REHEARSAL',
    true,
    true
);
resetPolicyAssert($execution['allowed'], 'Fully guarded disposable execution should be allowed.');

$invalidToken = DatasetResetGuardEvaluator::evaluateExecution(
    $snapshot,
    $manifest,
    $guards,
    'wrong-token',
    'disposable_reset',
    'DISPOSABLE_REHEARSAL',
    true,
    true
);
resetPolicyAssert(in_array('INVALID_OPERATION_TOKEN', $invalidToken['blockers'], true), 'Invalid token must abort.');

$writersActive = DatasetResetGuardEvaluator::evaluateExecution(
    $snapshot,
    $manifest,
    $guards,
    DatasetResetPolicyV2::EXECUTION_TOKEN,
    'disposable_reset',
    'DISPOSABLE_REHEARSAL',
    true,
    false,
    ['WRITER_RESUMED_EARLY']
);
resetPolicyAssert(in_array('MACHINE_FREEZE_EVIDENCE_INVALID', $writersActive['blockers'], true), 'Missing machine freeze evidence must abort execution.');
resetPolicyAssert(in_array('WRITER_RESUMED_EARLY', $writersActive['blockers'], true), 'Early writer resume must remain visible in blockers.');

fwrite(STDOUT, "RESET_POLICY_V2 and reset guard assertions passed.\n");
