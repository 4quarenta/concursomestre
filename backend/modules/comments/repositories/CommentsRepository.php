<?php

require_once __DIR__ . '/../../../shared/pagination/SignedKeysetCursor.php';

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
 * Repository oficial do dominio de comentarios.
 * Centraliza o acesso ao banco, incluindo likes e notificacoes derivadas.
 *
 * @since 1.0.0
 */
class CommentsRepository
{
    private bool $schemaEnsured = false;

    /**
     * Inicializa o repository com a conexao do banco.
     *
     * @since 1.0.0
     */
    public function __construct(private readonly PDO $db)
    {
    }

    /**
     * Lista comentarios de um alvo com dados do autor e estado de curtida.
     *
     * @since 1.0.0
     */
    public function listByTargetId(
        string $targetId,
        string $targetType,
        ?string $viewerUserId,
        int $limit = 50,
        ?string $cursor = null
    ): array
    {
        $this->ensureSchema();
        $safeLimit = max(1, min(100, $limit));
        $cursorParts = SignedKeysetCursor::decode($cursor, 'comments.target') ?? [
            'createdAt' => null,
            'id' => '',
        ];

        $query = "SELECT
                    c.id,
                    c.user_id,
                    c.target_type,
                    c.target_id,
                    c.content,
                    c.parent_id,
                    c.created_at,
                    u.name AS user_name,
                    u.plan AS user_plan,
                    u.role AS user_role,
                    u.photo_url AS user_avatar,
                    (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) AS likes_count,
                    CASE
                        WHEN :viewer_user_id = '' THEN 0
                        ELSE EXISTS(
                            SELECT 1
                            FROM comment_likes
                            WHERE comment_id = c.id
                              AND user_id = :viewer_user_id_exists
                        )
                    END AS is_liked,
                    CASE
                        WHEN :viewer_user_id_report = '' THEN 0
                        ELSE EXISTS(
                            SELECT 1
                            FROM reports r
                            WHERE r.reporter_id = :viewer_user_id_report_exists
                              AND r.target_type = 'comment'
                              AND r.target_id = c.id
                              AND r.resolved_at IS NULL
                              AND r.status NOT IN ('resolved', 'rejected', 'dismissed', 'closed')
                        )
                    END AS user_has_pending_report
                  FROM comments c
                  LEFT JOIN users u ON u.id = c.user_id
                  WHERE c.target_id = :target_id
                    AND c.target_type = :target_type
                    AND c.moderation_status = 'approved'";

        if ($cursorParts['createdAt'] !== null) {
            $query .= " AND (
                c.created_at < :cursor_created_at
                OR (c.created_at = :cursor_created_at AND c.id < :cursor_id)
            )";
        }

