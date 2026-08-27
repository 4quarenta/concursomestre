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

if (PHP_SAPI !== 'cli') {
    http_response_code(410);
}

fwrite(STDERR, implode(PHP_EOL, [
    'LEGACY_DATASET_RESET_DISABLED',
    'This script is permanently fail-closed and must not be used for Macrostep 11B.',
    'Use scripts/data/reset_definitive_dataset.php only after an approved RESET_POLICY_V2 audit.',
]) . PHP_EOL);

exit(64);
