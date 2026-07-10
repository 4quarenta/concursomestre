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

require_once __DIR__ . '/../services/AdminReportModerationService.php';

/**
 * Controller HTTP do fluxo de moderacao administrativa de denuncias.
 */
class AdminReportModerationController
{
    private AdminReportModerationService $service;

    /**
     * Inicializa o controller com o servico de moderacao.
     *
     * @since 1.0.0
     */
    public function __construct(AdminReportModerationService $service)
    {
        $this->service = $service;
    }

    /**
     * Aplica a moderacao administrativa conforme dados recebidos.
     *
     * @since 1.0.0
     */
    public function moderate(
        string $adminUserId,
        string $reportId,
        string $action,
        string $adminReason,
        string $userResponse,
        string $internalNote,
        string $moderationAction,
        string $evidenceUrl
    ): array {
        return $this->service->moderate(
            $adminUserId,
            $reportId,
            $action,
            $adminReason,
            $userResponse,
            $internalNote,
            $moderationAction,
            $evidenceUrl
        );
    }
}
