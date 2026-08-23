<?php

declare(strict_types=1);

require_once __DIR__ . '/SeoLaunchMode.php';

final class SeoRuntimeEnvironment
{
    /** @var array<string,mixed> */
    private array $contract;

    public function __construct(?string $configPath = null)
    {
        $path = $configPath ?? dirname(__DIR__, 4) . '/config/seo/index-policy-phase-6.v1.json';
        $raw = file_get_contents($path);
        $contract = $raw === false ? null : json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($contract)
            || ($contract['version'] ?? null) !== 'index-policy-phase-6.v1'
            || !is_array($contract['runtime'] ?? null)
            || !is_array($contract['sitemap'] ?? null)) {
            throw new RuntimeException('Contrato de ambiente SEO da Fase 6 invalido.');
        }
        $origin = self::normalizeOrigin($contract['canonicalOrigin'] ?? null);
        if ($origin === null || !str_starts_with($origin, 'https://')) {
            throw new RuntimeException('Origem canonica HTTPS invalida no contrato da Fase 6.');
        }
        $this->contract = $contract;
    }

    /** @return array<string,mixed> */
    public function evaluate(string $launchMode, ?string $requestOrigin = null): array
    {
        $runtime = $this->contract['runtime'];
        $canonicalOrigin = self::normalizeOrigin($this->contract['canonicalOrigin']);
        $configuredOrigin = self::normalizeOrigin(getenv('CANONICAL_BASE_URL') ?: null);
        $requestOrigin = $requestOrigin === null ? $canonicalOrigin : self::normalizeOrigin($requestOrigin);
        $deployment = strtoupper(trim((string) getenv((string) $runtime['deploymentEnvironmentVariable'])));
        $activation = strtoupper(trim((string) $runtime['activationValue']));
        $indexActivation = strtoupper(trim((string) getenv((string) $runtime['indexActivationVariable'])));
        $sitemapActivation = strtoupper(trim((string) getenv((string) $runtime['sitemapActivationVariable'])));
        $reasons = [];

        if (SeoLaunchMode::normalize($launchMode) !== SeoLaunchMode::PRODUCTION) {
            $reasons[] = 'environment.launch_not_production';
        }
        if ($configuredOrigin !== $canonicalOrigin) {
            $reasons[] = 'environment.configured_origin_noncanonical';
        }
        if ($requestOrigin !== $canonicalOrigin) {
            $reasons[] = 'environment.request_origin_noncanonical';
        }
        if ($deployment !== strtoupper((string) $runtime['productionEnvironmentValue'])) {
            $reasons[] = 'environment.not_production';
        }
        $vercelEnvironment = strtolower(trim((string) getenv('VERCEL_ENV')));
        if ($vercelEnvironment !== '' && $vercelEnvironment !== 'production') {
            $reasons[] = 'environment.preview';
        }
        if ($indexActivation !== $activation) {
            $reasons[] = 'environment.index_activation_missing';
        }

        $runtimeIndexingAllowed = $reasons === [];
        return [
            'canonicalOrigin' => $canonicalOrigin,
            'runtimeIndexingAllowed' => $runtimeIndexingAllowed,
            'sitemapPublicationAllowed' => $runtimeIndexingAllowed && $sitemapActivation === $activation,
            'reasonCodes' => $sitemapActivation === $activation
                ? $reasons
                : [...$reasons, 'environment.sitemap_activation_missing'],
        ];
    }

    public function canonicalOrigin(): string
    {
        return (string) self::normalizeOrigin($this->contract['canonicalOrigin']);
    }

    public function maxUrlsPerChild(): int
    {
        return (int) $this->contract['sitemap']['maxUrlsPerChild'];
    }

    private static function normalizeOrigin(mixed $value): ?string
    {
        $parts = parse_url(trim((string) $value));
        if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])
            || !in_array(strtolower((string) $parts['scheme']), ['http', 'https'], true)
            || isset($parts['user']) || isset($parts['pass'])) {
            return null;
        }
        $port = isset($parts['port']) ? ':' . (int) $parts['port'] : '';
        return strtolower((string) $parts['scheme']) . '://' . strtolower((string) $parts['host']) . $port;
    }
}
