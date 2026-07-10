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

require_once __DIR__ . '/../../../config/payment_provider.php';

/**
 * Service oficial do dominio de comentarios.
 * Orquestra listagem, criacao, curtida, exclusao e notificacoes correlatas.
 *
 * @since 1.0.0
 */
class CommentsService
{
    private const COMMENT_MODERATION_STATUS_APPROVED = 'approved';
    private const COMMENT_MODERATION_STATUS_PENDING = 'pending';
    private const COMMENT_MODERATION_STATUS_SPAM = 'spam';

    /**
     * Inicializa o service de comentarios com dependencias principais.
     *
     * @since 1.0.0
     */
    public function __construct(
        private readonly CommentsRepository $repository,
        private readonly CommentsValidator $validator,
        private readonly PDO $db
    ) {
    }

    /**
     * Lista comentarios do alvo solicitado com nesting compativel ao frontend.
     *
     * @since 1.0.0
     */
    public function listComments(array $query, ?array $authenticatedUserPayload): array
    {
        $filters = $this->validator->validateListQuery($query);
        $viewerUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($viewerUserId === '') {
            $viewerUserId = (string) ($filters['fallbackUserId'] ?? '');
        }

        $rows = $this->repository->listByTargetId($filters['targetId'], $viewerUserId !== '' ? $viewerUserId : null);
        $lookup = [];

        foreach ($rows as $row) {
            $comment = $this->mapCommentRow($row);
            $lookup[$comment['id']] = $comment;
        }

        $roots = [];
        foreach (array_keys($lookup) as $commentId) {
            $parentId = $lookup[$commentId]['parentId'];

            if ($parentId && isset($lookup[$parentId])) {
                $lookup[$parentId]['replies'][] = &$lookup[$commentId];
                continue;
            }

            $roots[] = &$lookup[$commentId];
        }

        return $roots;
    }

    /**
     * Cria um novo comentario autenticado e dispara notificacoes relacionadas.
     *
     * @since 1.0.0
     */
    public function addComment(array $payload, array $authenticatedUserPayload): array
    {
        $normalized = $this->validator->validateAddPayload($payload);
        $authorId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($authorId === '') {
            throw new RuntimeException('Sessao invalida. Faca login novamente.');
        }

        $author = $this->repository->findUserById($authorId);
        if (!$author) {
            throw new OutOfBoundsException('Usuario autenticado nao encontrado.');
        }

        $this->enforceCommentQuota($authorId, (string) ($authenticatedUserPayload['role'] ?? ''));

        if ($normalized['parentId'] !== null && str_contains($normalized['targetId'], '-qa')) {
            $realMaterialId = $this->resolveMaterialId($normalized['targetId']);
            $material = $this->repository->findMaterialById($realMaterialId);
            $parentComment = $this->repository->findCommentById($normalized['parentId']);
            $materialOwnerId = (string) ($material['author_id'] ?? '');
            $parentOwnerId = (string) ($parentComment['user_id'] ?? '');

            if ($authorId !== $materialOwnerId && $authorId !== $parentOwnerId) {
                throw new DomainException('Voce nao tem permissao para responder a esta duvida.');
            }
        }

        $commentId = $this->generateCommentId();
        $moderationStatus = $this->resolveModerationStatus($normalized['content']);
        $requiresModeration = $moderationStatus !== self::COMMENT_MODERATION_STATUS_APPROVED;
        $this->repository->insertComment([
            'id' => $commentId,
            'user_id' => $authorId,
            'target_type' => $normalized['targetType'],
            'target_id' => $normalized['targetId'],
            'content' => $normalized['content'],
            'parent_id' => $normalized['parentId'],
            'moderation_status' => $moderationStatus,
        ]);
        $this->repository->applySubmittedCommentGamification(
            $authorId,
            $commentId,
            $normalized['targetType'],
            $normalized['targetId'],
            $normalized['parentId'],
            $requiresModeration
        );

        if (!$requiresModeration) {
            $this->notifyAboutNewComment(
                $author,
                $commentId,
                $normalized['targetType'],
                $normalized['targetId'],
                $normalized['parentId'],
                $this->buildTargetLink($normalized['targetType'], $normalized['targetId'])
            );
            $this->repository->applyApprovedCommentGamification(
                $authorId,
                $commentId,
                $normalized['targetType'],
                $normalized['targetId']
            );
        } else {
            try {
                $authorName = (string) ($author['name'] ?? 'Usuario');
                $this->repository->notifyAdmins(
                    'Comentario aguardando moderacao',
                    $authorName . ' enviou comentario para revisao.',
                    'warning',
                    'moderation',
                    '/admin/support/comments'
                );
            } catch (Throwable $e) {
                // Comentarios nao devem falhar por erro em notificação operacional.
            }
        }

        return [
            'id' => $commentId,
            'moderationStatus' => $moderationStatus,
            'requiresModeration' => $requiresModeration,
            'message' => $requiresModeration
                ? 'Comentario enviado para moderacao.'
                : 'Comentario publicado.',
        ];
    }

