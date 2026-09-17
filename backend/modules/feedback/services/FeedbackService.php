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
require_once __DIR__ . '/../../../shared/communications/CommunicationService.php';
require_once __DIR__ . '/../../../shared/utils/EmailTemplateResolver.php';

/**
 * Service oficial da central de suporte/feedback.
 * Orquestra listagem de threads, leitura da conversa e criacao de novas mensagens.
 *
 * @since 1.0.0
 */
class FeedbackService
{
    /**
     * Inicializa o service de feedback com dependencias principais.
     *
     * @since 1.0.0
     */
    public function __construct(
        private readonly FeedbackRepository $repository,
        private readonly FeedbackValidator $validator
    ) {
    }

    /**
     * Lista as threads abertas pelo usuario autenticado.
     *
     * @since 1.0.0
     */
    public function listThreads(array $authenticatedUserPayload): array
    {
        $userId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($userId === '') {
            throw new RuntimeException('Sessão inválida. Faça login novamente.');
        }

        return $this->repository->listThreadsByUserId($userId);
    }

    /**
     * Lista sugestoes da comunidade para votacao publica.
     *
     * @since 1.0.0
     */
    public function listPublicSuggestions(?array $authenticatedUserPayload, int $limit = 80): array
    {
        $userId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        return $this->repository->listPublicSuggestions($userId, $limit);
    }

    /**
     * Registra like/dislike do usuario em uma sugestao publica.
     *
     * @since 1.0.0
     */
    public function votePublicSuggestion(array $payload, array $authenticatedUserPayload): array
    {
        $userId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($userId === '') {
            throw new RuntimeException('Sessão inválida. Faça login novamente.');
        }

        $feedbackId = (int) ($payload['feedback_id'] ?? $payload['feedbackId'] ?? $payload['id'] ?? 0);
        if ($feedbackId <= 0) {
            throw new InvalidArgumentException('Sugestão inválida.');
        }

        $voteValue = strtolower(trim((string) ($payload['value'] ?? $payload['vote'] ?? '')));
        if ($voteValue === '' || $voteValue === 'null' || $voteValue === 'none') {
            $voteValue = null;
        }

        if ($voteValue !== null && !in_array($voteValue, ['like', 'dislike'], true)) {
            throw new InvalidArgumentException('Voto inválido.');
        }

        $result = $this->repository->votePublicSuggestion($feedbackId, $userId, $voteValue);

        try {
            applyFeedbackVoteGamification($this->repository->getConnection(), $userId, (string) $feedbackId, $voteValue);
        } catch (Throwable $e) {
            error_log('[FeedbackService] Falha ao aplicar gamificacao de voto em sugestao: ' . $e->getMessage());
        }

        return $result;
    }

    /**
     * Lista as respostas de uma thread visivel ao usuario autenticado.
     *
     * @since 1.0.0
     */
    public function listReplies(int $threadId, array $authenticatedUserPayload): array
    {
        $this->validator->validateThreadId($threadId);

        $userId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $role = trim((string) ($authenticatedUserPayload['role'] ?? 'student'));
        if ($userId === '') {
            throw new RuntimeException('Sessão inválida. Faça login novamente.');
        }

        $thread = $this->repository->findRootThreadById($threadId);
        if (!$thread) {
            throw new OutOfBoundsException('Conversa de suporte não encontrada.');
        }

        $isOwner = (string) ($thread['root_user_id'] ?? '') === $userId;
        $isAdmin = $role === 'admin';
        if (!$isOwner && !$isAdmin) {
            throw new DomainException('Você não tem acesso a esta conversa de suporte.');
        }

        return $this->repository->listRepliesByParentId((int) $thread['root_id']);
    }

