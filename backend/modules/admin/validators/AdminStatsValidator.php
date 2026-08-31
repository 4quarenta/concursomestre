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
 * Validador de filtros do dashboard administrativo.
 * Garante consistencia minima antes de executar agregacoes no banco.
 */
class AdminStatsValidator
{
    /**
     * Normaliza e valida os filtros informados no dashboard.
     *
     * @return array{period:string,startDate:?string,endDate:?string}
     *
     * @since 1.0.0
     */
    public function validateFilters(?string $period, ?string $startDate, ?string $endDate): array
    {
        $normalizedPeriod = strtolower(trim((string) ($period ?? 'today')));
        $allowedPeriods = ['all', 'today', 'week', 'month', 'year', 'custom'];

        if (!in_array($normalizedPeriod, $allowedPeriods, true)) {
            throw new InvalidArgumentException('Periodo administrativo invalido.');
        }

        $normalizedStart = $startDate ? trim($startDate) : null;
        $normalizedEnd = $endDate ? trim($endDate) : null;

        if ($normalizedPeriod === 'custom') {
            if (!$normalizedStart || !$normalizedEnd) {
                throw new InvalidArgumentException('Periodo customizado exige data inicial e final.');
            }

            if (!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $normalizedStart) || !preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $normalizedEnd)) {
                throw new InvalidArgumentException('Datas administrativas invalidas.');
            }
        }

        return [
            'period' => $normalizedPeriod,
            'startDate' => $normalizedStart,
            'endDate' => $normalizedEnd,
        ];
    }
}
