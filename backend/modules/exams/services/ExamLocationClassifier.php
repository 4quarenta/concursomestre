<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

final class ExamLocationClassifier
{
    private const REGION_BY_UF = [
        'AC' => 'Norte', 'AP' => 'Norte', 'AM' => 'Norte', 'PA' => 'Norte',
        'RO' => 'Norte', 'RR' => 'Norte', 'TO' => 'Norte',
        'AL' => 'Nordeste', 'BA' => 'Nordeste', 'CE' => 'Nordeste', 'MA' => 'Nordeste',
        'PB' => 'Nordeste', 'PE' => 'Nordeste', 'PI' => 'Nordeste', 'RN' => 'Nordeste', 'SE' => 'Nordeste',
        'DF' => 'Centro-Oeste', 'GO' => 'Centro-Oeste', 'MT' => 'Centro-Oeste', 'MS' => 'Centro-Oeste',
        'ES' => 'Sudeste', 'MG' => 'Sudeste', 'RJ' => 'Sudeste', 'SP' => 'Sudeste',
        'PR' => 'Sul', 'RS' => 'Sul', 'SC' => 'Sul',
        'BR' => 'Nacional',
    ];

    private const STATE_NAME_BY_UF = [
        'AC' => 'Acre', 'AL' => 'Alagoas', 'AP' => 'Amapá', 'AM' => 'Amazonas',
        'BA' => 'Bahia', 'CE' => 'Ceará', 'DF' => 'Distrito Federal', 'ES' => 'Espírito Santo',
        'GO' => 'Goiás', 'MA' => 'Maranhão', 'MT' => 'Mato Grosso', 'MS' => 'Mato Grosso do Sul',
        'MG' => 'Minas Gerais', 'PA' => 'Pará', 'PB' => 'Paraíba', 'PR' => 'Paraná',
        'PE' => 'Pernambuco', 'PI' => 'Piauí', 'RJ' => 'Rio de Janeiro', 'RN' => 'Rio Grande do Norte',
        'RS' => 'Rio Grande do Sul', 'RO' => 'Rondônia', 'RR' => 'Roraima', 'SC' => 'Santa Catarina',
        'SP' => 'São Paulo', 'SE' => 'Sergipe', 'TO' => 'Tocantins', 'BR' => 'Nacional',
    ];

    public static function classify(array $parts, ?string $metadataUf = null): array
    {
        $metadataUf = strtoupper(trim((string) $metadataUf));
        if (isset(self::REGION_BY_UF[$metadataUf])) {
            return self::payload($metadataUf);
        }

        $haystack = self::normalize(implode(' ', array_filter(array_map('strval', $parts))));
        foreach (self::STATE_NAME_BY_UF as $uf => $name) {
            if ($uf === 'BR') {
                continue;
            }
            $normalizedName = self::normalize($name);
            if (preg_match('/(?:^|[^A-Z0-9])' . preg_quote($normalizedName, '/') . '(?:[^A-Z0-9]|$)/', $haystack) === 1) {
                return self::payload($uf);
            }
        }

        foreach (array_keys(self::REGION_BY_UF) as $uf) {
            if ($uf === 'BR') {
                continue;
            }
            if (preg_match('/(?:^|[^A-Z0-9])' . preg_quote($uf, '/') . '(?:[^A-Z0-9]|$)/', $haystack) === 1) {
                return self::payload($uf);
            }
        }

        if (preg_match('/\b(FEDERAL|NACIONAL|BRASIL|IBGE|INSS|STN|RECEITA FEDERAL)\b/', $haystack) === 1) {
            return self::payload('BR');
        }

        return [
            'stateCode' => null,
            'stateName' => 'Localidade não informada',
            'region' => 'Não informada',
        ];
    }

    public static function stateCodesForRegion(string $region): array
    {
        $region = trim($region);
        if ($region === '') {
            return [];
        }

        return array_keys(array_filter(
            self::REGION_BY_UF,
            static fn (string $candidate): bool => $candidate === $region
        ));
    }

    public static function locationForStateCode(string $stateCode): ?array
    {
        $stateCode = strtoupper(trim($stateCode));
        return isset(self::REGION_BY_UF[$stateCode]) ? self::payload($stateCode) : null;
    }

    private static function payload(string $uf): array
    {
        return [
            'stateCode' => $uf,
            'stateName' => self::STATE_NAME_BY_UF[$uf],
            'region' => self::REGION_BY_UF[$uf],
        ];
    }

    private static function normalize(string $value): string
    {
        $transliterated = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        return strtoupper(trim(preg_replace('/\s+/', ' ', $transliterated !== false ? $transliterated : $value) ?? ''));
    }
}
