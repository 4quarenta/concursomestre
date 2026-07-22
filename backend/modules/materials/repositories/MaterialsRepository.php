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
require_once __DIR__ . '/../../../shared/pagination/SignedKeysetCursor.php';

/**
 * Repositorio do dominio de materiais.
 * Concentra acesso ao banco para listagem, CRUD, moderacao e avaliacao.
 *
 * @since 1.0.0
 */
class MaterialsRepository
{
    private PDO $db;
    private bool $schemaChecked = false;

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
     * Confere apenas a disponibilidade do schema. DDL pertence exclusivamente
     * ao runner de migrations para que uma requisicao HTTP nunca altere tabelas.
     */
    public function ensureSchema(): void
    {
        if ($this->schemaChecked) {
            return;
        }

        $this->schemaChecked = true;
        SchemaReadiness::assertTablesAndColumns($this->db, 'marketplace e conteudo de usuarios', [
            'materials' => [
                'id', 'author_id', 'files_json', 'status', 'updated_by_user_id',
                'moderated_by_user_id', 'moderated_at', 'moderation_reason',
            ],
            'material_ratings' => ['user_id', 'material_id', 'rating'],
            'material_uploads' => [
                'storage_key', 'uploaded_by_user_id', 'mime_type', 'size_bytes',
                'checksum_sha256', 'status', 'attached_material_id',
            ],
            'material_moderation_events' => [
                'material_id', 'actor_user_id', 'action', 'next_status', 'reason',
            ],
        ]);
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
    public function fetchMaterials(
        ?string $viewerUserId,
        bool $isAdmin,
        int $limit = 24,
        ?string $cursor = null
    ): array
    {
        if (!$this->materialsTableExists()) {
            return [];
        }

        $safeLimit = max(1, min(50, $limit));
        $cursorParts = SignedKeysetCursor::decode($cursor, 'materials.list') ?? [
            'createdAt' => null,
            'id' => '',
        ];

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

        if ($cursorParts['createdAt'] !== null) {
            $query .= $params === [] ? ' WHERE ' : ' AND ';
            $query .= '(
                m.created_at < :cursor_created_at
                OR (m.created_at = :cursor_created_at AND m.id < :cursor_id)
            )';
            $params[':cursor_created_at'] = $cursorParts['createdAt'];
            $params[':cursor_id'] = $cursorParts['id'];
        }

        $query .= ' ORDER BY m.created_at DESC, m.id DESC LIMIT ' . ($safeLimit + 1);

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Agrega vendas para somente os materiais da pagina corrente.
     */
    public function fetchSalesCountsForMaterials(array $materialIds): array
    {
        if ($materialIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($materialIds), '?'));
        $stmt = $this->db->prepare(
            "SELECT material_id, COUNT(*) AS sales_count
             FROM transactions
             WHERE material_id IN ({$placeholders})
               AND status IN ('completed', 'approved')
             GROUP BY material_id"
        );
        $stmt->execute(array_values($materialIds));

        $counts = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $counts[(string) $row['material_id']] = (int) $row['sales_count'];
        }

