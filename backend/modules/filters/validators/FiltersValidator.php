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

        $website = trim((string) ($data['website'] ?? ''));
        if ($website !== '' && filter_var($website, FILTER_VALIDATE_URL) === false) {
            throw new InvalidArgumentException('website deve conter uma URL valida.');
        }

        foreach (['assetUrl', 'asset_url'] as $field) {
            $url = trim((string) ($data[$field] ?? ''));
            $isProtectedUpload = str_starts_with($url, '/uploads/admin-assets/taxonomy-logo/')
                && !str_contains($url, '..');
            if ($url !== '' && !$isProtectedUpload && filter_var($url, FILTER_VALIDATE_URL) === false) {
                throw new InvalidArgumentException("{$field} deve conter uma URL valida.");
            }
        }

        $metadata = is_array($data['metadata'] ?? null) ? $data['metadata'] : [];
        $acronym = trim((string) ($data['sigla'] ?? $data['acronym'] ?? $metadata['sigla'] ?? ''));
        if (mb_strlen($acronym, 'UTF-8') > 40) {
            throw new InvalidArgumentException('A sigla deve ter no maximo 40 caracteres.');
        }
        if ($acronym !== '' && preg_match('/^[\p{L}\p{N}][\p{L}\p{N}.\-\/ ]*$/u', $acronym) !== 1) {
            throw new InvalidArgumentException('A sigla contem caracteres invalidos.');
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
