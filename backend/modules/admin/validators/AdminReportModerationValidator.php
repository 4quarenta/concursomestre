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
 * Validador do fluxo de moderação de denúncias.
 * Mantém as regras de entrada explícitas e reutilizáveis.
 */
class AdminReportModerationValidator
{
    /**
     * Valida os dados necessários para moderar uma denúncia.
     *
     * @since 1.0.0
     */
    public function validatePayload(string $reportId, string $action, string $adminReason, string $userResponse = ''): void
    {
        if ($reportId === '' || !in_array($action, ['resolved', 'ignored'], true)) {
            throw new InvalidArgumentException('Parâmetros inválidos para a moderação da denúncia.');
        }

        if ($adminReason === '') {
            throw new InvalidArgumentException('A justificativa administrativa é obrigatória.');
        }

        if ($userResponse === '') {
            throw new InvalidArgumentException('A resposta ao usuário é obrigatória.');
        }
    }
}
