<?php

declare(strict_types=1);

final class ContentSecurityPolicy
{
    public static function assertSafePayload(mixed $payload, int $maxDepth = 20): void
    {
        self::walk($payload, 0, max(1, $maxDepth));
    }

    private static function walk(mixed $value, int $depth, int $maxDepth): void
    {
        if ($depth > $maxDepth) {
            throw new InvalidArgumentException('Payload de ingestao excede a profundidade segura.');
        }
        if (is_string($value)) {
            if (strlen($value) > 1_000_000 || preg_match('/<\s*script\b|\bon[a-z]+\s*=|javascript\s*:/i', $value) === 1) {
                throw new InvalidArgumentException('Conteudo importado nao atende a politica de sanitizacao.');
            }
            return;
        }
        if (is_array($value)) {
            foreach ($value as $item) {
                self::walk($item, $depth + 1, $maxDepth);
            }
        }
    }
}
