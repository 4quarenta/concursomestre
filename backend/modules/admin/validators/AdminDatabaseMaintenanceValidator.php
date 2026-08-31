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
 * Validador das operacoes administrativas de manutencao da base.
 */
class AdminDatabaseMaintenanceValidator
{
    /**
     * Valida o fluxo de reset de credenciais administrativas.
     *
     * @since 1.0.0
     */
    public function validateResetCredentials(string $appMode, string $password, string $twoFactorCode): void
    {
        if ($appMode !== 'development') {
            if ($password === '' || $twoFactorCode === '') {
                throw new InvalidArgumentException('Senha e codigo 2FA sao obrigatorios.');
            }

            return;
        }

        if ($password === '') {
            throw new InvalidArgumentException('Senha administrativa e obrigatoria.');
        }
    }

    /**
     * Garante que ao menos uma tabela foi selecionada para limpeza.
     *
     * @since 1.0.0
     */
    public function validateSelectedTables(array $requestedTables): void
    {
        if (empty($requestedTables)) {
            throw new InvalidArgumentException('Selecione ao menos uma tabela para limpeza.');
        }
    }

    /**
     * Valida se o payload de reset possui itens suficientes para executar.
     *
     * @since 1.0.0
     */
    public function validateAllowedResetPayload(array $tablesToTruncate, bool $shouldCleanUsers): void
    {
        if (empty($tablesToTruncate) && !$shouldCleanUsers) {
            throw new InvalidArgumentException('Nenhuma tabela valida foi selecionada.');
        }
    }
}
