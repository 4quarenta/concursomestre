<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/scripts/data/Phase13StrictFinalRunbook.php';

$valid = Phase13StrictFinalRunbook::validate(
    Phase13StrictFinalRunbook::steps(),
    Phase13StrictFinalRunbook::OBSERVATION_SECONDS
);
if (!$valid['valid']) throw new RuntimeException('Canonical strict final runbook must validate.');

$short = Phase13StrictFinalRunbook::validate(Phase13StrictFinalRunbook::steps(), 900);
if ($short['valid'] || !in_array('STRICT_OBSERVATION_WINDOW_TOO_SHORT', $short['blockers'], true)) {
    throw new RuntimeException('Short strict observation window must fail.');
}

$drifted = Phase13StrictFinalRunbook::steps();
[$drifted[0], $drifted[1]] = [$drifted[1], $drifted[0]];
if (Phase13StrictFinalRunbook::validate($drifted, Phase13StrictFinalRunbook::OBSERVATION_SECONDS)['valid']) {
    throw new RuntimeException('Strict runbook order drift must fail.');
}

fwrite(STDOUT, "Phase 13 strict final runbook assertions passed.\n");
