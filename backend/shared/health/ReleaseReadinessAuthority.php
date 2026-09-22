<?php

declare(strict_types=1);

require_once __DIR__ . '/ReleaseMetadata.php';

/**
 * Runtime authority for the technical release decision shown to operators.
 *
 * The decision is explicit configuration, but it is only accepted when it is
 * bound to the release manifest currently serving the request. Missing or
 * mismatched state fails closed to the safe pre-release decision.
 */
final class ReleaseReadinessAuthority
{
    private const TECHNICAL_READINESS_VALUES = ['READY', 'NOT_READY'];
    private const RELEASE_RECOMMENDATION_VALUES = ['GO_RECOMMENDED', 'NO_GO_RECOMMENDED'];
    private const OWNER_DECISION_VALUES = ['GO', 'NOT_MADE_BY_CODEX'];

    /**
     * @return array{
     *   technicalReadiness: string,
     *   releaseRecommendation: string,
     *   ownerProductionDecision: string,
     *   candidateSha: string|null,
     *   valid: bool
     * }
     */
    public static function read(): array
    {
        $metadata = ReleaseMetadata::read();
        $commit = strtolower(trim((string) ($metadata['commit'] ?? '')));
        $candidateSha = strtolower(trim((string) (getenv('RELEASE_READINESS_CANDIDATE_SHA') ?: '')));
        $technicalReadiness = strtoupper(trim((string) (getenv('RELEASE_TECHNICAL_READINESS') ?: '')));
        $releaseRecommendation = strtoupper(trim((string) (getenv('RELEASE_RECOMMENDATION') ?: '')));
        $ownerDecision = strtoupper(trim((string) (getenv('OWNER_PRODUCTION_DECISION') ?: '')));

        $valid = !empty($metadata['manifestValid'])
            && preg_match('/^[a-f0-9]{40}$/', $commit) === 1
            && preg_match('/^[a-f0-9]{40}$/', $candidateSha) === 1
            && hash_equals($commit, $candidateSha)
            && in_array($technicalReadiness, self::TECHNICAL_READINESS_VALUES, true)
            && in_array($releaseRecommendation, self::RELEASE_RECOMMENDATION_VALUES, true)
            && in_array($ownerDecision, self::OWNER_DECISION_VALUES, true);

        return [
            'technicalReadiness' => $valid ? $technicalReadiness : 'NOT_READY',
            'releaseRecommendation' => $valid ? $releaseRecommendation : 'NO_GO_RECOMMENDED',
            'ownerProductionDecision' => $valid ? $ownerDecision : 'NOT_MADE_BY_CODEX',
            'candidateSha' => $valid ? $commit : null,
            'valid' => $valid,
        ];
    }

    private function __construct()
    {
    }
}