        return $counts;
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
                ranked.*,
                u.name AS userName,
                u.plan AS userPlan,
                u.photo_url AS userAvatar,
                COALESCE(likes.likes_count, 0) AS likes
            FROM (
                SELECT c.*,
                       ROW_NUMBER() OVER (
                           PARTITION BY c.target_id
                           ORDER BY c.created_at DESC, c.id DESC
                       ) AS material_row_number
                FROM comments c
                WHERE c.target_type = 'material'
                  AND c.target_id IN ({$placeholders})
                  AND c.moderation_status = 'approved'
            ) ranked
            LEFT JOIN users u ON u.id = ranked.user_id
            LEFT JOIN (
                SELECT cl.comment_id, COUNT(*) AS likes_count
                FROM comment_likes cl
                INNER JOIN comments liked_comment ON liked_comment.id = cl.comment_id
                WHERE liked_comment.target_type = 'material'
                  AND liked_comment.target_id IN ({$placeholders})
                GROUP BY cl.comment_id
            ) likes ON likes.comment_id = ranked.id
            WHERE ranked.material_row_number <= 20
            ORDER BY ranked.target_id, ranked.created_at DESC, ranked.id DESC
            "
        );
        $stmt->execute(array_merge(array_values($materialIds), array_values($materialIds)));

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
     * Registra um PDF privado enviado pelo autor antes de ele ser associado a
     * um material. A associacao posterior confere o mesmo usuario.
     */
    public function createMaterialUpload(array $payload): void
    {
        $this->ensureSchema();

        $stmt = $this->db->prepare(
            "INSERT INTO material_uploads (
                storage_key, uploaded_by_user_id, mime_type, size_bytes,
                checksum_sha256, status, created_at
            ) VALUES (
                :storage_key, :uploaded_by_user_id, :mime_type, :size_bytes,
                :checksum_sha256, 'pending', NOW()
            )"
        );
        $stmt->execute($payload);
    }

    /**
     * Busca somente um upload pendente pertencente ao autor autenticado.
     */
    public function findPendingMaterialUploadForOwner(string $storageKey, string $userId): ?array
    {
        $this->ensureSchema();

        $stmt = $this->db->prepare(
            "SELECT *
             FROM material_uploads
             WHERE storage_key = :storage_key
               AND uploaded_by_user_id = :user_id
               AND status = 'pending'
             LIMIT 1"
        );
        $stmt->execute([
            ':storage_key' => $storageKey,
            ':user_id' => $userId,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Marca o upload como associado de forma atomica para impedir que um mesmo
     * arquivo privado seja anexado a mais de um material por replay de request.
     */
    public function attachPendingMaterialUpload(string $storageKey, string $userId, string $materialId): bool
    {
        $this->ensureSchema();

        $stmt = $this->db->prepare(
            "UPDATE material_uploads
             SET status = 'attached',
                 attached_material_id = :material_id,
                 attached_at = NOW()
             WHERE storage_key = :storage_key
               AND uploaded_by_user_id = :user_id
               AND status = 'pending'"
        );
        $stmt->execute([
            ':material_id' => $materialId,
            ':storage_key' => $storageKey,
            ':user_id' => $userId,
        ]);

        return $stmt->rowCount() === 1;
    }

    /**
     * Aplica status de moderacao e motivo de rejeicao.
     *
     * @since 1.0.0
     */
    public function updateModeration(string $materialId, string $status, ?string $reason, string $moderatorUserId): void
    {
        $stmt = $this->db->prepare(
            "
            UPDATE materials
            SET status = :status,
                rejection_reason = :reason,
                moderation_reason = :reason,
                moderated_by_user_id = :moderator_user_id,
                moderated_at = NOW()
            WHERE id = :id
            "
        );
        $stmt->execute([
            ':status' => $status,
            ':reason' => $reason,
            ':moderator_user_id' => $moderatorUserId,
            ':id' => $materialId,
        ]);
    }

    /**
     * Mantem uma trilha append-only de cada decisao de moderacao.
     */
    public function recordModerationEvent(
        string $materialId,
        string $actorUserId,
        string $action,
        ?string $previousStatus,
        string $nextStatus,
        ?string $reason
    ): void {
        $this->ensureSchema();

        $stmt = $this->db->prepare(
            "INSERT INTO material_moderation_events (
                material_id, actor_user_id, action, previous_status,
                next_status, reason, created_at
            ) VALUES (
                :material_id, :actor_user_id, :action, :previous_status,
                :next_status, :reason, NOW()
            )"
        );
        $stmt->execute([
            ':material_id' => $materialId,
            ':actor_user_id' => $actorUserId,
            ':action' => $action,
            ':previous_status' => $previousStatus,
            ':next_status' => $nextStatus,
            ':reason' => $reason,
        ]);
    }

    /**
     * Marca o material como removido via moderacao.
     *
     * @since 1.0.0
     */
    public function markAsRemoved(string $materialId, string $reason): void
    {
        throw new LogicException('Use updateModeration com o moderador autenticado.');
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
     * Busca a avaliacao ja registrada por um usuario.
     *
     * @since 1.0.0
     */
    public function findUserRating(string $userId, string $materialId): ?int
    {
        $this->ensureSchema();

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
        $this->ensureSchema();

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
        $this->ensureSchema();

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
