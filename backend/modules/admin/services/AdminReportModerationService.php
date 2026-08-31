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

require_once __DIR__ . '/../repositories/AdminReportModerationRepository.php';
require_once __DIR__ . '/../validators/AdminReportModerationValidator.php';
require_once __DIR__ . '/../../../config/notification_helper.php';
require_once __DIR__ . '/../../../config/gamification_helper.php';
require_once __DIR__ . '/AdminUserCommunicationService.php';

/**
 * Servico de moderacao administrativa de denuncias.
 * Concentra regras de persistencia, notificacao e consistencia do fluxo.
 */
class AdminReportModerationService
{
    private PDO $db;
    private AdminReportModerationRepository $repository;
    private AdminReportModerationValidator $validator;
    private AdminUserCommunicationService $communicationService;

    /**
     * Inicializa o servico com dependencias de moderacao e comunicacao.
     *
     * @since 1.0.0
     */
    public function __construct(
        PDO $db,
        AdminReportModerationRepository $repository,
        AdminReportModerationValidator $validator,
        ?AdminUserCommunicationService $communicationService = null
    ) {
        $this->db = $db;
        $this->repository = $repository;
        $this->validator = $validator;
        $this->communicationService = $communicationService ?? new AdminUserCommunicationService();
    }

    /**
     * Aplica a decisao administrativa em uma denuncia especifica.
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
        $this->validator->validatePayload($reportId, $action, $adminReason, $userResponse);
        $this->repository->ensureAdminColumns();

        $report = $this->repository->findById($reportId);
        if (!$report) {
            throw new OutOfBoundsException('Denuncia nao encontrada.');
        }

        $normalizedEvidenceUrl = $evidenceUrl !== '' ? $evidenceUrl : null;

        $this->repository->moderateReport(
            $reportId,
            $action,
            $adminReason,
            $userResponse,
            $internalNote,
            $moderationAction,
            $normalizedEvidenceUrl,
            $adminUserId
        );

        if (!empty($report['reporter_id'])) {
            $title = $action === 'resolved' ? 'Denúncia aceita' : 'Denúncia analisada';
            $message = $action === 'resolved'
                ? "Sua denúncia foi aceita. Resposta da equipe: {$userResponse}"
                : "Sua denúncia foi analisada. Resposta da equipe: {$userResponse}";

            createNotification(
                $this->db,
                (string) $report['reporter_id'],
                $title,
                $message,
                $action === 'resolved' ? 'success' : 'info',
                'report'
            );

            if ($action === 'resolved') {
                $reward = grantGamificationEvent(
                    $this->db,
                    (string) $report['reporter_id'],
                    'report_accepted',
                    'report_accepted:' . $reportId,
                    15,
                    1,
                    [
                        'key' => 'first_accepted_report',
                        'title' => 'Denúncia aceita',
                        'description' => 'Uma denúncia sua ajudou a moderação da plataforma.',
                    ],
                    [
                        'report_id' => $reportId,
                        'target_type' => (string) ($report['target_type'] ?? ''),
                        'target_id' => (string) ($report['target_id'] ?? ''),
                    ]
                );

                if (!empty($reward['badge_awarded'])) {
                    createNotification(
                        $this->db,
                        (string) $report['reporter_id'],
                        'Badge desbloqueado',
                        'Denúncia aceita: você ajudou a manter a comunidade organizada.',
                        'success',
                        'system',
                        '/profile?tab=achievements'
                    );
                }

                if (!empty($reward['applied'])) {
                    createNotification(
                        $this->db,
                        (string) $report['reporter_id'],
                        'XP de moderação',
                        'Sua denúncia procedente rendeu +15 XP e reputação.',
                        'success',
                        'report',
                        '/notifications'
                    );
                }
            }
        }

        $this->communicationService->sendReportDecisionEmail(
            $report,
            $action,
            $userResponse,
            $normalizedEvidenceUrl
        );

        return [
            'report' => $report,
            'status' => $action,
            'admin_reason' => $adminReason,
            'user_response' => $userResponse,
            'internal_note' => $internalNote,
            'moderation_action' => $moderationAction,
            'evidence_url' => $normalizedEvidenceUrl,
        ];
    }
}
