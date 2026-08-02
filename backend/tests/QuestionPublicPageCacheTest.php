<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/questions/services/QuestionPublicPageCache.php';

final class QuestionCacheFakeStore implements RuntimeStoreInterface
{
    /** @var array<string, string> */
    public array $values = [];
    public ?string $lastKey = null;

    public function isShared(): bool { return true; }
    public function get(string $key): ?string { return $this->values[$key] ?? null; }
    public function set(string $key, string $value, int $ttlSeconds): bool
    {
        $this->lastKey = $key;
        $this->values[$key] = $value;
        return true;
    }
    public function delete(string $key): bool
    {
        $exists = array_key_exists($key, $this->values);
        unset($this->values[$key]);
        return $exists;
    }
    public function increment(string $key, int $ttlSeconds = 0): int
    {
        $next = ((int) ($this->values[$key] ?? '0')) + 1;
        $this->values[$key] = (string) $next;
        return $next;
    }
    public function consumeFixedWindow(string $key, int $maxRequests, int $windowSeconds): array
    {
        return ['allowed' => true, 'count' => 1, 'retryAfter' => $windowSeconds];
    }
    public function acquireLock(string $key, string $token, int $ttlSeconds): bool { return true; }
    public function releaseLock(string $key, string $token): bool { return true; }
}

function questionCacheAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $store = new QuestionCacheFakeStore();
    $cache = new QuestionPublicPageCache($store, 60);
    $filters = ['subject' => ['Direito'], 'onlySaved' => false, 'excludeAnswered' => false];
    $payload = [
        'rows' => [['id' => 10, 'enunciado_clean' => 'Resumo publico']],
        'filters' => ['10' => [['id' => 3, 'label' => 'Direito']]],
        'hasMore' => true,
    ];

    questionCacheAssert($cache->set(20, null, $filters, $payload), 'Payload publico nao foi armazenado.');
    questionCacheAssert($cache->get(20, null, $filters) === $payload, 'Payload publico nao foi recuperado.');
    questionCacheAssert(!$cache->set(20, null, $filters, [
        ...$payload,
        'rows' => [['id' => 10, 'userState' => ['isSaved' => true]]],
    ]), 'Cache aceitou estado privado do usuario.');

    questionCacheAssert(is_string($store->lastKey), 'Chave do cache nao foi registrada.');
    $store->values[(string) $store->lastKey] = json_encode([
        'rows' => [['id' => 10, 'selectedOptionId' => 99]],
        'filters' => [],
        'hasMore' => false,
    ], JSON_THROW_ON_ERROR);
    questionCacheAssert($cache->get(20, null, $filters) === null, 'Cache devolveu payload privado adulterado.');
    questionCacheAssert(!$cache->canCache(['onlySaved' => true]), 'Filtro privado onlySaved foi considerado compartilhavel.');
    questionCacheAssert(!$cache->canCache(['excludeAnswered' => true]), 'Filtro privado excludeAnswered foi considerado compartilhavel.');
    questionCacheAssert($cache->getTotal($filters) === null, 'Cache retornou total inexistente.');
    questionCacheAssert($cache->setTotal($filters, 137), 'Total publico nao foi armazenado.');
    questionCacheAssert($cache->getTotal($filters) === 137, 'Total publico nao foi recuperado.');
    questionCacheAssert(!$cache->setTotal(['onlySaved' => true], 10), 'Cache aceitou total privado do usuario.');

    $cache->invalidate();
    questionCacheAssert(($store->values['questions:public-list:version'] ?? null) === '1', 'Versao do cache nao foi invalidada.');

    fwrite(STDOUT, "QuestionPublicPageCacheTest: PASS\n");
} catch (Throwable $error) {
    fwrite(STDERR, 'QuestionPublicPageCacheTest: FAIL - ' . $error->getMessage() . "\n");
    exit(1);
}
