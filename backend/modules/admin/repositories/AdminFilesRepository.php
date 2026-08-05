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
                    COALESCE(qa.question_id, qo.question_id, qa.context_id) owner_id,
                    CASE
                        WHEN COALESCE(qa.question_id, qo.question_id) IS NOT NULL THEN CONCAT('Questao #', COALESCE(qa.question_id, qo.question_id))
                        ELSE CONCAT('Contexto #', qa.context_id)
                    END owner_label,
                    1 linked, 1 deletable
             FROM question_assets qa
             LEFT JOIN question_options qo ON qo.id = qa.option_id
             WHERE COALESCE(NULLIF(qa.public_url, ''), NULLIF(qa.storage_path, '')) IS NOT NULL",
            "SELECT CONCAT('exam_file:', pa.id), 'exam_file',
                    CASE WHEN LOWER(pa.mime_type) = 'application/pdf' OR LOWER(pa.caminho) LIKE '%.pdf%' THEN 'pdf' ELSE 'file' END,
                    pa.caminho, pa.nome_original, pa.mime_type, pa.tamanho, pa.created_at,
                    'exam', pa.prova_id, COALESCE(NULLIF(p.nome, ''), CONCAT('Prova #', pa.prova_id)), 1, 1
             FROM prova_arquivos pa
             INNER JOIN provas p ON p.id = pa.prova_id
             WHERE pa.archived_at IS NULL",
            "SELECT CONCAT('material_upload:', mu.id), 'material_upload',
                    CASE WHEN LOWER(mu.mime_type) = 'application/pdf' THEN 'pdf' WHEN LOWER(mu.mime_type) LIKE 'image/%' THEN 'image' ELSE 'file' END,
                    mu.storage_key, SUBSTRING_INDEX(mu.storage_key, '/', -1), mu.mime_type, mu.size_bytes, mu.created_at,
                    'material', mu.attached_material_id,
                    COALESCE(NULLIF(m.title, ''), CASE WHEN mu.attached_material_id IS NULL THEN 'Upload sem material' ELSE CONCAT('Material #', mu.attached_material_id) END),
                    CASE WHEN mu.attached_material_id IS NULL THEN 0 ELSE 1 END, 1
             FROM material_uploads mu
             LEFT JOIN materials m ON m.id = mu.attached_material_id",
            "SELECT CONCAT('profile_photo:', u.id), 'profile_photo', 'image',
                    u.photo_url, CONCAT('Foto de perfil - ', u.name), NULL, NULL, u.updated_at,
                    'user', u.id, u.name, 1, 1
             FROM users u WHERE NULLIF(u.photo_url, '') IS NOT NULL",
            "SELECT CONCAT('taxonomy_asset:', f.id), 'taxonomy_asset', 'image',
                    f.asset_url, CONCAT('Taxonomia - ', f.name), NULL, NULL, NULL,
                    'taxonomy', f.id, f.name, 1, 1
             FROM filters f WHERE NULLIF(f.asset_url, '') IS NOT NULL",
            "SELECT CONCAT('material_cover:', m.id), 'material_cover', 'image',
                    m.cover_url, CONCAT('Capa - ', m.title), NULL, NULL, m.created_at,
                    'material', m.id, m.title, 1, 1
             FROM materials m WHERE NULLIF(m.cover_url, '') IS NOT NULL",
            "SELECT CONCAT('material_preview:', m.id), 'material_preview',
                    CASE WHEN LOWER(m.preview_url) LIKE '%.pdf%' THEN 'pdf' ELSE 'file' END,
                    m.preview_url, CONCAT('Previa - ', m.title), NULL, NULL, m.created_at,
                    'material', m.id, m.title, 1, 1
             FROM materials m WHERE NULLIF(m.preview_url, '') IS NOT NULL",
            "SELECT CONCAT('blog_cover:', ba.id), 'blog_cover', 'image',
                    ba.cover_image_url, CONCAT('Capa do artigo - ', ba.title), NULL, NULL, ba.created_at,
                    'blog_article', ba.id, ba.title, 1, 1
             FROM blog_articles ba WHERE ba.deleted_at IS NULL AND NULLIF(ba.cover_image_url, '') IS NOT NULL",
            "SELECT CONCAT('blog_category:', bc.id), 'blog_category', 'image',
                    bc.image_url, CONCAT('Categoria do blog - ', bc.name), NULL, NULL, bc.created_at,
                    'blog_category', bc.id, bc.name, 1, 1
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

    /** @return array{file_ref:string}|null */
    public function removeFileReference(string $sourceType, string $ownerKey): ?array
    {
        $definition = $this->deletionDefinition($sourceType);
        if ($definition === null) {
            return null;
        }

        $this->db->beginTransaction();
        try {
            $select = $this->db->prepare($definition['select']);
            $select->execute([':id' => $ownerKey]);
            $row = $select->fetch(PDO::FETCH_ASSOC);
            if (!is_array($row)) {
                $this->db->rollBack();
                return null;
            }

            $remove = $this->db->prepare($definition['remove']);
            $remove->execute([':id' => $ownerKey]);
            if ($remove->rowCount() !== 1) {
                throw new RuntimeException('O arquivo foi alterado durante a exclusao.');
            }
            $this->db->commit();
            return ['file_ref' => (string) $row['file_ref']];
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    public function hasActiveReference(string $fileReference): bool
    {
        $statement = $this->db->prepare(
            "SELECT 1 FROM (
                SELECT qa.id FROM question_assets qa WHERE qa.public_url = :ref_qa_public OR qa.storage_path = :ref_qa_storage
                UNION ALL SELECT pa.id FROM prova_arquivos pa WHERE pa.archived_at IS NULL AND pa.caminho = :ref_exam
                UNION ALL SELECT mu.id FROM material_uploads mu WHERE mu.storage_key = :ref_upload
                UNION ALL SELECT u.id FROM users u WHERE u.photo_url = :ref_profile
                UNION ALL SELECT f.id FROM filters f WHERE f.asset_url = :ref_taxonomy
                UNION ALL SELECT m.id FROM materials m WHERE m.cover_url = :ref_cover OR m.preview_url = :ref_preview
                UNION ALL SELECT ba.id FROM blog_articles ba WHERE ba.deleted_at IS NULL AND ba.cover_image_url = :ref_blog
                UNION ALL SELECT bc.id FROM blog_categories bc WHERE bc.image_url = :ref_blog_category
             ) active_references LIMIT 1"
        );
        $statement->execute([
            ':ref_qa_public' => $fileReference,
            ':ref_qa_storage' => $fileReference,
            ':ref_exam' => $fileReference,
            ':ref_upload' => $fileReference,
            ':ref_profile' => $fileReference,
            ':ref_taxonomy' => $fileReference,
            ':ref_cover' => $fileReference,
            ':ref_preview' => $fileReference,
            ':ref_blog' => $fileReference,
            ':ref_blog_category' => $fileReference,
        ]);
        return $statement->fetchColumn() !== false;
    }

    /** @return array{select:string,remove:string}|null */
    private function deletionDefinition(string $sourceType): ?array
    {
        return match ($sourceType) {
            'question_asset' => [
                'select' => "SELECT COALESCE(NULLIF(public_url, ''), storage_path) file_ref FROM question_assets WHERE id = :id FOR UPDATE",
                'remove' => 'DELETE FROM question_assets WHERE id = :id',
            ],
            'exam_file' => [
                'select' => 'SELECT caminho file_ref FROM prova_arquivos WHERE id = :id AND archived_at IS NULL FOR UPDATE',
                'remove' => "UPDATE prova_arquivos SET archived_at = NOW(), visibility_status = 'archived' WHERE id = :id AND archived_at IS NULL",
            ],
            'material_upload' => [
                'select' => 'SELECT storage_key file_ref FROM material_uploads WHERE id = :id FOR UPDATE',
                'remove' => 'DELETE FROM material_uploads WHERE id = :id',
            ],
            'profile_photo' => [
                'select' => "SELECT photo_url file_ref FROM users WHERE id = :id AND NULLIF(photo_url, '') IS NOT NULL FOR UPDATE",
                'remove' => 'UPDATE users SET photo_url = NULL, updated_at = NOW() WHERE id = :id',
            ],
            'taxonomy_asset' => [
                'select' => "SELECT asset_url file_ref FROM filters WHERE id = :id AND NULLIF(asset_url, '') IS NOT NULL FOR UPDATE",
                'remove' => 'UPDATE filters SET asset_url = NULL WHERE id = :id',
            ],
            'material_cover' => [
                'select' => "SELECT cover_url file_ref FROM materials WHERE id = :id AND NULLIF(cover_url, '') IS NOT NULL FOR UPDATE",
                'remove' => 'UPDATE materials SET cover_url = NULL WHERE id = :id',
            ],
            'material_preview' => [
                'select' => "SELECT preview_url file_ref FROM materials WHERE id = :id AND NULLIF(preview_url, '') IS NOT NULL FOR UPDATE",
                'remove' => 'UPDATE materials SET preview_url = NULL WHERE id = :id',
            ],
            'blog_cover' => [
                'select' => "SELECT cover_image_url file_ref FROM blog_articles WHERE id = :id AND deleted_at IS NULL AND NULLIF(cover_image_url, '') IS NOT NULL FOR UPDATE",
                'remove' => "UPDATE blog_articles SET cover_image_url = '', updated_at = NOW() WHERE id = :id",
            ],
            'blog_category' => [
                'select' => "SELECT image_url file_ref FROM blog_categories WHERE id = :id AND NULLIF(image_url, '') IS NOT NULL FOR UPDATE",
                'remove' => 'UPDATE blog_categories SET image_url = NULL, updated_at = NOW() WHERE id = :id',
            ],
            default => null,
        };
    }
}
