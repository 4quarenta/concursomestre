<?php

declare(strict_types=1);

require_once __DIR__ . '/SeoLaunchMode.php';

final class SeoProductionPageMap
{
    /** @var array<string,array<string,mixed>> */
    private array $families = [];

    public function __construct(?string $configPath = null)
    {
        $path = $configPath ?? dirname(__DIR__, 4) . '/config/seo/seo-production-page-map.v1.json';
        $raw = file_get_contents($path);
        if ($raw === false) {
            throw new RuntimeException('SEO Production Page Map nao encontrado.');
        }
        $config = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($config)
            || ($config['version'] ?? null) !== 'seo-production-page-map.v1'
            || ($config['defaultLaunchMode'] ?? null) !== SeoLaunchMode::PRELAUNCH
            || !is_array($config['families'] ?? null)) {
            throw new RuntimeException('SEO Production Page Map invalido.');
        }
        foreach ($config['families'] as $family) {
            if (!is_array($family) || preg_match('/^[a-z][a-z0-9_]*$/', (string) ($family['familyId'] ?? '')) !== 1) {
                throw new RuntimeException('Familia do SEO Production Page Map invalida.');
            }
            $familyId = (string) $family['familyId'];
            if (isset($this->families[$familyId])) {
                throw new RuntimeException('Familia duplicada no SEO Production Page Map: ' . $familyId . '.');
            }
            if (($family['preLaunchIndexability'] ?? null) !== 'NOINDEX') {
                throw new RuntimeException('Familia sem fail-safe PRELAUNCH: ' . $familyId . '.');
            }
            if (($family['familyEligibility'] ?? null) === 'PERMANENT_NOINDEX'
                && (($family['targetProductionIndexability'] ?? null) !== 'NOINDEX'
                    || ($family['sitemapTarget'] ?? null) !== 'EXCLUDE')) {
                throw new RuntimeException('Familia PERMANENT_NOINDEX promovivel: ' . $familyId . '.');
            }
            $this->families[$familyId] = $family;
        }
    }

    /** @return array<string,mixed> */
    public function family(string $familyId): array
    {
        if (!isset($this->families[$familyId])) {
            throw new InvalidArgumentException('Familia ausente do SEO Production Page Map: ' . $familyId . '.');
        }
        return $this->families[$familyId];
    }

    /** @return list<array<string,mixed>> */
    public function families(): array
    {
        return array_values($this->families);
    }
}
