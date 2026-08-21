<?php

declare(strict_types=1);

final class PublicMaterialReadiness
{
    /** @return array{status:'READY'|'NOT_READY',reasonCodes:list<string>} */
    public static function material(array $row): array
    {
        $reasons = [];
        if (trim((string) ($row['id'] ?? '')) === '') $reasons[] = 'instance_readiness.entity_missing';
        if (!self::validSlug((string) ($row['slug'] ?? ''))) {
            $reasons[] = 'instance_readiness.invalid_slug';
            $reasons[] = 'instance_readiness.canonical_invalid';
        }
        if (trim((string) ($row['title'] ?? '')) === '') $reasons[] = 'instance_readiness.invalid_definition';
        if (($row['status'] ?? '') !== 'approved'
            || ($row['publication_status'] ?? '') !== 'published'
            || ($row['visibility_status'] ?? '') !== 'public'
            || !empty($row['archived_at'])) {
            $reasons[] = 'instance_readiness.publication_blocked';
        }
        if (($row['rights_status'] ?? '') !== 'approved') $reasons[] = 'instance_readiness.protected';
        if ((int) ($row['has_asset'] ?? $row['hasAsset'] ?? 0) !== 1) $reasons[] = 'instance_readiness.invalid_definition';
        $reasons = array_values(array_unique($reasons));
        return ['status' => $reasons === [] ? 'READY' : 'NOT_READY', 'reasonCodes' => $reasons];
    }

    /** @return array{status:'READY'|'NOT_READY',reasonCodes:list<string>} */
    public static function listing(array $row): array
    {
        $result = self::material($row);
        $availability = (string) ($row['availability_status'] ?? 'not_for_sale');
        $isFree = (int) ($row['is_free'] ?? 0) === 1;
        $price = self::minorUnits($row['price_decimal'] ?? $row['price'] ?? null);
        $currency = strtoupper(trim((string) ($row['currency'] ?? '')));
        $freeOffer = $isFree && ($price === null || $price === 0);
        $paidOffer = !$isFree && $price !== null && $price > 0 && $currency === 'BRL';
        $commerciallyValid = $availability === 'included_in_plan'
            || ($availability === 'available' && ($freeOffer || $paidOffer));
        if (!$commerciallyValid) $result['reasonCodes'][] = 'instance_readiness.invalid_definition';
        $result['reasonCodes'] = array_values(array_unique($result['reasonCodes']));
        $result['status'] = $result['reasonCodes'] === [] ? 'READY' : 'NOT_READY';
        return $result;
    }

    public static function validSlug(string $slug): bool
    {
        return strlen($slug) <= 190 && preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) === 1;
    }

    public static function minorUnits(mixed $value): ?int
    {
        $normalized = trim((string) ($value ?? ''));
        if (preg_match('/^(\d+)(?:\.(\d{1,2}))?$/', $normalized, $matches) !== 1) return null;
        $fraction = str_pad((string) ($matches[2] ?? ''), 2, '0');
        return ((int) $matches[1] * 100) + (int) $fraction;
    }
}
