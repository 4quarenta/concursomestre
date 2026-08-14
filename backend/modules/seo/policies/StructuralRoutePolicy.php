<?php

declare(strict_types=1);

/**
 * Interpreta a politica estrutural declarativa sem decidir entidades ou
 * promocao editorial individual.
 */
final class StructuralRoutePolicy
{
    /** @var array<string, array<string, mixed>> */
    private array $families = [];
    /** @var array<string, array<string, mixed>> */
    private array $parameters = [];
    private string $version;

    public function __construct(?string $configPath = null)
    {
        $path = $configPath ?? dirname(__DIR__, 4) . '/config/seo/structural-route-policy.v1.json';
        $config = $this->readJson($path);
        if (($config['version'] ?? null) !== 'structural-route-policy.v1') {
            throw new RuntimeException('Versao da Structural Route Policy invalida.');
        }
        if (($config['enforcement'] ?? null) !== false) {
            throw new RuntimeException('Structural Route Policy deve permanecer sem enforcement no Checkpoint 2.');
        }
        $this->version = (string) $config['version'];
        $this->parameters = is_array($config['parameterCatalog'] ?? null) ? $config['parameterCatalog'] : [];
        foreach ($config['families'] ?? [] as $family) {
            if (!is_array($family) || !is_string($family['id'] ?? null) || $family['id'] === '') {
                throw new RuntimeException('Familia estrutural invalida.');
            }
            $this->families[$family['id']] = $family;
        }
    }

    public function version(): string
    {
        return $this->version;
    }

    /** @return array<string, mixed> */
    public function family(string $familyId): array
    {
        if (!isset($this->families[$familyId])) {
            throw new InvalidArgumentException('Familia estrutural desconhecida: ' . $familyId);
        }
        return $this->families[$familyId];
    }

    /** @return array<string, mixed>|null */
    public function parameter(string $parameter): ?array
    {
        if (isset($this->parameters[$parameter]) && is_array($this->parameters[$parameter])) {
            return $this->parameters[$parameter];
        }
        foreach ($this->parameters as $name => $definition) {
            if (str_ends_with($name, '*') && str_starts_with($parameter, substr($name, 0, -1))) {
                return is_array($definition) ? $definition : null;
            }
        }
        return null;
    }

    public function allowsParameter(string $familyId, string $parameter): bool
    {
        $family = $this->family($familyId);
        $allowed = is_array($family['allowedParameters'] ?? null) ? $family['allowedParameters'] : [];
        foreach ($allowed as $name) {
            if (!is_string($name)) {
                continue;
            }
            if ($name === $parameter || (str_ends_with($name, '*') && str_starts_with($parameter, substr($name, 0, -1)))) {
                return true;
            }
        }
        return false;
    }

    /** @return list<string> */
    public function patterns(string $familyId, bool $includeLegacy = false): array
    {
        $family = $this->family($familyId);
        $patterns = is_array($family['patterns'] ?? null) ? $family['patterns'] : [];
        if ($includeLegacy) {
            $patterns = array_merge(
                $patterns,
                is_array($family['legacyPatterns'] ?? null) ? $family['legacyPatterns'] : []
            );
        }
        return array_values(array_filter($patterns, static fn (mixed $pattern): bool => is_string($pattern)));
    }

    /**
     * @param array<string, string|int> $parameters
     */
    public function buildPath(string $familyId, array $parameters): ?string
    {
        $family = $this->family($familyId);
        $patterns = $family['patterns'] ?? [];
        if (!is_array($patterns) || !is_string($patterns[0] ?? null)) {
            return null;
        }
        $pattern = $patterns[0];
        if (str_contains($pattern, '?') || str_contains($pattern, '{*')) {
            return null;
        }
        $path = preg_replace_callback('/\{([a-zA-Z][a-zA-Z0-9_]*)\}/', static function (array $match) use ($parameters): string {
            $value = $parameters[$match[1]] ?? '';
            return rawurlencode((string) $value);
        }, $pattern);
        if (!is_string($path) || preg_match('/\{[^}]+\}/', $path) === 1 || preg_match('~^/[^?#]*$~', $path) !== 1) {
            return null;
        }
        return $path;
    }

    /** @return array<string, mixed> */
    private function readJson(string $path): array
    {
        $raw = file_get_contents($path);
        if ($raw === false) {
            throw new RuntimeException('Structural Route Policy nao encontrada.');
        }
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($decoded)) {
            throw new RuntimeException('Structural Route Policy invalida.');
        }
        return $decoded;
    }
}
