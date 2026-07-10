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
 * Repositorio da caixa unificada de moderacao de comentarios.
 *
 * @since 1.0.0
 */
class AdminCommentsModerationRepository
{
    private const MODERATION_STATUSES = ['pending', 'approved', 'spam', 'trash'];

    private bool $schemaEnsured = false;

    public function __construct(private readonly PDO $db)
    {
    }

    public function listItems(array $filters): array
    {
        $this->ensureSchema();

        $status = $filters['status'];
        $search = $filters['search'];
        $origin = $filters['origin'];
        $page = max(1, (int) $filters['page']);
        $perPage = max(1, min(100, (int) $filters['perPage']));

        $items = array_merge(
            $this->fetchGenericComments($status, $search, $origin),
            $this->fetchLawComments($status, $search, $origin)
        );

        usort($items, static fn (array $left, array $right) => strcmp((string) $right['createdAt'], (string) $left['createdAt']));

        $total = count($items);
        $offset = ($page - 1) * $perPage;

        return [
            'items' => array_slice($items, $offset, $perPage),
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
            'pages' => max(1, $perPage > 0 ? (int) ceil($total / $perPage) : 1),
            'counts' => $this->countModerationStatuses(),
        ];
    }

    public function exportItems(array $filters): array
    {
        $filters['page'] = 1;
        $filters['perPage'] = 5000;
        return $this->listItems($filters)['items'];
    }

    public function updateModerationStatus(string $moderationId, string $status, string $adminUserId): array
    {
        $this->ensureSchema();
        [$sourceType, $sourceId] = $this->parseModerationId($moderationId);
        $before = $this->findModerationSource($sourceType, $sourceId);

        if ($sourceType === 'comment') {
            $stmt = $this->db->prepare(
                "UPDATE comments
                 SET moderation_status = :status,
                     moderated_at = NOW(),
                     moderated_by = :admin_user_id
                 WHERE id = :id"
            );
            $stmt->execute([
                ':status' => $status,
                ':admin_user_id' => $adminUserId,
                ':id' => $sourceId,
            ]);
        } elseif ($sourceType === 'law') {
            $stmt = $this->db->prepare(
                "UPDATE legal_user_comments
                 SET moderation_status = :status,
                     moderated_at = NOW(),
                     moderated_by = :admin_user_id
                 WHERE id = :id"
            );
            $stmt->execute([
                ':status' => $status,
                ':admin_user_id' => $adminUserId,
                ':id' => $sourceId,
            ]);
        } else {
            throw new InvalidArgumentException('Origem do comentario invalida.');
        }

        if ($stmt->rowCount() <= 0 && !$before) {
            throw new OutOfBoundsException('Comentario de moderacao nao encontrado.');
        }

        if ($before && (string) ($before['moderation_status'] ?? 'approved') !== $status) {
            $this->notifyModerationOutcome($sourceType, $before, $status);
        }

        return [
            'id' => $moderationId,
            'status' => $status,
        ];
    }

    public function bulkUpdateModerationStatus(array $ids, string $status, string $adminUserId): array
    {
        $updated = 0;

        foreach ($ids as $moderationId) {
            $this->updateModerationStatus((string) $moderationId, $status, $adminUserId);
            $updated++;
        }

        return [
            'updated' => $updated,
            'status' => $status,
        ];
    }

    private function countModerationStatuses(): array
    {
        $counts = ['all' => $this->countByStatus(null)];

        foreach (self::MODERATION_STATUSES as $status) {
            $counts[$status] = $this->countByStatus($status);
        }

        return $counts;
    }

    private function countByStatus(?string $status): int
    {
        $genericWhere = '';
        $genericParams = [];
        if ($status !== null) {
            $genericWhere = " WHERE COALESCE(moderation_status, 'approved') = :status";
            $genericParams[':status'] = $status;
        }

        $genericCountStmt = $this->db->prepare(
            "SELECT COUNT(*)
             FROM comments" . $genericWhere
        );
        $genericCountStmt->execute($genericParams);

        $lawWhere = " WHERE status != 'deleted'";
        $lawParams = [];
        if ($status !== null) {
            $lawWhere .= " AND COALESCE(moderation_status, 'approved') = :status";
            $lawParams[':status'] = $status;
        }

        $lawCountStmt = $this->db->prepare(
            "SELECT COUNT(*)
             FROM legal_user_comments" . $lawWhere
        );
        $lawCountStmt->execute($lawParams);

        return (int) $genericCountStmt->fetchColumn() + (int) $lawCountStmt->fetchColumn();
    }

