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
 * Camada extra de higiene SQL alem do uso de prepared statements.
 *
 * @since 1.0.0
 */
class SQLSecurity
{
    /**
     * Valida nome de tabela para impedir injecao via metadados.
     *
     * @since 1.0.0
     */
    public static function validateTableName($tableName): string
    {
        if (!preg_match('/^[a-zA-Z0-9_]+$/', (string) $tableName)) {
            throw new Exception('Invalid table name');
        }

        return (string) $tableName;
    }

    /**
     * Valida nome de coluna, permitindo pontos usados em joins.
     *
     * @since 1.0.0
     */
    public static function validateColumnName($columnName): string
    {
        if (!preg_match('/^[a-zA-Z0-9_.]+$/', (string) $columnName)) {
            throw new Exception('Invalid column name');
        }

        return (string) $columnName;
    }

    /**
     * Valida direcao de ORDER BY.
     *
     * @since 1.0.0
     */
    public static function validateOrderDirection($direction): string
    {
        $direction = strtoupper((string) $direction);
        if (!in_array($direction, ['ASC', 'DESC'], true)) {
            return 'ASC';
        }

        return $direction;
    }

    /**
     * Escapa caracteres especiais em padrao LIKE.
     *
     * @since 1.0.0
     */
    public static function sanitizeLikePattern($pattern): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $pattern);
    }

    /**
     * Valida limite numerico de paginacao.
     *
     * @since 1.0.0
     */
    public static function validateLimit($limit, $max = 1000): int
    {
        $limit = (int) $limit;
        if ($limit < 1) {
            return 1;
        }

        if ($limit > $max) {
            return (int) $max;
        }

        return $limit;
    }

    /**
     * Valida offset numerico de paginacao.
     *
     * @since 1.0.0
     */
    public static function validateOffset($offset): int
    {
        $offset = (int) $offset;
        return max(0, $offset);
    }
}
