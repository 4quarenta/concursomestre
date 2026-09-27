<?php

declare(strict_types=1);

final class ImportedExamSlugPolicy
{
    public static function collisionCandidate(string $baseSlug, string $identity, int $digestLength = 12): string
    {
        $baseSlug = trim($baseSlug, "- \t\n\r\0\x0B");
        $identity = trim($identity);
        if ($baseSlug === '' || $identity === '') {
            throw new InvalidArgumentException('Identidade e slug sao obrigatorios para resolver uma colisao.');
        }

        $digestLength = max(12, min(64, $digestLength));
        $suffix = '-' . substr(hash('sha256', $identity), 0, $digestLength);
        $baseLimit = 255 - strlen($suffix);

        return substr($baseSlug, 0, $baseLimit) . $suffix;
    }
}
