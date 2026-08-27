<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/launch/SeoLaunchMode.php';
require_once dirname(__DIR__) . '/services/PublicSeoEnvelopeService.php';

/**
 * Converte candidatos amplos do banco em URLs elegiveis usando a mesma
 * PublicationDecision e SeoDecision dos endpoints publicos.
 */
final class AuthoritativeSitemapEligibilityService
{
    private readonly PublicSeoEnvelopeService $seo;

    public function __construct(?PublicSeoEnvelopeService $seo = null)
    {
        $this->seo = $seo ?? new PublicSeoEnvelopeService(SeoLaunchMode::PRODUCTION, true, true);
    }

    /** @param array<string, mixed> $candidate
     *  @return array<string, string|null>|null
     */
    public function eligibleRecord(array $candidate): ?array
    {
        return $this->evaluateCandidate($candidate)['record'];
    }

    /** @param array<string,mixed> $candidate
     *  @return array{envelope:array<string,mixed>,record:array<string,string|null>|null}
     */
    public function evaluateCandidate(array $candidate): array
    {
        try {
            $envelope = $this->seo->buildEnvelope($candidate);
        } catch (InvalidArgumentException) {
            return ['envelope' => [], 'record' => null];
        }
        $decision = is_array($envelope['seoDecision'] ?? null) ? $envelope['seoDecision'] : [];
        $canonical = is_array($decision['canonical'] ?? null) ? $decision['canonical'] : [];

        if (($decision['indexability']['status'] ?? null) !== 'INDEX'
            || ($decision['resolution']['action'] ?? null) !== 'render'
            || ($decision['resolution']['httpStatus'] ?? null) !== 200
            || ($decision['sitemap']['eligible'] ?? null) !== true) {
            return ['envelope' => $envelope, 'record' => null];
        }

        $url = trim((string) ($canonical['url'] ?? ''));
        $parts = parse_url($url);
        if (!is_array($parts)
            || ($parts['scheme'] ?? null) !== 'https'
            || strtolower((string) ($parts['host'] ?? '')) !== 'concursomestre.com'
            || isset($parts['query'])
            || isset($parts['fragment'])) {
            throw new LogicException('SeoDecision elegivel produziu canonical fora do host autoritativo.');
        }

        return ['envelope' => $envelope, 'record' => [
            'family' => (string) ($candidate['routeFamily'] ?? ''),
            'identity' => (string) ($candidate['resourceType'] ?? '') . ':' . (string) ($candidate['resourceId'] ?? ''),
            'canonicalUrl' => $url,
            'lastModified' => is_scalar($decision['sitemap']['lastModified'] ?? null)
                ? (string) $decision['sitemap']['lastModified']
                : null,
            'policyVersion' => (string) ($decision['policyVersion'] ?? ''),
        ]];
    }
}