    /**
     * Classifica o comentario em aprovacao direta, revisao manual ou spam.
     * A regra evita publicar automaticamente conteudos promocionais/suspeitos.
     *
     * @since 1.0.0
     */
    private function resolveModerationStatus(string $content): string
    {
        $text = trim($content);
        if ($text === '') {
            return self::COMMENT_MODERATION_STATUS_PENDING;
        }

        $normalized = function_exists('mb_strtolower') ? mb_strtolower($text, 'UTF-8') : strtolower($text);
        $links = (int) preg_match_all('/https?:\/\/|www\./iu', $normalized);
        $digits = (int) preg_match_all('/\d/u', $normalized);
        $hasSuspiciousContact = preg_match('/(whats|whatsapp|telegram|t\.me|chama no|me chama|pix|dinheiro facil|ganhe dinheiro)/iu', $normalized) === 1;
        $hasExcessiveRepeat = preg_match('/(.)\1{7,}/u', $normalized) === 1;

        if ($links >= 2 || ($links >= 1 && $hasSuspiciousContact)) {
            return self::COMMENT_MODERATION_STATUS_SPAM;
        }

        if ($hasSuspiciousContact && $digits >= 8) {
            return self::COMMENT_MODERATION_STATUS_SPAM;
        }

        if ($hasExcessiveRepeat) {
            return self::COMMENT_MODERATION_STATUS_PENDING;
        }

        return self::COMMENT_MODERATION_STATUS_APPROVED;
    }

    private function generateCommentId(): string
    {
        try {
            return 'com-' . bin2hex(random_bytes(16));
        } catch (Throwable $e) {
            return substr('com-' . str_replace('.', '', uniqid('', true)), 0, 36);
        }
    }

    /**
     * Alterna a curtida do comentario autenticado.
     *
     * @since 1.0.0
     */
    public function toggleLike(array $payload, array $authenticatedUserPayload): array
    {
        $commentId = $this->validator->validateCommentMutationPayload($payload);
        $userId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($userId === '') {
            throw new RuntimeException('Sessao invalida. Faca login novamente.');
        }

        if (!$this->repository->userExists($userId)) {
            throw new OutOfBoundsException('Usuario autenticado nao encontrado.');
        }

        $comment = $this->repository->findCommentById($commentId);
        if (!$comment) {
            throw new OutOfBoundsException('Comentario nao encontrado.');
        }

        $alreadyLiked = $this->repository->hasLike($userId, $commentId);
        if ($alreadyLiked) {
            $this->repository->removeLike($userId, $commentId);
            return [
                'success' => true,
                'liked' => false,
            ];
        }

        $this->repository->addLike($userId, $commentId);
        $this->notifyAboutLike($userId, $comment);
        $this->repository->applyLikeGamification($userId, $comment);

        return [
            'success' => true,
            'liked' => true,
        ];
    }

    /**
     * Exclui um comentario do proprio autor.
     *
     * @since 1.0.0
     */
    public function deleteComment(array $payload, array $authenticatedUserPayload): array
    {
        $commentId = $this->validator->validateCommentMutationPayload($payload);
        $userId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($userId === '') {
            throw new RuntimeException('Sessao invalida. Faca login novamente.');
        }

        $comment = $this->repository->findCommentById($commentId);
        if (!$comment) {
            throw new OutOfBoundsException('Comentario nao encontrado.');
        }

        if ((string) ($comment['user_id'] ?? '') !== $userId) {
            throw new DomainException('Voce nao tem permissao para deletar este comentario.');
        }

        $this->repository->deleteComment($commentId);

        return [
            'success' => true,
            'message' => 'Comentario deletado com sucesso.',
        ];
    }

    /**
     * Formata uma linha SQL para o contrato esperado no app.
     *
     * @since 1.0.0
     */
    private function mapCommentRow(array $row): array
    {
        $createdAt = strtotime((string) ($row['created_at'] ?? 'now'));
        if ($createdAt === false) {
            $createdAt = time();
        }

        return [
            'id' => (string) ($row['id'] ?? ''),
            'userId' => (string) ($row['user_id'] ?? ''),
            'userName' => (string) ($row['user_name'] ?? 'Usuario Excluido'),
            'userAvatar' => ($row['user_avatar'] ?? null) ?: null,
            'userPlan' => (string) ($row['user_plan'] ?? 'Gratuito'),
            'userRole' => (string) ($row['user_role'] ?? ''),
            'text' => (string) ($row['content'] ?? ''),
            'date' => date('d/m/Y H:i', $createdAt),
            'likes' => (int) ($row['likes_count'] ?? 0),
            'isLiked' => (bool) ($row['is_liked'] ?? false),
            'userHasPendingReport' => (bool) ($row['user_has_pending_report'] ?? false),
            'parentId' => ($row['parent_id'] ?? null) ?: null,
            'replies' => [],
        ];
    }