    /**
     * Cria uma nova thread ou adiciona uma resposta em thread existente.
     *
     * @since 1.0.0
     */
    public function createEntry(array $payload, array $authenticatedUserPayload): array
    {
        $normalized = $this->validator->validateCreatePayload($payload);

        $userId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $role = trim((string) ($authenticatedUserPayload['role'] ?? 'student'));
        if ($userId === '') {
            throw new RuntimeException('Sessão inválida. Faça login novamente.');
        }

        $isAdmin = $role === 'admin';
        $parentId = $normalized['parentId'];

        if ($parentId !== null) {
            $thread = $this->repository->findRootThreadById($parentId);
            if (!$thread) {
                throw new OutOfBoundsException('Conversa de suporte não encontrada.');
            }

            $isOwner = (string) ($thread['root_user_id'] ?? '') === $userId;
            if (!$isOwner && !$isAdmin) {
                throw new DomainException('Você não pode responder esta conversa de suporte.');
            }

            if ((string) ($thread['root_status'] ?? '') === 'resolved') {
                throw new DomainException('Esta conversa já foi resolvida. Abra uma nova solicitação se precisar continuar.');
            }

            $reason = $normalized['reason'] !== ''
                ? $normalized['reason']
                : ($isAdmin ? 'Resposta do suporte' : 'Resposta do usuario');

            $feedbackId = $this->repository->createFeedback([
                'user_id' => $userId,
                'parent_id' => (int) $thread['root_id'],
                'type' => (string) ($thread['root_type'] ?? $normalized['type']),
                'reason' => $reason,
                'details' => $normalized['details'],
                'status' => 'new',
                'public_rating' => null,
                'public_display_name' => null,
                'public_headline' => null,
                'public_photo_url' => null,
            ]);

            $this->repository->updateThreadStatus((int) $thread['root_id'], $isAdmin ? 'read' : 'new');
            if (!$isAdmin) {
                $this->repository->notifyAdmins(
                    'Nova resposta em atendimento',
                    'Um usuario respondeu uma conversa de suporte.',
                    'warning',
                    'report',
                    '/admin/support/feedback'
                );

                try {
                    applyFeedbackReplyGamification(
                        $this->repository->getConnection(),
                        $userId,
                        (string) $feedbackId,
                        (string) $thread['root_id']
                    );
                } catch (Throwable $e) {
                    error_log('[FeedbackService] Falha ao aplicar gamificacao de resposta no suporte: ' . $e->getMessage());
                }
            }

            return [
                'id' => $feedbackId,
                'parent_id' => (int) $thread['root_id'],
                'type' => (string) ($thread['root_type'] ?? $normalized['type']),
            ];
        }

        $legalTeacherCommentRequestMarker = $this->extractLegalTeacherCommentRequestMarker(
            $normalized['reason'],
            $normalized['details']
        );
        if ($legalTeacherCommentRequestMarker !== '') {
            $duplicate = $this->repository->findOpenDuplicateRootByUserReasonAndDetailsMarker(
                $userId,
                $normalized['reason'],
                $legalTeacherCommentRequestMarker
            );

            if ($duplicate) {
                return [
                    'id' => (int) ($duplicate['id'] ?? 0),
                    'parent_id' => null,
                    'type' => (string) ($duplicate['type'] ?? $normalized['type']),
                    'duplicate' => true,
                ];
            }
        }

        $platformVersion = $normalized['type'] === 'suggestion'
            ? $this->repository->resolveCurrentPlatformVersion()
            : null;

        $feedbackId = $this->repository->createFeedback([
            'user_id' => $userId,
            'parent_id' => null,
            'type' => $normalized['type'],
            'reason' => $normalized['reason'],
            'details' => $normalized['details'],
            'status' => 'new',
            'platform_version' => $platformVersion,
            'public_rating' => $normalized['publicRating'],
            'public_display_name' => $normalized['publicDisplayName'],
            'public_headline' => $normalized['publicHeadline'],
            'public_photo_url' => $normalized['publicPhotoUrl'],
        ]);

        $this->notifyAdminsAboutNewEntry($feedbackId, $userId, $normalized);

        try {
            applyFeedbackGamification(
                $this->repository->getConnection(),
                $userId,
                (string) $feedbackId,
                $normalized['type'],
                $normalized['reason'],
                $normalized['publicRating']
            );
        } catch (Throwable $e) {
            error_log('[FeedbackService] Falha ao aplicar gamificacao de feedback: ' . $e->getMessage());
        }

        return [
            'id' => $feedbackId,
            'parent_id' => null,
            'type' => $normalized['type'],
            'platform_version' => $platformVersion,
        ];
    }

