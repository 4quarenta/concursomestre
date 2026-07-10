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
 * Repositorio do dominio de filtros/taxonomias.
 *
 * @since 1.0.0
 */
class FiltersRepository
{
    private PDO $db;
    private bool $schemaChecked = false;

    /**
     * Inicializa o repository com a conexao do banco.
     *
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    private function ensureSchema(): void
    {
        if ($this->schemaChecked) {
            return;
        }

        $this->schemaChecked = true;

        try {
            $this->createBaseTable();
            $this->ensureColumnExists('description', "description TEXT NULL AFTER parent_id");
            $this->ensureColumnExists('website', "website VARCHAR(255) NULL AFTER description");
            $this->ensureColumnExists('meta_materia', "meta_materia TINYINT(1) NOT NULL DEFAULT 0 AFTER website");
            $this->ensureColumnExists('taxonomy_level', "taxonomy_level VARCHAR(20) NULL AFTER meta_materia");
            $this->ensureColumnExists('meta_carreira', "meta_carreira TINYINT(1) NOT NULL DEFAULT 0 AFTER taxonomy_level");
        } catch (Throwable $exception) {
            error_log('[filters_repository_schema] ' . $exception->getMessage());
        }
    }

    private function createBaseTable(): void
    {
        $this->db->exec("
            CREATE TABLE IF NOT EXISTS filters (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type ENUM('banca', 'orgao', 'cargo', 'assunto', 'ano', 'carreira', 'area', 'nivel', 'tipo_prova', 'modalidade') NOT NULL,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL,
                parent_id INT DEFAULT NULL,
                description TEXT NULL,
                website VARCHAR(255) NULL,
                meta_materia TINYINT(1) NOT NULL DEFAULT 0,
                taxonomy_level VARCHAR(20) NULL,
                meta_carreira TINYINT(1) NOT NULL DEFAULT 0,
                UNIQUE KEY unique_type_slug (type, slug),
                INDEX idx_type (type),
                INDEX idx_parent_id (parent_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    private function ensureColumnExists(string $columnName, string $definition): void
    {
        $stmt = $this->db->prepare("SHOW COLUMNS FROM filters LIKE :column_name");
        $stmt->execute([':column_name' => $columnName]);

        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
            $this->db->exec("ALTER TABLE filters ADD COLUMN {$definition}");
        }
    }

    /**
     * Carrega todas as taxonomias cadastradas.
     *
     * @since 1.0.0
     */
    public function fetchAll(): array
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare("
            SELECT id, type, name, slug, parent_id, description, website, meta_materia, taxonomy_level, meta_carreira
            FROM filters
            ORDER BY name
        ");
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Verifica se o slug ja existe, ignorando um id opcional.
     *
     * @since 1.0.0
     */
    public function slugExists(string $slug, ?int $exceptId = null): bool
    {
        $this->ensureSchema();
        $query = 'SELECT id FROM filters WHERE slug = :slug';
        if ($exceptId !== null) {
            $query .= ' AND id != :id';
        }

        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':slug', $slug);
        if ($exceptId !== null) {
            $stmt->bindValue(':id', $exceptId, PDO::PARAM_INT);
        }
        $stmt->execute();

        return (bool) $stmt->fetch();
    }

    public function fetchById(int $id): ?array
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare("
            SELECT id, type, name, slug, parent_id, description, website, meta_materia, taxonomy_level, meta_carreira
            FROM filters
            WHERE id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Atualiza um filtro existente.
     *
     * @since 1.0.0
     */
    public function update(array $payload): void
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare("
            UPDATE filters
            SET type = :type,
                name = :name,
                slug = :slug,
                parent_id = :parent_id,
                description = :description,
                website = :website,
                meta_materia = :meta_materia,
                taxonomy_level = :taxonomy_level,
                meta_carreira = :meta_carreira
            WHERE id = :id
        ");
        $stmt->execute([
            ':type' => $payload['type'],
            ':name' => $payload['name'],
            ':slug' => $payload['slug'],
            ':parent_id' => $payload['parent_id'],
            ':description' => $payload['description'],
            ':website' => $payload['website'],
            ':meta_materia' => $payload['meta_materia'],
            ':taxonomy_level' => $payload['taxonomy_level'],
            ':meta_carreira' => $payload['meta_carreira'],
            ':id' => $payload['id'],
        ]);
    }

    /**
     * Cria um filtro novo.
     *
     * @since 1.0.0
     */
    public function create(array $payload): int
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare("
            INSERT INTO filters (type, name, slug, parent_id, description, website, meta_materia, taxonomy_level, meta_carreira)
            VALUES (:type, :name, :slug, :parent_id, :description, :website, :meta_materia, :taxonomy_level, :meta_carreira)
        ");
        $stmt->execute([
            ':type' => $payload['type'],
            ':name' => $payload['name'],
            ':slug' => $payload['slug'],
            ':parent_id' => $payload['parent_id'],
            ':description' => $payload['description'],
            ':website' => $payload['website'],
            ':meta_materia' => $payload['meta_materia'],
            ':taxonomy_level' => $payload['taxonomy_level'],
            ':meta_carreira' => $payload['meta_carreira'],
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Exclui um filtro pelo id.
     *
     * @since 1.0.0
     */
    public function delete(int $id): void
    {
        $this->ensureSchema();
        $stmt = $this->db->prepare('DELETE FROM filters WHERE id = :id');
        $stmt->execute([':id' => $id]);
    }
}
