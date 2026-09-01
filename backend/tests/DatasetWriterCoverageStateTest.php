<?php

declare(strict_types=1);

require_once __DIR__ . '/../scripts/data/DatasetWriterCoverageState.php';

function coverageStateAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$key = str_repeat('coverage-state-key-', 3);
$state = DatasetWriterCoverageState::initialState(
    'phase20br-coverage-20260901T180000Z',
    'phase13x-strict-window1-20260901T145759Z-canonical'
);
$signed = DatasetWriterCoverageState::sign($state, $key);
$validation = DatasetWriterCoverageState::validate($signed, $key);
coverageStateAssert($validation['valid'], 'A valid signed B13X coverage state must validate.');

$tampered = $signed;
$tampered['status'] = 'FINALIZED_PASS';
$tamperedValidation = DatasetWriterCoverageState::validate($tampered, $key);
coverageStateAssert(
    !$tamperedValidation['valid'] && in_array('COVERAGE_STATE_SIGNATURE_INVALID', $tamperedValidation['blockers'], true),
    'Tampering with the coverage state must invalidate the signature.'
);

$writerState = DatasetWriterCoverageState::withWriterResult($signed, 'http-auth-account', [
    'status' => 'PASS_NOOP',
    'beforeFingerprint' => str_repeat('a', 64),
    'afterFingerprint' => str_repeat('a', 64),
]);
coverageStateAssert(isset($writerState['writerResults']['http-auth-account']), 'Writer result must be stored by writer ID.');
coverageStateAssert(
    ($writerState['supersededRun']['result'] ?? null) === null,
    'The new state must not claim a methodology supersession before the canonical resume transition.'
);
$superseded = DatasetWriterCoverageState::markSupersededRun($writerState, '/ops/availability-safe/freeze-state.json');
coverageStateAssert(
    ($superseded['supersededRun']['result'] ?? null) === 'SUPERSEDED_BY_METHOD_CHANGE',
    'The coverage state must record the canonical methodology supersession after resume.'
);

fwrite(STDOUT, "B13X coverage state assertions passed.\n");