    private function extractLegalTeacherCommentRequestMarker(string $reason, string $details): string
    {
        $normalizedReason = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', trim($reason));
        $normalizedReason = strtolower((string) $normalizedReason);

        if (!str_contains($normalizedReason, 'solicitar')) {
            return '';
        }

        if (preg_match('/Codigo do pedido:\s*([^\r\n]+)/i', $details, $matches) !== 1) {
            return '';
        }

        return trim((string) ($matches[1] ?? ''));
    }

    private function notifyAdminsAboutNewEntry(int $feedbackId, string $userId, array $normalized): void
    {
        $isPlatformRating = (string) ($normalized['type'] ?? '') === 'platform-rating'
            || (int) ($normalized['publicRating'] ?? 0) > 0
            || preg_match('/^Avaliar plataforma\b/i', (string) ($normalized['reason'] ?? '')) === 1;

        if (!$isPlatformRating) {
            $type = strtolower(trim((string) ($normalized['type'] ?? 'support')));
            $reason = trim((string) ($normalized['reason'] ?? ''));
            $normalizedReason = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $reason);
            $normalizedReason = strtolower((string) $normalizedReason);

            $isEditorialRequest = str_contains($normalizedReason, 'solicitar comentario')
                || str_contains($normalizedReason, 'solicitar analise')
                || str_contains((string) ($normalized['details'] ?? ''), 'Codigo do pedido: teacher_request')
                || str_contains((string) ($normalized['details'] ?? ''), 'Codigo do pedido: analysis_request');

            $title = 'Novo atendimento aguardando resposta';
            $message = 'Um usuário abriu uma conversa de suporte.';
            $category = 'support';
            $link = '/admin/support/threads';

            if ($type === 'bug') {
                $title = 'Novo bug reportado';
                $message = 'Um usuário informou um possível bug da plataforma.';
                $category = 'feedback';
                $link = '/admin/support/feedback?type=bug';
            } elseif ($type === 'suggestion') {
                $title = 'Nova sugestão recebida';
                $message = 'Um usuário enviou uma sugestão para a plataforma.';
                $category = 'feedback';
                $link = '/admin/support/feedback?type=suggestion';
            } elseif ($type === 'report') {
                $title = 'Nova denúncia enviada pelo suporte';
                $message = 'Um usuário sinalizou um conteúdo para moderação.';
                $category = 'report';
                $link = '/admin/support/reports';
            } elseif ($isEditorialRequest) {
                $title = str_contains($normalizedReason, 'analise')
                    ? 'Solicitação de análise detalhada'
                    : 'Solicitação de comentário do professor';
                $message = 'Um aluno solicitou produção editorial na Lei Comentada.';
                $category = 'support';
                $link = '/admin/support/threads';
            }

            $this->repository->notifyAdmins(
                $title,
                $message,
                'warning',
                $category,
                $link
            );
            return;
        }

        $rating = max(1, min(5, (int) ($normalized['publicRating'] ?? 0)));
        $details = trim((string) ($normalized['details'] ?? ''));

        $this->repository->notifyAdmins(
            'Nova avaliação da plataforma',
            'Um aluno avaliou a plataforma com ' . $rating . '/5 estrelas.',
            'info',
            'feedback',
            '/admin/support/feedback?type=platform-rating'
        );

