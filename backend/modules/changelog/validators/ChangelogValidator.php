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
 * Validator do dominio de changelog.
 * Mantem a normalizacao do JSON fora do controller.
 *
 * @since 1.0.0
 */
class ChangelogValidator
{
    /**
     * Converte o payload salvo em JSON para array seguro.
     *
     * @since 1.0.0
     */
    public function normalizeContentJson($rawValue): array
    {
        if (is_array($rawValue)) {
            return $rawValue;
        }

        if (!is_string($rawValue) || trim($rawValue) === '') {
            return [];
        }

        $decoded = json_decode($rawValue, true);
        return is_array($decoded) ? $decoded : [];
    }
}
