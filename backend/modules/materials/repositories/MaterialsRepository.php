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
 * Repositorio do dominio de materiais.
 * Concentra acesso ao banco para listagem, CRUD, moderacao e avaliacao.
 *
 * @since 1.0.0
 */
class MaterialsRepository
{
    private PDO $db;

    /**
     * Injeta o PDO usado pelas consultas do marketplace.
     *
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Verifica se a tabela principal de materiais existe.
     *
     * @since 1.0.0
     */
    public function materialsTableExists(): bool
    {
        $stmt = $this->db->query("SHOW TABLES LIKE 'materials'");
        return $stmt !== false && $stmt->rowCount() > 0;
    }

    /**
     * Lista materiais visiveis considerando escopo do viewer.
     *
     * @since 1.0.0
     */
    public function fetchMaterials(?string $viewerUserId, bool $isAdmin): array
    {
        if (!$this->materialsTableExists()) {
            return [];
        }

        $query = "
            SELECT
                m.id,
                m.title,
                m.description,
                m.author_id AS authorId,
                u.name AS authorName,
                m.price,
                m.type,
                m.subject_id AS subjectId,
                m.subject_text AS subjectText,
                m.topic_id AS topicId,
                m.topic,
                m.page_count AS pageCount,
                m.year,
                m.status,
                m.preview_url AS previewUrl,
                m.cover_url AS coverUrl,
                m.exam_target AS examTarget,
                m.rejection_reason AS rejectionReason,
                (
                    SELECT COUNT(*)
                    FROM transactions t
                    WHERE t.material_id = m.id
                      AND t.status IN ('completed', 'approved')
                ) AS salesCount,
                m.rating,
                m.files_json AS filesJson,
                m.created_at AS createdAt
            FROM materials m
            LEFT JOIN users u ON u.id = m.author_id
        ";

        $params = [];
        if (!$isAdmin) {
            if ($viewerUserId) {
                $query .= " WHERE (m.status = 'approved' OR m.author_id = :viewer_user_id)";
                $params[':viewer_user_id'] = $viewerUserId;
            } else {
                $query .= " WHERE m.status = 'approved'";
            }
        }

        $query .= ' ORDER BY m.created_at DESC';

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Busca a biblioteca de materiais ja comprados por um usuario.
     * A consulta usa transacoes aprovadas/concluidas para refletir apenas itens liberados.
     *
     * @since 1.0.0
     */
    public function fetchPurchasedMaterialsByUser(string $userId): array
    {
        if (!$this->materialsTableExists()) {
            return [];
        }

        $stmt = $this->db->prepare(
            "
            SELECT DISTINCT
                m.id,
                m.title,
                m.description,
                m.author_id AS authorId,
                u.name AS authorName,
                m.price,
                m.type,
                m.subject_id AS subjectId,
                m.subject_text AS subjectText,
                m.topic_id AS topicId,
                m.topic,
                m.page_count AS pageCount,
                m.year,
                m.status,
                m.preview_url AS previewUrl,
                m.cover_url AS coverUrl,
                m.exam_target AS examTarget,
                m.rejection_reason AS rejectionReason,
                (
                    SELECT COUNT(*)
                    FROM transactions sales_tx
                    WHERE sales_tx.material_id = m.id
                      AND sales_tx.status IN ('completed', 'approved')
                ) AS salesCount,
                m.rating,
                m.files_json AS filesJson,
                m.created_at AS createdAt,
                t.created_at AS purchasedAt
            FROM transactions t
            INNER JOIN materials m ON m.id = t.material_id
            LEFT JOIN users u ON u.id = m.author_id
            WHERE t.user_id = :user_id
              AND t.status IN ('completed', 'approved')
              AND t.type <> 'plan'
            ORDER BY t.created_at DESC
            "
        );
        $stmt->execute([':user_id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Recupera detalhes completos de um material pelo id.
     *
     * @since 1.0.0
     */
    public function fetchMaterialDetailsById(string $materialId): ?array
    {
        $stmt = $this->db->prepare(
            "
            SELECT
                m.id,
                m.title,
                m.description,
                m.author_id AS authorId,
                u.name AS authorName,
                m.price,
                m.type,
                m.subject_id AS subjectId,
                m.subject_text AS subjectText,
                m.topic_id AS topicId,
                m.topic,
                m.page_count AS pageCount,
                m.year,
                m.status,
                m.preview_url AS previewUrl,
                m.cover_url AS coverUrl,
                m.exam_target AS examTarget,
                m.rejection_reason AS rejectionReason,
                (
                    SELECT COUNT(*)
                    FROM transactions t
                    WHERE t.material_id = m.id
                      AND t.status IN ('completed', 'approved')
                ) AS salesCount,
                m.rating,
                m.files_json AS filesJson,
                m.created_at AS createdAt
            FROM materials m
            LEFT JOIN users u ON u.id = m.author_id
            WHERE m.id = :id
            LIMIT 1
            "
        );
        $stmt->execute([':id' => $materialId]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Busca comentarios e metadados para um conjunto de materiais.
     *
     * @since 1.0.0
     */
    public function fetchCommentsForMaterials(array $materialIds): array
    {
        if ($materialIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($materialIds), '?'));
        $stmt = $this->db->prepare(
            "
            SELECT
                c.*,
                u.name AS userName,
                u.plan AS userPlan,
                u.photo_url AS userAvatar,
                (
                    SELECT COUNT(*)
                    FROM comment_likes cl
                    WHERE cl.comment_id = c.id
                ) AS likes
            FROM comments c
            LEFT JOIN users u ON u.id = c.user_id
            WHERE c.target_type = 'material'
              AND c.target_id IN ({$placeholders})
            ORDER BY c.created_at DESC
            "
        );
        $stmt->execute($materialIds);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Busca o registro bruto do material para uso interno.
     *
     * @since 1.0.0
     */
    public function findMaterialRecordById(string $materialId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM materials WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $materialId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Insere um novo material no marketplace.
     *
     * @since 1.0.0
     */
    public function createMaterial(array $payload): void
    {
        $stmt = $this->db->prepare(
            "
            INSERT INTO materials (
                id,
                author_id,
                title,
                description,
                price,
                type,
                subject_id,
                topic_id,
                subject_text,
                topic,
                page_count,
                year,
                exam_target,
                files_json,
                preview_url,
                cover_url,
                status,
                created_at
            ) VALUES (
                :id,
                :author_id,
                :title,
                :description,
                :price,
                :type,
                :subject_id,
                :topic_id,
                :subject_text,
                :topic,
                :page_count,
                :year,
                :exam_target,
                :files_json,
                :preview_url,
                :cover_url,
                :status,
                NOW()
            )
            "
        );

        $stmt->execute($payload);
    }

    /**
     * Atualiza campos dinamicos de um material.
     *
     * @since 1.0.0
     */
    public function updateMaterial(string $materialId, array $fields): void
    {
        if ($fields === []) {
            return;
        }

        $assignments = [];
        $params = [':id' => $materialId];

        foreach ($fields as $column => $value) {
            $parameter = ':' . $column;
            $assignments[] = "{$column} = {$parameter}";
            $params[$parameter] = $value;
        }

        $stmt = $this->db->prepare(
            'UPDATE materials SET ' . implode(', ', $assignments) . ' WHERE id = :id'
        );
        $stmt->execute($params);
    }

    /**
     * Aplica status de moderacao e motivo de rejeicao.
     *
     * @since 1.0.0
     */
    public function updateModeration(string $materialId, string $status, ?string $reason): void
    {
        $stmt = $this->db->prepare(
            "
            UPDATE materials
            SET status = :status,
                rejection_reason = :reason
            WHERE id = :id
            "
        );
        $stmt->execute([
            ':status' => $status,
            ':reason' => $reason,
            ':id' => $materialId,
        ]);
    }

    /**
     * Marca o material como removido via moderacao.
     *
     * @since 1.0.0
     */
    public function markAsRemoved(string $materialId, string $reason): void
    {
        $this->updateModeration($materialId, 'rejected', $reason);
    }

    /**
     * Recupera dados do autor do material.
     *
     * @since 1.0.0
     */
    public function findUserById(string $userId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Verifica se o usuario ja comprou o material.
     *
     * @since 1.0.0
     */
    public function hasApprovedPurchase(string $userId, string $materialId): bool
    {
        $stmt = $this->db->prepare(
            "
            SELECT id
            FROM transactions
            WHERE user_id = :user_id
              AND material_id = :material_id
              AND status IN ('completed', 'approved')
            LIMIT 1
            "
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':material_id' => $materialId,
        ]);

        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Busca os marcadores salvos pelo usuario para um material especifico.
     *
     * @since 1.0.0
     */
    public function fetchBookmarksByMaterial(string $userId, string $materialId): array
    {
        $stmt = $this->db->prepare(
            "
            SELECT id, page_num, label, created_at
            FROM user_bookmarks
            WHERE user_id = :user_id
              AND material_id = :material_id
            ORDER BY page_num ASC, created_at ASC
            "
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':material_id' => $materialId,
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Persiste um novo marcador do leitor.
     *
     * @since 1.0.0
     */
    public function createBookmark(string $userId, string $materialId, int $pageNum, string $label): int
    {
        $stmt = $this->db->prepare(
            "
            INSERT INTO user_bookmarks (user_id, material_id, page_num, label)
            VALUES (:user_id, :material_id, :page_num, :label)
            "
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':material_id' => $materialId,
            ':page_num' => $pageNum,
            ':label' => $label,
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Remove um marcador pertencente ao usuario autenticado.
     *
     * @since 1.0.0
     */
    public function deleteBookmarkById(string $userId, int $bookmarkId): bool
    {
        $stmt = $this->db->prepare(
            'DELETE FROM user_bookmarks WHERE id = :id AND user_id = :user_id'
        );
        $stmt->execute([
            ':id' => $bookmarkId,
            ':user_id' => $userId,
        ]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Busca os destaques do leitor para o material informado.
     *
     * @since 1.0.0
     */
    public function fetchHighlightsByMaterial(string $userId, string $materialId): array
    {
        $stmt = $this->db->prepare(
            "
            SELECT id, page_num, color, rects, text, type, created_at
            FROM user_highlights
            WHERE user_id = :user_id
              AND material_id = :material_id
            ORDER BY page_num ASC, created_at ASC
            "
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':material_id' => $materialId,
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Persiste um destaque textual/visual do leitor.
     *
     * @since 1.0.0
     */
    public function createHighlight(
        string $userId,
        string $materialId,
        int $pageNum,
        string $color,
        string $rectsJson,
        string $text,
        string $type
    ): int {
        $stmt = $this->db->prepare(
            "
            INSERT INTO user_highlights (user_id, material_id, page_num, color, rects, text, type)
            VALUES (:user_id, :material_id, :page_num, :color, :rects, :text, :type)
            "
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':material_id' => $materialId,
            ':page_num' => $pageNum,
            ':color' => $color,
            ':rects' => $rectsJson,
            ':text' => $text,
            ':type' => $type,
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Remove um destaque pertencente ao usuario autenticado.
     *
     * @since 1.0.0
     */
    public function deleteHighlightById(string $userId, int $highlightId): bool
    {
        $stmt = $this->db->prepare(
            'DELETE FROM user_highlights WHERE id = :id AND user_id = :user_id'
        );
        $stmt->execute([
            ':id' => $highlightId,
            ':user_id' => $userId,
        ]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Busca a anotacao livre do usuario para o material.
     *
     * @since 1.0.0
     */
    public function findMaterialNote(string $userId, string $materialId): ?array
    {
        $stmt = $this->db->prepare(
            "
            SELECT note_text, updated_at
            FROM user_notes
            WHERE user_id = :user_id
              AND item_id = :material_id
              AND type = 'material'
            LIMIT 1
            "
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':material_id' => $materialId,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Cria ou atualiza a anotacao do usuario sem duplicar linhas no historico.
     *
     * @since 1.0.0
     */
    public function upsertMaterialNote(string $userId, string $materialId, string $noteText): void
    {
        $stmt = $this->db->prepare(
            "
            INSERT INTO user_notes (id, user_id, item_id, type, note_text)
            VALUES (:id, :user_id, :material_id, 'material', :note_text)
            ON DUPLICATE KEY UPDATE
                note_text = VALUES(note_text),
                updated_at = CURRENT_TIMESTAMP
            "
        );
        $stmt->execute([
            ':id' => 'note-' . uniqid('', true),
            ':user_id' => $userId,
            ':material_id' => $materialId,
            ':note_text' => $noteText,
        ]);
    }

    /**
     * Garante que a tabela de ratings de materiais exista.
     *
     * @since 1.0.0
     */
    public function ensureMaterialRatingsTable(): void
    {
        $this->db->exec(
            "
            CREATE TABLE IF NOT EXISTS material_ratings (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                material_id VARCHAR(64) NOT NULL,
                rating DECIMAL(3,1) NOT NULL,
                created_at DATETIME NOT NULL,
                UNIQUE KEY uniq_material_ratings_user_material (user_id, material_id),
                INDEX idx_material_ratings_material (material_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            "
        );

        $this->db->exec('ALTER TABLE material_ratings MODIFY user_id VARCHAR(64) NOT NULL');
        $this->db->exec('ALTER TABLE material_ratings MODIFY material_id VARCHAR(64) NOT NULL');
    }

    /**
     * Busca a avaliacao ja registrada por um usuario.
     *
     * @since 1.0.0
     */
    public function findUserRating(string $userId, string $materialId): ?int
    {
        $this->ensureMaterialRatingsTable();

        $stmt = $this->db->prepare(
            'SELECT rating FROM material_ratings WHERE user_id = :user_id AND material_id = :material_id LIMIT 1'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':material_id' => $materialId,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }

        return (int) round((float) $row['rating']);
    }

    /**
     * Cria ou atualiza a avaliacao de um material.
     *
     * @since 1.0.0
     */
    public function upsertRating(string $userId, string $materialId, float $rating): void
    {
        $this->ensureMaterialRatingsTable();

        $stmt = $this->db->prepare(
            "
            INSERT INTO material_ratings (user_id, material_id, rating, created_at)
            VALUES (:user_id, :material_id, :rating, NOW())
            ON DUPLICATE KEY UPDATE
                rating = VALUES(rating),
                created_at = NOW()
            "
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':material_id' => $materialId,
            ':rating' => $rating,
        ]);
    }

    /**
     * Recalcula e persiste o rating medio do material.
     *
     * @since 1.0.0
     */
    public function refreshMaterialRatingStats(string $materialId): array
    {
        $this->ensureMaterialRatingsTable();

        $stmt = $this->db->prepare(
            'SELECT AVG(rating) AS avg_rating, COUNT(*) AS total_ratings FROM material_ratings WHERE material_id = :material_id'
        );
        $stmt->execute([':material_id' => $materialId]);
        $stats = $stmt->fetch(PDO::FETCH_ASSOC) ?: [
            'avg_rating' => 0,
            'total_ratings' => 0,
        ];

        $average = round((float) ($stats['avg_rating'] ?? 0), 2);
        $totalRatings = (int) ($stats['total_ratings'] ?? 0);

        $update = $this->db->prepare('UPDATE materials SET rating = :rating WHERE id = :id');
        $update->execute([
            ':rating' => $average,
            ':id' => $materialId,
        ]);

        return [
            'newRating' => $average,
            'totalRatings' => $totalRatings,
        ];
    }
}
