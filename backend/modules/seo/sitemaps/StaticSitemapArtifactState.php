<?php

declare(strict_types=1);

final class StaticSitemapArtifactState
{
    public const VERSION = 'database-driven-sitemap-state.v4';

    private string $statePath;

    public function __construct(private readonly string $outputDirectory)
    {
        if (trim($this->outputDirectory) === '' || basename($this->outputDirectory) === '') {
            throw new InvalidArgumentException('Diretorio de sitemap invalido para o estado de publicacao.');
        }

        $this->statePath = dirname($this->outputDirectory)
            . DIRECTORY_SEPARATOR
            . '.' . basename($this->outputDirectory) . '-publication-state.json';
    }

    /** @param array<string, scalar|null> $context */
    public function invalidate(string $reason, array $context = []): void
    {
        $this->write([
            'version' => self::VERSION,
            'state' => 'DIRTY',
            'reason' => self::normalizeReason($reason),
            'invalidatedAt' => gmdate('c'),
            'context' => $context,
        ]);
    }

    public function markCurrent(
        string $eligibleDatasetFingerprint,
        string $datasetRevisionToken,
        string $artifactFingerprint,
        string $releaseId,
        string $manifestHash,
        string $generatedAt
    ): void
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $eligibleDatasetFingerprint)) {
            throw new InvalidArgumentException('Fingerprint elegivel de sitemap invalido.');
        }
        if (!preg_match('/^[a-f0-9]{64}$/', $datasetRevisionToken)) {
            throw new InvalidArgumentException('Token de revisao do dataset de sitemap invalido.');
        }
        if (!preg_match('/^[a-f0-9]{64}$/', $artifactFingerprint)) {
            throw new InvalidArgumentException('Fingerprint do artefato de sitemap invalido.');
        }
        if (!preg_match('/^[a-f0-9]{64}$/', $releaseId) || !preg_match('/^[a-f0-9]{64}$/', $manifestHash)) {
            throw new InvalidArgumentException('Identidade fisica do release de sitemap invalida.');
        }

        $this->write([
            'version' => self::VERSION,
            'state' => 'CURRENT',
            'eligibleDatasetFingerprint' => $eligibleDatasetFingerprint,
            'datasetRevisionToken' => $datasetRevisionToken,
            'artifactFingerprint' => $artifactFingerprint,
            'releaseId' => $releaseId,
            'manifestHash' => $manifestHash,
            'generatedAt' => $generatedAt,
            'activatedAt' => gmdate('c'),
        ]);
    }

    /** @return array<string, mixed>|null */
    public function read(): ?array
    {
        if (!is_file($this->statePath)) {
            return null;
        }

        try {
            $decoded = json_decode((string) file_get_contents($this->statePath), true, 32, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            return null;
        }

        return is_array($decoded) ? $decoded : null;
    }

    /** @param array<string, mixed> $status */
    public function isCurrent(array $status, string $currentDatasetRevisionToken): bool
    {
        $state = $this->read();
        $fingerprint = (string) ($status['eligibleDatasetFingerprint'] ?? '');

        return is_array($state)
            && ($state['version'] ?? null) === self::VERSION
            && ($state['state'] ?? null) === 'CURRENT'
            && preg_match('/^[a-f0-9]{64}$/', $fingerprint) === 1
            && preg_match('/^[a-f0-9]{64}$/', $currentDatasetRevisionToken) === 1
            && preg_match('/^[a-f0-9]{64}$/', (string) ($status['datasetRevisionToken'] ?? '')) === 1
            && hash_equals((string) ($status['datasetRevisionToken'] ?? ''), $currentDatasetRevisionToken)
            && hash_equals((string) ($state['datasetRevisionToken'] ?? ''), $currentDatasetRevisionToken)
            && hash_equals($fingerprint, (string) ($state['eligibleDatasetFingerprint'] ?? ''))
            && preg_match('/^[a-f0-9]{64}$/', (string) ($status['artifactFingerprint'] ?? '')) === 1
            && hash_equals(
                (string) ($status['artifactFingerprint'] ?? ''),
                (string) ($state['artifactFingerprint'] ?? '')
            )
            && preg_match('/^[a-f0-9]{64}$/', (string) ($status['releaseId'] ?? '')) === 1
            && hash_equals((string) ($status['releaseId'] ?? ''), (string) ($state['releaseId'] ?? ''))
            && preg_match('/^[a-f0-9]{64}$/', (string) ($status['manifestHash'] ?? '')) === 1
            && hash_equals((string) ($status['manifestHash'] ?? ''), (string) ($state['manifestHash'] ?? ''));
    }

    public function statePath(): string
    {
        return $this->statePath;
    }

    /** @param array<string, mixed> $payload */
    private function write(array $payload): void
    {
        $directory = dirname($this->statePath);
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new RuntimeException('Nao foi possivel criar o diretorio de estado do sitemap.');
        }

        $temporary = $this->statePath . '.tmp-' . getmypid() . '-' . bin2hex(random_bytes(4));
        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
        if (file_put_contents($temporary, $json, LOCK_EX) === false) {
            throw new RuntimeException('Nao foi possivel gravar o estado temporario do sitemap.');
        }
        if (!rename($temporary, $this->statePath)) {
            @unlink($temporary);
            throw new RuntimeException('Nao foi possivel promover atomicamente o estado do sitemap.');
        }
    }

    private static function normalizeReason(string $reason): string
    {
        $normalized = strtoupper(trim($reason));
        if ($normalized === '' || preg_match('/^[A-Z0-9_.:-]{1,120}$/', $normalized) !== 1) {
            throw new InvalidArgumentException('Reason code de invalidacao do sitemap invalido.');
        }
        return $normalized;
    }
}
