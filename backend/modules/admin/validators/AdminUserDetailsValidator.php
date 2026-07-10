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
 * Validador do fluxo administrativo de detalhes de usuario.
 */
class AdminUserDetailsValidator
{
    /**
     * Garante que o identificador do usuario foi informado.
     *
     * @since 1.0.0
     */
    public function validateUserId(string $userId): void
    {
        if (trim($userId) === '') {
            throw new InvalidArgumentException('ID do usuario e obrigatorio.');
        }
    }
}
