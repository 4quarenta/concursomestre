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

require_once __DIR__ . '/../../../config/gamification_helper.php';
require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/../../../shared/utils/Mailer.php';
require_once __DIR__ . '/../../../shared/utils/EmailTemplateResolver.php';
require_once __DIR__ . '/../../../shared/pagination/SignedKeysetCursor.php';

/**
 * Service oficial do domínio de denúncias.
 * Orquestra criação autenticada e listagem administrativa padronizada.
 *
 * @since 1.0.0
 */
class ReportsService
{
    public function __construct(
        private readonly ReportsRepository $repository,
        private readonly ReportsValidator $validator
    ) {
    }

    public function createReport(array $payload, array $authenticatedUserPayload): array
    {
        $normalized = $this->validator->validateCreatePayload($payload);
        $reporterId = $this->validator->resolveReporterId(
            $authenticatedUserPayload,
            $normalized['requestedReporterId']
        );

        $reporter = $this->repository->findUserById($reporterId);
        if (!$reporter) {
            throw new OutOfBoundsException('Usuário autenticado não encontrado.');
        }

        $duplicate = $this->repository->findPendingDuplicate(
            $reporterId,
            $normalized['targetType'],
            $normalized['targetId']
        );

        if ($duplicate) {
            $duplicateMessage = $normalized['targetType'] === 'comment'
                ? 'Você já enviou uma denúncia para este comentário. A equipe ainda está analisando.'
                : 'Você já enviou uma denúncia para este item. A equipe ainda está analisando.';

            return [
                'id' => (string) ($duplicate['id'] ?? ''),
                'duplicate' => true,
                'message' => $duplicateMessage,
            ];
        }

        $reportId = 'rep-' . uniqid('', true) . '-' . time();
        $this->repository->insertReport([
            'id' => $reportId,
            'reporter_id' => $reporterId,
            'target_type' => $normalized['targetType'],
            'target_id' => $normalized['targetId'],
            'reason' => $normalized['reason'],
            'details' => $normalized['details'],
            'status' => 'pending',
            'evidence_url' => $normalized['evidenceUrl'],
        ]);

        $this->repository->notifyAdmins(
            'Nova denúncia aguardando moderação',
            (string) ($reporter['name'] ?? 'Usuário') . ' enviou uma denúncia em ' . $normalized['targetType'] . '.',
            'warning',
            'report',
            '/admin/support/reports'
        );
        $this->notifyAdminByEmail($reportId, $reporter, $normalized);

        try {
            applyReportSubmissionGamification(
                $this->repository->getConnection(),
                $reporterId,
                $reportId,
                $normalized['targetType'],
                $normalized['targetId']
            );
        } catch (Throwable $e) {
            error_log('[ReportsService] Falha ao aplicar gamificação de denúncia: ' . $e->getMessage());
        }

        return [
            'id' => $reportId,
            'duplicate' => false,
            'message' => 'Denúncia registrada com sucesso.',
        ];
    }

    public function listReports(
        string $adminUserId,
        int $limit = 50,
        ?string $cursor = null
    ): array
    {
        $this->validator->validateAdminUserId($adminUserId);
        $safeLimit = max(1, min(100, $limit));
        $rows = $this->repository->listReports($safeLimit, $cursor);
        $hasMore = count($rows) > $safeLimit;
        if ($hasMore) {
            $rows = array_slice($rows, 0, $safeLimit);
        }

        $items = array_map(function (array $row): array {
            $targetType = (string) ($row['targetType'] ?? '');
            $targetId = (string) ($row['target_id'] ?? '');

            return [
                'id' => (string) ($row['id'] ?? ''),
                'targetType' => $targetType,
                'questionId' => $targetType === 'question' && $targetId !== '' ? (int) $targetId : null,
                'materialId' => $targetType === 'material' ? $targetId : null,
                'commentId' => $targetType === 'comment' ? $targetId : null,
                'lawSectionId' => $targetType === 'law_section' ? $targetId : null,
                'userName' => (string) ($row['userName'] ?? 'Usuário'),
                'userId' => (string) ($row['userId'] ?? ''),
                'reason' => (string) ($row['reason'] ?? ''),
                'email' => ($row['email'] ?? null) ?: null,
                'role' => ($row['role'] ?? null) ?: null,
                'plan' => null,
                'level' => isset($row['level']) ? (int) $row['level'] : null,
                'details' => (string) ($row['details'] ?? ''),
                'status' => (string) ($row['status'] ?? 'pending'),
                'timestamp' => $this->normalizeTimestampToMs($row['timestamp'] ?? null),
                'evidenceUrl' => ($row['evidenceUrl'] ?? null) ?: null,
                'targetContent' => ($row['targetContent'] ?? null) ?: null,
                'targetLabel' => ($row['targetLabel'] ?? null) ?: null,
                'targetContext' => ($row['targetContext'] ?? null) ?: null,
                'targetUrl' => ($row['targetUrl'] ?? null) ?: null,
                'resolvedAt' => $this->normalizeTimestampToMs($row['resolvedAt'] ?? null),
            ];
        }, $rows);
        $lastRow = $rows !== [] ? $rows[count($rows) - 1] : null;

        return [
            'items' => $items,
            'pageInfo' => [
                'limit' => $safeLimit,
                'hasMore' => $hasMore,
                'nextCursor' => $hasMore && is_array($lastRow)
                    ? SignedKeysetCursor::encode(
                        'reports.admin',
                        (string) ($lastRow['timestamp'] ?? ''),
                        (string) ($lastRow['id'] ?? '')
                    )
                    : null,
            ],
        ];
    }