        $this->notifyAdminAboutPlatformRatingByEmail($feedbackId, $userId, $rating, $details, $normalized);
    }

    private function notifyAdminAboutPlatformRatingByEmail(int $feedbackId, string $userId, int $rating, string $details, array $normalized): void
    {
        try {
            $admin = $this->repository->findFirstAdmin();
            if (!$admin) {
                return;
            }

            $adminUrl = buildAppHashRoute('/admin', ['tab' => 'support', 'section' => 'feedback']);
            $displayName = trim((string) ($normalized['publicDisplayName'] ?? 'Aluno'));
            $headline = trim((string) ($normalized['publicHeadline'] ?? ''));

            $content = 'Olá ' . htmlspecialchars((string) ($admin['name'] ?? 'admin'), ENT_QUOTES, 'UTF-8') . ',<br><br>'
                . 'Uma nova avaliação da plataforma foi enviada.<br><br>'
                . '<b>ID:</b> ' . $feedbackId . '<br>'
                . '<b>Usuário:</b> ' . htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8') . '<br>'
                . '<b>Nota:</b> ' . $rating . '/5 estrelas<br>'
                . ($headline !== '' ? '<b>Contexto:</b> ' . htmlspecialchars($headline, ENT_QUOTES, 'UTF-8') . '<br>' : '')
                . '<b>Depoimento:</b><br>' . nl2br(htmlspecialchars($details, ENT_QUOTES, 'UTF-8')) . '<br><br>'
                . 'Acesse o painel para aprovar ou remover a exibição na home.';

            $bodyHtml = Mailer::htmlTemplate('Nova avaliação da plataforma', $content, $adminUrl, 'Abrir avaliações');
            $template = resolveSystemEmailTemplate(
                'platform_rating_admin',
                [
                    'subject' => 'Nova avaliação da plataforma',
                    'htmlBody' => $bodyHtml,
                    'textBody' => "Olá {$admin['name']},\n\nUma nova avaliação da plataforma foi enviada.\nID: {$feedbackId}\nUsuário: {$displayName}\nNota: {$rating}/5\n{$details}\n\nAbrir avaliações: {$adminUrl}",
                ],
                [
                    'name' => (string) ($admin['name'] ?? ''),
                    'email' => (string) ($admin['email'] ?? ''),
                    'feedback_id' => (string) $feedbackId,
                    'rating' => (string) $rating,
                    'student_name' => $displayName,
                    'student_id' => $userId,
                    'headline' => $headline,
                    'details' => $details,
                    'admin_url' => $adminUrl,
                    'app_url' => rtrim((string) (getenv('APP_URL') ?: 'http://localhost:3000'), '/'),
                    'content' => Mailer::htmlToText($content),
                ],
                $this->repository->getConnection()
            );

            if ($template['enabled']) {
                CommunicationService::queueEmail($this->repository->getConnection(), [
                    'eventType' => 'support.platform_rating.created',
                    'idempotencyKey' => 'platform-rating:' . $feedbackId . ':admin:' . (string) $admin['id'],
                    'recipientUserId' => (string) $admin['id'],
                    'recipientEmail' => (string) $admin['email'],
                    'recipientName' => (string) $admin['name'],
                    'subject' => $template['subject'],
                    'html' => $template['htmlBody'],
                    'text' => $template['textBody'],
                    'templateKey' => 'platform_rating_admin',
                    'category' => 'support',
                    'entityType' => 'feedback',
                    'entityId' => (string) $feedbackId,
                ]);
            }
        } catch (Throwable $e) {
            error_log('[FeedbackService] Falha ao notificar admin sobre avaliação: ' . $e->getMessage());
        }
    }

    /**
     * Retorna depoimentos aprovados para a home publica.
     *
     * @since 1.0.0
     */
    public function listPublishedTestimonials(int $limit = 9): array
    {
        return $this->repository->listPublishedTestimonials($limit);
    }
}