    /**
     * Monta o deep link padrao do comentario novo.
     *
     * @since 1.0.0
     */
    private function buildTargetLink(string $targetType, string $targetId): string
    {
        if ($targetType === 'material') {
            return '/marketplace?openMaterial=' . $this->resolveMaterialId($targetId);
        }

        return '/practice?questionId=' . $targetId;
    }

    private function enforceCommentQuota(string $userId, string $role): void
    {
        if (in_array($role, ['admin', 'staff'], true)) {
            return;
        }

        enforceUserPlanUsageLimitAvailable($this->db, $userId, 'comments_per_day');
    }

    /**
     * Remove sufixos derivados usados pelo fluxo de QA do marketplace.
     *
     * @since 1.0.0
     */
    private function resolveMaterialId(string $targetId): string
    {
        return str_replace(['-qa', '-reviews'], '', $targetId);
    }

    /**
     * Dispara notificacoes derivadas de respostas e comentarios de material.
     *
     * @since 1.0.0
     */
    private function notifyAboutNewComment(
        array $author,
        string $commentId,
        string $targetType,
        string $targetId,
        ?string $parentId,
        string $targetLink
    ): void {
        $authorId = (string) ($author['id'] ?? '');
        $authorName = (string) ($author['name'] ?? 'Usuario');

        try {
            if ($parentId !== null) {
                $parentComment = $this->repository->findCommentById($parentId);
                if ($parentComment && (string) ($parentComment['user_id'] ?? '') !== $authorId) {
                    $excerpt = $this->truncateForNotification((string) ($parentComment['content'] ?? ''));
                    $this->repository->insertNotification([
                        'id' => 'not-' . uniqid('', true) . '-' . time(),
                        'user_id' => (string) $parentComment['user_id'],
                        'title' => $authorName,
                        'message' => 'respondeu ao seu comentario: "' . $excerpt . '..."',
                        'category' => 'social',
                        'type' => 'info',
                        'link' => $targetLink . '#comment-' . $commentId,
                        'evidence_url' => null,
                        'created_at' => date('Y-m-d H:i:s'),
                    ]);
                }

                return;
            }

            if ($targetType === 'material') {
                $material = $this->repository->findMaterialById($this->resolveMaterialId($targetId));
                if ($material && (string) ($material['author_id'] ?? '') !== $authorId) {
                    $this->repository->insertNotification([
                        'id' => 'not-' . uniqid('', true) . '-' . time(),
                        'user_id' => (string) $material['author_id'],
                        'title' => $authorName,
                        'message' => 'deixou um novo comentario em seu material: "' . (string) ($material['title'] ?? '') . '"',
                        'category' => 'social',
                        'type' => 'info',
                        'link' => $targetLink . '&comment=' . $commentId,
                        'evidence_url' => null,
                        'created_at' => date('Y-m-d H:i:s'),
                    ]);
                }
            }
        } catch (Throwable $e) {
            // Comentarios nao devem falhar por causa de notificacao auxiliar.
        }
    }

    /**
     * Notifica o dono do comentario quando uma curtida nova e registrada.
     *
     * @since 1.0.0
     */
    private function notifyAboutLike(string $likerUserId, array $comment): void
    {
        try {
            $commentOwnerId = (string) ($comment['user_id'] ?? '');
            if ($commentOwnerId === '' || $commentOwnerId === $likerUserId) {
                return;
            }

            $liker = $this->repository->findUserById($likerUserId);
            $likerName = (string) ($liker['name'] ?? 'Alguem');
            $excerpt = $this->truncateForNotification((string) ($comment['content'] ?? ''));
            $targetId = (string) ($comment['target_id'] ?? '');
            $targetType = (string) ($comment['target_type'] ?? 'question');
            $link = $this->buildTargetLink($targetType, $targetId) . '#comment-' . (string) ($comment['id'] ?? '');

            $this->repository->insertNotification([
                'id' => 'not-' . uniqid('', true) . '-' . time(),
                'user_id' => $commentOwnerId,
                'title' => $likerName,
                'message' => 'curtiu seu comentario: "' . $excerpt . '..."',
                'category' => 'social',
                'type' => 'info',
                'link' => $link,
                'evidence_url' => null,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        } catch (Throwable $e) {
            // Curtida nao deve falhar por notificacao auxiliar.
        }
    }

    /**
     * Reduz o texto usado em notificacoes sem depender obrigatoriamente de mbstring.
     *
     * @since 1.0.0
     */
    private function truncateForNotification(string $content, int $limit = 50): string
    {
        $plainContent = trim(strip_tags($content));

        if (function_exists('mb_substr')) {
            return mb_substr($plainContent, 0, $limit);
        }

        return substr($plainContent, 0, $limit);
    }
}
