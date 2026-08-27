<?php

declare(strict_types=1);

final class PublicMaterialReadiness
{
    /** @return array{status:'READY'|'NOT_READY',reasonCodes:list<string>} */
    public static function material(array $row): array
    {
        require_once dirname(__DIR__, 2) . '/seo/launch/SeoInstanceReadinessAssembler.php';
        return (new SeoInstanceReadinessAssembler())->assemblePublicEntity(
            'material',
            self::publicationInput($row),
            self::profileSignals($row)
        );
    }

    /** @return array{status:'READY'|'NOT_READY',reasonCodes:list<string>} */
    public static function listing(array $row): array
    {
        $availability = (string) ($row['availability_status'] ?? 'not_for_sale');
        $isFree = (int) ($row['is_free'] ?? 0) === 1;
        $price = self::minorUnits($row['price_decimal'] ?? $row['price'] ?? null);
        $currency = strtoupper(trim((string) ($row['currency'] ?? '')));
        $freeOffer = $isFree && ($price === null || $price === 0);
        $paidOffer = !$isFree && $price !== null && $price > 0 && $currency === 'BRL';
        $commerciallyValid = $availability === 'included_in_plan'
            || ($availability === 'available' && ($freeOffer || $paidOffer));
        require_once dirname(__DIR__, 2) . '/seo/launch/SeoInstanceReadinessAssembler.php';
        $signals = self::profileSignals($row);
        $signals['commerciallyValid'] = $commerciallyValid;
        return (new SeoInstanceReadinessAssembler())->assemblePublicEntity(
            'material_listing',
            self::publicationInput($row),
            $signals
        );
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

    /** @return array<string,mixed> */
    public static function publicationInput(array $row): array
    {
        return [
            'status' => (string) ($row['publication_status'] ?? 'unpublished'),
            'visibility' => (string) ($row['visibility_status'] ?? 'restricted'),
            'scheduledAt' => $row['scheduled_at'] ?? null,
            'provenanceStatus' => 'verified',
            'rightsStatus' => ($row['rights_status'] ?? '') === 'approved' ? 'allowed' : 'denied',
        ];
    }

    /** @return array<string,bool> */
    public static function profileSignals(array $row): array
    {
        return [
            'entityExists' => trim((string) ($row['id'] ?? '')) !== '',
            'validSlug' => self::validSlug((string) ($row['slug'] ?? '')),
            'hasDefinition' => trim((string) ($row['title'] ?? '')) !== '',
            'notArchived' => empty($row['archived_at']),
            'definitionApproved' => ($row['status'] ?? '') === 'approved',
            'rightsAllowed' => ($row['rights_status'] ?? '') === 'approved',
            'hasAsset' => (int) ($row['has_asset'] ?? $row['hasAsset'] ?? $row['has_ready_upload'] ?? 0) === 1,
        ];
    }
}
