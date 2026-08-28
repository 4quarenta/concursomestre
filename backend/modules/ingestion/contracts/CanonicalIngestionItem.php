<?php

declare(strict_types=1);

/**
 * Immutable input accepted by the shared ingestion core.
 * Adapters may extract data, but they cannot persist canonical records.
 */
final class CanonicalIngestionItem
{
    public function __construct(
        public readonly string $domain,
        public readonly string $sourceProvider,
        public readonly string $sourceEntityType,
        public readonly string $sourceEntityId,
        public readonly string $sourceVersion,
        public readonly string $eventId,
        public readonly array $payload,
        public readonly array $sourceMetadata = [],
        public readonly ?string $sourceCursor = null,
    ) {
        foreach ([
            'domain' => $this->domain,
            'sourceProvider' => $this->sourceProvider,
            'sourceEntityType' => $this->sourceEntityType,
            'sourceEntityId' => $this->sourceEntityId,
            'sourceVersion' => $this->sourceVersion,
            'eventId' => $this->eventId,
        ] as $field => $value) {
            if ($value === '' || strlen($value) > 190 || preg_match('/[\r\n\x00]/', $value) === 1) {
                throw new InvalidArgumentException('Identidade de ingestao invalida: ' . $field);
            }
        }
        if (preg_match('/^[a-z][a-z0-9_.:-]{1,79}$/', $this->domain) !== 1) {
            throw new InvalidArgumentException('Dominio de ingestao invalido.');
        }
        if (preg_match('/^[a-z0-9][a-z0-9_.:-]{0,79}$/i', $this->sourceProvider) !== 1) {
            throw new InvalidArgumentException('Fonte de ingestao invalida.');
        }
        if (!is_array($this->payload) || !is_array($this->sourceMetadata)) {
            throw new InvalidArgumentException('Payload de ingestao invalido.');
        }
    }

    /** @param array<string,mixed> $input */
    public static function fromArray(array $input): self
    {
        return new self(
            strtolower(trim((string) ($input['domain'] ?? ''))),
            strtolower(trim((string) ($input['sourceProvider'] ?? $input['source'] ?? ''))),
            strtolower(trim((string) ($input['sourceEntityType'] ?? $input['entityType'] ?? ''))),
            trim((string) ($input['sourceEntityId'] ?? $input['entityId'] ?? '')),
            trim((string) ($input['sourceVersion'] ?? $input['version'] ?? '1')),
            trim((string) ($input['eventId'] ?? '')),
            is_array($input['payload'] ?? null) ? $input['payload'] : [],
            self::sanitizeMetadata(is_array($input['sourceMetadata'] ?? null) ? $input['sourceMetadata'] : []),
            isset($input['sourceCursor']) ? trim((string) $input['sourceCursor']) : null,
        );
    }

    public function sourceIdentityKey(): string
    {
        return hash('sha256', implode("\0", [
            $this->domain,
            $this->sourceProvider,
            $this->sourceEntityType,
            $this->sourceEntityId,
        ]));
    }

    public function idempotencyKey(): string
    {
        return hash('sha256', implode("\0", [
            $this->sourceIdentityKey(),
            $this->sourceVersion,
            $this->eventId,
            $this->contentHash(),
        ]));
    }

    public function contentHash(): string
    {
        return self::payloadHash($this->payload);
    }

    /** @param array<string,mixed> $payload */
    public static function payloadHash(array $payload): string
    {
        return hash('sha256', self::canonicalJson($payload));
    }

    public function domainIdentityKey(): ?string
    {
        if (!is_array($this->payload['domainIdentity'] ?? null) || $this->payload['domainIdentity'] === []) {
            return null;
        }
        return hash('sha256', self::canonicalJson($this->payload['domainIdentity']));
    }

    /** @param array<string,mixed> $value */
    private static function canonicalJson(array $value): string
    {
        $normalized = self::sortRecursively($value);
        return json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    private static function sortRecursively(mixed $value): mixed
    {
        if (!is_array($value)) {
            return $value;
        }
        $result = [];
        foreach ($value as $key => $item) {
            $result[$key] = self::sortRecursively($item);
        }
        if (array_keys($result) !== range(0, count($result) - 1)) {
            ksort($result);
        }
        return $result;
    }

    /** @param array<string,mixed> $metadata @return array<string,mixed> */
    private static function sanitizeMetadata(array $metadata): array
    {
        $result = [];
        foreach ($metadata as $key => $value) {
            $normalizedKey = is_string($key) ? strtolower($key) : (string) $key;
            if (preg_match('/password|secret|token|authorization|cookie|credential|private|payload/i', $normalizedKey) === 1) {
                continue;
            }
            if ($normalizedKey === 'reference' && is_string($value) && preg_match('/password|secret|token|sig(?:nature)?|key=/i', $value) === 1) {
                continue;
            }
            if (is_scalar($value) || $value === null) {
                $result[$normalizedKey] = is_string($value) ? substr($value, 0, 500) : $value;
            }
        }
        return $result;
    }
}
