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
 * Validator do dominio de planos.
 * O catalogo publico ainda nao recebe filtros, mas a classe existe para
 * manter o padrao oficial do modulo e ser expandida sem acoplamento futuro.
 *
 * @since 1.0.0
 */
class PlansValidator
{
    /**
     * Valida a requisicao da listagem publica.
     *
     * @since 1.0.0
     */
    public function validateListRequest(): void
    {
        // Sem parametros obrigatorios no catalogo publico atual.
    }
}
