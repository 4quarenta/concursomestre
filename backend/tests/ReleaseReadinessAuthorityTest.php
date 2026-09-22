<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/shared/health/ReleaseReadinessAuthority.php';

$metadata = ReleaseMetadata::read();
$commit = (string) ($metadata['commit'] ?? '');
$previous = [];
foreach ([
    'RELEASE_READINESS_CANDIDATE_SHA',
    'RELEASE_TECHNICAL_READINESS',
    'RELEASE_RECOMMENDATION',
    'OWNER_PRODUCTION_DECISION',
] as $name) {
    $previous[$name] = getenv($name);
}

try {
    putenv('RELEASE_READINESS_CANDIDATE_SHA=' . $commit);
    putenv('RELEASE_TECHNICAL_READINESS=READY');
    putenv('RELEASE_RECOMMENDATION=GO_RECOMMENDED');
    putenv('OWNER_PRODUCTION_DECISION=GO');

    $ready = ReleaseReadinessAuthority::read();
    if (!$ready['valid'] || $ready['technicalReadiness'] !== 'READY' || $ready['releaseRecommendation'] !== 'GO_RECOMMENDED' || $ready['ownerProductionDecision'] !== 'GO') {
        throw new RuntimeException('Readiness explicito valido nao foi aceito.');
    }

    putenv('RELEASE_READINESS_CANDIDATE_SHA=' . str_repeat('0', 40));
    $mismatched = ReleaseReadinessAuthority::read();
    if ($mismatched['valid'] || $mismatched['technicalReadiness'] !== 'NOT_READY' || $mismatched['releaseRecommendation'] !== 'NO_GO_RECOMMENDED' || $mismatched['ownerProductionDecision'] !== 'NOT_MADE_BY_CODEX') {
        throw new RuntimeException('SHA divergente nao falhou fechado.');
    }
} finally {
    foreach ($previous as $name => $value) {
        if ($value === false || $value === null) {
            putenv($name);
        } else {
            putenv($name . '=' . $value);
        }
    }
}

fwrite(STDOUT, "ReleaseReadinessAuthorityTest: PASS\n");
