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
require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';

/**
 * Repositorio das conversas de feedback administrativo.
 * Centraliza queries do dominio para evitar SQL espalhado na camada HTTP.
 */
class AdminFeedbackRepository
{
    private PDO $db;

    /**
     * Inicializa o repositorio com a conexao PDO.
     *
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Busca uma thread principal de feedback pelo ID.
     *
     * @since 1.0.0
     */
    public function findThreadById(int $threadId): ?array
    {
        $this->ensureFeedbackSchema();

        $stmt = $this->db->prepare(
            "SELECT f.*, u.name AS user_name, u.email AS user_email, u.role AS user_role
             FROM user_feedback f
             LEFT JOIN users u ON f.user_id = u.id
             WHERE f.id = :id
             LIMIT 1"
        );
        $stmt->execute([':id' => $threadId]);

        $thread = $stmt->fetch(PDO::FETCH_ASSOC);

        return $thread ?: null;
    }

    /**
     * Lista respostas de uma thread pelo parent_id.
     *
     * @since 1.0.0
     */
    public function fetchRepliesByParentId(int $parentId): array
    {
        $this->ensureFeedbackSchema();

        $stmt = $this->db->prepare(
            "SELECT f.*, u.name AS user_name, u.email AS user_email, u.role AS user_role
             FROM user_feedback f
             LEFT JOIN users u ON f.user_id = u.id
             WHERE f.parent_id = :parent_id
             ORDER BY f.created_at ASC"
        );
        $stmt->execute([':parent_id' => $parentId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Lista threads principais com filtros de status, tipo e busca.
     *
     * @since 1.0.0
     */
    public function listThreads(array $filters): array
    {
        $this->ensureFeedbackSchema();

        $where = ['f.parent_id IS NULL'];
        $params = [];

        $status = trim((string) ($filters['status'] ?? ''));
        $type = trim((string) ($filters['type'] ?? ''));
        $search = trim((string) ($filters['search'] ?? ''));

        if ($status !== '') {
            $where[] = 'f.status = :status';
            $params[':status'] = $status;
        }

        if ($type === 'platform-rating') {
            $where[] = "(f.type = 'platform-rating' OR f.reason LIKE 'Avaliar plataforma%' OR f.public_rating BETWEEN 1 AND 5)";
        } elseif ($type === 'suggestion') {
            $where[] = "f.type = 'suggestion' AND f.public_rating IS NULL AND f.reason NOT LIKE 'Avaliar plataforma%'";
        } elseif ($type !== '') {
            $where[] = 'f.type = :type';
            $params[':type'] = $type;
        }

        if ($search !== '') {
            $where[] = '(f.reason LIKE :search OR f.details LIKE :search OR u.name LIKE :search OR u.email LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }

        $sql = "
            SELECT
                f.*,
                u.name AS user_name,
                u.email AS user_email,
                u.role AS user_role,
                (SELECT COUNT(*) FROM user_feedback r WHERE r.parent_id = f.id) AS reply_count
            FROM user_feedback f
            LEFT JOIN users u ON f.user_id = u.id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY f.created_at DESC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Atualiza o status de uma thread de feedback.
     *
     * @since 1.0.0
     */
    public function updateStatus(int $feedbackId, string $status): void
    {
        $this->ensureFeedbackSchema();

        $stmt = $this->db->prepare(
            "UPDATE user_feedback
             SET status = :status
             WHERE id = :id"
        );
        $stmt->execute([
            ':status' => $status,
            ':id' => $feedbackId,
        ]);
    }

    public function setHomePublication(int $feedbackId, bool $published): void
    {
        $this->ensureFeedbackSchema();

        $stmt = $this->db->prepare(
            "UPDATE user_feedback
             SET status = CASE WHEN :published_status = 1 THEN 'resolved' ELSE status END,
                 home_published_at = CASE WHEN :published_home = 1 THEN COALESCE(home_published_at, NOW()) ELSE NULL END
             WHERE id = :id
               AND parent_id IS NULL
               AND (type = 'platform-rating' OR reason LIKE 'Avaliar plataforma%' OR public_rating BETWEEN 1 AND 5)"
        );
        $stmt->execute([
            ':published_status' => $published ? 1 : 0,
            ':published_home' => $published ? 1 : 0,
            ':id' => $feedbackId,
        ]);

        if ($stmt->rowCount() === 0) {
            throw new InvalidArgumentException('Avaliação não encontrada ou inválida para publicação.');
        }
    }

    /**
     * Cria uma resposta administrativa vinculada a thread raiz.
     *
     * @since 1.0.0
     */
    public function createReply(string $adminUserId, int $parentId, string $type, string $reason, string $details): int
    {
        $this->ensureFeedbackSchema();

        $stmt = $this->db->prepare(
            'INSERT INTO user_feedback (user_id, parent_id, type, reason, details, status, created_at)
             VALUES (:user_id, :parent_id, :type, :reason, :details, :status, NOW())'
        );
        $stmt->execute([
            ':user_id' => $adminUserId,
            ':parent_id' => $parentId,
            ':type' => $type,
            ':reason' => $reason,
            ':details' => $details,
            ':status' => 'new',
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Notifica o dono da conversa quando o suporte responde no painel.
     *
     * @since 1.0.0
     */
    public function notifyThreadOwnerReply(array $thread, int $parentId): bool
    {
        $userId = trim((string) ($thread['user_id'] ?? ''));
        if ($userId === '') {
            return false;
        }

        require_once __DIR__ . '/../../../config/notification_helper.php';

        return createNotification(
            $this->db,
            $userId,
            'Resposta do suporte',
            'Nossa equipe respondeu sua conversa de suporte.',
            'info',
            'support',
            '/support?threadId=' . $parentId
        );
    }

    /**
     * Mantem o schema de feedback compativel com depoimentos publicos.
     *
     * @since 1.0.0
     */
    private function ensureFeedbackSchema(): void
    {
        static $ensured = false;
        if ($ensured) {
            return;
        }

        SchemaReadiness::assertTablesAndColumns($this->db, 'feedback administrativo', [
            'user_feedback' => ['id', 'user_id', 'parent_id', 'type', 'reason', 'details', 'status', 'public_rating', 'public_display_name', 'public_headline', 'public_photo_url', 'home_published_at', 'created_at', 'updated_at'],
        ]);

        $ensured = true;
    }

}
