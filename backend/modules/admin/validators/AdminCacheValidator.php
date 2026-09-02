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
 * Validador das operacoes administrativas de cache.
 */
class AdminCacheValidator
{
    private const ALLOWED_ACTIONS = ['stats', 'clear', 'clean', 'settings'];

    /**
     * Garante que a acao informada e suportada pelo modulo.
     *
     * @since 1.0.0
     */
    public function validateAction(string $action): void
    {
        if (!in_array($action, self::ALLOWED_ACTIONS, true)) {
            throw new InvalidArgumentException('Acao invalida.');
        }
    }

    /**
     * Garante que a rota de configuracao usa o metodo correto.
     *
     * @since 1.0.0
     */
    public function validateSettingsMethod(string $method): void
    {
        $this->validateMutationMethod($method);
    }

    /**
     * Mutacoes administrativas de cache nunca aceitam GET.
     */
    public function validateMutationMethod(string $method): void
    {
        if (strtoupper($method) !== 'POST') {
            throw new RuntimeException('Metodo invalido.');
        }
    }
}
