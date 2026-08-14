<?php

declare(strict_types=1);

final class SeoContractReasonCodes
{
    /** @var array<string, list<string>>|null */
    private static ?array $catalog = null;

    /** @return array<string, list<string>> */
    public static function catalog(): array
    {
        if (self::$catalog !== null) {
            return self::$catalog;
        }

        $path = dirname(__DIR__, 4) . '/contracts/seo/reason-codes.v1.json';
        $raw = file_get_contents($path);
        if ($raw === false) {
            throw new RuntimeException('Reason-code catalog not found.');
        }

        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($decoded) || ($decoded['version'] ?? null) !== 'reason-codes.v1' || !is_array($decoded['definitions'] ?? null)) {
            throw new RuntimeException('Reason-code catalog is invalid.');
        }

        $definitionNames = [
            'publication' => 'publicationReasonCode',
            'quality' => 'qualityReasonCode',
            'indexability' => 'indexabilityReasonCode',
            'resolution' => 'resolutionReasonCode',
        ];
        $families = [];
        foreach ($definitionNames as $family => $definitionName) {
            $codes = $decoded['definitions'][$definitionName]['enum'] ?? null;
            if (!is_array($codes)) {
                throw new RuntimeException('Reason-code definition is invalid: ' . $definitionName . '.');
            }
            $families[$family] = array_values(array_filter($codes, 'is_string'));
        }

        /** @var array<string, list<string>> $families */
        self::$catalog = $families;

        return self::$catalog;
    }

    /** @param mixed $reasonCodes
     *  @return list<string>
     */
    public static function validate(string $family, mixed $reasonCodes): array
    {
        $catalog = self::catalog();
        if (!isset($catalog[$family])) {
            return ['Unknown reason-code family: ' . $family . '.'];
        }
        if (!is_array($reasonCodes)) {
            return ['Reason codes must be an array.'];
        }

        $errors = [];
        $seen = [];
        foreach ($reasonCodes as $reasonCode) {
            if (!is_string($reasonCode) || !in_array($reasonCode, $catalog[$family], true)) {
                $errors[] = 'Unknown ' . $family . ' reason code.';
                continue;
            }
            if (isset($seen[$reasonCode])) {
                $errors[] = 'Duplicate reason code: ' . $reasonCode . '.';
            }
            $seen[$reasonCode] = true;
        }

        return $errors;
    }

    private function __construct()
    {
    }
}