    private function fetchGenericComments(string $status, string $search, string $origin): array
    {
        if (!in_array($origin, ['all', 'question', 'material'], true)) {
            return [];
        }

        $conditions = [];
        $params = [];

        if ($status !== 'all') {
            $conditions[] = "COALESCE(c.moderation_status, 'approved') = :status";
            $params[':status'] = $status;
        }

        if ($origin !== 'all') {
            $conditions[] = 'c.target_type = :origin';
            $params[':origin'] = $origin;
        }

        if ($search !== '') {
            $conditions[] = "(COALESCE(u.name, '') LIKE :search OR c.content LIKE :search OR COALESCE(q.enunciado_clean, q.enunciado, '') LIKE :search OR COALESCE(m.title, '') LIKE :search)";
            $params[':search'] = '%' . $search . '%';
        }

        $stmt = $this->db->prepare(
            "SELECT
                c.id,
                c.user_id,
                c.target_type,
                c.target_id,
                c.content,
                c.created_at,
                COALESCE(c.moderation_status, 'approved') AS moderation_status,
                COALESCE(u.name, 'Usuario') AS user_name,
                COALESCE(q.enunciado_clean, q.enunciado, CONCAT('Questao #', c.target_id)) AS question_label,
                COALESCE(m.title, CONCAT('Material #', REPLACE(REPLACE(c.target_id, '-qa', ''), '-reviews', ''))) AS material_label
             FROM comments c
             LEFT JOIN users u ON u.id = c.user_id
             LEFT JOIN questions q
               ON c.target_type = 'question'
              AND q.id = c.target_id
             LEFT JOIN materials m
               ON c.target_type = 'material'
              AND m.id = REPLACE(REPLACE(c.target_id, '-qa', ''), '-reviews', '')
             " . ($conditions ? "WHERE " . implode(' AND ', $conditions) : '') . "
             ORDER BY c.created_at DESC"
        );
        $stmt->execute($params);

        return array_map(function (array $row): array {
            $origin = (string) ($row['target_type'] ?? 'question');
            $targetId = (string) ($row['target_id'] ?? '');
            $resolvedMaterialId = str_replace(['-qa', '-reviews'], '', $targetId);

            return [
                'id' => 'comment:' . (string) $row['id'],
                'origin' => $origin,
                'sourceType' => 'comment',
                'sourceId' => (string) $row['id'],
                'authorId' => (string) ($row['user_id'] ?? ''),
                'authorName' => (string) ($row['user_name'] ?? 'Usuario'),
                'excerpt' => trim((string) ($row['content'] ?? '')),
                'targetLabel' => $origin === 'material'
                    ? (string) ($row['material_label'] ?? 'Material')
                    : (string) ($row['question_label'] ?? 'Questao'),
                'targetPath' => $origin === 'material'
                    ? '/marketplace?openMaterial=' . urlencode($resolvedMaterialId)
                    : '/practice?questionId=' . urlencode($targetId),
                'status' => (string) ($row['moderation_status'] ?? 'approved'),
                'createdAt' => (string) ($row['created_at'] ?? ''),
            ];
        }, $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function fetchLawComments(string $status, string $search, string $origin): array
    {
        if (!in_array($origin, ['all', 'law'], true)) {
            return [];
        }

        $conditions = [
            "luc.status != 'deleted'",
        ];
        $params = [];

        if ($status !== 'all') {
            $conditions[] = "COALESCE(luc.moderation_status, 'approved') = :status";
            $params[':status'] = $status;
        }

        if ($search !== '') {
            $conditions[] = "(luc.user_name LIKE :search OR luc.body LIKE :search OR la.article_number LIKE :search OR COALESCE(l.short_title, l.title, '') LIKE :search)";
            $params[':search'] = '%' . $search . '%';
        }

        $stmt = $this->db->prepare(
            "SELECT
                luc.id,
                luc.user_id,
                luc.user_name,
                luc.body,
                luc.created_at,
                COALESCE(luc.moderation_status, 'approved') AS moderation_status,
                la.id AS article_id,
                la.article_number,
                l.slug AS law_slug,
                COALESCE(l.short_title, l.title) AS law_title
             FROM legal_user_comments luc
             INNER JOIN law_articles la ON la.id = luc.law_article_id
             INNER JOIN laws l ON l.id = la.law_id
             WHERE " . implode(' AND ', $conditions) . "
             ORDER BY luc.created_at DESC"
        );
        $stmt->execute($params);

        return array_map(static function (array $row): array {
            return [
                'id' => 'law:' . (string) $row['id'],
                'origin' => 'law',
                'sourceType' => 'law',
                'sourceId' => (string) $row['id'],
                'authorId' => (string) ($row['user_id'] ?? ''),
                'authorName' => (string) ($row['user_name'] ?? 'Usuario'),
                'excerpt' => trim((string) ($row['body'] ?? '')),
                'targetLabel' => 'Art. ' . (string) ($row['article_number'] ?? '') . ' - ' . (string) ($row['law_title'] ?? 'Lei Comentada'),
                'targetPath' => '/lei-comentada/' . urlencode((string) ($row['law_slug'] ?? '')) . '#article-' . urlencode((string) ($row['article_id'] ?? '')),
                'status' => (string) ($row['moderation_status'] ?? 'approved'),
                'createdAt' => (string) ($row['created_at'] ?? ''),
            ];
        }, $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function ensureSchema(): void
    {
        if ($this->schemaEnsured) {
            return;
        }

        if ($this->tableExists('comments')) {
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
            } catch (Throwable $e) {
                // noop
            }
        }

        if ($this->tableExists('legal_user_comments')) {
            $this->ensureColumnExists(
                'legal_user_comments',
                'moderation_status',
                "ALTER TABLE legal_user_comments ADD COLUMN moderation_status VARCHAR(20) NOT NULL DEFAULT 'approved' AFTER status"
            );
            $this->ensureColumnExists(
                'legal_user_comments',
                'moderated_at',
                "ALTER TABLE legal_user_comments ADD COLUMN moderated_at DATETIME NULL AFTER updated_at"
            );
            $this->ensureColumnExists(
                'legal_user_comments',
                'moderated_by',
                "ALTER TABLE legal_user_comments ADD COLUMN moderated_by VARCHAR(80) NULL AFTER moderated_at"
            );
            try {
                $this->db->exec("UPDATE legal_user_comments SET moderation_status = 'approved' WHERE moderation_status IS NULL OR moderation_status = ''");
            } catch (Throwable $e) {
                // noop
            }
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

    private function parseModerationId(string $moderationId): array
    {
        $parts = explode(':', $moderationId, 2);
        if (count($parts) !== 2 || trim($parts[1]) === '') {
            throw new InvalidArgumentException('Identificador de moderacao invalido.');
        }

        return [trim($parts[0]), trim($parts[1])];
    }

    private function findModerationSource(string $sourceType, string $sourceId): ?array
    {
        if ($sourceType === 'comment') {
            $stmt = $this->db->prepare(
                "SELECT c.id,
                        c.user_id,
                        c.target_type,
                        c.target_id,
                        c.content,
                        c.parent_id,
                        COALESCE(c.moderation_status, 'approved') AS moderation_status,
                        COALESCE(u.name, 'Usuario') AS user_name
                 FROM comments c
                 LEFT JOIN users u ON u.id = c.user_id
                 WHERE c.id = :id
                 LIMIT 1"
            );
            $stmt->execute([':id' => $sourceId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return is_array($row) ? $row : null;
        }

        if ($sourceType === 'law') {
            $stmt = $this->db->prepare(
                "SELECT luc.id,
                        luc.user_id,
                        luc.user_name,
                        luc.body AS content,
                        COALESCE(luc.moderation_status, 'approved') AS moderation_status,
                        la.id AS article_id,
                        la.article_number,
                        l.slug AS law_slug,
                        COALESCE(l.short_title, l.title, 'Lei Comentada') AS law_title
                 FROM legal_user_comments luc
                 INNER JOIN law_articles la ON la.id = luc.law_article_id
                 INNER JOIN laws l ON l.id = la.law_id
                 WHERE luc.id = :id
                 LIMIT 1"
            );
            $stmt->execute([':id' => $sourceId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return is_array($row) ? $row : null;
        }

        return null;
    }

    private function notifyModerationOutcome(string $sourceType, array $source, string $status): void
    {
        require_once __DIR__ . '/../../../config/notification_helper.php';
        require_once __DIR__ . '/../../../config/gamification_helper.php';

        try {
            $authorId = trim((string) ($source['user_id'] ?? ''));
            if ($authorId === '') {
                return;
            }

            $link = $sourceType === 'law'
                ? $this->buildLawCommentPath($source)
                : $this->buildGenericCommentPath($source);

            if ($status === 'approved') {
                createNotification(
                    $this->db,
                    $authorId,
                    'Comentario aprovado',
                    'Seu comentario foi aprovado e ja esta visivel na plataforma.',
                    'success',
                    'social',
                    $link
                );

                if ($sourceType === 'comment') {
                    $this->notifyVisibleGenericComment($source, $link);
                }

                $reward = grantGamificationEvent(
                    $this->db,
                    $authorId,
                    'comment_approved',
                    'comment_approved:' . $sourceType . ':' . (string) ($source['id'] ?? ''),
                    10,
                    1,
                    [
                        'key' => 'first_approved_comment',
                        'title' => 'Primeiro comentario aprovado',
                        'description' => 'Um comentario seu passou pela moderacao e ficou visivel.',
                    ],
                    [
                        'source_type' => $sourceType,
                        'comment_id' => (string) ($source['id'] ?? ''),
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
                        'XP de comunidade',
                        'Seu comentario aprovado pela moderacao rendeu +10 XP.',
                        'success',
                        'social',
                        $link
                    );
                }

                return;
            }

            if (in_array($status, ['spam', 'trash'], true)) {
                createNotification(
                    $this->db,
                    $authorId,
                    $status === 'spam' ? 'Comentario marcado como spam' : 'Comentario removido',
                    $status === 'spam'
                        ? 'Seu comentario foi marcado como spam pela moderacao.'
                        : 'Seu comentario foi removido pela moderacao.',
                    'warning',
                    'social',
                    $link
                );

                grantGamificationEvent(
                    $this->db,
                    $authorId,
                    'comment_moderation_penalty',
                    'comment_penalty:' . $sourceType . ':' . (string) ($source['id'] ?? ''),
                    0,
                    -3,
                    null,
                    [
                        'source_type' => $sourceType,
                        'comment_id' => (string) ($source['id'] ?? ''),
                        'status' => $status,
                    ]
                );
            }
        } catch (Throwable $e) {
            error_log('[AdminCommentsModerationRepository] Falha ao notificar moderacao: ' . $e->getMessage());
        }
    }

    private function notifyVisibleGenericComment(array $source, string $link): void
    {
        $authorId = trim((string) ($source['user_id'] ?? ''));
        $authorName = trim((string) ($source['user_name'] ?? 'Usuario'));
        $commentId = (string) ($source['id'] ?? '');
        $parentId = trim((string) ($source['parent_id'] ?? ''));

        if ($parentId !== '') {
            $parent = $this->findModerationSource('comment', $parentId);
            $parentOwnerId = trim((string) ($parent['user_id'] ?? ''));

            if ($parentOwnerId !== '' && $parentOwnerId !== $authorId) {
                createNotification(
                    $this->db,
                    $parentOwnerId,
                    $authorName,
                    'respondeu ao seu comentario.',
                    'info',
                    'social',
                    $link
                );
            }

            return;
        }

        if ((string) ($source['target_type'] ?? '') !== 'material') {
            return;
        }

        $materialId = str_replace(['-qa', '-reviews'], '', (string) ($source['target_id'] ?? ''));
        if ($materialId === '') {
            return;
        }

        $stmt = $this->db->prepare(
            "SELECT author_id, title
             FROM materials
             WHERE id = :id
             LIMIT 1"
        );
        $stmt->execute([':id' => $materialId]);
        $material = $stmt->fetch(PDO::FETCH_ASSOC);
        $ownerId = trim((string) ($material['author_id'] ?? ''));

        if ($ownerId === '' || $ownerId === $authorId) {
            return;
        }

        createNotification(
            $this->db,
            $ownerId,
            $authorName,
            'comentou no seu material: "' . $this->truncateNotificationText((string) ($material['title'] ?? 'Material')) . '"',
            'info',
            'social',
            $link
        );
    }

    private function buildGenericCommentPath(array $source): string
    {
        $targetType = (string) ($source['target_type'] ?? 'question');
        $targetId = (string) ($source['target_id'] ?? '');
        $commentId = (string) ($source['id'] ?? '');

        if ($targetType === 'material') {
            $materialId = str_replace(['-qa', '-reviews'], '', $targetId);
            return '/marketplace?openMaterial=' . rawurlencode($materialId) . '&comment=' . rawurlencode($commentId);
        }

        return '/practice?questionId=' . rawurlencode($targetId) . '#comment-' . rawurlencode($commentId);
    }

    private function buildLawCommentPath(array $source): string
    {
        return '/lei-comentada/'
            . rawurlencode((string) ($source['law_slug'] ?? ''))
            . '#article-'
            . rawurlencode((string) ($source['article_id'] ?? ''));
    }

    private function truncateNotificationText(string $value, int $limit = 80): string
    {
        $plainValue = trim(strip_tags($value));

        if (function_exists('mb_substr')) {
            return mb_substr($plainValue, 0, $limit);
        }

        return substr($plainValue, 0, $limit);
    }
}
