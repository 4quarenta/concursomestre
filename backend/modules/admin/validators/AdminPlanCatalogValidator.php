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
 * Valida filtros e mutacoes do catalogo de planos no painel admin.
 *
 * @since 1.0.0
 */
class AdminPlanCatalogValidator
{
    /**
     * Normaliza filtros de listagem.
     *
     * @since 1.0.0
     */
    public function validateListFilters(array $query): array
    {
        return [
            'search' => trim((string) ($query['search'] ?? '')),
        ];
    }

    /**
     * Normaliza payload de atualizacao de plano.
     *
     * @since 1.0.0
     */
    public function validateUpdatePayload(array $payload): array
    {
        $planId = (int) ($payload['plan_id'] ?? $payload['id'] ?? 0);
        if ($planId <= 0) {
            throw new InvalidArgumentException('Informe um plano valido para atualizar.');
        }

        $hasPrice = array_key_exists('price', $payload);
        $hasIntervalCount = array_key_exists('interval_count', $payload);
        $hasIntervalUnit = array_key_exists('interval_unit', $payload);
        $hasActive = array_key_exists('active', $payload);

        if (!$hasPrice && !$hasIntervalCount && !$hasIntervalUnit && !$hasActive) {
            throw new InvalidArgumentException('Nenhum campo de atualizacao foi informado.');
        }

        $normalized = [
            'plan_id' => $planId,
            'price' => null,
            'interval_count' => null,
            'interval_unit' => null,
            'active' => null,
        ];

        if ($hasPrice) {
            $price = (float) $payload['price'];
            if (!is_finite($price) || $price < 0) {
                throw new InvalidArgumentException('Valor do plano invalido.');
            }
            $normalized['price'] = round($price, 2);
        }

        if ($hasIntervalCount) {
            $intervalCount = (int) $payload['interval_count'];
            if ($intervalCount <= 0 || $intervalCount > 3650) {
                throw new InvalidArgumentException('Quantidade de dias/ciclos invalida.');
            }
            $normalized['interval_count'] = $intervalCount;
        }

        if ($hasIntervalUnit) {
            $intervalUnit = strtolower(trim((string) $payload['interval_unit']));
            if (!in_array($intervalUnit, ['day', 'week', 'month', 'year'], true)) {
                throw new InvalidArgumentException('Tipo de ciclo invalido.');
            }
            $normalized['interval_unit'] = $intervalUnit;
        }

        if ($hasActive) {
            $active = $payload['active'];
            $normalized['active'] = filter_var($active, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
            if ($normalized['active'] === null) {
                $normalized['active'] = ((int) $active) > 0;
            }
        }

        return $normalized;
    }
}

