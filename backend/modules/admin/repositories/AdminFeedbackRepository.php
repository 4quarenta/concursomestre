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

        $tableStmt = $this->db->query("SHOW TABLES LIKE 'user_feedback'");
        if (!$tableStmt || $tableStmt->fetchColumn() === false) {
            $this->createFeedbackBaseTable();
        }

        $this->db->exec("ALTER TABLE user_feedback MODIFY COLUMN type ENUM('cancellation', 'support', 'report', 'suggestion', 'platform-rating', 'bug', 'other') DEFAULT 'support'");
        $this->addColumnIfMissing('parent_id', 'ALTER TABLE user_feedback ADD COLUMN parent_id INT NULL AFTER user_id');
        $this->addColumnIfMissing('public_rating', 'ALTER TABLE user_feedback ADD COLUMN public_rating TINYINT NULL AFTER status');
        $this->addColumnIfMissing('public_display_name', 'ALTER TABLE user_feedback ADD COLUMN public_display_name VARCHAR(120) NULL AFTER public_rating');
        $this->addColumnIfMissing('public_headline', 'ALTER TABLE user_feedback ADD COLUMN public_headline VARCHAR(180) NULL AFTER public_display_name');
        $this->addColumnIfMissing('public_photo_url', 'ALTER TABLE user_feedback ADD COLUMN public_photo_url VARCHAR(500) NULL AFTER public_headline');
        $this->addColumnIfMissing('home_published_at', 'ALTER TABLE user_feedback ADD COLUMN home_published_at DATETIME NULL AFTER public_photo_url');
        $this->db->exec(
            "UPDATE user_feedback
             SET type = 'platform-rating'
             WHERE parent_id IS NULL
               AND type = 'suggestion'
               AND (reason LIKE 'Avaliar plataforma%' OR public_rating BETWEEN 1 AND 5)"
        );

        try {
            $this->db->exec('CREATE INDEX idx_feedback_home_testimonials ON user_feedback (status, home_published_at, created_at)');
        } catch (Throwable $e) {
            // Index already exists or the database does not support this exact shape.
        }

        $ensured = true;
    }

    /**
     * Cria a tabela de feedback quando uma instalacao nova ainda nao aplicou a migration legada.
     *
     * @since 1.0.0
     */
    private function createFeedbackBaseTable(): void
    {
        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS user_feedback (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                parent_id INT NULL,
                type ENUM('cancellation', 'support', 'report', 'suggestion', 'platform-rating', 'bug', 'other') DEFAULT 'support',
                reason VARCHAR(255) NOT NULL,
                details TEXT,
                status ENUM('new', 'read', 'resolved') DEFAULT 'new',
                public_rating TINYINT NULL,
                public_display_name VARCHAR(120) NULL,
                public_headline VARCHAR(180) NULL,
                public_photo_url VARCHAR(500) NULL,
                home_published_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_parent_id (parent_id),
                INDEX idx_status (status),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
    }

    /**
     * Adiciona colunas opcionais em bases antigas.
     *
     * @since 1.0.0
     */
    private function addColumnIfMissing(string $column, string $sql): void
    {
        $stmt = $this->db->prepare('SHOW COLUMNS FROM user_feedback LIKE :column');
        $stmt->execute([':column' => $column]);

        if ($stmt->fetchColumn() === false) {
            $this->db->exec($sql);
        }
    }
}
