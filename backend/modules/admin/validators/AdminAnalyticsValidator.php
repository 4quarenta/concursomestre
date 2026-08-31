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

/**
 * Validador dos filtros analiticos do admin.
 *
 * @since 1.0.0
 */
class AdminAnalyticsValidator
{
    public function validateFilters(?string $period, ?string $startDate, ?string $endDate): array
    {
        $normalizedPeriod = strtolower(trim((string) ($period ?? 'month')));

        if (!in_array($normalizedPeriod, ['all', 'today', 'week', 'month', 'year', 'custom'], true)) {
            $normalizedPeriod = 'month';
        }

        $normalizedStart = $startDate ? trim((string) $startDate) : null;
        $normalizedEnd = $endDate ? trim((string) $endDate) : null;

        if ($normalizedPeriod === 'custom') {
            if ($normalizedStart === null || $normalizedEnd === null) {
                throw new InvalidArgumentException('Periodo custom exige data inicial e final.');
            }

            $start = DateTimeImmutable::createFromFormat('Y-m-d', $normalizedStart);
            $end = DateTimeImmutable::createFromFormat('Y-m-d', $normalizedEnd);

            if (!$start || !$end) {
                throw new InvalidArgumentException('Formato de data invalido. Use YYYY-MM-DD.');
            }

            if ($start > $end) {
                throw new InvalidArgumentException('A data inicial nao pode ser maior do que a data final.');
            }
        }

        return [
            'period' => $normalizedPeriod,
            'startDate' => $normalizedStart,
            'endDate' => $normalizedEnd,
        ];
    }
}

