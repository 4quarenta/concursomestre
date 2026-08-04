<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*/

declare(strict_types=1);

final class AdminFilesRepository
{
    public function __construct(private PDO $db)
    {
    }

    /** @return array{items:array<int,array<string,mixed>>,total:int} */
    public function list(array $filters): array
    {
        $sources = [
            "SELECT CONCAT('question_asset:', qa.id) id, 'question_asset' source_type,
                    qa.asset_type file_type, COALESCE(NULLIF(qa.public_url, ''), qa.storage_path) file_ref,
                    COALESCE(NULLIF(qa.alt_text, ''), NULLIF(qa.caption, ''), CONCAT('Asset #', qa.id)) name,
                    NULL mime_type, NULL size_bytes, qa.created_at,
                    CASE WHEN qa.question_id IS NOT NULL OR qa.option_id IS NOT NULL THEN 'question' ELSE 'context' END owner_type,
                    COALESCE(qa.question_id, qo.question_id, qa.context_id) owner_id, 1 linked, 0 deletable
             FROM question_assets qa
             LEFT JOIN question_options qo ON qo.id = qa.option_id
             WHERE COALESCE(NULLIF(qa.public_url, ''), NULLIF(qa.storage_path, '')) IS NOT NULL",
            "SELECT CONCAT('exam_file:', pa.id), 'exam_file',
                    CASE WHEN LOWER(pa.mime_type) = 'application/pdf' OR LOWER(pa.caminho) LIKE '%.pdf%' THEN 'pdf' ELSE 'file' END,
                    pa.caminho, pa.nome_original, pa.mime_type, pa.tamanho, pa.created_at,
                    'exam', pa.prova_id, 1, 0
             FROM prova_arquivos pa WHERE pa.archived_at IS NULL",
            "SELECT CONCAT('material_upload:', mu.id), 'material_upload',
                    CASE WHEN LOWER(mu.mime_type) = 'application/pdf' THEN 'pdf' WHEN LOWER(mu.mime_type) LIKE 'image/%' THEN 'image' ELSE 'file' END,
                    mu.storage_key, SUBSTRING_INDEX(mu.storage_key, '/', -1), mu.mime_type, mu.size_bytes, mu.created_at,
                    'material', mu.attached_material_id, CASE WHEN mu.attached_material_id IS NULL THEN 0 ELSE 1 END,
                    CASE WHEN mu.attached_material_id IS NULL AND mu.status = 'pending' THEN 1 ELSE 0 END
             FROM material_uploads mu",
            "SELECT CONCAT('profile_photo:', u.id), 'profile_photo', 'image',
                    u.photo_url, CONCAT('Foto de perfil - ', u.name), NULL, NULL, u.updated_at,
                    'user', u.id, 1, 0
             FROM users u WHERE NULLIF(u.photo_url, '') IS NOT NULL",
            "SELECT CONCAT('taxonomy_asset:', f.id), 'taxonomy_asset', 'image',
                    f.asset_url, CONCAT('Taxonomia - ', f.name), NULL, NULL, NULL,
                    'taxonomy', f.id, 1, 0
             FROM filters f WHERE NULLIF(f.asset_url, '') IS NOT NULL",
            "SELECT CONCAT('material_cover:', m.id), 'material_cover', 'image',
                    m.cover_url, CONCAT('Capa - ', m.title), NULL, NULL, m.created_at,
                    'material', m.id, 1, 0
             FROM materials m WHERE NULLIF(m.cover_url, '') IS NOT NULL",
            "SELECT CONCAT('material_preview:', m.id), 'material_preview',
                    CASE WHEN LOWER(m.preview_url) LIKE '%.pdf%' THEN 'pdf' ELSE 'file' END,
                    m.preview_url, CONCAT('Previa - ', m.title), NULL, NULL, m.created_at,
                    'material', m.id, 1, 0
             FROM materials m WHERE NULLIF(m.preview_url, '') IS NOT NULL",
            "SELECT CONCAT('blog_cover:', ba.id), 'blog_cover', 'image',
                    ba.cover_image_url, CONCAT('Capa do artigo - ', ba.title), NULL, NULL, ba.created_at,
                    'blog_article', ba.id, 1, 0
             FROM blog_articles ba WHERE ba.deleted_at IS NULL AND NULLIF(ba.cover_image_url, '') IS NOT NULL",
            "SELECT CONCAT('blog_category:', bc.id), 'blog_category', 'image',
                    bc.image_url, CONCAT('Categoria do blog - ', bc.name), NULL, NULL, bc.created_at,
                    'blog_category', bc.id, 1, 0
             FROM blog_categories bc WHERE NULLIF(bc.image_url, '') IS NOT NULL",
        ];
        $union = implode(' UNION ALL ', $sources);
        $where = [];
        $params = [];
        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $where[] = '(inventory.name LIKE :search_name OR inventory.file_ref LIKE :search_ref)';
            $params[':search_name'] = '%' . $search . '%';
            $params[':search_ref'] = '%' . $search . '%';
        }
        $type = trim((string) ($filters['type'] ?? ''));
        if (in_array($type, ['image', 'pdf', 'file'], true)) {
            $where[] = 'inventory.file_type = :file_type';
            $params[':file_type'] = $type;
        }
        $source = trim((string) ($filters['source'] ?? ''));
        if (in_array($source, [
            'question_asset', 'exam_file', 'material_upload', 'profile_photo',
            'taxonomy_asset', 'material_cover', 'material_preview', 'blog_cover', 'blog_category',
        ], true)) {
            $where[] = 'inventory.source_type = :source_type';
            $params[':source_type'] = $source;
        }
        $link = trim((string) ($filters['link'] ?? ''));
        if ($link === 'linked' || $link === 'orphan') {
            $where[] = 'inventory.linked = :linked';
            $params[':linked'] = $link === 'linked' ? 1 : 0;
        }
        $whereSql = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);
        $base = " FROM ({$union}) inventory{$whereSql}";

        $count = $this->db->prepare('SELECT COUNT(*)' . $base);
        $count->execute($params);
        $total = (int) $count->fetchColumn();

        $limit = max(1, min(100, (int) ($filters['limit'] ?? 30)));
        $offset = max(0, (int) ($filters['offset'] ?? 0));
        $statement = $this->db->prepare('SELECT inventory.*' . $base . ' ORDER BY inventory.created_at DESC, inventory.id DESC LIMIT :limit OFFSET :offset');
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
        $statement->execute();
        return ['items' => $statement->fetchAll(PDO::FETCH_ASSOC) ?: [], 'total' => $total];
    }

    public function findDeletableMaterialUpload(int $id): ?array
    {
        $statement = $this->db->prepare(
            "SELECT id, storage_key FROM material_uploads
             WHERE id = :id AND attached_material_id IS NULL AND status = 'pending' LIMIT 1"
        );
        $statement->execute([':id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function deleteMaterialUpload(int $id): bool
    {
        $statement = $this->db->prepare(
            "DELETE FROM material_uploads
             WHERE id = :id AND attached_material_id IS NULL AND status = 'pending'"
        );
        $statement->execute([':id' => $id]);
        return $statement->rowCount() === 1;
    }
}
