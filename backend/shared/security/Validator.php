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
 * Utilitario de validacao e sanitizacao de entrada.
 *
 * @since 1.0.0
 */
class Validator
{
    /**
     * Valida email no formato esperado.
     *
     * @since 1.0.0
     */
    public static function validateEmail($email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Sanitize string removendo tags e caracteres especiais.
     *
     * @since 1.0.0
     */
    public static function sanitizeString($str): string
    {
        return htmlspecialchars(strip_tags(trim((string) $str)), ENT_QUOTES, 'UTF-8');
    }

    /**
     * Valida campos obrigatorios em um objeto de entrada.
     *
     * @since 1.0.0
     */
    public static function validateRequired($data, $fields): array
    {
        foreach ($fields as $field) {
            if (!isset($data->$field) || empty($data->$field)) {
                return [
                    'valid' => false,
                    'message' => "Field '{$field}' is required",
                ];
            }
        }

        return ['valid' => true];
    }

    /**
     * Valida tamanho minimo e maximo de string.
     *
     * @since 1.0.0
     */
    public static function validateLength($str, $min, $max): bool
    {
        $len = strlen((string) $str);
        return $len >= $min && $len <= $max;
    }

    /**
     * Valida inteiro dentro de limites opcionais.
     *
     * @since 1.0.0
     */
    public static function validateInt($value, $min = null, $max = null): bool
    {
        if (!is_numeric($value)) {
            return false;
        }

        $int = (int) $value;

        if ($min !== null && $int < $min) {
            return false;
        }

        if ($max !== null && $int > $max) {
            return false;
        }

        return true;
    }

    /**
     * Sanitiza inteiro com fallback.
     *
     * @since 1.0.0
     */
    public static function sanitizeInt($value, $default = 0): int
    {
        return is_numeric($value) ? (int) $value : (int) $default;
    }

    /**
     * Normaliza uma lista de IDs inteiros.
     *
     * @since 1.0.0
     */
    public static function sanitizeIds($ids): array
    {
        if (!is_array($ids)) {
            return [];
        }

        return array_filter(
            array_map('intval', $ids),
            static function ($id): bool {
                return $id > 0;
            }
        );
    }
}
