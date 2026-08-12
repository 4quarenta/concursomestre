<?php

declare(strict_types=1);

final class ChangelogRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function listPublic(array $filters): array
    {
        $limit = (int) $filters['limit'];
        $page = (int) $filters['page'];
        $offset = ($page - 1) * $limit;
        $total = (int) $this->db->query(
            "SELECT COUNT(*) FROM changelogs
             WHERE status = 'published'
               AND published_at IS NOT NULL
               AND published_at <= NOW()"
        )->fetchColumn();

        $stmt = $this->db->prepare(
            "SELECT id, version, slug, release_date, published_at, title, description, content_json
             FROM changelogs
             WHERE status = 'published'
               AND published_at IS NOT NULL
               AND published_at <= NOW()
             ORDER BY published_at DESC, id DESC
             LIMIT :limit OFFSET :offset"
        );
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return [
            'items' => $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'pageInfo' => $this->pageInfo($page, $limit, $total),
        ];
    }

    public function listAdmin(array $filters): array
    {
        $conditions = ['1 = 1'];
        $params = [];
        if ($filters['status'] !== '') {
            $conditions[] = 'c.status = :status';
            $params[':status'] = $filters['status'];
        }
        if ($filters['search'] !== '') {
            $conditions[] = '(c.title LIKE :search_title OR c.description LIKE :search_description)';
            $params[':search_title'] = '%' . $filters['search'] . '%';
            $params[':search_description'] = '%' . $filters['search'] . '%';
        }
        $where = implode(' AND ', $conditions);
        $count = $this->db->prepare("SELECT COUNT(*) FROM changelogs c WHERE {$where}");
        $count->execute($params);
        $total = (int) $count->fetchColumn();
        $limit = (int) $filters['limit'];
        $page = (int) $filters['page'];
        $offset = ($page - 1) * $limit;

        $stmt = $this->db->prepare(
            "SELECT c.*, creator.name AS creator_name, updater.name AS updater_name
             FROM changelogs c
             LEFT JOIN users creator ON creator.id = c.created_by
             LEFT JOIN users updater ON updater.id = c.updated_by
             WHERE {$where}
             ORDER BY c.updated_at DESC, c.id DESC
             LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return [
            'items' => $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'pageInfo' => $this->pageInfo($page, $limit, $total),
        ];
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT c.*, creator.name AS creator_name, updater.name AS updater_name '
            . 'FROM changelogs c '
            . 'LEFT JOIN users creator ON creator.id = c.created_by '
            . 'LEFT JOIN users updater ON updater.id = c.updated_by '
            . 'WHERE c.id = :id LIMIT 1'
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function save(array $entry, string $actorId): array
    {
        $publishedAt = $entry['status'] === 'published' ? date('Y-m-d H:i:s') : null;
        $contentJson = json_encode($entry['content'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($contentJson)) {
            throw new RuntimeException('Nao foi possivel serializar o conteudo da novidade.');
        }

        if ($entry['id']) {
            $existing = $this->findById((int) $entry['id']);
            if (!$existing) {
                throw new OutOfBoundsException('Novidade nao encontrada.');
            }
            $stmt = $this->db->prepare(
                "UPDATE changelogs SET
                    slug = :slug,
                    release_date = :release_date,
                    published_at = CASE
                        WHEN :status_publish = 'published' THEN COALESCE(published_at, :published_at)
                        ELSE NULL
                    END,
                    title = :title,
                    description = :description,
                    content_json = :content_json,
                    status = :status_value,
                    updated_by = :updated_by,
                    updated_at = NOW()
                 WHERE id = :id"
            );
            $stmt->execute([
                ':slug' => $entry['slug'],
                ':release_date' => $entry['releaseDate'],
                ':status_publish' => $entry['status'],
                ':published_at' => $publishedAt,
                ':title' => $entry['title'],
                ':description' => $entry['description'],
                ':content_json' => $contentJson,
                ':status_value' => $entry['status'],
                ':updated_by' => $actorId,
                ':id' => $entry['id'],
            ]);
            return $this->findById((int) $entry['id']) ?? $existing;
        }

        $version = $entry['version'] !== ''
            ? $entry['version']
            : date('Y.m.d.His') . '-' . bin2hex(random_bytes(2));
        $stmt = $this->db->prepare(
            'INSERT INTO changelogs (
                version, slug, release_date, published_at, title, description,
                content_json, status, created_by, updated_by, created_at, updated_at
             ) VALUES (
                :version, :slug, :release_date, :published_at, :title, :description,
                :content_json, :status, :created_by, :updated_by, NOW(), NOW()
             )'
        );
        $stmt->execute([
            ':version' => $version,
            ':slug' => $entry['slug'],
            ':release_date' => $entry['releaseDate'],
            ':published_at' => $publishedAt,
            ':title' => $entry['title'],
            ':description' => $entry['description'],
            ':content_json' => $contentJson,
            ':status' => $entry['status'],
            ':created_by' => $actorId,
            ':updated_by' => $actorId,
        ]);
        return $this->findById((int) $this->db->lastInsertId()) ?? [];
    }

    public function archive(int $id, string $actorId): bool
    {
        $stmt = $this->db->prepare(
            "UPDATE changelogs
             SET status = 'archived', published_at = NULL, updated_by = :updated_by, updated_at = NOW()
             WHERE id = :id"
        );
        $stmt->execute([':updated_by' => $actorId, ':id' => $id]);
        return $stmt->rowCount() > 0;
    }

    public function listSuggestions(array $filters): array
    {
        $conditions = [
            'f.parent_id IS NULL',
            "f.type = 'suggestion'",
            'f.public_rating IS NULL',
            "f.reason NOT LIKE 'Avaliar plataforma%'",
        ];
        $params = [];
        if ($filters['status'] !== '') {
            $conditions[] = "COALESCE(f.suggestion_status, 'pending') = :suggestion_status";
            $params[':suggestion_status'] = $filters['status'];
        }
        if ($filters['search'] !== '') {
            $conditions[] = '(f.reason LIKE :search_reason OR f.details LIKE :search_details OR u.name LIKE :search_name OR u.email LIKE :search_email)';
            $like = '%' . $filters['search'] . '%';
            $params[':search_reason'] = $like;
            $params[':search_details'] = $like;
            $params[':search_name'] = $like;
            $params[':search_email'] = $like;
        }
        $where = implode(' AND ', $conditions);
        $count = $this->db->prepare(
            "SELECT COUNT(*) FROM user_feedback f LEFT JOIN users u ON u.id = f.user_id WHERE {$where}"
        );
        $count->execute($params);
        $total = (int) $count->fetchColumn();
        $limit = (int) $filters['limit'];
        $page = (int) $filters['page'];
        $offset = ($page - 1) * $limit;

        $stmt = $this->db->prepare(
            "SELECT
                f.id, f.reason, f.details, f.status AS support_status,
                COALESCE(f.suggestion_status, 'pending') AS suggestion_status,
                f.platform_version,
                f.suggestion_admin_note, f.suggestion_changelog_id,
                f.suggestion_reviewed_at, f.created_at, f.updated_at,
                u.id AS user_id, u.name AS user_name, u.email AS user_email,
                (SELECT COUNT(*) FROM user_feedback_votes vl WHERE vl.feedback_id = f.id AND vl.vote_value = 'like') AS likes,
                (SELECT COUNT(*) FROM user_feedback_votes vd WHERE vd.feedback_id = f.id AND vd.vote_value = 'dislike') AS dislikes,
                c.title AS changelog_title
             FROM user_feedback f
             LEFT JOIN users u ON u.id = f.user_id
             LEFT JOIN changelogs c ON c.id = f.suggestion_changelog_id
             WHERE {$where}
             ORDER BY f.created_at DESC, f.id DESC
             LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        return [
            'items' => $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
            'pageInfo' => $this->pageInfo($page, $limit, $total),
        ];
    }

    public function updateSuggestion(array $input, string $actorId): ?array
    {
        $stmt = $this->db->prepare(
            "UPDATE user_feedback
             SET suggestion_status = :suggestion_status,
                 suggestion_admin_note = :admin_note,
                 suggestion_changelog_id = :changelog_id,
                 suggestion_reviewed_at = NOW(),
                 suggestion_reviewed_by = :reviewed_by,
                 updated_at = NOW()
             WHERE id = :id
               AND parent_id IS NULL
               AND type = 'suggestion'"
        );
        $stmt->execute([
            ':suggestion_status' => $input['status'],
            ':admin_note' => $input['adminNote'] ?: null,
            ':changelog_id' => $input['changelogId'],
            ':reviewed_by' => $actorId,
            ':id' => $input['id'],
        ]);
        if ($stmt->rowCount() === 0) {
            $check = $this->db->prepare("SELECT id FROM user_feedback WHERE id = :id AND parent_id IS NULL AND type = 'suggestion'");
            $check->execute([':id' => $input['id']]);
            if (!$check->fetchColumn()) {
                return null;
            }
        }
        return $this->findSuggestionById((int) $input['id']);
    }

    private function findSuggestionById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT
                f.id, f.reason, f.details, f.status AS support_status,
                COALESCE(f.suggestion_status, 'pending') AS suggestion_status,
                f.platform_version,
                f.suggestion_admin_note, f.suggestion_changelog_id,
                f.suggestion_reviewed_at, f.created_at, f.updated_at,
                u.id AS user_id, u.name AS user_name, u.email AS user_email,
                (SELECT COUNT(*) FROM user_feedback_votes vl WHERE vl.feedback_id = f.id AND vl.vote_value = 'like') AS likes,
                (SELECT COUNT(*) FROM user_feedback_votes vd WHERE vd.feedback_id = f.id AND vd.vote_value = 'dislike') AS dislikes,
                c.title AS changelog_title
             FROM user_feedback f
             LEFT JOIN users u ON u.id = f.user_id
             LEFT JOIN changelogs c ON c.id = f.suggestion_changelog_id
             WHERE f.id = :id
               AND f.parent_id IS NULL
               AND f.type = 'suggestion'
             LIMIT 1"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    private function pageInfo(int $page, int $limit, int $total): array
    {
        $totalPages = max(1, (int) ceil($total / max(1, $limit)));
        return [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'totalPages' => $totalPages,
            'hasMore' => $page < $totalPages,
        ];
    }
}
