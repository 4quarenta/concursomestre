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
 * Validador das operacoes de taxonomias/filtros.
 *
 * @since 1.0.0
 */
class FiltersValidator
{
    /**
     * Valida o payload de salvamento.
     *
     * @since 1.0.0
     */
    public function validateSavePayload(array $data): void
    {
        $type = trim((string) ($data['type'] ?? ''));
        $name = trim((string) ($data['name'] ?? ''));

        if ($type === '' || $name === '') {
            throw new InvalidArgumentException('Tipo e nome sao obrigatorios');
        }

        foreach (['aliases', 'keywords'] as $field) {
            if (isset($data[$field]) && !is_array($data[$field]) && !is_string($data[$field])) {
                throw new InvalidArgumentException("{$field} deve ser uma lista ou texto separado por virgulas.");
            }
        }

        foreach (['website', 'assetUrl', 'asset_url'] as $field) {
            $url = trim((string) ($data[$field] ?? ''));
            if ($url !== '' && filter_var($url, FILTER_VALIDATE_URL) === false) {
                throw new InvalidArgumentException("{$field} deve conter uma URL valida.");
            }
        }
    }

    /**
     * Garante que o id informado seja positivo.
     *
     * @since 1.0.0
     */
    public function validatePositiveId(int $id, string $message): void
    {
        if ($id <= 0) {
            throw new InvalidArgumentException($message);
        }
    }
}