    private function notifyAdminByEmail(string $reportId, array $reporter, array $normalized): void
    {
        try {
            $admin = $this->repository->findFirstAdmin();
            if (!$admin) {
                return;
            }

            $adminUrl = buildAppHashRoute('/admin', ['tab' => 'support', 'section' => 'reports']);
            $reporterName = trim((string) ($reporter['name'] ?? 'Usuário'));
            $targetType = trim((string) ($normalized['targetType'] ?? 'item'));
            $reason = trim((string) ($normalized['reason'] ?? ''));
            $details = trim((string) ($normalized['details'] ?? ''));

            $content = 'Olá ' . htmlspecialchars((string) ($admin['name'] ?? 'admin'), ENT_QUOTES, 'UTF-8') . ',<br><br>'
                . 'Uma nova denúncia foi registrada e aguarda moderação.<br><br>'
                . '<b>ID da denúncia:</b> ' . htmlspecialchars($reportId, ENT_QUOTES, 'UTF-8') . '<br>'
                . '<b>Usuário:</b> ' . htmlspecialchars($reporterName, ENT_QUOTES, 'UTF-8') . '<br>'
                . '<b>Alvo:</b> ' . htmlspecialchars($targetType, ENT_QUOTES, 'UTF-8') . ' #' . htmlspecialchars((string) ($normalized['targetId'] ?? ''), ENT_QUOTES, 'UTF-8') . '<br>'
                . '<b>Motivo:</b> ' . htmlspecialchars($reason, ENT_QUOTES, 'UTF-8') . '<br>'
                . ($details !== '' ? '<b>Detalhes:</b> ' . nl2br(htmlspecialchars($details, ENT_QUOTES, 'UTF-8')) . '<br>' : '')
                . '<br>Acesse o painel administrativo para analisar a denúncia.';

            $bodyHtml = Mailer::htmlTemplate('Denúncia aguardando moderação', $content, $adminUrl, 'Abrir moderação');
            $template = resolveSystemEmailTemplate(
                'report_created_admin',
                [
                    'subject' => 'Nova denúncia aguardando moderação',
                    'htmlBody' => $bodyHtml,
                    'textBody' => "Olá {$admin['name']},\n\nUma nova denúncia foi registrada e aguarda moderação.\nID: {$reportId}\nUsuário: {$reporterName}\nAlvo: {$targetType} #{$normalized['targetId']}\nMotivo: {$reason}\n\nAbrir moderação: {$adminUrl}",
                ],
                [
                    'name' => (string) ($admin['name'] ?? ''),
                    'email' => (string) ($admin['email'] ?? ''),
                    'report_id' => $reportId,
                    'reporter_name' => $reporterName,
                    'target_type' => $targetType,
                    'target_id' => (string) ($normalized['targetId'] ?? ''),
                    'reason' => $reason,
                    'details' => $details,
                    'admin_url' => $adminUrl,
                    'app_url' => rtrim((string) (getenv('APP_URL') ?: 'http://localhost:3000'), '/'),
                    'content' => Mailer::htmlToText($content),
                ],
                $this->repository->getConnection()
            );

            if ($template['enabled']) {
                Mailer::send((string) $admin['email'], (string) $admin['name'], $template['subject'], $template['htmlBody'], $template['textBody']);
            }
        } catch (Throwable $e) {
            error_log('[ReportsService] Falha ao notificar admin por e-mail: ' . $e->getMessage());
        }
    }

    private function normalizeTimestampToMs(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        $timestamp = strtotime((string) $value);
        if ($timestamp === false) {
            return null;
        }

        return $timestamp * 1000;
    }
}
