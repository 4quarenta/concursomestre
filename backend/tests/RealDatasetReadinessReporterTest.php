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

require_once __DIR__ . '/../scripts/data/RealDatasetReadinessReporter.php';

$gates = RealDatasetReadinessReporter::openGates();
if (count($gates) !== 20 || count(array_unique($gates)) !== 20) {
    throw new RuntimeException('Real-data reporter must preserve exactly 20 unique open gates.');
}
if ($gates[0] !== 'INTERNAL_LINK_GRAPH_REAL_DATA_VALIDATION_REQUIRED'
    || $gates[19] !== 'IMAGE_DELIVERY_REAL_DATA_VALIDATION_REQUIRED') {
    throw new RuntimeException('Real-data gate order drifted.');
}

$script = (string) file_get_contents(__DIR__ . '/../scripts/data/RealDatasetReadinessReporter.php');
foreach (['INSERT INTO', 'UPDATE ', 'DELETE FROM', 'TRUNCATE', 'DROP TABLE', 'ALTER TABLE'] as $forbidden) {
    if (str_contains($script, $forbidden)) {
        throw new RuntimeException('Real-data reporter is not read-only: ' . $forbidden);
    }
}

fwrite(STDOUT, "Real dataset readiness reporter assertions passed.\n");