        $query .= ' ORDER BY c.created_at DESC, c.id DESC LIMIT ' . ($safeLimit + 1);

        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':target_id', $targetId);
        $stmt->bindValue(':target_type', $targetType);
        $stmt->bindValue(':viewer_user_id', $viewerUserId ?? '');
        $stmt->bindValue(':viewer_user_id_exists', $viewerUserId ?? '');
        $stmt->bindValue(':viewer_user_id_report', $viewerUserId ?? '');
        $stmt->bindValue(':viewer_user_id_report_exists', $viewerUserId ?? '');
        if ($cursorParts['createdAt'] !== null) {
            $stmt->bindValue(':cursor_created_at', $cursorParts['createdAt']);
            $stmt->bindValue(':cursor_id', $cursorParts['id']);
        }
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Verifica se o usuario existe no banco antes de criar interacoes.
     *
     * @since 1.0.0
     */
    public function userExists(string $userId): bool
    {
        $stmt = $this->db->prepare("SELECT 1 FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$userId]);
        return (bool) $stmt->fetchColumn();
    }

    /**
     * Busca o nome do usuario para resposta imediata e notificacoes.
     *
     * @since 1.0.0
     */
    public function findUserById(string $userId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, name, plan, role, photo_url
             FROM users
             WHERE id = ?
             LIMIT 1"
        );
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($user) ? $user : null;
    }

    /**
     * Confirma se um artigo publico do blog pode receber interacoes.
     *
     * @since 1.0.0
     */
    public function findPublicBlogArticleSlug(string $articleId, bool $requireCommentsEnabled = false): ?string
    {
        $conditions = [
            'id = :id',
            'deleted_at IS NULL',
            "status IN ('published', 'scheduled')",
            'published_at IS NOT NULL',
            'published_at <= NOW()',
        ];
        if ($requireCommentsEnabled) {
            $conditions[] = 'allow_comments = 1';
        }
        $stmt = $this->db->prepare(
            'SELECT slug FROM blog_articles WHERE ' . implode(' AND ', $conditions) . ' LIMIT 1'
        );
        $stmt->execute([':id' => $articleId]);
        $slug = $stmt->fetchColumn();
        return is_string($slug) && trim($slug) !== '' ? trim($slug) : null;
    }

    /**
     * Busca um comentario pelo identificador.
     *
     * @since 1.0.0
     */
    public function findCommentById(string $commentId): ?array
    {
        $this->ensureSchema();

        $stmt = $this->db->prepare(
            "SELECT id, user_id, target_type, target_id, content, parent_id, created_at, moderation_status
             FROM comments
             WHERE id = ?
             LIMIT 1"
        );
        $stmt->execute([$commentId]);
        $comment = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($comment) ? $comment : null;
    }

    /**
     * Busca o autor de um material para regras de QA e notificacoes.
     *
     * @since 1.0.0
     */
    public function findMaterialById(string $materialId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, author_id, title
             FROM materials
             WHERE id = ?
             LIMIT 1"
        );
        $stmt->execute([$materialId]);
        $material = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($material) ? $material : null;
    }

    /**
     * Persiste um comentario novo.
     *
     * @since 1.0.0
     */
    public function insertComment(array $comment): void
    {
        $this->ensureSchema();

        $stmt = $this->db->prepare(
            "INSERT INTO comments (id, user_id, target_type, target_id, content, parent_id, moderation_status)
             VALUES (:id, :user_id, :target_type, :target_id, :content, :parent_id, :moderation_status)"
        );

        $stmt->bindValue(':id', $comment['id']);
        $stmt->bindValue(':user_id', $comment['user_id']);
        $stmt->bindValue(':target_type', $comment['target_type']);
        $stmt->bindValue(':target_id', $comment['target_id']);
        $stmt->bindValue(':content', $comment['content']);
        $stmt->bindValue(':parent_id', $comment['parent_id']);
        $stmt->bindValue(':moderation_status', $comment['moderation_status'] ?? 'pending');
        $stmt->execute();
    }

    private function ensureSchema(): void
    {
        if ($this->schemaEnsured) {
            return;
        }

        if (!$this->tableExists('comments')) {
            $this->schemaEnsured = true;
            return;
        }

        $this->ensureColumnExists(
            'comments',
            'moderation_status',
            "ALTER TABLE comments ADD COLUMN moderation_status VARCHAR(20) NOT NULL DEFAULT 'approved' AFTER parent_id"
        );
        $this->ensureColumnExists(
            'comments',
            'moderated_at',
            "ALTER TABLE comments ADD COLUMN moderated_at DATETIME NULL AFTER moderation_status"
        );
        $this->ensureColumnExists(
            'comments',
            'moderated_by',
            "ALTER TABLE comments ADD COLUMN moderated_by VARCHAR(80) NULL AFTER moderated_at"
        );

        try {
            $this->db->exec("UPDATE comments SET moderation_status = 'approved' WHERE moderation_status IS NULL OR moderation_status = ''");
            $this->db->exec("CREATE INDEX idx_comments_moderation_status ON comments (moderation_status, created_at)");
        } catch (Throwable $e) {
            // Index may already exist in environments that rerun migrations.
        }

        $this->schemaEnsured = true;
    }

    private function tableExists(string $table): bool
    {
        $stmt = $this->db->prepare('SHOW TABLES LIKE :table_name');
        $stmt->execute([':table_name' => $table]);
        return $stmt->fetchColumn() !== false;
    }

    private function ensureColumnExists(string $table, string $column, string $ddl): void
    {
        $stmt = $this->db->prepare("SHOW COLUMNS FROM {$table} LIKE :column_name");
        $stmt->execute([':column_name' => $column]);

        if ($stmt->fetchColumn() !== false) {
            return;
        }

        $this->db->exec($ddl);
    }

    /**
     * Informa se o like ja existe para decidir entre insert e delete.
     *
     * @since 1.0.0
     */
    public function hasLike(string $userId, string $commentId): bool
    {
        $stmt = $this->db->prepare(
            "SELECT 1
             FROM comment_likes
             WHERE user_id = :user_id
               AND comment_id = :comment_id
             LIMIT 1"
        );
        $stmt->bindValue(':user_id', $userId);
        $stmt->bindValue(':comment_id', $commentId);
        $stmt->execute();

        return (bool) $stmt->fetchColumn();
    }

    /**
     * Registra uma curtida nova.
     *
     * @since 1.0.0
     */
    public function addLike(string $userId, string $commentId): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO comment_likes (user_id, comment_id)
             VALUES (:user_id, :comment_id)"
        );
        $stmt->bindValue(':user_id', $userId);
        $stmt->bindValue(':comment_id', $commentId);
        $stmt->execute();
    }

    /**
     * Remove uma curtida existente.
     *
     * @since 1.0.0
     */
    public function removeLike(string $userId, string $commentId): void
    {
        $stmt = $this->db->prepare(
            "DELETE FROM comment_likes
             WHERE user_id = :user_id
               AND comment_id = :comment_id"
        );
        $stmt->bindValue(':user_id', $userId);
        $stmt->bindValue(':comment_id', $commentId);
        $stmt->execute();
    }

    /**
     * Exclui um comentario pelo id.
     *
     * @since 1.0.0
     */
    public function deleteComment(string $commentId): void
    {
        $stmt = $this->db->prepare("DELETE FROM comments WHERE id = ?");
        $stmt->execute([$commentId]);
    }

    /**
     * Persiste notificacoes derivadas do dominio.
     *
     * @since 1.0.0
     */
    public function insertNotification(array $notification): void
    {
        require_once __DIR__ . '/../../../config/notification_helper.php';
        $delivery = resolveNotificationDeliveryRule(
            $this->db,
            (string) ($notification['title'] ?? ''),
            (string) ($notification['message'] ?? ''),
            (string) ($notification['type'] ?? 'info'),
            (string) ($notification['category'] ?? 'system'),
            isset($notification['link']) ? (string) $notification['link'] : null,
            isset($notification['rule_key']) ? (string) $notification['rule_key'] : null
        );
        if (!notificationHelperBoolean($delivery['enabled'] ?? true, true)) {
            return;
        }

        ensureNotificationTableSupportsCurrentContract($this->db);

        $stmt = $this->db->prepare(
            "INSERT INTO notifications (id, user_id, title, message, category, type, link, evidence_url, created_at)
             VALUES (:id, :user_id, :title, :message, :category, :type, :link, :evidence_url, :created_at)"
        );

        $stmt->bindValue(':id', $notification['id']);
        $stmt->bindValue(':user_id', $notification['user_id']);
        $stmt->bindValue(':title', $delivery['title']);
        $stmt->bindValue(':message', $delivery['message']);
        $stmt->bindValue(':category', $delivery['category']);
        $stmt->bindValue(':type', $delivery['type']);
        $stmt->bindValue(':link', $delivery['link']);
        $stmt->bindValue(':evidence_url', $notification['evidence_url']);
        $stmt->bindValue(':created_at', $notification['created_at']);
        $stmt->execute();
    }

    /**
     * Notifica administradores sobre eventos que exigem acao no painel.
     *
     * @since 1.0.0
     */
    public function notifyAdmins(string $title, string $message, string $type, string $category, string $link, ?string $ruleKey = null): int
    {
        require_once __DIR__ . '/../../../config/notification_helper.php';

        return createAdminNotification($this->db, $title, $message, $type, $category, $link, $ruleKey);
    }

    /**
     * Recompensa o autor quando recebe uma curtida real de outro usuario.
     *
     * @since 1.0.0
     */
    public function applyLikeGamification(string $likerUserId, array $comment): void
    {
        require_once __DIR__ . '/../../../config/gamification_helper.php';

        $commentId = trim((string) ($comment['id'] ?? ''));
        $ownerId = trim((string) ($comment['user_id'] ?? ''));
        if ($commentId === '' || $ownerId === '' || $ownerId === $likerUserId) {
            return;
        }

        $reward = grantGamificationEvent(
            $this->db,
            $ownerId,
            'comment_like_received',
            'comment_like:' . $commentId . ':' . $likerUserId,
            2,
            1,
            [
                'key' => 'first_comment_like_received',
                'title' => 'Primeira curtida recebida',
                'description' => 'Um comentario seu recebeu uma curtida de outro aluno.',
            ],
            [
                'comment_id' => $commentId,
                'target_type' => (string) ($comment['target_type'] ?? ''),
                'target_id' => (string) ($comment['target_id'] ?? ''),
            ]
        );

        if (!empty($reward['badge_awarded'])) {
            createNotification(
                $this->db,
                $ownerId,
                'Badge desbloqueado',
                'Primeira curtida recebida: sua contribuicao ajudou outro aluno.',
                'success',
                'system',
                '/profile?tab=achievements'
            );
        }

        if (!empty($reward['applied'])) {
            createNotification(
                $this->db,
                $ownerId,
                'Curtida recebida',
                'Seu comentario recebeu uma curtida. Voce ganhou +2 XP e reputacao.',
                'success',
                'social',
                '/notifications',
                'comment_like_received'
            );
        }
    }

    /**
     * Recompensa a participacao inicial em comentarios, inclusive quando vai para moderacao.
     *
     * @since 1.0.0
     */
    public function applySubmittedCommentGamification(
        string $authorId,
        string $commentId,
        string $targetType,
        string $targetId,
        ?string $parentId,
        bool $requiresModeration
    ): void {
        require_once __DIR__ . '/../../../config/gamification_helper.php';

        $authorId = trim($authorId);
        $commentId = trim($commentId);
        if ($authorId === '' || $commentId === '') {
            return;
        }

        $isReply = $parentId !== null && trim($parentId) !== '';
        $eventName = $isReply ? 'comment_reply_submitted' : 'comment_submitted';
        $reward = grantGamificationEvent(
            $this->db,
            $authorId,
            $eventName,
            $eventName . ':' . $commentId,
            $isReply ? 2 : 3,
            0,
            $isReply ? null : [
                'key' => 'first_comment_submitted',
                'title' => 'Primeiro comentario enviado',
                'description' => 'Voce participou da comunidade com um comentario.',
            ],
            [
                'comment_id' => $commentId,
                'target_type' => $targetType,
                'target_id' => $targetId,
                'parent_id' => $parentId,
                'requires_moderation' => $requiresModeration,
            ]
        );

        if ($requiresModeration && !empty($reward['applied'])) {
            createNotification(
                $this->db,
                $authorId,
                $isReply ? 'Resposta registrada' : 'Comentario enviado',
                $isReply
                    ? 'Sua resposta foi enviada para moderacao. Voce ganhou XP por participar da conversa.'
                    : 'Seu comentario foi enviado para moderacao. Voce ganhou XP pela contribuicao.',
                'success',
                'social',
                '/notifications',
                $isReply ? 'comment_reply' : 'comment_submitted'
            );
        }
    }

    /**
     * Recompensa comentario publicado automaticamente sem passar por spam/moderacao.
     *
     * @since 1.0.0
     */
    public function applyApprovedCommentGamification(string $authorId, string $commentId, string $targetType, string $targetId): void
    {
        require_once __DIR__ . '/../../../config/gamification_helper.php';

        $authorId = trim($authorId);
        $commentId = trim($commentId);
        if ($authorId === '' || $commentId === '') {
            return;
        }

        $reward = grantGamificationEvent(
            $this->db,
            $authorId,
            'comment_auto_approved',
            'comment_auto_approved:' . $commentId,
            5,
            1,
            [
                'key' => 'first_approved_comment',
                'title' => 'Primeiro comentario aprovado',
                'description' => 'Um comentario seu ficou visivel e ajudou a comunidade.',
            ],
            [
                'comment_id' => $commentId,
                'target_type' => $targetType,
                'target_id' => $targetId,
            ]
        );

        if (!empty($reward['badge_awarded'])) {
            createNotification(
                $this->db,
                $authorId,
                'Badge desbloqueado',
                'Primeiro comentario aprovado: sua participacao ja esta visivel.',
                'success',
                'system',
                '/profile?tab=achievements'
            );
        }

        if (!empty($reward['applied'])) {
            createNotification(
                $this->db,
                $authorId,
                'Comentario publicado',
                'Seu comentario ficou visivel. Voce ganhou +5 XP pela contribuicao.',
                'success',
                'social',
                $targetType === 'material'
                    ? '/marketplace?openMaterial=' . rawurlencode(str_replace(['-qa', '-reviews'], '', $targetId)) . '&comment=' . rawurlencode($commentId)
                    : '/practice?questionId=' . rawurlencode($targetId) . '#comment-' . rawurlencode($commentId),
                'comment_published'
            );
        }
    }
}
