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
 * Repository do dominio de feedback publico.
 * Concentra SQL da central de suporte em um unico lugar.
 *
 * @since 1.0.0
 */
class FeedbackRepository
{
    /**
     * Inicializa o repository com a conexao do banco.
     *
     * @since 1.0.0
     */
    public function __construct(private readonly PDO $db)
    {
    }

    public function getConnection(): PDO
    {
        return $this->db;
    }

    /**
     * Resolve a versao editorial vigente sem aceitar valor informado pelo cliente.
     */
    public function resolveCurrentPlatformVersion(): string
    {
        $stmt = $this->db->prepare(
            "SELECT value_json FROM system_settings WHERE key_name = 'platformVersion' LIMIT 1"
        );
        $stmt->execute();
        $rawValue = $stmt->fetchColumn();
        if (!is_string($rawValue) || trim($rawValue) === '') {
            return '1.0.0';
        }

        $decoded = json_decode($rawValue, true);
        $candidate = is_string($decoded)
            ? $decoded
            : (is_array($decoded) ? (string) ($decoded['platformVersion'] ?? $decoded['value'] ?? '') : '');
        $candidate = trim($candidate);

        return $candidate !== '' ? mb_substr($candidate, 0, 40) : '1.0.0';
    }

    public function findFirstAdmin(): ?array
    {
        $stmt = $this->db->prepare("
            SELECT id, name, email
            FROM users
            WHERE role = 'admin'
              AND email IS NOT NULL
              AND email <> ''
              AND COALESCE(status, 'active') NOT IN ('deleted', 'pending_deletion', 'banned', 'suspended')
            ORDER BY id ASC
            LIMIT 1
        ");
        $stmt->execute();

        $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        return $admin ?: null;
    }

    /**
     * Lista as threads raiz do usuario com contagem de respostas.
     *
     * @since 1.0.0
     */
    public function listThreadsByUserId(string $userId): array
    {
        $this->ensureFeedbackSchema();

        $stmt = $this->db->prepare(
            "SELECT
                f.*,
                (SELECT COUNT(*) FROM user_feedback r WHERE r.parent_id = f.id) AS reply_count
             FROM user_feedback f
             WHERE f.user_id = :user_id
               AND f.parent_id IS NULL
             ORDER BY f.created_at DESC"
        );
        $stmt->execute([':user_id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Busca a thread raiz com dados do usuario dono.
     *
     * @since 1.0.0
     */
    public function findRootThreadById(int $threadId): ?array
    {
        $this->ensureFeedbackSchema();

        $stmt = $this->db->prepare(
            "SELECT
                target.id AS target_id,
                root.id AS root_id,
                root.user_id AS root_user_id,
                root.type AS root_type,
                root.reason AS root_reason,
                root.status AS root_status,
                u.name AS root_user_name,
                u.email AS root_user_email
             FROM user_feedback target
             INNER JOIN user_feedback root ON root.id = COALESCE(target.parent_id, target.id)
             LEFT JOIN users u ON u.id = root.user_id
             WHERE target.id = :id
             LIMIT 1"
        );
        $stmt->execute([':id' => $threadId]);

        $thread = $stmt->fetch(PDO::FETCH_ASSOC);
        return $thread ?: null;
    }

    /**
     * Lista respostas de uma thread com nome e papel do autor.
     *
     * @since 1.0.0
     */
    public function listRepliesByParentId(int $parentId): array
    {
        $this->ensureFeedbackSchema();

        $stmt = $this->db->prepare(
            "SELECT
                r.*,
                u.name AS user_name,
                u.role AS user_role
             FROM user_feedback r
             JOIN users u ON u.id = r.user_id
             WHERE r.parent_id = :parent_id
             ORDER BY r.created_at ASC"
        );
        $stmt->execute([':parent_id' => $parentId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findOpenDuplicateRootByUserReasonAndDetailsMarker(string $userId, string $reason, string $detailsMarker): ?array
    {
        $this->ensureFeedbackSchema();

        $stmt = $this->db->prepare(
            "SELECT root.id, root.type, root.reason, root.status
             FROM user_feedback root
             WHERE root.user_id = :user_id
               AND root.parent_id IS NULL
               AND root.reason = :reason
               AND root.details LIKE :details_marker
               AND root.status IN ('new', 'read')
               AND NOT EXISTS (
                    SELECT 1
                    FROM user_feedback reply
                    LEFT JOIN users reply_user ON reply_user.id = reply.user_id
                    WHERE reply.parent_id = root.id
                      AND COALESCE(reply_user.role, 'student') IN ('admin', 'staff')
               )
             ORDER BY root.created_at DESC
             LIMIT 1"
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':reason' => $reason,
            ':details_marker' => '%' . $detailsMarker . '%',
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /**
     * Cria uma nova entrada de feedback.
     *
     * @since 1.0.0
     */
    public function createFeedback(array $payload): int
    {
        $this->ensureFeedbackSchema();

        $stmt = $this->db->prepare(
            'INSERT INTO user_feedback (
                user_id,
                parent_id,
                type,
                reason,
                details,
                status,
                platform_version,
                public_rating,
                public_display_name,
                public_headline,
                public_photo_url,
                created_at
             ) VALUES (
                :user_id,
                :parent_id,
                :type,
                :reason,
                :details,
                :status,
                :platform_version,
                :public_rating,
                :public_display_name,
                :public_headline,
                :public_photo_url,
                NOW()
             )'
        );
        $stmt->execute([
            ':user_id' => $payload['user_id'],
            ':parent_id' => $payload['parent_id'],
            ':type' => $payload['type'],
            ':reason' => $payload['reason'],
            ':details' => $payload['details'],
            ':status' => $payload['status'],
            ':platform_version' => $payload['platform_version'] ?? null,
            ':public_rating' => $payload['public_rating'] ?? null,
            ':public_display_name' => $payload['public_display_name'] ?? null,
            ':public_headline' => $payload['public_headline'] ?? null,
            ':public_photo_url' => $payload['public_photo_url'] ?? null,
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Lista depoimentos aprovados para a home publica.
     *
     * @since 1.0.0
     */
    public function listPublishedTestimonials(int $limit = 9): array
    {
        $this->ensureFeedbackSchema();

        $stmt = $this->db->prepare(
            "SELECT
                f.id,
                f.details,
                f.public_rating,
                f.public_display_name,
                f.public_headline,
                f.public_photo_url,
                f.home_published_at,
                f.created_at,
                u.photo_url AS user_photo_url
             FROM user_feedback f
             LEFT JOIN users u ON u.id = f.user_id
             WHERE f.parent_id IS NULL
               AND f.status = 'resolved'
               AND f.home_published_at IS NOT NULL
               AND f.reason LIKE 'Avaliar plataforma%'
               AND f.public_rating BETWEEN 1 AND 5
               AND TRIM(COALESCE(f.public_display_name, '')) <> ''
               AND TRIM(COALESCE(f.public_headline, '')) <> ''
               AND CHAR_LENGTH(TRIM(COALESCE(f.details, ''))) >= 20
             ORDER BY f.home_published_at DESC, f.created_at DESC
             LIMIT :limit"
        );
        $stmt->bindValue(':limit', max(1, min(18, $limit)), PDO::PARAM_INT);
        $stmt->execute();

        return array_map([$this, 'mapPublishedTestimonial'], $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    /**
     * Lista sugestoes publicas com votos agregados e voto do usuario atual.
     *
     * @since 1.0.0
     */
    public function listPublicSuggestions(string $viewerUserId, int $limit = 80): array
    {
        $this->ensureFeedbackSchema();

        $stmt = $this->db->prepare(
            "SELECT
                f.id,
                f.type,
                f.reason,
                f.details,
                f.status,
                COALESCE(f.suggestion_status, 'pending') AS suggestion_status,
                f.platform_version,
                f.created_at,
                COALESCE(votes.likes, 0) AS likes,
                COALESCE(votes.dislikes, 0) AS dislikes,
                (COALESCE(votes.likes, 0) - COALESCE(votes.dislikes, 0)) AS score,
                viewer.vote_value AS user_vote
             FROM user_feedback f
             LEFT JOIN (
                SELECT
                    feedback_id,
                    SUM(CASE WHEN vote_value = 'like' THEN 1 ELSE 0 END) AS likes,
                    SUM(CASE WHEN vote_value = 'dislike' THEN 1 ELSE 0 END) AS dislikes
                FROM user_feedback_votes
                GROUP BY feedback_id
             ) votes ON votes.feedback_id = f.id
             LEFT JOIN user_feedback_votes viewer
                ON viewer.feedback_id = f.id
               AND viewer.user_id = :viewer_user_id
             WHERE f.parent_id IS NULL
               AND f.type = 'suggestion'
               AND f.public_rating IS NULL
               AND f.reason NOT LIKE 'Avaliar plataforma%'
               AND COALESCE(f.suggestion_status, 'pending') IN ('pending', 'under_review', 'approved', 'planned', 'in_progress', 'completed')
             ORDER BY score DESC, f.created_at DESC
             LIMIT :limit"
        );
        $stmt->bindValue(':viewer_user_id', $viewerUserId);
        $stmt->bindValue(':limit', max(1, min(200, $limit)), PDO::PARAM_INT);
        $stmt->execute();

        return array_map([$this, 'mapPublicSuggestion'], $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    /**
     * Busca uma sugestao publica especifica com o voto do usuario.
     *
     * @since 1.0.0
     */
    public function findPublicSuggestionById(int $feedbackId, string $viewerUserId): ?array
    {
        $this->ensureFeedbackSchema();

        $stmt = $this->db->prepare(
            "SELECT
                f.id,
                f.type,
                f.reason,
                f.details,
                f.status,
                COALESCE(f.suggestion_status, 'pending') AS suggestion_status,
                f.platform_version,
                f.created_at,
                COALESCE(votes.likes, 0) AS likes,
                COALESCE(votes.dislikes, 0) AS dislikes,
                (COALESCE(votes.likes, 0) - COALESCE(votes.dislikes, 0)) AS score,
                viewer.vote_value AS user_vote
             FROM user_feedback f
             LEFT JOIN (
                SELECT
                    feedback_id,
                    SUM(CASE WHEN vote_value = 'like' THEN 1 ELSE 0 END) AS likes,
                    SUM(CASE WHEN vote_value = 'dislike' THEN 1 ELSE 0 END) AS dislikes
                FROM user_feedback_votes
                GROUP BY feedback_id
             ) votes ON votes.feedback_id = f.id
             LEFT JOIN user_feedback_votes viewer
                ON viewer.feedback_id = f.id
               AND viewer.user_id = :viewer_user_id
             WHERE f.parent_id IS NULL
               AND f.type = 'suggestion'
               AND f.public_rating IS NULL
               AND f.reason NOT LIKE 'Avaliar plataforma%'
               AND COALESCE(f.suggestion_status, 'pending') IN ('pending', 'under_review', 'approved', 'planned', 'in_progress', 'completed')
               AND f.id = :id
             LIMIT 1"
        );
        $stmt->bindValue(':viewer_user_id', $viewerUserId);
        $stmt->bindValue(':id', $feedbackId, PDO::PARAM_INT);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $this->mapPublicSuggestion($row) : null;
    }

    /**
     * Registra ou remove o voto de uma sugestao publica.
     *
     * @since 1.0.0
     */
    public function votePublicSuggestion(int $feedbackId, string $userId, ?string $voteValue): array
    {
        $this->ensureFeedbackSchema();

        $suggestion = $this->findPublicSuggestionById($feedbackId, $userId);
        if (!$suggestion) {
            throw new OutOfBoundsException('Sugestão não encontrada.');
        }

        if ($voteValue === null) {
            $deleteStmt = $this->db->prepare(
                'DELETE FROM user_feedback_votes WHERE feedback_id = :feedback_id AND user_id = :user_id'
            );
            $deleteStmt->execute([
                ':feedback_id' => $feedbackId,
                ':user_id' => $userId,
            ]);
        } else {
            $upsertStmt = $this->db->prepare(
                "INSERT INTO user_feedback_votes (
                    feedback_id,
                    user_id,
                    vote_value
                ) VALUES (
                    :feedback_id,
                    :user_id,
                    :vote_value
                )
                ON DUPLICATE KEY UPDATE
                    vote_value = VALUES(vote_value),
                    updated_at = CURRENT_TIMESTAMP"
            );
            $upsertStmt->execute([
                ':feedback_id' => $feedbackId,
                ':user_id' => $userId,
                ':vote_value' => $voteValue,
            ]);
        }

        return $this->findPublicSuggestionById($feedbackId, $userId) ?: $suggestion;
    }

    /**
     * Atualiza o status da thread raiz.
     *
     * @since 1.0.0
     */
    public function updateThreadStatus(int $threadId, string $status): void
    {
        $this->ensureFeedbackSchema();

        $stmt = $this->db->prepare('UPDATE user_feedback SET status = :status WHERE id = :id');
        $stmt->execute([
            ':status' => $status,
            ':id' => $threadId,
        ]);
    }

    /**
     * Notifica administradores sobre entradas novas no suporte.
     *
     * @since 1.0.0
     */
    public function notifyAdmins(string $title, string $message, string $type, string $category, string $link): int
    {
        require_once __DIR__ . '/../../../config/notification_helper.php';

        return createAdminNotification($this->db, $title, $message, $type, $category, $link);
    }

    /**
     * Mapeia a linha aprovada sem expor dados privados do usuario.
     *
     * @since 1.0.0
     */
    private function mapPublishedTestimonial(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'name' => trim((string) ($row['public_display_name'] ?? '')),
            'role' => trim((string) ($row['public_headline'] ?? '')),
            'text' => trim((string) ($row['details'] ?? '')),
            'rating' => max(1, min(5, (int) ($row['public_rating'] ?? 5))),
            'photoUrl' => trim((string) (($row['public_photo_url'] ?? '') ?: ($row['user_photo_url'] ?? ''))),
            'publishedAt' => $row['home_published_at'] ?? $row['created_at'] ?? null,
            'verified' => true,
        ];
    }

    /**
     * Mapeia uma sugestao para o mural publico.
     *
     * @since 1.0.0
     */
    private function mapPublicSuggestion(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'type' => (string) ($row['type'] ?? 'suggestion'),
            'reason' => trim((string) ($row['reason'] ?? '')),
            'details' => trim((string) ($row['details'] ?? '')),
            'status' => (string) ($row['status'] ?? 'new'),
            'product_status' => (string) ($row['suggestion_status'] ?? 'approved'),
            'platform_version' => trim((string) ($row['platform_version'] ?? '')),
            'created_at' => $row['created_at'] ?? null,
            'user_name' => 'Comunidade',
            'likes' => (int) ($row['likes'] ?? 0),
            'dislikes' => (int) ($row['dislikes'] ?? 0),
            'score' => (int) ($row['score'] ?? 0),
            'user_vote' => in_array((string) ($row['user_vote'] ?? ''), ['like', 'dislike'], true)
                ? (string) ($row['user_vote'] ?? '')
                : null,
        ];
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
        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS user_feedback_votes (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                feedback_id INT NOT NULL,
                user_id VARCHAR(64) NOT NULL,
                vote_value ENUM('like', 'dislike') NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uniq_user_feedback_vote (feedback_id, user_id),
                INDEX idx_user_feedback_votes_feedback (feedback_id),
                INDEX idx_user_feedback_votes_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
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
                platform_version VARCHAR(40) NULL,
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
