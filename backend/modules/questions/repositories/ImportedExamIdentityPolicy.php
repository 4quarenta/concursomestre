<?php

declare(strict_types=1);

final class ImportedExamIdentityPolicy
{
    private const CANONICAL_FILTER_FIELDS = [
        'banca_id',
        'orgao_id',
        'cargo_id',
        'nivel_id',
        'tipo_prova_id',
        'carreira_id',
    ];

    public static function isSameGranExam(array $incoming, array $existing): bool
    {
        if (strtolower(trim((string) ($incoming['source_provider'] ?? ''))) !== 'gran'
            || strtolower(trim((string) ($existing['source_provider'] ?? ''))) !== 'gran') {
            return false;
        }

        $incomingName = self::normalizeName((string) ($incoming['nome'] ?? ''));
        $existingName = self::normalizeName((string) ($existing['nome'] ?? ''));
        $year = (int) ($incoming['ano'] ?? 0);
        if ($incomingName === '' || $incomingName !== $existingName
            || $year < 1900 || $year !== (int) ($existing['ano'] ?? 0)) {
            return false;
        }

        foreach (self::CANONICAL_FILTER_FIELDS as $field) {
            $incomingId = self::normalizeNullableId($incoming[$field] ?? null);
            $existingId = self::normalizeNullableId($existing[$field] ?? null);
            if ($incomingId !== null && $existingId !== null && $incomingId !== $existingId) {
                return false;
            }
        }

        return true;
    }

    private static function normalizeName(string $name): string
    {
        $name = preg_replace('/\s+/u', ' ', trim($name)) ?? '';
        return function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
    }

    private static function normalizeNullableId(mixed $value): ?int
    {
        return is_numeric($value) && (int) $value > 0 ? (int) $value : null;
    }
}
