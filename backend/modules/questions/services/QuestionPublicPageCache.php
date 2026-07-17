<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/runtime/RuntimeStoreFactory.php';

/** Cache compartilhado somente do nucleo publico da listagem. */
final class QuestionPublicPageCache
{
    private const VERSION_KEY = 'questions:public-list:version';

    public function __construct(
        private readonly RuntimeStoreInterface $store,
        private readonly int $ttlSeconds = 60
    ) {
    }

    public static function fromEnvironment(): self
    {
        return new self(
            RuntimeStoreFactory::shared(),
            max(5, min(600, (int) (getenv('QUESTIONS_PUBLIC_CACHE_TTL') ?: 60)))
        );
    }

    public function canCache(array $filters): bool
    {
        return $this->store->isShared()
            && empty($filters['onlySaved'])
            && empty($filters['excludeAnswered']);
    }

    public function get(int $limit, ?string $cursor, array $filters): ?array
    {
        if (!$this->canCache($filters)) {
            return null;
        }
        $raw = $this->store->get($this->cacheKey($limit, $cursor, $filters));
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($decoded)
            || !is_array($decoded['rows'] ?? null)
            || !is_array($decoded['filters'] ?? null)
            || $this->containsPrivateState($decoded)) {
            return null;
        }
        return $decoded;
    }

    public function set(int $limit, ?string $cursor, array $filters, array $payload): bool
    {
        if (!$this->canCache($filters)) {
            return false;
        }
        $publicPayload = [
            'rows' => array_values(is_array($payload['rows'] ?? null) ? $payload['rows'] : []),
            'filters' => is_array($payload['filters'] ?? null) ? $payload['filters'] : [],
            'hasMore' => !empty($payload['hasMore']),
        ];
        if ($this->containsPrivateState($publicPayload)) {
            return false;
        }
        $encoded = json_encode($publicPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return is_string($encoded)
            && $this->store->set($this->cacheKey($limit, $cursor, $filters), $encoded, $this->ttlSeconds);
    }

    public function invalidate(): void
    {
        if ($this->store->isShared()) {
            $this->store->increment(self::VERSION_KEY, 86400 * 365);
        }
    }

    private function cacheKey(int $limit, ?string $cursor, array $filters): string
    {
        $filters = $this->normalize($filters);
        $payload = json_encode([
            'version' => $this->store->get(self::VERSION_KEY) ?: '0',
            'limit' => $limit,
            'cursor' => $cursor,
            'filters' => $filters,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return 'questions:public-list:page:' . hash('sha256', is_string($payload) ? $payload : '');
    }

    private function containsPrivateState(mixed $value): bool
    {
        if (!is_array($value)) {
            return false;
        }
        $forbidden = [
            'userid', 'userstate', 'answered', 'isanswered',
            'favorite', 'isfavorite', 'saved', 'issaved',
            'selectedoption', 'selectedoptionid', 'selectedoptionindex',
            'iscorrect', 'answer', 'resposta', 'correctoptionindex',
            'correctalternativeid', 'correctalternativetempids',
            'editorial', 'questioneditorials', 'teachercomment', 'detailedcomment',
        ];
        foreach ($value as $key => $item) {
            $normalized = strtolower((string) preg_replace('/[^a-z0-9]+/i', '', (string) $key));
            if (in_array($normalized, $forbidden, true) || $this->containsPrivateState($item)) {
                return true;
            }
        }
        return false;
    }

    private function normalize(mixed $value): mixed
    {
        if (!is_array($value)) {
            return $value;
        }
        if (array_is_list($value)) {
            $value = array_map(fn (mixed $item): mixed => $this->normalize($item), $value);
            usort($value, static fn (mixed $a, mixed $b): int => strcmp((string) json_encode($a), (string) json_encode($b)));
            return $value;
        }
        ksort($value);
        foreach ($value as $key => $item) {
            $value[$key] = $this->normalize($item);
        }
        return $value;
    }
}
