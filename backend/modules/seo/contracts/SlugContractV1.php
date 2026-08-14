<?php

declare(strict_types=1);

final class SlugContractV1
{
    public const VERSION = 'slug-contract.v1';
    public const MAX_LENGTH = 80;

    public static function generate(string $input, string $resourceType, string|int $resourceId): string
    {
        $decoded = html_entity_decode(strip_tags($input), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $decoded = str_replace(['º', 'ª', '&'], ['o', 'a', ' e '], $decoded);
        $ascii = self::transliterate($decoded);
        $slug = strtolower($ascii);
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        $slug = trim(preg_replace('/-+/', '-', $slug) ?? '', '-');

        if ($slug === '') {
            $fallbackType = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(self::transliterate($resourceType))) ?? '', '-');
            $fallbackId = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower((string) $resourceId)) ?? '', '-');
            $slug = ($fallbackType !== '' ? $fallbackType : 'resource') . '-' . ($fallbackId !== '' ? $fallbackId : 'unknown');
        }

        return self::truncate($slug);
    }

    private static function transliterate(string $value): string
    {
        if (class_exists('Normalizer')) {
            $normalized = Normalizer::normalize($value, Normalizer::FORM_D);
            if (is_string($normalized)) {
                $value = preg_replace('/\p{Mn}+/u', '', $normalized) ?? $normalized;
            }
        }

        $map = [
            'á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a',
            'Á' => 'A', 'À' => 'A', 'Â' => 'A', 'Ã' => 'A', 'Ä' => 'A',
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'É' => 'E', 'È' => 'E', 'Ê' => 'E', 'Ë' => 'E',
            'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
            'Í' => 'I', 'Ì' => 'I', 'Î' => 'I', 'Ï' => 'I',
            'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o',
            'Ó' => 'O', 'Ò' => 'O', 'Ô' => 'O', 'Õ' => 'O', 'Ö' => 'O',
            'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u',
            'Ú' => 'U', 'Ù' => 'U', 'Û' => 'U', 'Ü' => 'U',
            'ç' => 'c', 'Ç' => 'C', 'ñ' => 'n', 'Ñ' => 'N', 'ß' => 'ss',
        ];

        return strtr($value, $map);
    }

    private static function truncate(string $slug): string
    {
        if (strlen($slug) <= self::MAX_LENGTH) {
            return $slug;
        }

        $candidate = substr($slug, 0, self::MAX_LENGTH);
        $nextCharacter = substr($slug, self::MAX_LENGTH, 1);
        if ($nextCharacter !== '' && $nextCharacter !== '-') {
            $lastHyphen = strrpos($candidate, '-');
            if ($lastHyphen !== false) {
                $candidate = substr($candidate, 0, $lastHyphen);
            }
        }

        return rtrim($candidate, '-');
    }

    private function __construct()
    {
    }
}
